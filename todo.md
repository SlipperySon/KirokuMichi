# KirokuMichi — Active Todo List

Last updated: 2026-05-14 13:12 UTC

**EXTRACTION STATUS:** ✅ A1 COMPLETE (27 packs) | ✅ A2 COMPLETE (27 packs) | ✅ B1-B2 COMPLETE (27 packs) | **54 TOTAL LESSONS EXTRACTED**

---

## Priority 1: Quick Wins (This Week)

### 1. Weekly Goals Widget
- [x] Add `jlptTarget` + `goalDate` to Zustand store (if not present)
- [x] Implement weekly goal calculation: `(cardsNeeded / weeksRemaining)` per week
- [x] Query `sessions` table for this week's activity: `GROUP BY DATE(started_at) WHERE started_at >= date('now', 'weekday 1', '-7 days')`
- [x] Display on StudyDashboard: "X cards this week · Y needed for goal"
- [x] Add progress bar or simple indicator
- [x] Test with various goal dates (past, future, urgent)
- **Effort:** 1-2 hours
- **Blocks:** Nothing (independent feature)

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
- [ ] Test with Anki import (`.apkg`) in parallel to validate no regressions
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
