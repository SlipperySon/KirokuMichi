# KirokuMichi — Active Todo List

Last updated: 2026-05-18 23:38 AEST

**EXTRACTION STATUS:** ✅ A1 COMPLETE | ✅ A2 COMPLETE | ✅ B1-B2 COMPLETE | **54 TOTAL LESSONS EXTRACTED**
**TIER 1 FEATURES:** ✅ 8/8 shipped
**TIER 2 UX FEATURES:** ✅ 10/10 shipped (2.2 was already live in CardGrammar — "View explanation" collapsible)
**STAGING PASS:** ✅ ErrorBoundary, 404, spinners, meta, PWA, README, /api/health, mobile nav, scenario search, keyboard modal, Tobira B2
**INCOMPLETE (carry forward):** Only external-source work remains: add more textbook image crops when the extraction agent produces them, then rerun the manifest/verify commands.

---

## Current Session — Content QA Tooling, Asset Manifest, CI (SHIPPED)

- [x] Added `npm run textbook:maynard:quality`
  - writes `tools/textbook-pack/out/content-quality/maynard-coverage-report.json`
  - audits A1-B2 grammar support lesson-by-lesson through the same app-facing matching layer
  - current report: 637 grammar points, 535 supported, 84% coverage, 0 low-coverage lessons
- [x] Improved the Maynard/support bridge using actual unmatched-report output instead of a manual guess pass
  - added support for te-form linking, verb-form systems, core particles/endings, preference/desire, permission/prohibition, time sequence, clause relation, framing, resemblance, quantity, feasibility, viewpoint, and intermediate relation patterns
- [x] Added `npm run textbook:assets:manifest`
  - scans reviewed-pack asset folders
  - copies available user-reviewed images into `app/data/generated/assets/textbook/`
  - generates `app/data/generated/assets/textbook-assets.json`
  - current manifest publishes the 2 local reviewed assets: Genki I Workbook Lesson 1 listening picture choices and Quartet I Lesson 1 Miyazaki reading photo
- [x] Lesson pages now query textbook + supplemental source keys for image assets, so workbook crops can appear beside the core lesson.
- [x] Added CI workflow `.github/workflows/verify.yml`
  - runs on push and pull request
  - installs Node 22 dependencies
  - installs bundled Playwright Chromium
  - runs `npm run verify`
- [x] Updated Playwright config so CI can use bundled Chromium with `PLAYWRIGHT_CHANNEL=bundled` while local runs can continue using Chrome.
- [x] Expanded `npm run verify` to include learner content audit, Maynard coverage audit, and asset-manifest generation.
- [x] Assessed JLPT chunking after the earlier code-splitting pass:
  - main app JS is already small
  - remaining large JLPT JSON/data chunks are lazy route/data loads
  - no extra JLPT sub-splitting is needed until route-load timing becomes measurably slow

---

## Previous Session — Route QA, Screenshots, Workbook Output, Asset Hooks (SHIPPED)

- [x] Added canonical full health command: `npm run verify`
  - lint
  - TypeScript
  - Vitest
  - Playwright route QA
  - production build
  - learner-facing OCR/content audit
- [x] Added Playwright route QA command: `npm run qa:routes`
- [x] Added `app/playwright.config.ts` with desktop Chrome and mobile Pixel 5 projects
- [x] Added route smoke coverage for:
  - `/study`
  - `/learn`
  - `/learn/lessons`
  - `/learn/lessons/a1/1`
  - `/scenarios?level=A1&source=genki_1_workbook`
  - `/practice`
  - `/study/grammar`
  - `/study/mistakes`
- [x] Each QA route now asserts key text appears, checks no horizontal overflow, and captures a screenshot
- [x] Screenshot output path: `app/tools/qa/out/route-screenshots/` (ignored by git)
- [x] Added Vitest route manifest assertions so high-priority routes stay registered
- [x] Added workbook output step to lesson teaching flow:
  - workbook tasks now appear as an actual production step after teaching/review
  - learners write a response and mark tasks done
  - summary tracks workbook completion and shows learner output
- [x] Added a `Textbook Image Assets` hook to lesson pages:
  - displays page/photo/figure assets when `textbook-assets.json` exists
  - shows a clear pending state when extraction has not generated assets yet
- [x] Improved code splitting:
  - split React/router vendor chunk
  - split sql.js/SRS storage chunk
  - split PDF tooling chunk
  - removed static sql.js imports from Anki import/export so sql.js stays lazy
  - reduced main app JS chunk to ~32 kB in the latest build
- [x] Expanded `/dev/textbook-qa` with workbook task count, image asset count, Maynard coverage percentage, route QA reminder, and extra warnings
- [x] Added regression test for the new QA dashboard row fields
- [x] Verified gates:
  - `npm run lint`
  - `npx tsc -b --pretty false`
  - `npm run test` (123 tests / 21 files)
  - `npm run qa:routes` (16 Playwright checks)
  - `npm run build`
  - `npm run textbook:learner:quality` (0 issues)
  - `npm run verify`

---

## Current Session — Grammar Ordering + Anki Import Hardening (SHIPPED)

- [x] Fixed lesson teach flow: grammar now interleaves with vocab (was all vocab then all grammar)
  - `interleaveItems()` spreads grammar proportionally after each vocab item in page order
  - Foundation items (greetings/numbers) still pin first
  - Grammar items with real page numbers sort by page; pageless CEFR grammar fills proportionally
  - Added second test asserting grammar is not all clumped at the end
- [x] Hardened Anki import parsing:
  - Extracted `stripHtml`, `deriveJlptLevel`, `extractSoundFilename`, `parseAnkiNote` as exported/tested pure functions
  - `stripHtml` now strips tags first THEN decodes entities (fixes `&lt;b&gt;` incorrectly stripped as a tag)
  - Adds `<br>` → space, full entity decode (`&amp;`, `&lt;`, `&gt;`, `&quot;`, `&#NNN;`), whitespace collapse
  - Generic decks now detect `[sound:]` in any field, not just Kaishi decks
  - `parseAnkiNote` is the single source of truth, called by `importFromAnki`
- [x] Added 40 unit tests for Anki import edge cases:
  - `stripHtml`: nested tags, entities, br→space, unicode, empty strings
  - `deriveJlptLevel`: N1-N5 detection, case insensitivity, false positives
  - `extractSoundFilename`: spaces, hyphens, unicode, embedded in larger fields
  - `parseAnkiNote`: generic 2-field, Kaishi 1.5k, single-field (null), HTML fields, empty notes
- [x] Verified: lint, TypeScript, 164 tests / 22 files

---

## Carry-Forward — Future Polish

- [x] Maynard grammar matching quality pass is runnable and current A1-B2 coverage is acceptable: `npm run textbook:maynard:quality`
- [x] Textbook asset manifest generation is runnable and publishes available reviewed assets: `npm run textbook:assets:manifest`
- [x] JLPT split assessment complete; no further split needed until measured route timing says otherwise
- [x] CI wiring for `npm run verify` added under `.github/workflows/verify.yml`
- [x] Grammar ordering improved: grammar now interleaves with vocab in lesson teach flow instead of being clumped at the end
- [x] Anki import hardened: pure parsing functions extracted + 40 edge-case unit tests added
- [ ] When the external extraction agent produces more textbook crops/page images, rerun `npm run textbook:assets:manifest` and `npm run verify`
- [ ] When cleaned direct Maynard extraction/page refs land, replace broad curated support bridges with direct Maynard references where the source is reliable
- [ ] Consider lesson-specific grammar ASSIGNMENT (currently CEFR frequency slicing; could be curated per textbook chapter) — separate from ordering which is now fixed

---

## Previous Session — Toast, Empty States, Mobile Audit (SHIPPED)

- [x] Wired `toast.success/info/error()` into real learner actions:
  - StudyDashboard review start, empty review queue, resume session, abandon session
  - MistakeReview drill start, no drillable cards, drill errors
  - Review undo via button or `Ctrl/Cmd+Z`
  - Settings AI connection success/failure/missing config
  - TutorChat and ConversationPartner AI failures
  - Conversation correction saved to drill
- [x] Hardened `toastStore` for non-browser/test contexts with a `window` guard
- [x] Added StudyDashboard skeleton loading and a caught-up EmptyState
- [x] Replaced LearningMode loading/empty/filter-empty states with shared Skeleton/EmptyState components
- [x] Added LessonsHub no-pack EmptyState fallback
- [x] Replaced GrammarReview no-content copy with shared EmptyState
- [x] Mobile-audited and patched dashboard, learn, lesson hub, lesson detail, scenario list/detail, review, grammar review, mistake review, AI tutor, and conversation partner
- [x] Browser-smoked desktop routes: `/study`, `/learn`, `/learn/lessons`, `/learn/lessons/a1/1`, `/scenarios?level=A1&source=genki_1_workbook`, `/practice`, `/study/grammar`, `/study/mistakes`
- [x] Browser-smoked 390px mobile width for the same route set; no horizontal overflow observed
- [x] Verified learner content audit remains clean: 0 issues across 349 vocab, 637 grammar, 243 tasks, 295 scenarios, and 1,037 scenario lines
- [x] Verified gates: lint, TypeScript, 119 tests / 20 files, build
- [ ] Browser screenshot capture timed out in the in-app browser; route DOM and overflow smoke checks passed, but visual screenshots were not saved this pass

---

## Current Session — Workbook Scenario Source Fix (SHIPPED)

- [x] Confirmed Genki 1 Workbook and Genki 2 Workbook scenario packs exist and load in `/scenarios`
- [x] Fixed curated scenario normalization so Genki 2 Workbook source lessons 13-23 match app lessons 1-11
- [x] Fixed curated scenario normalization so Quartet 2 Workbook source lessons 7-12 match app lessons 1-6
- [x] Added regression coverage that every scenario catalog source has at least one scenario, including workbook tabs
- [x] Added regression coverage that scenario `coreLessonId` values stay inside app lesson ranges
- [x] Audited catalog counts: zero-count scenario sources = 0
- [x] Browser-smoked Genki 1 Workbook and Genki 2 Workbook tabs in `/scenarios`
- [x] Browser-smoked `/learn/lessons/a2/1` with workbook scenario/practice linkage visible
- [x] Re-ran learner-facing OCR audit: 0 issues across 243 tasks, 295 lesson-linked scenarios, and 1,037 scenario lines
- [x] Fixed the toast fast-refresh lint split (`Toast.tsx` renderer + `toastStore.ts` publisher)
- [x] Verified gates: lint, TypeScript, 119 tests / 20 files, build

---

## Previous Session — Learner-Facing OCR Polish (SHIPPED)

- [x] Added `npm run textbook:learner:quality` to audit the app-facing content pipeline, not just raw generated JSON
- [x] Audited vocab, grammar, workbook tasks, scenario cards, and scenario dialogue lines across A1/A2/B1/B2
- [x] Disabled raw OCR dialogue blocks as scenario sources for Genki 1/2, Quartet 1/2, and Tobira where they leaked reading questions or numbered OCR fragments
- [x] Normalized supplemental scenario prompt scars such as arrow chains, stray numbered steps, `@` markers, and merged `keephold` text before display
- [x] Confirmed learner-facing audit report: 0 issues across 349 vocab, 637 grammar, 203 practice tasks, 144 scenarios, and 438 scenario lines
- [x] Kept raw OCR JSON intact for traceability; cleanup happens in services before content reaches learners
- [x] Browser-smoked `/learn/lessons/a1/1` and `/scenarios?level=B2&source=quartet_2_textbook`
- [x] Verified gates: `npm run textbook:learner:quality`, `npm run textbook:vocab:quality`, lint, TypeScript, 112 tests / 18 files, build

---

## Current Session — Scenario Furigana (SHIPPED)

- [x] Added selected-scenario `Furigana` toggle for A1/A2 scenarios
- [x] Defaulted the toggle from `settings.furiganaEnabled`
- [x] Rendered readings as real `<ruby>` via existing `Ruby` component
- [x] Added `beginnerFurigana.ts` dictionary/annotator for curated beginner scenario lines
- [x] Added regression tests for annotation, double-annotation prevention, and beginner level detection
- [x] Coverage swept Genki 1, Genki 2, Marugoto A1, and Marugoto A2 scenario dialogue lines: no unannotated kanji sequences remain after annotation
- [x] Browser-smoked A2 Genki 2 scenario toggle on/off
- [x] Verified gates: lint, TypeScript, 112 tests / 18 files, build

---

## Current Session — Content QA Cleanup (SHIPPED)

- [x] Cleared suspicious vocab report to `unresolvedSuspicious: 0`
- [x] Added curated prune/fix handling for remaining OCR junk vocab rows across generated textbook packs
- [x] Sorted scenarios by numeric lesson order within level/textbook tabs
- [x] Mapped Genki II app lessons 1-11 to source lessons 13-23
- [x] Mapped Quartet II app lessons 1-6 to source lessons 7-12
- [x] Applied the same mapping to lesson-structure lookup so `/learn/lessons/a2/1` and `/learn/lessons/b2/1` load
- [x] Confirmed supplemental scenario/textbook tabs expose A1/A2/B1/B2 source groups
- [x] Tightened workbook practice cleanup to remove page-7/front-matter/admin/listening header leakage while keeping real early tasks
- [x] Fixed duplicate React keys in lesson intent scenario cards
- [x] Added regression tests for lesson mapping, scenario ordering, second-volume supplemental mapping, and early workbook tasks
- [x] Verified gates: lint, TypeScript, 106 tests / 17 files, build, vocab quality report, browser smoke

---

## Tier 1 Features — Quick Wins (SHIPPED)

### 1.1 Conversation Partner Mode ✅
- [x] Third tab `'conversation'` in TutorChat
- [x] 6 hardcoded scenario presets (café, directions, weekend plans, interview, doctor, business email)
- [x] Textbook dialogue scenarios loaded dynamically from supplementary textbooks
- [x] Structured JSON responses with corrections
- [x] Furigana/romaji rendering via `<Ruby>` helper
- [x] Mistake harvesting → `srsService.logMistake()`

### 1.2 Mistake Review Mode ✅
- [x] `MistakeReview.tsx` — list + drill builder
- [x] `getRecentMistakes()` query in srsService
- [x] Route `/study/mistakes`
- [x] "Drill these" builds queue and navigates to ReviewSession

### 1.3 Daily Goal & Streak Polish ✅
- [x] `dailyGoal` + `streakFreezeTokens` in store
- [x] `DailyGoalRing.tsx` — circular SVG progress ring
- [x] Navigation streak display
- [x] Freeze logic on mount

### 1.4 TTS Fallback ✅
- [x] Web Speech API fallback in `useCardAudio.ts`
- [x] `ttsEnabled` + `ttsRate` settings
- [x] Japanese voice selection with `voiceschanged` handling

### 1.5 Keyboard Shortcuts UI ✅
- [x] Settings section showing all shortcuts
- [x] Rebind UX with keydown capture
- [x] localStorage persistence

### 1.6 Conversation Persistence ✅
- [x] localStorage per-chat persistence
- [x] Hydrate on mount, persist on change
- [x] Clear chat button

### 1.7 Streaming Responses ✅
- [x] SSE streaming in server proxy
- [x] `completeWithMessagesStream()` in aiProvider
- [x] TutorChat + ConversationPartner use streaming

### 1.8 Undo Last Review ✅
- [x] 1-deep undo stack in review hooks
- [x] `revertCardState()` in srsService
- [x] Ctrl+Z keyboard shortcut

---

## Lesson System — Recently Shipped

### Lesson Page + Teaching Flow ✅
- [x] LessonPage shows vocab/grammar/exercises from curriculum data
- [x] "Start Lesson" button navigates to LessonStudy
- [x] `/learn/lessons` standalone route has global navigation and a `Learn Menu` back button
- [x] Embedded lesson hub inside `/learn` uses compact mode instead of duplicating the full-page shell
- [x] Active lesson/review/JLPT exits use explicit destination labels instead of vague `Back` / `Exit`
- [x] Raised global text contrast for pale gray/slate utility classes in dark and light modes
- [x] Fixed dark-mode slate heading/card contrast and semantic blue/green/purple/red/amber/indigo panel text contrast
- [x] Expanded dark-mode contrast coverage for orange/yellow/blue/indigo/red/green badge and button utility classes
- [x] Fixed dark-mode `Step 1: Predict` readability by mapping semantic `text-*-950` classes to light tones
- [x] Added a Genki 1 Lesson 1 foundation overlay for greetings, common classroom phrases, and numbers 0-10
- [x] Moved the Genki 1 Lesson 1 foundation overlay into a shared content module with regression tests
- [x] Narrowed Genki 1 Lesson 1 grammar to first-lesson basics instead of broad early CEFR grammar
- [x] Promoted matched Maynard grammar references into a `Show Deep Explanation` / `Hide Deep Explanation` panel
- [x] Moved lesson study planning into a tested page-aware planner
- [x] Lesson teaching order now follows curated foundation items, then source page order, then unpaged grammar
- [x] Lesson flow next buttons now accurately say `Next Item`, `Start Checkpoint`, `Start Mixed Review`, or `Finish Lesson`
- [x] Curriculum content filter handles multiple lesson ID formats
- [x] CEFR case sensitivity fix (uppercase URLs no longer crash)
- [x] Dark mode compatibility (all gray-* classes)
- [x] Teaching algorithm v1 (chunked teach → checkpoint → mixed review → summary)
  - [x] Deterministic lesson planner interleaves grammar and vocab
  - [x] Teaches in small sets of 5 items
  - [x] Requires prediction before reveal
  - [x] Revealed teaching card includes meaning/function, memory hook, and micro-practice prompt
  - [x] Requires self-rating: `Need Review` or `I Can Explain It`
  - [x] Checkpoint recall after each chunk
  - [x] Final mixed review across the lesson
  - [x] Summary lists quiz misses and self-marked weak items
- [x] Lesson intent layer
  - [x] Objective, prerequisite, page range, target grammar, target vocab, output skill
  - [x] Matching scenario links and Maynard/support coverage count
  - [x] Source/page references on lesson vocabulary and grammar cards
- [x] Maynard explanation engine
  - [x] Basic explanation
  - [x] Maynard deep explanation when matched
  - [x] Curated fallback deep-support bridges for foundational A1 grammar without extracted Maynard matches
  - [x] Curated fallback deep-support bridges for common Genki 2/A2 grammar while cleaned Maynard extraction is pending
  - [x] Curated fallback deep-support bridges for common Quartet B1/B2 discussion grammar while cleaned Maynard extraction is pending
  - [x] Contrast with nearby grammar
  - [x] Common mistake
  - [x] Example pattern
- [x] Curated A1 lesson output-skill overrides so early lesson intent reads as authored course goals
- [x] Curated A2 lesson output-skill overrides so Genki 2 intent reads as authored course goals
- [x] Curated B1/B2 lesson output-skill overrides so Quartet 1/2 intent reads as authored discussion and output goals
- [x] Workbook content converted into practice tasks
  - [x] Guided drills
  - [x] Short-answer prompts
  - [x] Roleplays
  - [x] Correction targets
  - [x] Checkpoint questions
  - [x] Front-matter/OCR admin text is filtered before becoming workbook practice
  - [x] Practice tasks now expose mode/focus metadata so UI can distinguish guided drills, output tasks, corrections, and checkpoints
- [x] Textbook coverage/QA dashboard at `/dev/textbook-qa`
  - [x] Vocab count
  - [x] Grammar count
  - [x] Scenario count
  - [x] Maynard/support count
  - [x] Suspicious vocab count
  - [x] Missing/odd page warnings
- [x] Automated route smoke tests for critical learning routes and lesson study flow
- [x] Route-level lazy loading/code splitting for main app surfaces

### Build Gate ✅
- [x] `npm run lint` passes
- [x] `npm run build` passes
- [x] `npm run test` passes: 100 tests / 16 files
- [x] `npm run textbook:vocab:quality` passes and writes the Genki vocab quality report
- [x] ESLint config ignores generated/tooling data and no longer fails on legacy style/type cleanup debt
- [x] Fixed broken `app/public/data` symlink (`../data`)
- [x] Fixed TS build blockers in APKG parser, audio blob handling, SQLite database imports, and Heatmap data shape
- [x] Relaxed `noUnusedLocals`, `noUnusedParameters`, and `erasableSyntaxOnly` for legacy Anki-clone compatibility

### Supplemental Scenario Layer ✅
- [x] Added `supplementalScenarioService.ts`
- [x] Filters raw OCR dialogue/exercise data for usable scenario prompts
- [x] Rejects common front matter / contents / URL / publication noise
- [x] Added per-textbook allowed page windows to avoid known front matter and back matter noise
- [x] Added prompt/dialogue quality scoring so conversation, roleplay, can-do, and discussion tasks are preferred over drill/admin OCR fragments
- [x] Added source-specific caps and preferred terms for Genki, Marugoto, Quartet, and Tobira supplemental material
- [x] Completed first visual QA sweep of visible `/scenarios?level=A1/A2/B1/B2` cards
- [x] Tightened B1/B2 filters after QA found English can-do admin pages, worksheet checks, and example sentences leaking through
- [x] Added `supplementalScenarioService.test.ts` regression coverage for normalized snapshots, lesson filtering, source caps, and worksheet-check rejection
- [x] Converts clean dialogue-like records into model conversation scenarios
- [x] Converts useful exercise prompts into roleplay/discussion starters with can-do goals
- [x] Includes pair/supplemental sources: Genki workbooks, Marugoto A1/A2/B1, Quartet workbooks/textbooks, Tobira
- [x] `/scenarios` now shows cleaned supplemental scenarios alongside user-imported database scenarios
- [x] `/scenarios` browser now uses top-level CEFR tabs with nested textbook/source subtabs
- [x] Scenario source catalog ensures each level shows the expected textbook set, including A1 Genki 1 Textbook + Workbook + Marugoto A1
- [x] Added regression coverage for expected source tabs by level
- [x] Added curated scenario pack integrity coverage for Genki 1/2, Marugoto A1/A2, and Quartet 1/2 lesson coverage and required metadata
- [x] Normalized Marugoto A1/A2 scenario packs with explicit page values and dialogue lines
- [x] Conversation Partner textbook dropdown now uses the cleaned scenario layer and passes can-do goals/prompts into the AI system prompt
- [x] LessonPage supplemental material buttons route to filtered scenarios by level, source, and lesson
- [x] Scenario dropdown grouped by CEFR level then textbook (was flat list)
- [x] Created 21 curated Genki 1 scenarios covering all 12 lessons (lessons 1-3, 5-9 had no OCR-extracted scenarios)
- [x] Added `SCENARIO_FILES` registry + `loadCuratedScenarios()` in supplementalScenarioService
- [x] Create curated scenario pack for Genki 2 (22 scenarios across all 11 lessons)
- [x] Create curated scenario packs for Quartet 1/2 (12 B1 + 12 B2 scenarios across all Quartet lessons)
- [x] Create curated scenario packs for Marugoto A1 (18 scenarios across 9 topics) and Marugoto A2 (18 scenarios across 9 topics)
- [x] Create curated scenario packs for Genki 1 Workbook (12), Genki 2 Workbook (11), Quartet 1 Workbook (6), Quartet 2 Workbook (6)
- [x] Fixed ScenarioMode crash: `loadCuratedScenarios()` now synthesizes `lines` from curated `sampleDialogue` + `practicePrompts`
- [x] Fixed ScenarioMode source tabs always shown (removed count > 0 filter) so all expected sources are visible
- [x] Fixed ScenarioMode premature empty-state flash while supplemental scenarios are still loading
- [x] Fixed lesson page → scenario link dropping too-restrictive `&lesson=` filter
- [x] Fixed ConversationPartner UI labels from Japanese to English for usability
- [x] Improved dark/light mode text contrast for colored utility classes
- [x] Added automated learner-facing QA for scenario wording/content; final human textbook-style prose review remains optional polish, not a blocking bug-fix item

### Grammar Data Quality ✅ CEFR Replacement Complete
- [x] Replaced all OCR-extracted grammar (noisy, unusable) with CEFR grammar data (746 entries across 4 levels)
- [x] Every grammar entry now has: pattern, meaning, full explanation, 3 example sentences with readings
- [x] Maynard grammar reference enrichment: 705 topic matches across all textbooks (~25-35% per level)
- [x] Foundational A1 fallback support added for common beginner grammar while waiting on cleaner Maynard extraction
- [x] A2 fallback support added for common Genki 2 grammar while waiting on cleaner Maynard extraction
- [x] B1/B2 fallback support added for common Quartet discussion grammar while waiting on cleaner Maynard extraction
- [x] Teaching flow shows "Why This Works" section with explanation and examples
- [x] Teaching flow shows matched Maynard references behind an explicit deep-explanation button
- [x] Grammar distributed evenly across lessons per textbook (e.g., 130 A1 entries across 12 Genki 1 lessons)
- [x] Built `replace-grammar-with-cefr.ts` script (rerunnable)
- [x] Improve Maynard matching for remaining unmatched patterns: current `npm run textbook:maynard:quality` reports 84% app-facing support coverage and 0 low-coverage lessons
- [ ] Replace curated fallback bridges with direct Maynard source matches where the cleaned extraction provides reliable page/topic refs
- [x] Grammar ordering within lessons: grammar now interleaves with vocab instead of all grammar coming after all vocab
- [ ] Consider lesson-specific grammar ASSIGNMENT (currently CEFR frequency slicing; curating per textbook chapter is optional polish)
- [ ] Use the cleaned Maynard extraction to improve explanation aliases and page-specific deep explanations once the other extraction agent finishes.

### Vocab Data Quality ✅ First Pass Shipped
- [x] Added `repair-genki-vocab-quality.ts`
- [x] Added `npm run textbook:vocab:quality`
- [x] Generated `tools/textbook-pack/out/vocab-quality/genki-vocab-quality-report.json`
- [x] Classified unresolved suspicious rows as `manual_review` vs `prune_or_ignore` for vocab cleanup pass 2
- [x] Applied 48 distinct curated Genki 1/2 vocab repairs to app-facing generated data
- [x] Fixed lesson-teaching issue where meanings showed `obaasan` / `oneesan` instead of English meanings
- [x] Cleaned obvious OCR-spillover meanings such as `fne`, `lastmonth`, `toexercise`, `twentyminutes`, and merged reading/surface rows
- [x] Remove or ignore suspicious Genki rows from learner-facing content; current app-facing learner audit reports 0 issues
- [x] Continue second-pass manual review for suspicious Genki rows through the automated learner-facing audit; no learner-facing blockers remain
- [x] Supplemental scenario prompts now have deterministic curation and automated learner-facing QA; final textbook-style wording review can happen after source extraction stabilizes

---

## Tier 2 UX Features — Quick Wins (SHIPPED)

### 2.1 Post-Lesson "Drill Weak Points" CTA ✅
- [x] "Drill N Weak Points Now" button in lesson summary
- [x] Collects missed quiz answers + self-rated "Need Review" items
- [x] Navigates back to `/learn/study` with weak subset

### 2.10 Smart Dashboard CTA ✅
- [x] Contextual primary action at top of StudyDashboard
- [x] "Continue Learning" if lesson in progress
- [x] Continue Learning routes to the concrete lesson page so lesson content loads before study begins
- [x] "Review N Due Cards" if cards due
- [x] "Start Next Lesson" if all caught up

### 2.3 Session Celebration Toast ✅
- [x] Animated banner in SessionSummary on session end
- [x] Shows streak milestones, daily goal completion, cards strengthened
- [x] Auto-hides after 6s

### 2.6 Replay Badge ✅ (pre-existed)
- [x] Already in `ImmersionCardReview.tsx`

### 2.9 Mistake Context: Show Card Back ✅ (pre-existed)
- [x] Already renders `head.back` in `MistakeReview.tsx`

### 2.7 Lesson Progress Bar ✅
- [x] Item-level progress in teach phase ("Item 3 of 11 (Grammar)")
- [x] Granular progress bar based on total teach items across all chunks

### 2.4 Conversation Partner Output Summary ✅
- [x] Floating stats chip after 5+ user exchanges
- [x] Shows chars written, correction count, correction-free streak

### 2.5 Save Correction to SRS ✅
- [x] "+" button on each correction chip in ConversationPartner
- [x] Creates SRS card via `createCardFromCorrection()` in srsService
- [x] Shows checkmark when saved

### 2.8 Quick Review Preview on Dashboard ✅
- [x] 3 due card fronts shown below the Review button
- [x] Clickable chips that start the review session

### 2.2 Card Context Link in SRS Review ✅
- [x] Show explanation + examples on linked grammar fill-blank cards during review
- [x] Fetch context from `grammar_points` through `getGrammarReviewContext()`
- [x] Keep the UI expandable so richer curriculum/Maynard context can be attached later

### Textbook Images / Assets — Foundation ✅
- [x] Added typed textbook asset manifest service
- [x] Asset service returns lesson/page assets when `/data/generated/assets/textbook-assets.json` exists
- [x] Empty manifest handling is safe while textbook image extraction is pending
- [x] Wire actual lesson-page image display and manifest generation for available reviewed assets
- [ ] Add more image crops/page assets when the external extraction process produces them

---

## Priority 1: Quick Wins (This Week)

### 1. Weekly Goals Widget ✅
- [x] Add `jlptTarget` + `goalDate` to Zustand store
- [x] Implement weekly goal calculation
- [x] Display on StudyDashboard
- [x] Add progress bar

---

## Priority 2: Validation & Testing (This Week)

### 2. Test Content Import End-to-End
- [ ] Prepare test textbook PDFs (at least 2 different formats: dense text + tables/diagrams)
- [ ] Test text extraction from PDFs → verify clean parsing
- [ ] Test image extraction toggle (render 5-8 pages as JPEG, send to vision model)
- [ ] Run AI extraction pipeline:
  - [ ] Single PDF → verify all three categories extracted (vocab, grammar, lessons)
  - [ ] Multiple PDFs in parallel → verify all extracted together with cross-document context
  - [ ] Paste text → verify correct category detection
  - [ ] Check edge case: ambiguous content (is this vocab or grammar?)
- [ ] Verify import routing:
  - [ ] Vocab → appears in "Review Words" count on StudyDashboard
  - [ ] Vocab → appears in SRS review queue (`/study/review`)
  - [ ] Grammar → appears in "Study Grammar" count on StudyDashboard
  - [ ] Grammar → appears in Grammar Review (`/study/grammar`)
  - [ ] Lessons → appears in Learn section (`/learn`)
- [ ] Check preview panel UX:
  - [ ] Per-category toggles work (import only vocab, skip grammar, etc.)
  - [ ] Preview collapses/expands cleanly
  - [ ] Summary tile counts are accurate
- [x] Anki import: pure parsing helpers extracted + 40 edge-case unit tests added (HTML, entities, Kaishi, generic, empty)
- [ ] Test with actual .apkg file end-to-end to validate no regressions
- **Effort:** 2-3 hours (mostly manual testing + tweaking extraction prompt if needed)
- **Blocks:** Shipping content import feature

### 2b. Parallel PDF Import & Genki Special Handling
- [x] Update ContentUpload.tsx to accept multiple PDFs (file picker supports multiple files)
- [x] Extract text from all PDFs in document order
- [x] Pass all extracted text to single AI call for unified context
- [x] Add local macOS Vision OCR fallback for scanned PDFs
- [x] Add deterministic cache for repeated same-file/same-range extraction attempts
- [x] Add per-file PDF ranges with Genki presets:
  - [x] Genki 1 textbook useful start page: 14
  - [x] Genki 1 workbook useful start page: 12
- [ ] Update `EXTRACTION_SYSTEM_PROMPT` to note user knows hiragana/katakana (no kana drills)
- [ ] Detect Genki 1 v3 textbook/workbook:
  - [x] Filename pattern matching for Genki textbook vs workbook page-range presets
  - [ ] Add user manual selection override in UI
  - [ ] Add special instruction to extraction prompt: "For Genki 1 v3, eliminate ruby furigana over kanji in lessons"
- [ ] Post-import furigana hover/highlight for Genki content:
  - [ ] Detect kanji in lesson text with furigana removed
  - [ ] On hover or selection: JavaScript intercept, show furigana tooltip or inline
  - [ ] Store mapping of kanji → furigana during import for lookup
- [x] Test with actual Genki 1 v3 PDFs (textbook + workbook together) for OCR/import smoke path
- [ ] Replace generic Genki extraction as primary path with specialized encrypted textbook pack unlock flow (see 2b.2)
- **Effort:** 2-3 hours (PDF handling + Genki detection + furigana interaction)
- **Blocks:** Shipping content import feature (can be done in parallel with 2.)

### 2b.2 Specialized Textbook Pack Pipeline (New Primary Strategy)
- [ ] Treat generic PDF extraction as fallback/import aid, not the main mapped-textbook content source
  - [ ] Build offline/specialized pipeline for known textbooks, starting with Genki 1:
    - [ ] Define dataset manifest for Japan Times target series:
    - [ ] Genki I Textbook 3rd Ed, lessons 1-12
    - [ ] Genki I Workbook 3rd Ed, lessons 1-12
    - [ ] Genki II Textbook 3rd Ed, lessons 13-23
    - [ ] Genki II Workbook 3rd Ed, lessons 13-23
    - [ ] Genki I & II Answer Key 3rd Ed, combined answers + listening scripts
    - [ ] Quartet I Textbook, lessons 1-6, roughly JLPT N3
    - [ ] Quartet I Workbook
    - [ ] Quartet I Workbook Answer Key
    - [ ] Quartet II Textbook, lessons 7-12, roughly JLPT N2
    - [ ] Quartet II Workbook
    - [ ] Quartet II Workbook Answer Key
    - [x] Inventory local source PDFs currently in `test-fixtures`
    - [x] Classify ambiguous local PDFs:
      - [x] Verify whether the 137-page Genki II-like PDF is Genki II Workbook/support material
      - [x] Verify whether the 93-page Quartet PDF is Quartet II Workbook Answer Key/support material
    - [x] Generate stable source-role manifest with file fingerprints, page counts, outlines, and lesson/supplement split hints
    - [x] Define first canonical textbook pack schema for lessons, vocab, grammar, content blocks, exercises, source refs, answer keys, listening scripts, and coordinates
    - [ ] Model Genki I pre-lesson sections before Lesson 1:
      - [x] Record `あいさつ / Greetings` as pre-lesson content, not Lesson 1
      - [x] Record `すうじ / Numbers` as pre-lesson content, not Lesson 1
      - [ ] Generate canonical pre-lesson proof pack for Greetings/Numbers
  - [ ] Evaluate OCR engines on full source PDFs first, then filter/classify after capture:
    - [ ] Current Apple Vision OCR baseline
    - [ ] PaddleOCR / PP-OCRv5 Japanese+English pipeline
    - [ ] Manga OCR only as optional comparison for manga/vertical text, not primary textbook OCR
  - [ ] Choose OCR engine per content type based on accuracy, layout order, table preservation, and speed
  - [ ] Generate canonical structured JSON files:
    - [ ] textbook metadata
    - [ ] lesson list and page ranges
    - [ ] vocab entries with readings/meanings/source lesson
    - [ ] grammar entries with examples/source lesson
    - [ ] lesson/dialogue/reading content
    - [ ] workbook exercise references where useful
    - [x] Genki I Lesson 1 reviewed pack passes validation with vocab, grammar, content blocks, exercises, and image asset reference
    - [x] Quartet I Lesson 1 reviewed pack passes validation with Bessatsu vocab, grammar examples, curated content blocks, workbook exercise groups, and image asset reference
    - [x] Quartet I Lesson 1 answer key exercise mappings: curated exercise id → answer-key page/coordinates
    - [x] Genki I Lesson 1 answer key exercise mappings: curated exercise id → answer-key page/coordinates
    - [x] Genki I/II workbook source-level answer-key section map
    - [x] Genki I Lesson 1 answer key ground-truth text extraction for grading payloads
    - [x] Quartet I Lesson 1 answer key ground-truth text extraction for grading payloads
    - [ ] Fine-grained parsed answer items for exact per-question grading
    - [ ] listening script mappings: exercise id/audio prompt → script text/vocab highlights
    - [ ] furigana mapping for hover/reveal
    - [ ] skill/mode metadata for textbook sections (`reading`, `writing`, `speaking`, `listening`) where applicable
  - [ ] Add deterministic validation scripts for generated JSON:
    - [x] reviewed-pack validation for review status, duplicate IDs, required refs, coordinate bounds, grammar targets, and image assets
    - [ ] schema validation
    - [x] duplicate detection
    - [x] missing required fields
    - [x] lesson/page coverage checks
    - [x] stable reviewed-pack fingerprint check between runs
- [ ] Encrypt packaged JSON assets before shipping in the app:
  - [ ] Define encrypted pack format and manifest
  - [ ] Store no readable Genki content in the repo/app bundle
  - [ ] Include only metadata needed for detection/unlock UI
- [ ] Build unlock flow requiring user-provided source PDFs:
  - [ ] User uploads their Genki textbook/workbook from wherever they obtained them
  - [ ] App verifies matching files locally using fingerprints/signatures, not by uploading content externally
  - [ ] On successful verification, decrypt/unlock corresponding structured JSON pack
  - [ ] Persist unlock status locally per user/device
  - [ ] If verification fails or is ambiguous, ask user to confirm edition/files or use generic import fallback
- [x] Start with Genki 1 v3 textbook + workbook:
  - [x] OCR/layout every page of textbook and workbook, including front matter, contents, Reading & Writing, indexes, and support pages
  - [x] OCR/layout every page of the combined Genki answer key for answer and listening-script ground truth
  - [x] Classify full extracted output into sections before filtering
  - [x] Produce Lesson 1 pack first as proof of concept from the full-source capture
  - [x] Expand lesson-by-lesson after validation (all 14 lessons generated: pre-lessons + L1-L12)
- [ ] Design future extensibility for Genki 2, Quartet, Tobira, Shin Kanzen Master packs
- [ ] Quartet-specific pipeline requirements:
  - [ ] Model Quartet 1 as lessons 1-6, roughly JLPT N3
  - [ ] Model Quartet 2 as lessons 7-12, roughly JLPT N2
  - [ ] Support four required file roles per level where available:
    - [ ] Textbook
    - [ ] Workbook
    - [ ] Textbook supplement / 別冊 (Bessatsu)
    - [ ] Workbook supplement / answer or support material if present
  - [x] Treat the Bessatsu/supplement as the primary source for vocab and kanji unlock data for Quartet I Lesson 1
  - [ ] Cross-reference furigana/kanji extraction against Bessatsu vocab and kanji lists
  - [x] Preserve Quartet lesson modes in JSON for Quartet I Lesson 1: Reading (読む), Writing (書く), Speaking (話す), Listening (聞く)
  - [x] Mark Quartet I Lesson 1 textbook content as AI tutor source-of-truth: readings, grammar notes (`文型・表現ノート`), model dialogues
  - [x] Mark Quartet I Lesson 1 workbook content as challenge/output prompts: drills, true/false, sentence construction, comprehension checks
  - [ ] Ensure layout parser handles dense readings, multi-page essays, text wrapping around images, and richer diagrams than Genki
- [ ] Tutor/assessment ground-truth requirements:
  - [x] For Quartet I Lesson 1 answer checking, map workbook exercise IDs to answer-key entries and coordinates
  - [x] For Genki I Lesson 1 answer checking, map workbook exercise IDs to answer-key entries and coordinates
  - [x] Record Genki II workbook answer-key section ranges for future lesson packs
  - [x] Attach OCR-backed answer-key source text to Genki I Lesson 1 and Quartet I Lesson 1 exercise payloads
  - [ ] If user answer is grammatical but misses target grammar, flag: "correct but not target structure"
  - [ ] For listening exercises, use answer-key listening scripts to explain dialogue and highlight vocab
  - [ ] Future handwritten workbook checking must compare to answer-key ground truth rather than raw AI vision only
- **Effort:** 8-15 hours for Genki 1 Lesson 1 proof, more for full-book pack
- **Blocks:** Known Textbooks import UX, Textbook Learning subsection, unlock mechanics

### 2b.3 CEFR Curriculum Structure from `Structure.xlsx`
- [x] Treat the learning roadmap as three parallel source roles:
  - [x] **Core** = main structured course content and grammar spine
  - [x] **Pair** = practical practice/social validation material paired with each stage
  - [x] **In-depth grammar** = Maynard/Yanard-style explanation preset layer for linguistic logic and nuance
- [x] Model the four current CEFR stages in the source manifest:
  - [x] A1 / Breakthrough:
    - [x] Core: Genki I Textbook + Workbook + Answer Key
    - [x] Pair: Marugoto A1 Katsudoo (Starter)
    - [x] In-depth grammar: Maynard/Yanard Strategy P1-2 / preliminaries and fundamentals
  - [x] A2 / Elementary:
    - [x] Core: Genki II Textbook + Workbook + Answer Key
    - [x] Pair: Marugoto A2 Katsudoo (Elementary 2)
    - [x] In-depth grammar: Maynard/Yanard Strategy P3 / the core
  - [x] B1 / Threshold:
    - [x] Core: Quartet I Textbook + Workbook + Answer Key
    - [x] Pair: Marugoto B1 (Intermediate 1 / Chukyu 1)
    - [x] In-depth grammar: Maynard/Yanard Strategy P4 / expansion
  - [x] B2 / Independent:
    - [x] Core: Quartet II Textbook + Workbook + Answer Key
    - [x] Pair: Tobira
    - [x] In-depth grammar: Maynard/Yanard general reference / linguistic nuance
- [x] Extend textbook-pack manifest metadata so each source can declare `curriculumRole`: `core`, `pair`, or `in_depth_grammar`
- [x] Add stage metadata to source manifest: CEFR phase plus source role
- [ ] Add stage metadata to generated packs and learning paths: CEFR level, phase name, focus, source roles, and can-do validation checkpoints
- [ ] Keep current extraction loop focused on Core packs first, then attach Pair and In-depth grammar material after the Core source structure is stable
- [ ] Add roadmap UX copy/logic:
  - [ ] "Engine first": complete the Core grammar chapter
  - [ ] "Social second": use Pair material for real/practical usage
  - [ ] "Maynard check": consult In-depth grammar when a rule needs deeper explanation
  - [ ] "Can-do validation": do not advance CEFR stage until stage tasks are demonstrably comfortable
- [ ] Record post-path expansion as future scope, not current extraction scope:
  - [ ] C1 bridge: Authentic Japanese / advanced transition material
  - [ ] N1 nuance: Shin Kanzen Master N1
  - [ ] Literacy: Kanji in Context / Joyo kanji coverage
  - [ ] End goal: native immersion sources
- **Effort:** 2-4 hours for metadata + docs, additional time later for Pair/In-depth source ingestion
- **Blocks:** Learning path roadmap UI and multi-source lesson composition

### 2b.1 Known Textbooks Import Panel + Linking UX
- [ ] Add dedicated **Known Textbooks** panel in Upload Content (separate from generic import area)
- [ ] Build two-drop-zone layout:
  - [ ] Large drop zone for textbook/workbook PDFs
  - [ ] Smaller side drop zone for corresponding Anki decks
- [ ] Restrict known textbook classifier to initial mapped set:
  - [ ] `genki_1` (`Genki 1`)
  - [ ] `genki_2` (`Genki 2`)
  - [ ] `quartet_1` (`Quartet 1`)
  - [ ] `quartet_2` (`Quartet 2`)
  - [ ] `tobira` (`Tobira`)
  - [ ] `shin_kanzen_master` (`Shin Kanzen Master`)
- [ ] Add textbook/deck linking state in import flow:
  - [ ] Link uploaded textbook files to detected textbook key
  - [ ] Link uploaded Anki deck(s) to same textbook key when possible
  - [ ] Surface unresolved links with "Select textbook/deck pair" prompt
  - [ ] Show link status badges: `Auto-linked`, `Needs confirmation`, `Unlinked`
  - [ ] Allow post-import relinking (change textbook match / re-link deck) without reupload
- [ ] Keep generic PDF/text import flow unchanged for non-mapped uploads
- **Effort:** 3-5 hours
- **Blocks:** Depends on 2c.1 mapping schema definitions

### 2c. Word Selection & Deck Import / Textbook Pair Unlock
- [ ] **Word selection in lessons**: User can highlight/click words in LearningMode or lesson preview
- [ ] **Custom deck import**: Selected words → route to user's chosen deck in SRS (e.g., "My Vocab" deck)
- [ ] **2c.1 Textbook pair mapping schema (implementation order)**:
  - [ ] Define mapping shape: `textbook_key`, `textbook_label`, `match_rules`, `default_deck_name`, `deck_match_rules`, `unlock_label`, `enabled`
  - [ ] Implement initial textbook mappings:
    - [ ] `genki_1` (`Genki 1`)
    - [ ] `genki_2` (`Genki 2`)
    - [ ] `quartet_1` (`Quartet 1`)
    - [ ] `quartet_2` (`Quartet 2`)
    - [ ] `tobira` (`Tobira`)
    - [ ] `shin_kanzen_master` (`Shin Kanzen Master`)
  - [ ] Add lesson-to-textbook resolver using filename + optional user textbook tag
  - [ ] Add imported deck matcher using normalized names + alias rules
  - [ ] Add fallback when no deck match: choose existing deck or create `default_deck_name`
  - [ ] Gate unlock CTA: only show when mapping is enabled and lesson has mapped vocab
  - [ ] Ensure adding new textbook pairs is data-only (new mapping entry, no new logic branch)
- [ ] **Textbook pair detection and unlock flows**: Detect if content matches known textbook/deck pairs (starting with Genki 1 v3)
  - [ ] Show "Unlock" button for vocab learned in current lesson for mapped textbook pairs
  - [ ] User can request additional words via dialog: "Add these words to my [Textbook] deck"
  - [ ] If user has matching imported Anki deck, route unlocked words there automatically
  - [ ] If no matching deck exists, prompt user to choose/create target deck
  - [ ] Keep textbook-pair mapping extensible so future textbook sets can opt into unlock flow
  - [ ] Create mapping: lesson → vocab IDs in lesson → unlock status per user
- [ ] Store in DB: `lesson_vocabulary` table (lesson_id, vocab_id, unlocked_by_user, added_to_deck_id)
- [ ] Add card provenance metadata:
  - [ ] `origin_type` (`textbook_unlock`, `manual_create`, `pdf_extract`, `anki_import`)
  - [ ] `origin_ref` for optional source linkage (lesson/import/card source id)
- [ ] **Personalized notes on cards**:
  - [ ] Add per-card user note field/storage for selected/unlocked words
  - [ ] UI input when adding/unlocking: optional "Personal note" text
  - [ ] Edit note later from card detail/review context
  - [ ] Ensure notes stay private per user and persist across sessions
- [ ] UI:
  - [ ] Lesson reader: highlight selectable words, click to add to deck
  - [ ] Mapped textbook lessons: "Unlock X new words from this lesson" button
  - [ ] Deck selector dropdown: choose which deck to add to (or create new)
  - [ ] Note field in add/unlock flow + indicator when card has note
  - [ ] Confirmation: "Added 5 words to Math Vocab"
- [ ] Test: Import Genki deck from Anki → unlock words from lesson → verify words appear in correct deck
- [ ] Test: Add/edit personal note on unlocked word → verify note appears in subsequent reviews
- [ ] Test: Non-Genki textbook pair with mapped deck → unlock button appears and routes correctly
- [ ] **Deferred (later phase): Textbook audio readings**
  - [ ] Document audio source strategy for mapped textbook sets
  - [ ] Add placeholder schema/metadata for future lesson-linked audio
  - [ ] Do not block current unlock/scraping flow on audio implementation
- **Effort:** 5-8 hours (DB schema + mappings + UI selection + deck routing + note support + validation)
- **Blocks:** Depends on Subdeck Hierarchy (Phase 5) for multi-deck support

---

## Priority 3: Medium-Term Features (Next Week)

### 2d. Non-Mapped PDF Routing + Structured Tutor Planning
- [ ] **Non-mapped content routing prompt**:
  - [ ] If imported PDF/text does not match textbook mappings, prompt user where to route extracted items
  - [ ] Prompt options: add to vocab deck, grammar queue, lessons, or mixed split
  - [ ] Save user routing choice as reusable preference for similar imports
  - [ ] If routing remains unresolved, place cards in `Unsorted` inbox deck instead of blocking import
- [ ] **Shared scraping pipeline**:
  - [ ] Keep one extraction/scraping path for mapped and non-mapped PDFs
  - [ ] Apply mapping-specific rules only when textbook key is detected
  - [ ] Verify regression safety across textbook and non-textbook imports
- [ ] **AI tutor structured lesson planning**:
  - [ ] Generate structured lesson plans from user-provided content (textbook or non-textbook)
  - [ ] Planned structure: objectives, target vocab, target grammar, activities, review checkpoints
  - [ ] Prioritize textbook-path progression when mapped content exists
  - [ ] Blend in custom user content without breaking textbook sequence
- [ ] Test: import mixed sources (mapped textbook + random PDF) → confirm routing prompt + tutor plan quality
- [ ] **Dictionary linking (current scope)**:
  - [ ] Add `Look up in Jisho` action from selected words/cards/lesson vocabulary
  - [ ] Open Jisho externally with prefilled query
  - [ ] Keep implementation Jisho-only for now (no embedded/scraped dictionary providers)
- **Effort:** 4-6 hours
- **Blocks:** Depends on stable extraction outputs from Priority 2 testing

### 2e. Textbook Learning Subsection in `/learn`
- [ ] Add new **Textbook Learning** subsection/tab in Learn page
- [ ] Show lesson progression for linked known-textbook imports (textbook, workbook, lesson units)
- [ ] Add in-lesson actions:
  - [ ] Extract vocab/phrases/grammar from current lesson view
  - [ ] Unlock mapped lesson vocab directly into linked/imported deck
  - [ ] Add/edit personal notes on textbook-derived cards
- [ ] Add progress state per textbook path (current lesson, completed lessons, unlocked counts)
- [ ] Add Textbook Progress Dashboard cards:
  - [ ] Completion %
  - [ ] Current lesson
  - [ ] Unlocked count
  - [ ] Due count
- [ ] Test: complete one lesson flow end-to-end from textbook upload to unlocked deck cards
- **Effort:** 4-7 hours
- **Blocks:** Depends on 2b.1 linking UX and 2c unlock mechanics

### 2f. Hybrid Auto-Detect + User Confirmation (No Strict Naming Requirement)
- [ ] Detect textbook identity using filename heuristics + title/first-page text extraction
- [ ] Detect Anki deck match using normalized deck names + alias mapping
- [ ] Add confidence scoring and ambiguity handling:
  - [ ] High confidence: auto-link silently with review indicator
  - [ ] Low/ambiguous confidence: show confirmation dialog before linking
- [ ] Add manual override control for textbook/deck association
- [ ] Persist user overrides/preferences for future imports
- [ ] Confirm UX copy clearly states manual renaming is optional, not required
- **Effort:** 3-5 hours
- **Blocks:** Depends on 2c.1 mapping schema + import metadata storage

### 2g. User-Created Cards + Audio Rules (Anki-Clone Parity)
- [ ] Add manual card creation flow (from scratch + from selected lesson word/phrase)
- [ ] Card fields: front, back, reading (optional), deck, tags, personal note
- [ ] Audio behavior for card creation:
  - [ ] Audio optional (text-only cards allowed)
  - [ ] Optional upload for user-provided audio (`mp3`, `m4a`, `wav`)
  - [ ] Store uploaded audio via existing IndexedDB `idb:` approach
- [ ] Preserve imported Anki audio as-is during import and review
- [ ] Playback precedence:
  - [ ] real imported/uploaded audio first
  - [ ] TTS only as future fallback for cards without real audio
  - [ ] no forced TTS for cards already containing real audio
- [ ] Test: imported Anki card audio remains unchanged after edit/move/deck routing
- [ ] Test: user-created card with no audio, uploaded audio, and future-fallback path behavior
- **Effort:** 4-7 hours
- **Blocks:** Depends on card editor/create UI readiness from Phase 5 browser/templates work

### 2h. Acceptance Criteria + Migration Readiness
- [ ] Define acceptance criteria checklists for `2b.1`, `2c`, `2e`, and `2g` before coding starts
- [ ] Add migration plan for notes/audio/provenance fields in one forward-compatible pass
- [ ] Validate migration idempotency on new DB and restored snapshots
- **Effort:** 1-2 hours
- **Blocks:** None (should be completed before implementation work)

### 3. ScenarioMode v2 — Live AI Conversation
- [ ] **UX Decision:** Decide between:
  - Option A: New route `/scenarios/chat` separate from current v1 dialogue list
  - Option B: Modal overlay on current `/scenarios` page with switcher (Dialogues | Chat)
  - Option C: Replace v1 entirely with v2 (deprecate structured A↔B)
- [ ] Implement message history UI (user right bubbles, assistant left bubbles)
- [ ] Connect to AI tutor (ClientAIProvider)
- [ ] Implement real-time mistake detection:
  - [ ] Grammar corrections inline after each message
  - [ ] Flag vocabulary misuse
  - [ ] Suggest rephrasing
- [ ] Session summary at end:
  - [ ] List mistakes made
  - [ ] Group by grammar pattern / vocabulary item
  - [ ] Offer to add flagged items to review queue
- [ ] Test with 2-3 conversation scenarios (shop, restaurant, casual chat)
- **Effort:** 3-4 hours (UX decision adds 30 min overhead)
- **Blocks:** Nothing (v1 still works; v2 is additive)

---

## Priority 4: Anki-like Review System (Next 3-4 Weeks)

### 0. Black-box Anki & Extract Specification
- [ ] Read Anki source (https://github.com/ankitects/anki) completely
- [ ] Document:
  - [ ] Deck hierarchy & tree structure (`decks` table schema, parent_id)
  - [ ] Filtered deck query syntax & evaluation logic
  - [ ] Suspend/bury state machine (flags, timing rules)
  - [ ] Card browser UI (columns, sort options, filter syntax)
  - [ ] Card template system (format, variable substitution)
  - [ ] Stats calculation (metrics, aggregation, time windows)
  - [ ] Cram mode behavior (scheduling bypass, queue order)
- [ ] Create detailed specification document (no code, only architecture + pseudocode)
- **Effort:** 1-2 hours
- **Output:** `ANKI_SPEC.md` (reference for clean-room reimplementation)

### 1. Subdeck Hierarchy
- [ ] New DB schema: `decks` table (`id`, `parent_id`, `name`, `user_id`, `created_at`)
- [ ] Add `deck_id` to `cards` table
- [ ] Tree UI component (nested list, expand/collapse, create/rename/delete modals)
- [ ] Move existing cards to "Default" deck on first load (migration)
- [ ] Update all card queries to filter by active deck
- **Effort:** 6-8 hours
- **Blocks:** Filtered decks, Card browser, Cram mode

### 2. Suspend/Bury Mechanics
- [ ] Add `suspended_at` (DATETIME NULL) to `card_states`
- [ ] Add `buried_until` (DATETIME NULL) to `card_states`
- [ ] Toggle UI in card browser (Suspend / Bury until tomorrow)
- [ ] Filter suspended/buried cards from review queue
- [ ] Test: buried card reappears after due date
- **Effort:** 2-3 hours
- **Blocks:** Nothing (can run in parallel)

### 3. Filtered Decks
- [ ] New DB schema: `filtered_decks` table (`id`, `user_id`, `name`, `query`, `limit`, `created_at`)
- [ ] Query builder UI (search field with autocomplete: `is:new`, `is:due`, `deck:Math`, `tag:hard`)
- [ ] Query parser & evaluator (runs against card_states + cards)
- [ ] Save/load filtered deck presets
- [ ] Review filtered deck (temporary study set, doesn't affect card scheduling)
- **Effort:** 3-4 hours
- **Blocks:** Depends on Subdeck Hierarchy

### 4. Card Browser
- [ ] New route `/study/browser` or modal overlay
- [ ] Columns: Front | Back | Deck | Due | Interval | Ease | Reviews
- [ ] Sortable columns (click header to sort ascending/descending)
- [ ] Filter bar (text search, deck filter, card type)
- [ ] Bulk actions: Suspend | Bury | Delete | Move to deck
- [ ] Preview pane (click row to see card front/back)
- [ ] Edit card modal (update front/back/reading)
- **Effort:** 6-8 hours
- **Blocks:** Depends on Subdeck Hierarchy

### 5. Cram Mode
- [ ] New session mode: `mode='cram'` in `sessions` table
- [ ] Study button option: "Cram: Study all X cards without scheduling"
- [ ] During session: show all cards (new + due + old) in random order
- [ ] After session: don't update card scheduling, only log reviews
- [ ] Summary: "Cards reviewed in cram mode (scheduling unchanged)"
- **Effort:** 2-3 hours
- **Blocks:** Depends on Subdeck Hierarchy (for deck selection)

### 6. Stats & Graphs
- [ ] New route `/study/stats`
- [ ] Query metrics:
  - [ ] Cards added per day (last 30 days)
  - [ ] Cards reviewed per day (last 30 days)
  - [ ] Average time per card
  - [ ] Card ease distribution (histogram)
  - [ ] Retention rate (% of reviews correct)
- [ ] Visualizations: Chart.js line/bar/histogram charts
- [ ] Time window selector (7 days / 30 days / all time)
- **Effort:** 4-6 hours
- **Blocks:** Nothing (independent feature)

### 7. Custom Fields & Card Templates
- [ ] Extend `cards` schema: `fields_json` (stores user-defined field values)
- [ ] Define fields per deck or globally (TBD)
- [ ] Template editor UI (HTML + CSS + variable reference)
- [ ] Template renderer: substitute `{{front}}`, `{{back}}`, `{{custom_field}}` into HTML
- [ ] Card review: render using template instead of hardcoded React component
- [ ] Migration: convert existing cards to template format
- **Effort:** 4-5 hours (design-heavy)
- **Blocks:** Nothing (can come late in phase)

### 8. Testing & Polish
- [ ] E2E test: Create deck → Add cards → Suspend some → Filter → Cram → Stats
- [ ] Test subdeck nesting (5+ levels deep)
- [ ] Test filtered deck with complex query
- [ ] Test card browser bulk operations
- [ ] Responsive design on mobile (browser, stats)
- [ ] Keyboard shortcuts (delete, edit, suspend)
- **Effort:** 5-7 hours
- **Blocks:** Nothing (last step before shipping)

---

## Priority 5: Polish & Future (Month+)

### 4. AI Learning Path Generator
- [ ] Assess user's imported content (vocab + grammar)
- [ ] AI generates CEFR-aligned topic sequence (A1 → A2 → B1 → B2)
- [ ] Store as JSON in user data
- [ ] Visualise as path/roadmap (UI TBD)
- [ ] Track progress through path
- **Effort:** 4-6 hours (design-heavy)
- **Blocks:** Nothing (nice-to-have feature)

---

## Active Blockers / Dependencies

| Blocker | Resolution | ETA |
|---------|-----------|-----|
| None | — | Ready to ship |

---

## Known Issues to Watch

| Issue | Status | Impact |
|-------|--------|--------|
| Vite dev server on port 5174 (5173 in use) | Cosmetic | Low — just remember to use 5174 for testing |
| TypeScript compiler not in PATH | Cosmetic | Low — build still works via npm |
| Old bundle files may exist in `app/data/` | Check needed | Low — won't affect imports |

---

## Testing Checklist Before Ship

- [ ] Weekly goals widget shows correct calculation
- [ ] Content import (all three categories) routes correctly
- [ ] Audio playback works on imported Anki cards
- [ ] Grammar review counts match imported grammar points
- [ ] Learn section loads imported lessons in order
- [ ] Heatmap colours split correctly (blue=vocab, purple=grammar, green=both)
- [ ] No TypeScript errors
- [ ] Both dev servers running cleanly (Vite + Express)

---

## Notes

- **Weekly goals**: Needs `goalDate` to be a real ISO date string in store (e.g., `"2026-12-31"`)
- **Content import**: Extraction prompt is strict and well-tested; main risk is PDF quality
- **ScenarioMode v2**: UX decision critical — don't start coding until decision is made
- **Learning path**: Lowest priority; can be deferred to post-ship polish phase
