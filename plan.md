# KirokuMichi — Current State & Active Roadmap

Last updated: 2026-05-13 15:15 UTC

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
- Weekly Goals widget: reads `jlptTarget` + `goalDate`, calculates cards/week needed, tracks this week's completed cards from `sessions`, and shows progress toward the target
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
- **Paste text or upload one or more files** (`.pdf`, `.txt`, `.md`, `.csv`)
- **PDF (Parallel Mode)**: Upload multiple PDFs together (e.g., textbook + workbook)
  - Text extracted client-side via `pdfjs-dist` from all uploaded files in picker order for generic text PDFs
  - Scanned PDFs can be OCRed server-side using local macOS Vision OCR
  - Per-file PDF ranges are supported; Genki 1 presets currently use textbook page 14 and workbook page 12
  - Repeated same-file/same-range extractions are cached during the server session to avoid run-to-run variation
  - Optional page image rendering (up to 8 pages per PDF → JPEG base64) for vision-capable models
  - AI processes all uploaded files together in a single call with cross-document context
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

#### Specialized Textbook Pack Strategy (new primary mapped-textbook plan)
- For known textbooks, generic PDF→OCR→AI extraction is now a fallback, not the desired production path.
- Primary plan: generate high-quality structured textbook packs offline, encrypt them in the app, and unlock them only when the user supplies matching source PDFs.
- Dataset scope is Japan Times GENKI 3rd Edition plus QUARTET, covering roughly N5 through N2:
  - Genki I Textbook/Workbook: Lessons 1-12
  - Genki II Textbook/Workbook: Lessons 13-23
  - Genki I & II Answer Key: combined answers plus listening scripts
  - Quartet I Textbook/Workbook/Workbook Answer Key: Lessons 1-6, roughly N3
  - Quartet II Textbook/Workbook/Workbook Answer Key: Lessons 7-12, roughly N2
- Genki 1 v3 is the first target:
  - Full textbook/workbook extraction comes first, including front matter, contents, Reading & Writing, indexes, and support pages.
  - The old textbook page 14 / workbook page 12 starts are only quick generic-import smoke-test presets, not canonical pack boundaries.
  - First proof should produce a canonical Lesson 1 JSON pack from the full-source capture before expanding to the full book.
- Offline/specialized extraction pipeline:
  - Evaluate Apple Vision OCR, PaddleOCR/PP-OCRv5 Japanese+English, and optionally Manga OCR.
  - Prefer PaddleOCR if it improves Japanese+English layout, table, and exercise extraction over Apple Vision.
  - Manga OCR is likely better for manga/immersion assets than textbook pages; do not make it the primary Genki engine unless testing proves otherwise.
  - Convert textbook/workbook pages into canonical JSON: lessons, vocab, grammar, readings/dialogues, workbook references, and furigana mappings.
  - Include answer-key mappings: exercise id → answer-key page/coordinates/ground-truth answer.
  - Include listening-script mappings from answer keys for listening exercises and tutor explanations.
  - Include section-mode metadata when a book has explicit skill divisions, for example Quartet's Reading/Writing/Speaking/Listening sections.
  - Validate generated JSON with schema checks, duplicate checks, coverage checks, and stable output diffs.
- Genki-specific extraction notes:
  - Vocab is listed within each lesson.
  - Kanji comes from the textbook Reading & Writing section in the back.
  - Answer key is a combined Genki I & II source and should be indexed for textbook/workbook answers plus listening scripts.
- Quartet-specific pack notes:
  - Quartet 1 consists of Textbook + Workbook for Lessons 1-6, roughly JLPT N3.
  - Quartet 2 consists of Textbook + Workbook for Lessons 7-12, roughly JLPT N2.
  - Quartet textbooks also rely on a separate supplement / 別冊 (Bessatsu) for vocabulary and kanji lists. The pack pipeline must ingest this as its own file role, not assume all vocab lives inside lesson chapters.
  - Quartet lessons should preserve the 4-skill structure: Reading (読む), Writing (書く), Speaking (話す), Listening (聞く).
  - Textbook content is the AI tutor source of truth: readings, grammar notes (`文型・表現ノート`), and model dialogues.
  - Workbook content should become output/challenge material: drills, true/false questions, sentence construction, grammar practice, and reading comprehension checks.
  - Layout extraction must handle denser pages than Genki: long authentic-style readings, multi-page essays, richer diagrams, and text wrapping around images.
- Tutor/assessment rules:
  - When grading, use answer-key ground truth for the specific exercise id, page, and coordinates.
  - If a user answer is grammatically correct but does not use the lesson target grammar, flag it as correct but off-target.
  - For listening exercises, use answer-key listening scripts to explain dialogue and highlight vocab.
  - Future handwritten workbook checking should compare handwriting against answer-key ground truth, not raw AI vision alone.
- Encrypted pack/unlock model:
  - Ship only encrypted structured JSON packs and non-sensitive metadata.
  - User uploads their own textbook/workbook PDFs locally to prove access.
  - App verifies the files using local fingerprints/signatures, then decrypts/unlocks the relevant pack.
  - Persist unlock status locally per user/device.
  - If verification fails or the edition is ambiguous, fall back to generic PDF import with user confirmation.
- This avoids repeatedly asking DeepSeek to infer textbook structure and gives consistent, curated lesson data for mapped textbooks.

#### CEFR Roadmap Structure (`Structure.xlsx`)
- The workbook defines the curriculum as three parallel source roles:
  - **Core**: the main content spine and grammar engine. These are the authoritative course packs the app should extract first.
  - **Pair**: practical/social practice material paired with the Core stage. This supports output practice, can-do validation, and real-use reinforcement.
  - **In-depth grammar**: deeper explanation material for linguistic logic, nuance, and "why this rule works" support.
- Current stage map:
  - **A1 / Breakthrough**
    - Core: Genki I Textbook, Genki I Workbook, Answer Key
    - Pair: Marugoto A1 Katsudoo (Starter)
    - In-depth grammar: Maynard Strategy P1-2, preliminaries and fundamentals
    - Focus: survival basics, introductions, time/dates, and simple daily interactions
  - **A2 / Elementary**
    - Core: Genki II Textbook, Genki II Workbook, Answer Key
    - Pair: Marugoto A2 Katsudoo (Elementary 2)
    - In-depth grammar: Maynard Strategy P3, the core
    - Focus: routine tasks, personal background, and familiar information exchange
  - **B1 / Threshold**
    - Core: Quartet I Textbook, Quartet I Workbook, Answer Key
    - Pair: Marugoto B1 (Intermediate 1 / Chukyu 1)
    - In-depth grammar: Maynard Strategy P4, expansion
    - Focus: connected text on personal interests, dreams, ambitions, and opinions
  - **B2 / Independent**
    - Core: Quartet II Textbook, Quartet II Workbook, Answer Key
    - Pair: Tobira
    - In-depth grammar: Maynard general reference / linguistic nuance
    - Focus: complex abstract texts and more fluent interaction with native speakers
- Roadmap study rules:
  - Core first: complete the Genki/Quartet grammar chapter to build the structural base.
  - Pair second: use Marugoto A1-B1 or Tobira B2 to see and practice that structure in practical communication or denser reading.
  - In-depth grammar check: use Maynard when a grammar rule feels arbitrary and needs linguistic explanation.
  - Can-do validation: do not advance CEFR rank until the relevant practical tasks are comfortable.
- Data model implication:
  - Source manifest entries now carry `curriculumRole`, `cefrPhase`, `source_series`/`book_key` via `textbookKey`, and source file role.
  - Textbook packs and future roadmap nodes should also carry `cefr_level`, `phase_name`, `source_role`, `source_series`, `book_key`, and optional `can_do_targets`.
  - Existing Genki/Quartet extraction remains the immediate **Core** path. Pair and In-depth grammar sources should be attached after Core pack structure and validation are reliable.
- Current inventory status:
  - `app/tools/textbook-pack/out/source-manifest.json` has no source gaps.
  - Pair sources are present: Marugoto A1, Marugoto A2, Marugoto B1, and Tobira.
  - The Maynard/Yanard in-depth grammar source is present as `maynard_grammar_grammar_reference`; it is a reusable explanation preset layer, not a normal lesson sequence.
  - The only medium-confidence source is the known Genki II workbook file because its filename lacks an explicit workbook marker; prior outline/page checks classify it as Genki II workbook.
- Future post-path expansion:
  - C1 bridge: Authentic Japanese / progressing from intermediate to advanced material.
  - Advanced nuance: Shin Kanzen Master N1.
  - Literacy: Kanji in Context for broader Joyo kanji mastery.
  - End state: native immersion through novels, podcasts, and unfiltered native content.

#### File/Deck Identification Strategy (proposed)
- Use hybrid matching rather than strict file naming requirements:
  - Auto-detect via filename heuristics + title page/first-page text extraction
  - Auto-match Anki decks via normalized names + aliases
  - Show user confirmation step when detection confidence is low or ambiguous
- User can override detected textbook/deck link in one click; overrides are stored for future imports
- Do not require manual renaming as a hard prerequisite
- Show explicit link status badges per upload: `Auto-linked`, `Needs confirmation`, `Unlinked`
- Allow reversible linking after import (re-link deck, reassign textbook pair) without reuploading files

#### Dictionary Linking Policy (current)
- For now, provide **Jisho-only external lookup links** from vocab/lesson/card actions
- Do not embed or scrape dictionary sites; open lookup externally and keep card creation/editing in-app

### Word Selection, Deck Import & Unlock Flows (LearningMode)
- Users can **select/highlight words in lessons** and add them to any deck
- **Textbook pair unlock flow (generalized)**: If imported lesson content matches a known textbook/deck pair:
  - Show "Unlock words from this lesson" button for that lesson
  - Route unlocked words to matching imported deck (if present) or let user choose/create target deck
  - Applies to Genki and any future textbook pair mappings (not Genki-exclusive)
  - `lesson_vocabulary` table tracks: lesson_id → vocab_id → unlock status per user
- **General flow**: Highlight word in lesson → "Add to [Deck]" → confirm → word routes to SRS queue in chosen deck
- **Personalized notes**: Users can attach private notes to added/unlocked cards for memory cues, mnemonics, and context
- **Create card support**: Users can also create cards manually (aligned with Anki-like workflow), with optional reading/tags/notes
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
- Audio reading support for textbook lesson content is explicitly deferred to a later phase
- Audio policy for cards:
  - Preserve imported Anki audio exactly as-is
  - User-created cards can be text-only or have optional uploaded audio
  - Future TTS is fallback-only for cards without real audio
  - Playback precedence: imported/uploaded real audio > TTS fallback > no audio
- For non-mapped PDFs/content imports: keep generic extraction path and prompt user where to route content (deck/grammar/lessons)
- Extend by adding rows/entries only (no new logic paths)
- Add provenance metadata on created cards for filtering/stats/debugging:
  - `origin_type` (`textbook_unlock`, `manual_create`, `pdf_extract`, `anki_import`)
  - `origin_ref` (optional link to lesson/import source)
- Use `Unsorted` inbox deck as safe fallback when routing is unclear (never block import/unlock on uncertain routing)

### AI Tutor Structured Lesson Planning
- Tutor should generate **structured lesson plans** from whatever content the user provides (not only textbook-path content)
- Textbook path is the primary structured path, but tutor planning must support mixed/custom sources
- Planned output format: lesson goals, vocab targets, grammar targets, exercises, and review checkpoints

### Implementation Guardrails (Quality)
- Define acceptance criteria for each major block (`2b.1`, `2c`, `2e`, `2g`) before implementation starts
- Plan migrations early for note/audio/provenance fields to minimize repeated schema churn
- Add a Textbook Progress Dashboard in Learn: per-book completion %, current lesson, unlocked count, due count

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
Generic content routing is working:
- Vocab → SRS deck (appears in "Review Words" count on dashboard)
- Grammar → Grammar Review queue (appears in "Study Grammar" count)
- Lessons → Learn section (`/learn`)

However, mapped textbooks should move to the specialized encrypted pack strategy. The generic OCR/AI path remains useful for:
- unknown PDFs
- quick experiments
- fallback when a textbook pack is unavailable or unlock verification fails

Current mapped-textbook priority is no longer "make DeepSeek extraction perfect every run"; it is:
1. build a reliable offline pack-generation pipeline,
2. validate canonical JSON,
3. encrypt the pack,
4. unlock it locally when the user supplies matching PDFs.

Current extraction status (2026-05-13):

**✅ A1 Core (Genki I) — COMPLETE**
- `genki_1_textbook`: 393/393 pages captured, normalized, grouped
- `genki_1_workbook`: 157/157 pages captured, normalized, grouped
- `genki_combined_answer_key`: 84/84 pages (Genki I section mapped)
- All 14 lesson packs generated: 2,992 content blocks, 2,289 exercises
- Individual reviewed packs ready: `out/reviewed-packs/genki_1_*.json`

**🔄 A1 Pair (Marugoto A1) — IN PROGRESS**
- PaddleOCR at 300 DPI running: 6/147 pages (estimated 40min remaining)
- Will normalize → group → build 1 unified lesson pack
- Output: `marugoto_a1_all_lessons.json` (once complete)

**🔄 A2 Core (Genki II) — IN PROGRESS**
- Genki II textbook OCR starting (399 pages)
- Genki II workbook OCR starting (137 pages)
- Answer key: extract A2 section from combined key (~20 pages estimated)
- Will generate 11 lesson packs (L13-L23)

**⏳ A2 Pair & In-depth Grammar — Pending**
- Marugoto A2 (186p) — After A1 complete
- Maynard/Yanard reference — Deferred to end (reusable layer)

Next: Monitor OCR completion, then normalize/group/build lessons.

---

## Pending / Not Yet Built

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

1. **Genki 1 specialized pack proof** — evaluate PaddleOCR vs Apple Vision, generate canonical Lesson 1 JSON, validate it
2. **Encrypted pack + local unlock flow** — user uploads Genki textbook/workbook to unlock the encrypted pack
3. **Known Textbooks panel** — route Genki uploads into unlock flow; keep generic PDF import as fallback
4. **Textbook Learning subsection** — render unlocked structured lessons and unlock vocab into linked decks
5. **Structured AI tutor lesson planning** from unlocked textbook packs plus user-provided custom content
6. **ScenarioMode v2** — AI conversation (requires UX decision first)
