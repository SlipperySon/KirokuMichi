# KirokuMichi — Active Todo List

Last updated: 2026-05-06

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
- [ ] Update ContentUpload.tsx to accept multiple PDFs (drag-drop multiple files)
- [ ] Extract text from all PDFs in document order
- [ ] Pass all extracted text to single AI call for unified context
- [ ] Update `EXTRACTION_SYSTEM_PROMPT` to note user knows hiragana/katakana (no kana drills)
- [ ] Detect Genki 1 v3 textbook/workbook:
  - [ ] Filename pattern matching (e.g., "Genki 1" + "v3" or user manual selection in UI)
  - [ ] Add special instruction to extraction prompt: "For Genki 1 v3, eliminate ruby furigana over kanji in lessons"
- [ ] Post-import furigana hover/highlight for Genki content:
  - [ ] Detect kanji in lesson text with furigana removed
  - [ ] On hover or selection: JavaScript intercept, show furigana tooltip or inline
  - [ ] Store mapping of kanji → furigana during import for lookup
- [ ] Test with actual Genki 1 v3 PDFs (textbook + workbook together)
- **Effort:** 2-3 hours (PDF handling + Genki detection + furigana interaction)
- **Blocks:** Shipping content import feature (can be done in parallel with 2.)

### 2c. Word Selection & Deck Import / Textbook Pair Unlock
- [ ] **Word selection in lessons**: User can highlight/click words in LearningMode or lesson preview
- [ ] **Custom deck import**: Selected words → route to user's chosen deck in SRS (e.g., "My Vocab" deck)
- [ ] **Textbook pair detection and unlock flows**: Detect if content matches known textbook/deck pairs (starting with Genki 1 v3)
  - [ ] Show "Unlock" button for vocab learned in current lesson for mapped textbook pairs
  - [ ] User can request additional words via dialog: "Add these words to my [Textbook] deck"
  - [ ] If user has matching imported Anki deck, route unlocked words there automatically
  - [ ] If no matching deck exists, prompt user to choose/create target deck
  - [ ] Keep textbook-pair mapping extensible so future textbook sets can opt into unlock flow
  - [ ] Create mapping: lesson → vocab IDs in lesson → unlock status per user
- [ ] Store in DB: `lesson_vocabulary` table (lesson_id, vocab_id, unlocked_by_user, added_to_deck_id)
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
- **Effort:** 4-6 hours (DB schema + pair mapping + UI selection + deck routing + note support)
- **Blocks:** Depends on Subdeck Hierarchy (Phase 5) for multi-deck support

---

## Priority 3: Medium-Term Features (Next Week)

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
