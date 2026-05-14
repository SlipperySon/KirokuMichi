# Anki Clone Implementation Plan — KirokuMichi

**Status:** Ready for development
**Target Timeline:** 4 weeks full-time (or 8-10 weeks part-time)
**Tech Stack:** React + TypeScript + SQLite (sql.js) + Express backend

---

## Phase 1: Foundation & Core Decks (Week 1)

### 1.1 Database Schema & Setup

**Tasks:**
- [ ] Copy Anki schema from ANKI_SPEC_VERIFIED.md to `app/src/db/schema.ts`
- [ ] Create SQLite migrations:
  - [ ] `001_init_schema.sql` (col, notes, cards, revlog, graves tables)
  - [ ] `002_add_indexes.sql` (scheduling, syncing, searches)
- [ ] Initialize `col` table with defaults on first run
- [ ] Add deck tree JSON structure to `col.decks`
- [ ] Add deck config JSON to `col.dconf`

**Files to create:**
- `app/src/db/schema.ts` — schema definitions
- `app/src/db/migrations/` — migration files
- `app/src/db/init.ts` — database initialization

**Estimated effort:** 2 hours

---

### 1.2 Card & Deck Models (TypeScript)

**Tasks:**
- [ ] Create TypeScript interfaces:
  - [ ] `Card` (all fields from ANKI_SPEC)
  - [ ] `CardType` enum (New, Learn, Review, Relearn)
  - [ ] `CardQueue` enum (0-4, -1, -2, -3)
  - [ ] `Deck` (id, name, parent_id, conf_id, collapsed)
  - [ ] `DeckConfig` (new, review, lapse settings)
  - [ ] `Note` (id, guid, mid, mod, usn, tags, flds, sfld, csum)
  - [ ] `NoteType` (fields, templates, css)
  - [ ] `Review` (revlog entry)

**Files to create:**
- `app/src/types/card.ts`
- `app/src/types/deck.ts`
- `app/src/types/note.ts`
- `app/src/types/review.ts`

**Estimated effort:** 1.5 hours

---

### 1.3 SM2 Scheduling Engine

**Tasks:**
- [ ] Implement SM2 algorithm in `app/src/srs/sm2-scheduler.ts`:
  ```typescript
  interface ScheduleResult {
    newInterval: number
    newEase: number
    newQueue: CardQueue
    newType: CardType
    due: number
  }
  
  function scheduleCard(
    card: Card,
    response: 1 | 2 | 3 | 4,  // Again, Hard, Good, Easy
    config: DeckConfig
  ): ScheduleResult
  ```
- [ ] Implement ease factor calculation (min 1.3, initial 2.5)
- [ ] Implement interval calculation (with fuzz)
- [ ] Implement lapse handling (relearning steps)
- [ ] Implement leech detection (suspend after N lapses)

**Constants to use (from ANKI_SPEC):**
- Initial ease: 2.5
- Min ease: 1.3
- Again delta: -0.2
- Hard delta: -0.15
- Good delta: 0.0 (or +0.05 variant)
- Easy delta: +0.15

**Files to create:**
- `app/src/srs/sm2-scheduler.ts`
- `app/src/srs/scheduler-types.ts`

**Test cases needed:**
- [ ] New card → Good → enters Review (graduating_interval days)
- [ ] Review card → Again → enters Relearn (lapse handling)
- [ ] Ease factor bounds (never < 1.3)
- [ ] Interval fuzz (randomization within bounds)

**Estimated effort:** 3 hours

---

### 1.4 Queue Building Logic

**Tasks:**
- [ ] Implement queue builder in `app/src/srs/queue-builder.ts`:
  ```typescript
  interface QueuedCard {
    card: Card
    kind: 'new' | 'learning' | 'review'
    nextStates: SchedulingStates
  }
  
  function buildQueue(
    deckId: DeckId,
    config: DeckConfig,
    now: Date
  ): QueuedCard[]
  ```
- [ ] Queue priority order:
  1. Learning cards due now (absolute timestamp)
  2. Review cards due today (days since epoch)
  3. New cards (up to new_per_day limit)
  4. Learning cards ahead (if learn_ahead_secs allows)
- [ ] Implement interleaving ratio (new/review balance)
- [ ] Implement sibling burial (bury other cards from same note)
- [ ] Calculate remaining steps for learning cards

**Files to create:**
- `app/src/srs/queue-builder.ts`
- `app/src/srs/queue-types.ts`

**Estimated effort:** 2.5 hours

---

### 1.5 Card CRUD Operations

**Tasks:**
- [ ] Create `app/src/db/card-service.ts`:
  ```typescript
  class CardService {
    getCard(cardId: CardId): Promise<Card>
    updateCard(card: Card): Promise<void>
    getCardsByDeck(deckId: DeckId): Promise<Card[]>
    getCardsByNote(noteId: NoteId): Promise<Card[]>
    deleteCard(cardId: CardId): Promise<void>
    moveCard(cardId: CardId, targetDeckId: DeckId): Promise<void>
    suspendCard(cardId: CardId): Promise<void>
    unsuspendCard(cardId: CardId): Promise<void>
    buryCard(cardId: CardId): Promise<void>
    unburyCard(cardId: CardId): Promise<void>
  }
  ```
- [ ] Implement database queries
- [ ] Add transaction support for batch operations

**Estimated effort:** 2 hours

---

### 1.6 Review Answering Logic

**Tasks:**
- [ ] Create `app/src/srs/answer-card.ts`:
  ```typescript
  function answerCard(
    card: Card,
    rating: 1 | 2 | 3 | 4,
    deckConfig: DeckConfig,
    now: Date
  ): Card {
    // Returns updated card with new state
    // Calls SM2 scheduler
    // Updates reps, lapses, ease, interval, due
    // Logs to revlog
  }
  ```
- [ ] Create revlog entry
- [ ] Handle state transitions (New → Learn → Review, etc.)
- [ ] Calculate next due date

**Estimated effort:** 1.5 hours

---

## Phase 2: Deck Management & UI (Week 2)

### 2.1 Deck CRUD Operations

**Tasks:**
- [ ] Create `app/src/db/deck-service.ts`:
  ```typescript
  class DeckService {
    createDeck(name: string, parentId?: DeckId): Promise<Deck>
    getDeck(deckId: DeckId): Promise<Deck>
    getAllDecks(): Promise<Deck[]>
    getDeckTree(): Promise<DeckNode[]>  // Hierarchical
    renameDeck(deckId: DeckId, newName: string): Promise<void>
    moveDeck(deckId: DeckId, newParentId?: DeckId): Promise<void>
    deleteDeck(deckId: DeckId, moveCards?: DeckId): Promise<void>
    getDeckConfig(deckId: DeckId): Promise<DeckConfig>
    updateDeckConfig(deckId: DeckId, config: DeckConfig): Promise<void>
  }
  ```
- [ ] Implement deck tree building (parent_id relationships)
- [ ] Handle deck deletion (cascade or move cards)
- [ ] Validate deck names (no duplicates at same level)

**Estimated effort:** 2 hours

---

### 2.2 Deck Merging & Card Movement

**Tasks:**
- [ ] Create `app/src/db/deck-merge-service.ts`:
  ```typescript
  class DeckMergeService {
    mergeDeck(sourceDeckId: DeckId, targetDeckId: DeckId): Promise<void>
    // Move all cards from source → target, delete source
    
    moveCards(cardIds: CardId[], targetDeckId: DeckId): Promise<void>
    // Bulk move cards to different deck
  }
  ```
- [ ] Implement batch card movement
- [ ] Clear FSRS data on move (optional)
- [ ] Log operation for undo

**Estimated effort:** 1 hour

---

### 2.3 Deck Navigation UI

**Tasks:**
- [ ] Create `app/src/components/DeckTree.tsx`:
  ```typescript
  interface DeckTreeProps {
    decks: DeckNode[]
    selectedDeckId: DeckId
    onSelectDeck: (deckId: DeckId) => void
    onCreateDeck: () => void
    onRenameDeck: (deckId: DeckId) => void
    onMoveDeck: (deckId: DeckId, newParentId?: DeckId) => void
    onDeleteDeck: (deckId: DeckId) => void
    onMergeDeck: (sourceDeckId: DeckId, targetDeckId: DeckId) => void
  }
  ```
- [ ] Nested tree rendering (parent >> child >> grandchild)
- [ ] Expand/collapse toggle
- [ ] Right-click context menu:
  - [ ] Create sub-deck
  - [ ] Rename
  - [ ] Delete
  - [ ] Merge into...
- [ ] Drag-drop to move decks (optional, Phase 4)
- [ ] Show card counts per deck (new, learning, review)

**Estimated effort:** 3 hours

---

### 2.4 Review Session UI

**Tasks:**
- [ ] Create `app/src/pages/ReviewSession.tsx`:
  - [ ] Show front side of card
  - [ ] "Show Answer" button (or spacebar)
  - [ ] Show back side + front (for context)
  - [ ] Four response buttons: Again (1), Hard (2), Good (3), Easy (4)
  - [ ] Keyboard shortcuts: 1-4 for responses
  - [ ] Show card count: "15 remaining"
  - [ ] Show deck name + config info

**Components:**
- `CardDisplay.tsx` — Front/back rendering
- `ResponseButtons.tsx` — 4 buttons with keyboard support
- `ReviewStats.tsx` — Cards remaining, time, etc.

**Estimated effort:** 3 hours

---

### 2.5 Deck Switching

**Tasks:**
- [ ] Add deck selector to review session
- [ ] Allow switching decks mid-session (cancel current, start new)
- [ ] Update Zustand store:
  ```typescript
  interface StudyStore {
    selectedDeckId: DeckId
    setSelectedDeckId: (deckId: DeckId) => void
    // ... rest
  }
  ```

**Estimated effort:** 1 hour

---

### 2.6 Review Summary & Statistics

**Tasks:**
- [ ] Create `app/src/components/ReviewSummary.tsx`:
  - [ ] Cards studied today
  - [ ] Time spent
  - [ ] New cards learned
  - [ ] Review cards studied
  - [ ] Rating distribution (1/2/3/4)
  - [ ] New ease range

**Estimated effort:** 1.5 hours

---

## Phase 3: Import & Custom Decks (Week 3)

### 3.1 Create Custom Deck UI

**Tasks:**
- [ ] Create `app/src/components/CreateDeckModal.tsx`:
  - [ ] Deck name input
  - [ ] Parent deck selector
  - [ ] Deck config template dropdown:
    - [ ] Default (Anki defaults)
    - [ ] Custom
  - [ ] Create button
- [ ] Integrate with DeckService.createDeck()

**Estimated effort:** 1.5 hours

---

### 3.2 Manual Card Entry

**Tasks:**
- [ ] Create `app/src/components/AddCardModal.tsx`:
  - [ ] Note type selector
  - [ ] Field inputs (dynamic based on note type)
  - [ ] Tags input
  - [ ] Target deck selector
  - [ ] Add & continue / Add & close
- [ ] Call CardService to create card

**Estimated effort:** 2 hours

---

### 3.3 .apkg Import (Using Existing Code)

**Tasks:**
- [ ] Integrate existing `.apkg` import:
  - [ ] Parse ZIP + SQLite
  - [ ] Extract media
  - [ ] Extract notes + cards
  - [ ] Create new deck
  - [ ] Insert cards with media references
- [ ] Handle duplicates:
  - [ ] Skip (default)
  - [ ] Update existing
  - [ ] Import as new cards

**Files:**
- Use existing `app/src/srs/ankiImport.ts`

**Estimated effort:** 1.5 hours

---

### 3.4 Curriculum Deck Auto-Generation

**Tasks:**
- [ ] Create `app/src/import/curriculum-importer.ts`:
  ```typescript
  interface CurriculumImportConfig {
    curriculum: 'genki_1' | 'genki_2' | 'quartet_1' | 'quartet_2' | 'marugoto_a1' | ...
    targetDeckId?: DeckId  // if not provided, create new
    mergeLessonVocab?: boolean  // combine all lesson vocab into one deck?
  }
  
  async function importCurriculumDeck(config: CurriculumImportConfig): Promise<void>
  ```
- [ ] Read curriculum JSON (from `curriculum-lessons-index.json`)
- [ ] Create deck structure:
  - [ ] Option A: One deck per lesson (Genki 1 L1, L2, L3, ...)
  - [ ] Option B: One vocab deck + one grammar deck per level
  - [ ] Option C: Single merged deck
- [ ] Import vocab cards:
  - [ ] Front: Japanese word
  - [ ] Back: meaning + reading + example
  - [ ] Tags: #genki_1, #lesson_1, #vocab
- [ ] Import grammar cards:
  - [ ] Front: pattern + sentence
  - [ ] Back: explanation + examples
  - [ ] Tags: #genki_1, #lesson_1, #grammar
- [ ] Link curriculum metadata (for unlock feature later)

**Files to create:**
- `app/src/import/curriculum-importer.ts`
- `app/src/import/curriculum-types.ts`

**Estimated effort:** 3 hours

---

### 3.5 Curriculum Deck Management UI

**Tasks:**
- [ ] Create `app/src/components/CurriculumImportWizard.tsx`:
  - [ ] Step 1: Select curriculum (Genki 1, Quartet 1, etc.)
  - [ ] Step 2: Choose import mode:
    - [ ] Create separate decks per lesson
    - [ ] Create one deck per skill (vocab, grammar)
    - [ ] Merge into single deck
  - [ ] Step 3: Review & confirm
  - [ ] Step 4: Import progress
- [ ] Show list of available curriculum packs
- [ ] Allow re-importing (merge with existing or replace)

**Estimated effort:** 2 hours

---

### 3.6 Batch Import

**Tasks:**
- [ ] Allow drag-drop multiple `.apkg` files
- [ ] Import all into separate decks or merge
- [ ] Progress bar + results summary

**Estimated effort:** 1.5 hours

---

## Phase 4: Card Browser & Advanced (Week 4)

### 4.1 Card Browser

**Tasks:**
- [ ] Create `app/src/pages/CardBrowser.tsx`:
  - [ ] Sortable columns: Front, Back, Ease, Interval, Due, Created
  - [ ] Search bar with Anki query syntax:
    - [ ] `deck:Genki` — specific deck
    - [ ] `is:new / is:review / is:learning` — card state
    - [ ] `prop:ivl>30` — interval > 30 days
    - [ ] `tag:vocab` — has tag
  - [ ] Saved searches (filters)
  - [ ] Sort buttons: ease, interval, due, created, reps

**Components:**
- `CardTable.tsx` — virtualized table
- `SearchBar.tsx` — query builder
- `SearchSuggestions.tsx` — autocomplete

**Estimated effort:** 4 hours

---

### 4.2 Bulk Operations

**Tasks:**
- [ ] Checkbox select cards
- [ ] Bulk action buttons:
  - [ ] Move to deck...
  - [ ] Delete
  - [ ] Suspend/Unsuspend
  - [ ] Bury/Unbury
  - [ ] Reset progress
  - [ ] Change ease (+0.1, -0.1)
  - [ ] Add/Remove tags

**Estimated effort:** 2 hours

---

### 4.3 Card Editing

**Tasks:**
- [ ] Card detail view (modal or side panel):
  - [ ] Edit front/back fields
  - [ ] Change deck
  - [ ] Add tags
  - [ ] View review history
  - [ ] Manual ease adjustment
  - [ ] Reset progress button
- [ ] Save changes back to database

**Estimated effort:** 2 hours

---

### 4.4 Statistics Dashboard

**Tasks:**
- [ ] Create `app/src/components/StatsDashboard.tsx`:
  - [ ] Cards reviewed today
  - [ ] Time spent today
  - [ ] Daily breakdown (bar chart)
  - [ ] Ease factor distribution
  - [ ] Interval distribution (log scale)
  - [ ] Current streak
  - [ ] Leech cards (most-lapsed)
  - [ ] Cards added/updated today

**Libraries:** Chart.js or Recharts

**Estimated effort:** 2.5 hours

---

### 4.5 Keyboard Shortcuts

**Tasks:**
- [ ] Global shortcuts:
  - [ ] `1-4` — Answer card (Again, Hard, Good, Easy)
  - [ ] `Space` — Reveal answer
  - [ ] `Shift+1` — Suspend
  - [ ] `Shift+2` — Bury
  - [ ] `Ctrl+Z` — Undo
  - [ ] `Ctrl+1` — Deck 1
  - [ ] `Ctrl+2` — Deck 2
- [ ] Create shortcuts guide/help modal

**Estimated effort:** 1 hour

---

## Phase 5: Optional / Polish (Week 4-5)

### 5.1 Filtered Decks (Advanced)

**Tasks:**
- [ ] Create `app/src/components/FilteredDeckWizard.tsx`:
  - [ ] Search query input (with suggestions)
  - [ ] Daily limit
  - [ ] Card ordering
  - [ ] Create filtered deck button
- [ ] Implement deck filtering:
  - [ ] Query parsing
  - [ ] Card filtering logic
  - [ ] Store odue/odid for card restoration
  - [ ] Restore cards on filtered deck deletion

**Estimated effort:** 3 hours (optional)

---

### 5.2 Undo/Redo

**Tasks:**
- [ ] Maintain undo queue (in-memory):
  ```typescript
  interface UndoEntry {
    action: 'answer_card' | 'edit_card' | 'move_card' | 'delete_card' | ...
    cardId?: CardId
    oldState?: Card
    newState?: Card
    timestamp: Date
  }
  ```
- [ ] Undo/redo stack (max 20 entries)
- [ ] Ctrl+Z / Ctrl+Shift+Z shortcuts
- [ ] Undo button in UI

**Estimated effort:** 1.5 hours (optional)

---

### 5.3 Card Templates & Custom Fields

**Tasks:**
- [ ] Note type editor:
  - [ ] Add/remove fields
  - [ ] Field templates (HTML/CSS)
  - [ ] Preview rendering
- [ ] Template system (handlebars-style variable substitution)

**Estimated effort:** 3 hours (optional, Phase 2 enhancement)

---

### 5.4 .apkg Export

**Tasks:**
- [ ] Package deck as `.apkg` (ZIP + SQLite):
  - [ ] Export selected cards
  - [ ] Include media
  - [ ] Create media directory
  - [ ] Generate manifest
- [ ] Allow download or email

**Estimated effort:** 2 hours (optional)

---

## Integration Checklist

### Before Phase 1:
- [ ] Set up React project structure (already done)
- [ ] Update TypeScript paths
- [ ] Create testing setup (Vitest)

### Before Phase 2:
- [ ] Verify SQLite schema works
- [ ] Test SM2 scheduler with unit tests
- [ ] Test queue building logic

### Before Phase 3:
- [ ] Curriculum JSON files are accessible
- [ ] .apkg import code is working
- [ ] Media storage (IndexedDB) ready

### Before Phase 4:
- [ ] Card browser search syntax tested
- [ ] Database indexes optimized
- [ ] Statistics queries efficient

---

## Database Queries Needed

```sql
-- Get next card for deck
SELECT * FROM cards 
WHERE did = ? AND queue IN (1, 2, 0) 
ORDER BY (CASE 
  WHEN queue = 1 THEN 0
  WHEN queue = 2 THEN 1
  WHEN queue = 0 THEN 2
  END), due
LIMIT 1;

-- Get deck card counts
SELECT 
  SUM(CASE WHEN queue = 0 THEN 1 ELSE 0 END) as new_count,
  SUM(CASE WHEN queue = 1 THEN 1 ELSE 0 END) as learn_count,
  SUM(CASE WHEN queue = 2 THEN 1 ELSE 0 END) as review_count
FROM cards WHERE did = ?;

-- Get review history
SELECT * FROM revlog WHERE cid = ? ORDER BY id DESC;

-- Bulk move cards
UPDATE cards SET did = ? WHERE id IN (...);

-- Get deck tree
SELECT * FROM decks ORDER BY name;
```

---

## File Structure (Target)

```
app/src/
├── db/
│   ├── schema.ts
│   ├── init.ts
│   ├── card-service.ts
│   ├── deck-service.ts
│   ├── deck-merge-service.ts
│   └── migrations/
├── srs/
│   ├── sm2-scheduler.ts
│   ├── queue-builder.ts
│   ├── answer-card.ts
│   ├── scheduler-types.ts
│   └── ankiImport.ts (existing)
├── import/
│   ├── curriculum-importer.ts
│   └── curriculum-types.ts
├── components/
│   ├── DeckTree.tsx
│   ├── CreateDeckModal.tsx
│   ├── AddCardModal.tsx
│   ├── CardDisplay.tsx
│   ├── ResponseButtons.tsx
│   ├── ReviewStats.tsx
│   ├── ReviewSummary.tsx
│   ├── CardBrowser.tsx
│   ├── CardTable.tsx
│   ├── SearchBar.tsx
│   ├── StatsDashboard.tsx
│   ├── CurriculumImportWizard.tsx
│   ├── FilteredDeckWizard.tsx
│   └── ScheduleModal.tsx
├── pages/
│   ├── ReviewSession.tsx
│   ├── CardBrowser.tsx
│   └── DeckManager.tsx
├── types/
│   ├── card.ts
│   ├── deck.ts
│   ├── note.ts
│   └── review.ts
└── store/
    └── study-store.ts (Zustand)
```

---

## Testing Strategy

### Unit Tests (Vitest)
- [ ] SM2 scheduler (all responses, edge cases)
- [ ] Queue builder (ordering, interleaving)
- [ ] Card CRUD operations
- [ ] Deck operations
- [ ] Card merging

### Integration Tests
- [ ] End-to-end review session
- [ ] Import + verify cards
- [ ] Bulk operations
- [ ] Deck switching mid-session

### Manual Testing
- [ ] UI interactions
- [ ] Keyboard shortcuts
- [ ] Performance (100+ cards)
- [ ] Browser compatibility

---

## Performance Targets

- **Card query:** < 10ms (with indexes)
- **Queue build:** < 50ms (1000 cards)
- **Review session load:** < 100ms
- **Card browser:** < 200ms (paginated, 50 cards/page)
- **Stats calculation:** < 500ms

---

## Milestones

**Week 1 End:** Core review session working (pick deck → study → answer → next card)
**Week 2 End:** Deck management UI complete (create, switch, merge, delete)
**Week 3 End:** Curriculum import working (Genki 1, Quartet 1, etc. importable)
**Week 4 End:** Card browser + bulk operations complete

---

**Status:** ✅ Ready to code!

Start with Phase 1.1 (Database Schema).
