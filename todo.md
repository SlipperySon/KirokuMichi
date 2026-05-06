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

## Priority 4: Polish & Future (Month+)

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
