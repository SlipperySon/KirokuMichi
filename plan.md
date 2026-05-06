# KirokuMichi — Current State & Active Roadmap

Last updated: 2026-05-06

---

## What Is Built (Complete)

### Core SRS
- SQLite via sql.js, persisted to localStorage as base64 snapshot
- FSRS + SM2 schedulers, switchable in Settings
- `card_states` with due dates, stability, difficulty, lapses, leech detection
- Session tracking (`sessions` table, `started_at` / `ended_at` / `cards_reviewed`)
- Session recovery (crash-safe resume via `sessionRecovery.ts`)
- Mistake logging (`mistake_logs` table)

### Study Dashboard (`/study`)
- Due count + new count (capped by daily limit)
- Daily card limit stepper (0–100)
- Streak heatmap — blue = vocab only, purple = grammar only, green = both
- Weak-point panel (`WeakPointPanel.tsx`)
- Two review buttons: "Review Words" (indigo) and "Study Grammar" (purple)
- Session recovery modal on load

### Word Review (`/study/review`)
- Interleaved queue: 1 new card per 5 due cards
- Filtered to vocabulary / kanji / hiragana / katakana types
- CardReading → CardMeaning flow
- Audio playback via `useCardAudio.ts`: resolves `idb:` prefix keys from IndexedDB (`audioStore.ts`), no TTS fallback on vocab cards (Anki cards have real MP3s)
- Exit button with confirm dialog

### Grammar Review (`/study/grammar`)
- Pulls from `grammar_points` table, ordered by `times_seen ASC NULLS FIRST`
- Progress tracked per-user in `grammar_progress` table (UPSERT on each view)
- `GrammarCard`: front = pattern + meaning + JLPT badge; reveal = explanation + examples
- Session logged with `mode = 'grammar'` for heatmap split

### Anki Import
- `.apkg` → JSZip → parse SQLite → extract cards + audio
- Audio bytes stored in IndexedDB (`audioStore.ts`) under key `idb:<filename>`
- `cards.audio_url` stores `idb:<filename>` — resolved to fresh Blob URL at play time
- `source = 'user'` on all imported cards

### AI Infrastructure
- Express proxy at `server/index.ts` — `POST /api/ai/complete`
- Supports Anthropic, OpenAI, OpenRouter, Ollama
- Multimodal messages (image content blocks) supported for Anthropic + OpenAI + OpenRouter
- Session token auth (`POST /api/session`, bootstrapped in `App.tsx`)
- Two model slots: `fastModel` (default: `claude-haiku-4-5-20251001`) + `powerfulModel` (default: `claude-sonnet-4-6`)
- `ClientAIProvider` in `app/src/ai/aiProvider.ts`

### Content Import (`/practice` → Upload Content tab)
- **Anki `.apkg`**: full import with audio
- **Paste text or upload file** (`.pdf`, `.txt`, `.md`, `.csv`)
- **PDF (Parallel Mode)**: Upload multiple PDFs together (e.g., textbook + workbook)
  - Text extracted client-side via `pdfjs-dist` from all PDFs in order
  - Optional page image rendering (up to 8 pages per PDF → JPEG base64) for vision-capable models
  - AI processes all PDFs together in single call with cross-document context
- **AI extraction** via strict `EXTRACTION_SYSTEM_PROMPT` — single call returns `{ vocab, grammar, lessons }`
  - Assumption: user knows all hiragana & katakana (no kana drills)
  - **Structured textbook path handling (primary)**: Automatic furigana elimination over kanji where applicable
    - User can hover or highlight kanji to reveal furigana (JavaScript interception)
    - Detected via filename pattern or user selection in UI
    - Primary path set: Genki 1, Genki 2, Quartet 1, Quartet 2, Tobira, Shin Kanzen Master
- **Preview panel**: three collapsible sections (Vocab / Grammar / Lessons), per-category import toggles
- **Import routing**:
  - `vocab` → `cards` + `card_states` (immediately in SRS queue, `source='user'`)
  - `grammar` → `grammar_points` (`source='user'`, appears in Grammar Review)
  - `lessons` → `learning_content` (appears in `/learn`)
- Import summary: tile count per category

#### Known Textbooks Import UX (proposed)
- Add a dedicated **Known Textbooks** panel in Upload Content, separate from generic PDF/text import
- Layout:
  - Large drop zone: textbook/workbook PDFs
  - Smaller side drop zone: corresponding Anki decks for those textbooks
- Known textbook path targets: Genki 1/2, Quartet 1/2, Tobira, Shin Kanzen Master
- Keep generic import unchanged for all non-mapped content
- In `/learn`, add **Textbook Learning** subsection:
  - Lesson-by-lesson progression for matched textbook sets
  - Integrated extraction actions (vocab, phrases, grammar)
  - Unlock-to-deck actions for mapped textbook lessons
  - Personal notes on unlocked/added cards

#### File/Deck Identification Strategy (proposed)
- Use hybrid matching rather than strict file naming requirements:
  - Auto-detect via filename heuristics + title page/first-page text extraction
  - Auto-match Anki decks via normalized names + aliases
  - Show user confirmation step when detection confidence is low or ambiguous
- User can override detected textbook/deck link in one click; overrides are stored for future imports
- Do not require manual renaming as a hard prerequisite

### Word Selection, Deck Import & Unlock Flows (LearningMode)
- Users can **select/highlight words in lessons** and add them to any deck
- **Textbook pair unlock flow (generalized)**: If imported lesson content matches a known textbook/deck pair:
  - Show "Unlock words from this lesson" button for that lesson
  - Route unlocked words to matching imported deck (if present) or let user choose/create target deck
  - Applies to Genki and any future textbook pair mappings (not Genki-exclusive)
  - `lesson_vocabulary` table tracks: lesson_id → vocab_id → unlock status per user
- **General flow**: Highlight word in lesson → "Add to [Deck]" → confirm → word routes to SRS queue in chosen deck
- **Personalized notes**: Users can attach private notes to added/unlocked cards for memory cues, mnemonics, and context
- Works with all lesson types (textbook imports, custom imports, pasted text)

#### Textbook Pair Mapping Schema (proposed)
- Add a lightweight mapping record (config table or static JSON seed) for textbook-specific unlock behavior:
  - `textbook_key` (e.g., `genki_1`, `quartet_2`)
  - `textbook_label` (user-facing name, e.g., `Genki 1`, `Quartet 2`)
  - `match_rules` (filename keywords, optional user-selected textbook tag)
  - `default_deck_name` (e.g., `Genki 1`)
  - `deck_match_rules` (imported Anki deck name aliases / normalized name)
  - `unlock_label` (button text override, optional)
  - `enabled` (feature flag per textbook pair)
- Runtime flow:
  - Identify imported lesson's `textbook_key` from `match_rules`
  - Resolve target deck by `deck_match_rules` first, fallback to `default_deck_name` create/select prompt
  - Render unlock CTA only when mapping exists and lesson has mapped vocabulary
  - Persist unlock events in `lesson_vocabulary` and apply optional per-card personal note
- Initial textbook mappings:
  - Keys: `genki_1`, `genki_2`, `quartet_1`, `quartet_2`, `tobira`, `shin_kanzen_master`
  - Labels: `Genki 1`, `Genki 2`, `Quartet 1`, `Quartet 2`, `Tobira`, `Shin Kanzen Master`
- Follow shared scraping/extraction patterns across these books where possible (same pipeline, mapping-specific rules only)
- Audio reading support for these books is explicitly deferred to a later phase
- For non-mapped PDFs/content imports: keep generic extraction path and prompt user where to route content (deck/grammar/lessons)
- Extend by adding rows/entries only (no new logic paths)

### AI Tutor Structured Lesson Planning
- Tutor should generate **structured lesson plans** from whatever content the user provides (not only textbook-path content)
- Textbook path is the primary structured path, but tutor planning must support mixed/custom sources
- Planned output format: lesson goals, vocab targets, grammar targets, exercises, and review checkpoints

### Other Sections (Built)
- **TutorChat** (`/practice`): AI chat with tab switcher (Tutor | Upload Content)
- **LearningMode** (`/learn`): sequential reader for `learning_content` table — text_passage, word_list, grammar_point, sentence_pair, dialogue_script renderers
- **ScenarioMode** (`/scenarios`): A↔B dialogue player with browser TTS (`speechSynthesis`, lang=ja-JP, rate=0.85)
- **JLPTSection** (`/study/jlpt`): JLPT level content browser
- **ImmersionMode** (`/immersion`): schedule + timer gated on toggle
- **MyContent** (`/my-content`): browse/manage user content
- **Settings** (`/settings`): model slots, API key, daily limit, scheduler algorithm, theme

### DB Schema (Current)
Tables: `users`, `cards`, `card_states`, `sessions`, `questions`, `mistake_logs`, `grammar_points`, `test_sessions`, `test_responses`, `weak_point_cache`, `grammar_progress`, `learning_content`, `scenarios`

Idempotent migrations run on every DB load (new + restored): `grammar_progress` CREATE IF NOT EXISTS, ALTER TABLE source columns on `cards` / `grammar_points` / `questions`.

---

## Active Work In Progress

### Content Import — Extraction Quality
The extraction prompt and pipeline are complete. The current open question from the user is ensuring extracted content is sorted into the right sections and accessible. The three destinations are working:
- Vocab → SRS deck (appears in "Review Words" count on dashboard)
- Grammar → Grammar Review queue (appears in "Study Grammar" count)
- Lessons → Learn section (`/learn`)

**No structural work needed here** — routing is implemented. What may need improvement is prompt quality/testing with real textbook PDFs.

---

## Pending / Not Yet Built

### Weekly Goals Widget (StudyDashboard)
- Read `jlptTarget` + `goalDate` from Zustand store
- Calculate cards/grammar needed per week to hit goal
- Show on StudyDashboard: "X cards this week · Y needed for goal"
- Track weekly sessions total from `sessions` table (`started_at >= date('now', 'weekday 1', '-7 days')`)

### ScenarioMode v2 — Live AI Conversation
- Free-form Japanese conversation with AI playing a character
- Inline grammar/mistake corrections mid-conversation
- Session summary: mistakes + patterns to review
- **Blocked on**: deciding UX (separate route vs modal overlay on `/scenarios`)

### AI Learning Path (CEFR-aligned)
- AI generates ordered topic sequence from user content
- Stored as JSON, visualised as a path/roadmap
- Should prioritize the textbook path when matched, then blend in user custom content
- Low priority — needs substantial UX design first

---

## Phase 5: Anki-like Review System (Planned)

**Scope:** Full-featured SRS with deck hierarchy, filtering, suspend/bury, card browser, cram mode, stats/graphs, custom fields, and card templates.

**Effort:** ~36-50 hours (3-4 weeks @ 10h/week, or 1-2 weeks full-time)

**Approach:** Read Anki open source (AGPL v3), extract detailed specification via black-boxing, then reimplement cleanly in TypeScript/React without copying code.

**Features in order:**
1. **Subdeck hierarchy** (6-8h) — new `decks` table, tree UI, card routing by deck_id
2. **Suspend/bury mechanics** (2-3h) — `suspended_at` / `buried_until` columns, queue filtering
3. **Filtered decks** (3-4h) — query builder, saved filters, dynamic card sets (depends on decks)
4. **Card browser** (6-8h) — sortable/filterable table, bulk edit, modal UI (depends on decks)
5. **Cram mode** (2-3h) — session mode flag, bypass SRS scheduling
6. **Stats/graphs** (4-6h) — daily review count, card ease, time analysis, Chart.js visualization
7. **Custom fields** (4-5h) — `card_fields` JSON, template renderer, form builder
8. **Card templates** (3-4h) — HTML/CSS templates, handlebars rendering
9. **DB backups** (1-2h) — export/import full snapshot (manual button)
10. **Testing & polish** (5-7h) — E2E testing, UI responsive design

**Critical path:** Subdeck hierarchy → Filtered decks, Card browser, Cram mode (in parallel) → Stats → Templates + Custom fields

---

## Architecture Decisions (Locked)

| Decision | Choice | Reason |
|----------|--------|--------|
| Content storage | SQLite in localStorage | Browser-native, no server persistence needed |
| Audio persistence | IndexedDB (`audioStore.ts`) with `idb:` key prefix | Blob URLs die on page reload |
| API keys | Server-side only, proxied via Express | Never exposed to client |
| Base content | Zero on install — user imports everything | Avoids bundling large data files |
| TTS | Only in ScenarioMode (`speechSynthesis`) | Vocab cards have real audio; grammar cards are text-only |
| Grammar tracking | `grammar_progress` table (UPSERT) | Lightweight, no full SRS needed for grammar points |
| Heatmap colours | Blue=vocab, purple=grammar, green=both | Visually separates study modes |

---

## File Map (Key Files)

```
app/src/
  study/
    StudyDashboard.tsx     — main dashboard, streak, counts, review buttons
    ReviewSession.tsx      — word review session
    GrammarReview.tsx      — grammar flashcard loop
    Heatmap.tsx            — tri-colour activity heatmap
    WeakPointPanel.tsx     — weak card analysis
    LearningMode.tsx       — sequential lesson reader
    ScenarioMode.tsx       — A↔B dialogue player
    TutorChat.tsx          — AI chat + upload tab switcher
    ContentUpload.tsx      — import pipeline (Anki + AI extraction)
    MyContent.tsx          — user content management
    JLPTSection.tsx        — JLPT level browser
  srs/
    srsService.ts          — all SRS DB operations
    ankiImport.ts          — .apkg importer
    audioStore.ts          — IndexedDB audio persistence
    sessionRecovery.ts     — crash-safe session resume
  db/
    sqlite.ts              — sql.js wrapper, schema init, idempotent migrations
  ai/
    aiProvider.ts          — ClientAIProvider (proxies to Express)
  core/
    providers.ts           — interfaces (StorageProvider, SchedulerProvider, AIProvider)
    scheduler.ts           — FSRS + SM2 implementations
  store/
    index.ts               — Zustand store (settings, activeUserId, onboardingComplete)
  components/
    Navigation.tsx
    OfflineBanner.tsx
  pages/
    Settings.tsx
  hooks/
    useCardAudio.ts        — audio resolution hook (idb: → Blob URL)
    useTheme.ts
server/
  index.ts                 — Express proxy (AI, session tokens)
```

---

## Next Steps (Priority Order)

1. **Textbook-path mapping rollout** — Genki 1/2, Quartet 1/2, Tobira, Shin Kanzen Master
2. **Test content import end-to-end** for mapped textbooks plus fallback handling for non-mapped PDFs
3. **Structured AI tutor lesson planning** from user-provided content (textbook and non-textbook)
4. **ScenarioMode v2** — AI conversation (requires UX decision first)
