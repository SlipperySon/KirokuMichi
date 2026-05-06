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
- **PDF (Parallel Mode)**: Upload multiple PDFs together (e.g., Genki textbook + workbook)
  - Text extracted client-side via `pdfjs-dist` from all PDFs in order
  - Optional page image rendering (up to 8 pages per PDF → JPEG base64) for vision-capable models
  - AI processes all PDFs together in single call with cross-document context
- **AI extraction** via strict `EXTRACTION_SYSTEM_PROMPT` — single call returns `{ vocab, grammar, lessons }`
  - Assumption: user knows all hiragana & katakana (no kana drills)
  - **Genki 1 v3 textbook/workbook special handling**: Automatic furigana elimination over kanji
    - User can hover or highlight kanji to reveal furigana (JavaScript interception)
    - Detected via filename pattern or user selection in UI
- **Preview panel**: three collapsible sections (Vocab / Grammar / Lessons), per-category import toggles
- **Import routing**:
  - `vocab` → `cards` + `card_states` (immediately in SRS queue, `source='user'`)
  - `grammar` → `grammar_points` (`source='user'`, appears in Grammar Review)
  - `lessons` → `learning_content` (appears in `/learn`)
- Import summary: tile count per category

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

1. **Weekly goals widget** — small, self-contained, high user value
2. **Test content import end-to-end** with a real PDF textbook to validate extraction prompt quality
3. **ScenarioMode v2** — AI conversation (requires UX decision first)
4. **AI learning path** — lowest priority, most design-heavy
