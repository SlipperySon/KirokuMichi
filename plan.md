# KirokuMichi — Current State & Active Roadmap

Last updated: 2026-05-18 23:38 AEST

---

## What Is Built (Complete)

### Route QA + Screenshots
- `npm run verify` is the canonical full health gate: lint, TypeScript, Vitest, Playwright route QA, build, learner-facing content audit, Maynard coverage audit, and textbook asset manifest generation.
- `npm run qa:routes` runs Playwright against the critical learner routes in desktop Chrome and mobile Pixel 5 profiles.
- The route QA checks key route text, detects horizontal overflow, and saves screenshots under `app/tools/qa/out/route-screenshots/`.
- Vitest route manifest tests now also protect the high-priority learner routes.

### UX Polish Pass
- Toasts are now wired into real app flows instead of only existing as an unused component: dashboard review/session actions, mistake drills, undo review, AI connection tests, tutor/conversation failures, and saved conversation corrections.
- Shared `EmptyState`/`Skeleton` components now cover StudyDashboard, LearningMode, LessonsHub fallback, GrammarReview, ScenarioMode, and MistakeReview.
- Mobile layout audit pass completed for dashboard, learn, lesson hub, lesson detail, scenarios, review, grammar review, mistake review, AI tutor, and conversation partner; 390px Browser smoke showed no horizontal overflow.
- Current limitation: Browser screenshot capture timed out during this pass, so verification used DOM state plus viewport overflow checks.

### Workbook Output Practice
- Workbook tasks are now part of the actual lesson teaching flow, not just supplemental text on the lesson page or summary.
- After teaching and recall, lessons can show a `Workbook Output` step where learners write/roleplay/correct/checkpoint responses and mark tasks complete.
- Lesson summaries track workbook completion and preserve the learner's written output for review.

### Textbook Image Asset Hook
- Lesson pages now have a `Textbook Image Assets` section wired to `textbookAssetService`.
- If `textbook-assets.json` exists, page/photo/diagram assets render with captions and page references.
- If no manifest exists yet, the lesson shows a clear pending state so the future extraction pipeline has a visible destination.
- `npm run textbook:assets:manifest` now scans reviewed-pack asset folders, copies available images to `app/data/generated/assets/textbook/`, and writes `app/data/generated/assets/textbook-assets.json`.
- Current manifest publishes the two reviewed local assets available in the workspace: Genki I Workbook Lesson 1 listening picture choices and Quartet I Lesson 1 Miyazaki reading photo. More assets will appear automatically after the external extraction pipeline produces more reviewed crops.

### Textbook QA Dashboard
- `/dev/textbook-qa` now tracks workbook output count, image asset count, Maynard coverage percentage, suspicious vocab, page ranges, scenarios, and warnings per lesson.
- Dashboard warnings now call out missing workbook output, missing image assets, low Maynard coverage, suspicious vocab, missing pages, and missing core content.
- The dashboard surfaces the route QA command so future QA passes have one obvious control point.

### Performance / Code Splitting
- Vite now manually splits React/router vendor code, storage/sql.js/SRS code, and PDF tooling.
- Anki import/export no longer statically import `sql.js`, keeping that heavy dependency lazy.
- Latest build reduces the main app JS chunk to ~32 kB; remaining large chunks are generated JLPT data/PDF/vendor chunks that are already route/data lazy.
- JLPT sub-splitting has been assessed and is not currently needed: the shell chunk is small and the remaining large JLPT/generated-data files are lazy route/data loads. Revisit only if measured route-load timing becomes slow.

### CI
- `.github/workflows/verify.yml` runs the app health gate on push and pull request.
- CI installs Node 22, app dependencies, bundled Playwright Chromium, then runs `npm run verify`.
- Playwright uses local Chrome by default, and CI can set `PLAYWRIGHT_CHANNEL=bundled` to use the installed Chromium browser.

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
- Grammar fill-blank review cards can now expand a `View explanation` panel after reveal, using the linked `grammar_points` explanation and examples instead of leaving learners with only the correction sentence.

### Grammar Review (`/study/grammar`)
- Pulls from `grammar_points` table, ordered by `times_seen ASC NULLS FIRST`
- Progress tracked per-user in `grammar_progress` table (UPSERT on each view)
- `GrammarCard`: front = pattern + meaning + JLPT badge; reveal = explanation + examples
- Session logged with `mode = 'grammar'` for heatmap split

### Lesson Teaching (`/learn/study`)
- Real teaching-flow v1 is live, replacing the old pure exposure flow.
- Lesson planner deterministically interleaves grammar and vocabulary, then splits the lesson into small sets of 5 items.
- Each item now follows: predict → reveal explanation/function → build a memory hook → micro-practice → self-rate.
- Learners must self-rate each item as `Need Review` or `I Can Explain It` before moving on.
- Each chunk ends with checkpoint recall; the lesson ends with a final mixed review.
- Summary reports quiz misses and self-marked weak items so the learner can see what needs another pass.
- Maynard-matched grammar cards now surface a visible `Maynard Deep Dive` panel instead of hiding the reference in a collapsed disclosure.
- Lesson teaching order is now page-aware: curated foundations come first, paginated textbook content follows source page order, and unpaged CEFR grammar is placed after paginated source material.
- Lesson transition buttons now name the actual next action (`Next Item`, `Start Checkpoint`, `Start Mixed Review`, `Finish Lesson`) instead of always saying `Checkpoint`.
- Current limitation: Maynard is still a mix of direct references plus curated support bridges, not yet a universal page-specific Maynard source of truth.

### Lesson Intent + Maynard Explanation Engine
- Lessons now build a structured intent plan instead of only assembling content buckets.
- Each lesson can surface objective, prerequisite, source page range, target grammar, target vocab, output skill, matching scenarios, workbook practice tasks, and Maynard/support count.
- Grammar teaching cards now use a richer explanation plan:
  - basic explanation
  - Maynard deep explanation when matched
  - contrast with nearby grammar
  - common mistake
  - example pattern
- Lesson cards show source/page references where the extracted data has pages.
- Workbook and scenario material now feeds output-practice tasks such as guided drills, short answers, roleplays, correction targets, and checkpoints.
- Workbook practice tasks now carry explicit practice mode and focus metadata (`guided`, `output`, `correction`, `checkpoint`) so lesson pages and summaries can distinguish drills from production tasks.
- Foundational A1 grammar now gets deterministic deep-support bridges when the extracted textbook grammar lacks a Maynard match, covering beginner-critical items like `です`, `は`, `が`, `も`, `の`, `か`, ko-so-a-do words, adjectives, `ている`, and `てください`.
- A1 lesson intent has curated output-skill overrides so early lessons read like authored goals instead of being driven by the first matching scenario.
- A2/Genki 2 lessons now also have authored output-skill overrides so lesson intent follows a clearer course arc from simple survival Japanese into connected everyday explanation.
- B1/Quartet 1 and B2/Quartet 2 lessons now have authored output-skill overrides so higher-level lessons ask for supported opinions, nuanced discussion, responsibility/no-choice framing, and evidence-based qualification instead of generic scenario-bucket goals.
- The Maynard/support bridge now covers common Genki 2 patterns such as `やすい/にくい`, `ほしい`, giving/receiving actions, `そう`, `みたい`, comparison, `ようと思う`, `なら`, necessity, `し`, `かどうか`, `てある`, `ようにする`, `ても`, transitive/intransitive verbs, honorific/humble forms, negative degree, `もし`, `なおす`, and common-view/reporting patterns.
- The Maynard/support bridge now also covers common Quartet-style B1/B2 discussion patterns such as advice strength, purpose/conditions, concession, topic/target marking, evaluated cause, partial denial, impression, contrast/trend, realization/evaluation, change/unresolved states, viewpoint/consequence, time-gap/possibility, deserved reputation, responsibility/no-choice logic, compulsion, limits/qualification, medium/scope, and prohibition.
- The latest pass added broader support for te-form linking, verb-form systems, core particles/endings, preference/desire, permission/prohibition, time sequence, clause relation, framing/quoting, resemblance, quantity, feasibility, viewpoint, and intermediate relation patterns.
- `npm run textbook:maynard:quality` writes a coverage report and currently shows 637 A1-B2 grammar points, 535 supported, 84% support coverage, and 0 low-coverage lessons.
- Current limitation: cleaned direct Maynard extraction should later replace broad curated bridges where reliable page/topic references are available.

### Textbook Coverage QA (`/dev/textbook-qa`)
- Added a developer QA dashboard for lesson-pack coverage.
- The dashboard reports per lesson: vocab count, grammar count, scenario count, Maynard/support count, suspicious vocab count, page range, and warnings.
- This is intended to make future textbook cleanup less vibes-based and to quickly spot missing pages, weird OCR, or underfilled lessons.
- Workbook practice filtering now rejects front matter and OCR/admin text before tasks reach lesson pages.

### Content Ordering + Workbook Activity Coverage
- Suspicious vocab cleanup now prunes/fixes the known OCR junk rows across textbook packs and the combined curriculum; `npm run textbook:vocab:quality` reports `unresolvedSuspicious: 0`.
- Scenario sorting now uses numeric lesson order inside each textbook tab, so lessons do not jump from 1 → 4 → 7 when source IDs are string-sorted.
- Learner-facing OCR cleanup is now covered by `npm run textbook:learner:quality`, which audits vocab, grammar, workbook practice tasks, scenarios, and scenario lines through the same services the app uses.
- The current learner-facing content audit reports 0 issues across 349 vocab items, 637 grammar items, 203 practice tasks, 144 scenarios, and 438 scenario lines.
- Raw OCR dialogue blocks are disabled as scenario sources for Genki, Quartet, and Tobira where they were producing reading questions, numbering scars, or prompt fragments instead of usable roleplays.
- Supplemental scenario prompts now normalize common OCR workflow scars before display, including arrow chains, stray numbered steps, `@` markers, and `keephold`-style merged English.
- Caveat: the generated textbook JSON still preserves raw OCR/source artifacts for traceability and future extraction QA; the app-facing lesson/scenario/practice pipeline is the cleaned and audited layer.
- App-facing second-volume lesson IDs now map back to source lesson IDs:
  - Genki II app lessons 1-11 match source lessons 13-23.
  - Quartet II app lessons 1-6 match source lessons 7-12.
- Lesson-structure lookup uses the same mapping, so `/learn/lessons/a2/1` and `/learn/lessons/b2/1` resolve correctly instead of falling into missing/source-numbered lessons.
- Workbook activities now surface in lesson practice tasks from the respective workbooks where usable OCR prompts exist, with front matter/admin/listening headers filtered out.

### Beginner Scenario Furigana
- `/scenarios` now shows a `Furigana` toggle in selected A1/A2 scenarios.
- The toggle defaults from `settings.furiganaEnabled`, renders beginner readings as real `<ruby>` annotations, and can be turned off per scenario session.
- Curated A1/A2 scenario dialogue lines are covered by `beginnerFurigana.ts`; a coverage sweep currently leaves no unannotated kanji sequences in Genki 1, Genki 2, Marugoto A1, or Marugoto A2 dialogue lines.

### Genki 1 Lesson 1 Foundation
- Genki 1 Lesson 1 now applies a curated foundation overlay before app-facing extracted textbook items.
- The Genki 1 foundation overlay is now a shared content module with regression tests, which makes the eventual canonical pre-lesson pack replacement safer.
- The lesson starts with beginner survival items from the Genki pre-lesson material: greetings, apologies/thanks, and numbers 0-10.
- First-lesson grammar is narrowed to beginner building blocks such as `です`, `は`, `か`, `の`, `これ`, `それ`, and `も`, instead of exposing a broader CEFR slice like `でしょう` too early.
- Current limitation: this is a runtime/app-facing repair. The canonical textbook pack should still model `あいさつ / Greetings` and `すうじ / Numbers` as explicit pre-lesson sections when the Maynard/textbook extraction pipeline is finalized.

### Lesson Navigation
- `/learn/lessons` now renders as a standalone page with the global top navigation and a `Learn Menu` button back to `/learn`.
- When `LessonsHub` is embedded inside `/learn`, it uses compact embedded mode to avoid nested full-page navigation.
- Active lesson/review exits now use explicit destinations such as `Exit to Lesson Page`, `Exit to Study Dashboard`, and `Exit to JLPT Menu`.

### Readability
- Global theme overrides now raise the contrast floor for common pale utility text (`text-gray-400/500`, `text-slate-400/500/600`) in both dark and light modes.
- This keeps secondary labels readable while preserving the existing design hierarchy.
- Dark-mode slate headings/backgrounds and semantic colored panel text now have explicit high-contrast mappings, fixing the `/learn/lessons` `Study by Lesson` and info-panel readability issue.
- Dark-mode semantic `text-*-950` classes now map to readable light tones, fixing the Lesson Study `Step 1: Predict`, Maynard deep explanation, and micro-practice panel contrast issue.
- Dark-mode semantic color coverage now includes the remaining orange/yellow/blue/indigo/red/green badge and button classes found in the app-wide scan.

### Genki Vocab Quality
- Added `tools/textbook-pack/repair-genki-vocab-quality.ts` and the `npm run textbook:vocab:quality` command.
- The tool reports suspicious Genki vocab meanings and can apply curated repairs to the app-facing generated textbook files.
- First repair pass fixed 48 distinct curated Genki 1/2 vocab issues across:
  - `data/generated/textbooks/genki_1_textbook-comprehensive.json`
  - `data/generated/textbooks/genki_2_textbook-comprehensive.json`
  - `data/generated/textbooks/comprehensive-curriculum.json`
- Fixed learner-facing romaji-as-English cases such as `obaasan` → `grandmother` and `oneesan` → `older sister`, plus OCR spillover like `fne`, `lastmonth`, `toexercise`, and merged reading/surface strings.
- Current report: `tools/textbook-pack/out/vocab-quality/genki-vocab-quality-report.json`.
- Current report classifies unresolved suspicious rows as `manual_review` or `prune_or_ignore`; latest report has 12 manual-review rows and 16 prune/ignore candidates.

### Textbook Image Assets
- Added a typed textbook asset manifest service for future user-provided page/photo assets.
- The service can load `/data/generated/assets/textbook-assets.json` when the extraction/image pipeline produces it and can return assets by lesson or page.
- If no asset manifest exists yet, it safely returns empty results, so UI integration can be incremental.
- Lesson pages now load assets from the base textbook and supplemental source keys, so workbook images can appear on core lesson pages.
- `npm run textbook:assets:manifest` generates the app-facing manifest from reviewed asset folders.

### Supplemental Scenarios (`/scenarios` + Conversation Partner)
- Supplemental texts now feed a normalized, curated runtime scenario layer through `supplementalScenarioService.ts`.
- The service loads generated textbook JSON, applies per-textbook page windows, rejects common OCR/front-matter/publishing noise, scores practice-like material, and emits clean `SupplementalScenario` records.
- `/scenarios` now uses level-first tabs (`A1`, `A2`, `B1`, `B2`, etc.) with nested textbook/source tabs inside the selected level, so learners can browse by proficiency before choosing a source book.
- Scenario source tabs are driven by an explicit catalog so the expected sources always appear even before a source has curated/generated scenarios: A1 = Genki 1 Textbook, Genki 1 Workbook, Marugoto A1; A2 = Genki 2 Textbook, Genki 2 Workbook, Marugoto A2; B1 = Quartet 1 Textbook, Quartet 1 Workbook, Marugoto B1; B2 = Quartet 2 Textbook, Quartet 2 Workbook, Tobira.
- Curated workbook scenario packs are now loaded for Genki 1 Workbook, Genki 2 Workbook, Quartet 1 Workbook, and Quartet 2 Workbook, so workbook tabs are real practice sources rather than empty catalog placeholders.
- Curated second-volume workbook source lessons are normalized to app lesson numbers at runtime:
  - Genki 2 Workbook source lessons 13-23 map to app lessons 1-11.
  - Quartet 2 Workbook source lessons 7-12 map to app lessons 1-6.
- Scenario core lesson links are now guarded to stay inside app lesson ranges, preventing source-derived material from pointing to impossible lesson IDs such as out-of-range B1 buckets.
- A first `/scenarios` visual QA pass checked visible A1, A2, B1, and B2 cards; the pass tightened B1/B2 rules for English can-do admin pages, worksheet checks, and example sentences that were slipping through.
- `supplementalScenarioService.test.ts` now snapshots normalized output, verifies mapped lesson filtering/source caps, and guards against workbook comprehension checks being promoted into scenario prompts.
- Scenario sources include Genki workbooks, Marugoto A1/A2/B1, Quartet 1/2 workbooks/textbooks, and Tobira.
- Curated Genki 2 scenario pack is registered with 22 A2 scenarios across all 11 lessons, giving each lesson at least two authored output tasks.
- Curated Quartet 1 and Quartet 2 scenario packs are registered with 12 B1 and 12 B2 scenarios, giving each Quartet lesson two authored discussion/output tasks.
- Curated scenario pack integrity tests now guard Genki 1/2, Marugoto A1/A2, and Quartet 1/2 lesson coverage, level metadata, curated-source tagging, practice prompts, and authored dialogue structure where applicable.
- All curated scenario JSON packs now include explicit page fields and dialogue lines; Marugoto A1/A2 no longer rely on runtime-only line synthesis.
- Two scenario types are produced:
  - `dialogue`: clean model-dialogue records that pass quality checks
  - `practice_prompt`: exercise/can-do prompts converted into roleplay or discussion starters
- Each normalized scenario carries textbook, CEFR level, source lesson, mapped core lesson where possible, page, can-do goal, lines, and practice prompts.
- `/scenarios` now shows these supplemental scenarios alongside locally imported scenario rows.
- Conversation Partner's textbook dropdown now uses the cleaned scenarios and injects the can-do goal, source sample, and practice prompts into the AI system prompt.
- LessonPage supplemental-material buttons route to `/scenarios` with `level`, `source`, and `lesson` filters.
- Current limitation: the source extraction remains OCR-derived. The service now has deterministic curation plus regression tests, but deeper per-textbook/page-range QA should still polish wording and coverage for final lesson packs.

### Anki Import
- `.apkg` → JSZip → parse SQLite → extract cards + audio
- Audio bytes stored in IndexedDB (`audioStore.ts`) under key `idb:<filename>`
- `cards.audio_url` stores `idb:<filename>` — resolved to fresh Blob URL at play time
- `source = 'user'` on all imported cards

### Build Health
- `npm run lint` is green as of 2026-05-18 09:43 AEST.
- `npx tsc -b --pretty false` is green as of 2026-05-18 09:43 AEST.
- `npm run build` is green as of 2026-05-18 11:18 AEST.
- `npm run test` is green: 100 tests across 16 files.
- Browser smoke is green for `/learn/lessons/a1/1`, `/learn/lessons`, `/study/grammar`, `/dev/textbook-qa`, and `/scenarios` A1/A2/B1/B2 textbook tabs.
- Route smoke coverage now guards critical learning routes and the `/learn/study` lesson flow.
- Route-level lazy loading/code splitting is in place. The main app shell is down to ~339 kB minified; large data/PDF chunks remain for later splitting.
- `npm run textbook:vocab:quality` is green and reports the remaining suspicious Genki vocab rows.
- TS build blockers fixed around APKG type-only imports, audio Blob creation, SQLite database interface imports, and Heatmap required fields.
- `app/public/data` symlink corrected to `../data` so Vite can copy public data during build.
- `noUnusedLocals`, `noUnusedParameters`, and `erasableSyntaxOnly` are temporarily relaxed in `tsconfig.app.json` to allow legacy Anki-clone code to compile while it is cleaned incrementally.
- ESLint now ignores generated/textbook tooling output and treats legacy style/type cleanup rules as non-blocking, so lint is useful as a hard syntax/rules gate again instead of failing on historical cleanup debt.

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

Current extraction status (2026-05-14):

**✅ A1 Core (Genki I) — COMPLETE**
- `genki_1_textbook`: 393/393 pages ✓
- `genki_1_workbook`: 157/157 pages ✓
- `genki_combined_answer_key`: 84/84 pages (A1 mapped) ✓
- All 14 lesson packs: 2,992 blocks, 2,289 exercises
- Reviewed packs: `genki_1_pre_greetings`, `genki_1_pre_numbers`, `genki_1_lesson_1-12`

**✅ A1 Pair (Marugoto A1) — COMPLETE**
- `marugoto_a1_textbook`: 147/147 pages ✓
- 1 unified lesson pack: 1,878 blocks
- Reviewed pack: `marugoto_a1_lesson_1`

**✅ A2 Core (Genki II) — COMPLETE**
- `genki_2_textbook`: 399/399 pages ✓
- `genki_2_workbook`: 137/137 pages ✓
- All 11 lesson packs (L13-L23): 2,678 blocks, 2,657 exercises
- Reviewed packs: `genki_2_lesson_13-23`

**✅ A2 Pair (Marugoto A2) — COMPLETE**
- `marugoto_a2_textbook`: 186/186 pages ✓
- 1 unified lesson pack: 2,901 blocks
- Reviewed pack: `marugoto_a2_lesson_1`

**✅ B1 Core (Quartet 1) — COMPLETE**
- `quartet_1_textbook`: 352/352 pages ✓
- 6 lesson packs: 1,963 exercises
- Reviewed packs: `quartet_1_lesson_1-6`

**✅ B1 Pair (Marugoto B1) — COMPLETE**
- `marugoto_b1_textbook`: 273/273 pages ✓
- 7 lesson packs: 4,257 blocks
- Reviewed packs: `marugoto_b1_lesson_1-7`

**✅ B2 Core (Quartet 2) — COMPLETE**
- `quartet_2_textbook`: 356/356 pages ✓
- `quartet_2_workbook`: 102/102 pages ✓
- 6 lesson packs: 2,166 blocks, 1,664 exercises
- Reviewed packs: `quartet_2_lesson_7-12`

**✅ B2 Grammar (Tobira) — COMPLETE**
- `tobira_textbook`: 428/428 pages ✓
- 8 lesson packs: 4,232 blocks
- Reviewed packs: `tobira_lesson_1-8`

**📊 TOTAL EXTRACTION COMPLETE: 54 lessons (27 A1-A2 + 27 B1-B2)**

Next: Manual corrections phase (A1-A2 first, then B1-B2)

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
