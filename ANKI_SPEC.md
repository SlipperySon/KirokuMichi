# Anki Specification — Black Box Analysis

**Purpose:** Document Anki's architecture, data model, and algorithms for clean-room reimplementation.

**Last Updated:** 2026-05-14

---

## 1. Core Concepts

### 1.1 Deck System

**Hierarchy:**
- Decks are tree-structured (parent_id relationship)
- Deck path notation: `Parent::Child::Grandchild`
- Each deck has independent configuration (daily limits, scheduler choice)
- Special `Default` deck for cards without explicit deck assignment

**Deck Properties:**
- `id`: unique identifier
- `name`: display name
- `parent_id`: parent deck (NULL for root decks)
- `created_at`: creation timestamp
- `desc`: optional description
- `config_id`: reference to deck config (learning steps, graduating interval, easy interval, etc.)

**Deck Config:**
- **New card settings:**
  - `new_steps`: learning steps (e.g., [1, 10] = 1 min, then 10 min reviews)
  - `new_per_day`: daily new card limit
  - `new_order`: order type (random, added, due)
  
- **Review settings:**
  - `review_per_day`: daily review limit
  - `easy_pct`: percentage to assign ease +0.3 (default ~90%)
  - `graduating_interval`: days until card moves from Learning → Review (default 1)
  - `easy_interval`: days for "Easy" response (default 4)
  - `max_review_interval`: cap on card interval (default 36500)
  
- **Lapse settings:**
  - `lapse_steps`: relearning steps when card lapses
  - `lapse_new_interval`: interval multiplier after lapse (e.g., 0.5 = 50% of original)
  - `lapse_min_interval`: minimum interval after lapse
  - `leech_threshold`: lapses before card is marked "leech" (default 8)
  - `leech_action`: suspend or tag leech cards

---

### 1.2 Card States & Queue System

**Card States (3 queues):**

1. **New Queue**
   - Cards user hasn't seen yet
   - Count: cards with `due >= today` and `type == 0`
   - Order: by `due` or `id` (configurable)

2. **Learning Queue**
   - Cards in learning steps (user failed or just added)
   - Due time is absolute (specific minute/hour, not just date)
   - Count: cards with `queue == 1` and `due <= now`
   - Multiple reviews possible in same day

3. **Review Queue**
   - Cards in SRS (graduating review state)
   - Due date is future date (integer: days since 2011-01-01)
   - Count: cards with `queue == 2` and `due <= today`
   - Typically 1 review per day per card max (except filtered decks)

**State Transitions:**
```
New → Learning (user presses "Again" or "Good")
   ↓
Review (graduating interval reached)
   ↓
Leech / Suspended (optional, based on lapses or manual action)

Review → Learning (lapse: user presses "Again")
   ↓
Review (relearning steps completed)
```

**Card Fields (in `cards` table):**
- `id`: card ID (timestamp-based)
- `nid`: note ID (card belongs to a note)
- `did`: deck ID (card current location)
- `type`: 0=new, 1=learning, 2=review
- `queue`: 0=new, 1=learning, 2=review, -1=suspended, -2=buried user, -3=buried sched
- `due`: 
  - New/Review: integer days since epoch (2011-01-01)
  - Learning: integer minutes since epoch
- `ivl`: review interval in days (0 for new/learning)
- `factor`: ease factor × 1000 (e.g., 2500 = 2.5)
- `reps`: total review count
- `lapses`: times card was lapsed
- `left`: reviews left in current step (not persisted, calculated)
- `odue`: original due (used by filtered decks)
- `odid`: original deck ID (used by filtered decks)
- `flags`: bit flags (0-7 for user flags, bit 7 = marked)
- `data`: reserved
- `crt`: card creation timestamp (for sorting)

---

### 1.3 Note/Card/Template System

**Notes (collection of fields for one concept):**
- `id`: note ID
- `guid`: unique global ID
- `mid`: model ID (card type)
- `mod`: modification timestamp
- `usn`: update sequence number (sync)
- `tags`: space-separated tag string
- `flds`: fields separated by `\x1f` (ASCII 31)
- `sfld`: sort field (cached, used for sorting)
- `csum`: field checksum (for sync)
- `flags`: reserved
- `data`: reserved

**Models (Card Types / Note Types):**
- Define field structure (e.g., "Front", "Back", "Hint")
- Define card templates (which fields appear on front/back)
- Anki auto-generates cards from notes using templates

**Card Template:**
```html
<!-- Front side -->
{{Front}}

<!-- Back side -->
{{FrontSide}}
<hr id="answer">
{{Back}}
```

Variables available:
- `{{FieldName}}`: field content
- `{{#Conditional}}...{{/Conditional}}`: conditional rendering (non-empty field)
- `{{FrontSide}}`: rendered front (for back side)

---

### 1.4 Suspend & Bury Mechanics

**Suspend:**
- `queue = -1` (suspended state)
- Card excluded from all queues
- User manually suspends (or automatic on leech)
- Manual unsuspend reverses to previous state

**Buried (User):**
- `queue = -2` (buried user)
- Card skipped for today (available tomorrow)
- Multiple reviews of same note in one day: bury siblings

**Buried (Scheduled):**
- `queue = -3` (buried scheduled)
- Automatically buried (e.g., when sibling is answered)
- Unbury at next day rollover

**Bury/Suspend Logic:**
- Sibling burial: if note has multiple cards, only study one per day
- Leech action: suspend or tag after threshold lapses
- Can manually bury/suspend/unsuspend individual cards

---

### 1.5 Filtered Decks

**Purpose:** Temporary deck with custom query (no persistent cards)

**Features:**
- Query: `"deck:Genki is:due prop:ivl>30"` (example)
- Search operators:
  - `deck:DECK` — in deck (including children)
  - `is:new/learning/review/due` — card state
  - `prop:ivl>N` — interval greater than N days
  - `prop:ease>=2.5` — ease factor
  - `prop:reps>10` — more than 10 reviews
  - `is:suspended/buried` — state
  - `tag:TAG` — has tag
  - `note:MODEL` — note type
  - `field:FIELD contains "text"` — field search
  - `added:1` — added today
  - `rated:1:2` — rated in last 1 day as 2 or worse
- Limit: number of cards (e.g., 50)
- Order: by ease/interval/recency/random

**Behavior:**
- Creates temporary deck
- Moved cards: `odue` and `odid` store original deck/due
- When filtered deck deleted: cards return to original deck
- Scheduling in filtered deck can modify intervals (resets on return)

---

## 2. Database Schema

### Core Tables

```sql
-- Decks
CREATE TABLE decks (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  parent_id INTEGER,
  created_at INTEGER,
  desc TEXT,
  config_id INTEGER,
  dyn INTEGER  -- 1 if filtered deck
);

-- Deck Config
CREATE TABLE deck_config (
  id INTEGER PRIMARY KEY,
  name TEXT,
  new_steps TEXT,  -- e.g., "1 10"
  new_per_day INTEGER,
  new_order INTEGER,
  review_per_day INTEGER,
  graduating_interval INTEGER,
  easy_interval INTEGER,
  easy_pct INTEGER,
  max_review_interval INTEGER,
  lapse_steps TEXT,
  lapse_new_interval REAL,
  lapse_min_interval INTEGER,
  leech_threshold INTEGER,
  leech_action INTEGER  -- 0=suspend, 1=tag
);

-- Notes
CREATE TABLE notes (
  id INTEGER PRIMARY KEY,
  guid TEXT UNIQUE,
  mid INTEGER,  -- model ID
  mod INTEGER,  -- modification time
  usn INTEGER,
  tags TEXT,
  flds TEXT,  -- fields separated by \x1f
  sfld TEXT,  -- sort field (cached)
  csum INTEGER,
  flags INTEGER,
  data TEXT
);

-- Cards
CREATE TABLE cards (
  id INTEGER PRIMARY KEY,
  nid INTEGER,  -- note ID
  did INTEGER,  -- deck ID
  type INTEGER,  -- 0=new, 1=learning, 2=review
  queue INTEGER,  -- -3=buried sched, -2=buried user, -1=suspended, 0=new, 1=learning, 2=review
  due INTEGER,  -- days since epoch for new/review, minutes for learning
  ivl INTEGER,  -- interval in days
  factor INTEGER,  -- ease factor × 1000
  reps INTEGER,  -- total reviews
  lapses INTEGER,  -- times card lapsed
  left INTEGER,  -- reviews left in current step (calculated, not stored)
  odue INTEGER,  -- original due (filtered decks)
  odid INTEGER,  -- original deck ID (filtered decks)
  flags INTEGER,  -- user flags + marked bit
  data TEXT
);

-- Models (Card Types)
CREATE TABLE models (
  id INTEGER PRIMARY KEY,
  name TEXT,
  fields TEXT,  -- JSON array of field definitions
  tmpls TEXT,  -- JSON array of card templates
  css TEXT,  -- card CSS
  mod INTEGER,
  usn INTEGER,
  flds_json TEXT
);

-- Reviews (log of all reviews)
CREATE TABLE reviews (
  id INTEGER PRIMARY KEY,
  cid INTEGER,  -- card ID
  usn INTEGER,
  ease INTEGER,  -- 1=again, 2=hard, 3=good, 4=easy
  ivl INTEGER,  -- interval assigned
  time_taken INTEGER,  -- milliseconds
  type INTEGER,  -- 0=learn, 1=review, 2=relearn
  mod INTEGER,  -- timestamp
  factor_change INTEGER
);
```

---

## 3. Scheduling Algorithms

### 3.1 SM2 Scheduling (Anki Default)

```pseudocode
function sm2_schedule(card, response):
  // response: 1=again, 2=hard, 3=good, 4=easy

  if response == 1 (Again):
    // Lapse
    lapses += 1
    if lapses >= leech_threshold:
      mark_leech(card)
    ivl = max(1, card.ivl * lapse_new_interval)
    factor = max(1.3, factor - 0.2)
    queue = LEARNING
    apply_lapse_steps()

  else if response == 2 (Hard):
    // Review, no interval change
    factor = max(1.3, factor - 0.15)
    ivl = card.ivl
    queue = REVIEW

  else if response == 3 (Good):
    // Normal review
    factor = max(1.3, factor - 0.05) + 0.1
    if card.queue == LEARNING:
      ivl = graduating_interval
    else:
      ivl = card.ivl * factor
    queue = REVIEW

  else if response == 4 (Easy):
    // Easy review
    factor = min(2.5, factor + 0.15)
    if card.queue == LEARNING:
      ivl = easy_interval
    else:
      ivl = card.ivl * factor
    queue = REVIEW

  card.factor = factor
  card.ivl = min(ivl, max_review_interval)
  card.due = today + card.ivl
  card.reps += 1
```

### 3.2 Queue Ordering

**New Card Order:**
- Random: shuffle
- Added order: sort by card.id ascending
- Due order: sort by card.due ascending

**Interleaving (New + Review):**
- Daily limit for new: `new_per_day`
- Daily limit for review: `review_per_day`
- Ratio: interleave every N review cards, insert 1 new card

**Learning Card Order:**
- Sort by `due` (absolute minute timestamp)
- All due learning cards before new/review cards
- Multiple learning steps in same day possible

---

### 3.3 Ease Factor Bounds

- Min: 1.3 (lowest difficulty)
- Max: varies, but typically 2.5+
- Adjust by ±0.05 to ±0.2 per response
- Affects interval multiplication

---

## 4. UI/UX Flows

### 4.1 Deck Navigation

```
┌─ Decks
├─ Default (20 new, 5 due)
├─ Japanese
│  ├─ Genki 1 (10 new, 3 due)
│  └─ Kanji (5 new, 12 due)
└─ Spanish (1 new, 0 due)

Click deck → review session
Click gear icon → deck config
```

### 4.2 Review Session Flow

```
1. Show card front
   ↓
2. User clicks "Show Answer" or presses spacebar
   ↓
3. Show card back
   ↓
4. User presses: Again (1) / Hard (2) / Good (3) / Easy (4)
   ↓
5. Apply scheduling, move to next card
   ↓
6. Repeat until queue empty
   ↓
7. Show summary (cards studied, new ease, etc.)
```

**Keyboard Shortcuts:**
- Space: reveal answer
- 1-4: response (Again, Hard, Good, Easy)
- Undo: Ctrl+Z (revert last review)
- Edit: e (open card editor mid-session)
- More: ... (suspend, bury, mark, delete)

### 4.3 Card Browser

**Columns:**
- Question (front)
- Answer (back)
- Ease (factor)
- Interval (days)
- Due (date)
- Created (date)
- Reviewed (last review date)
- Cards (count for notes)

**Filtering:**
- Search box: full-text query language
- Saved searches (filters)
- Card state toggles (new, learning, review, suspended)

**Bulk Actions:**
- Change deck
- Change model
- Delete
- Suspend/Unsuspend
- Bury/Unbury
- Mark/Unmark
- Add/Remove tags
- Change ease
- Reset progress

### 4.4 Statistics

**Metrics:**
- Cards reviewed today
- Time spent today
- Daily breakdown (bar chart)
- Ease distribution
- Interval distribution (log scale)
- Review count by card state
- Leech cards
- Current streak

---

## 5. Special Features

### 5.1 Undo System

- Each action (review, card edit, deck config change) generates undo point
- Can undo last N actions
- Stored in undo queue (not persisted across sessions)

### 5.2 Sync & Cloud

- Sync with AnkiWeb via token auth
- Tracks changes with `usn` (update sequence number)
- Conflict resolution (newer timestamp wins)
- Note: KirokuMichi can skip this initially

### 5.3 Add-ons & Plugins

- Anki supports add-on API
- KirokuMichi can skip initially, add later if needed

### 5.4 Import/Export

- **Import:**
  - `.apkg` (ZIP with media + SQLite + notes as text)
  - `.txt` / `.csv` (parse and generate notes)
  - Duplicate handling (update vs. skip)
  
- **Export:**
  - `.apkg` (with media, for AnkiDroid / other clients)
  - `.txt` / `.csv` (for external tools)
  - Filtered export (selected cards only)

---

## 6. Implementation Priorities (For KirokuMichi)

### Phase 1: Foundation (Week 1)
- ✅ Deck hierarchy (tree structure, deck config)
- ✅ Card states (new, learning, review, suspended, buried)
- ✅ SM2 scheduling algorithm
- ✅ Queue ordering (new, learning, review interleave)

### Phase 2: UI (Week 2)
- ✅ Deck navigation & selection
- ✅ Review session (show front → answer → response → next)
- ✅ Review summary

### Phase 3: Card Browser (Week 3)
- ✅ Card browser (table, sorting, filtering)
- ✅ Bulk actions (change deck, suspend, delete, etc.)
- ✅ Search query language

### Phase 4: Polish (Week 4)
- ✅ Statistics dashboard
- ✅ Card editing mid-session
- ✅ Keyboard shortcuts
- ✅ Undo/redo

### Optional Later:
- Filtered decks (advanced search + temporary deck)
- Card templates & custom fields
- .apkg import/export (can use existing code)
- Sync (AnkiWeb)
- Add-ons

---

## 7. Known Differences from Anki

(We can add these as custom features)

- **Plus:** Curriculum integration (unlock vocab by lesson)
- **Plus:** AI tutor during review (hint, explanation, correction)
- **Plus:** Better mobile responsive UI (Anki is desktop-first)
- **Minus:** No cloud sync (initially; can add later)
- **Minus:** No add-on system (initially; can add later)

---

## 8. References

- Anki Manual: https://docs.ankiweb.net/
- Anki GitHub: https://github.com/ankitects/anki
- Anki Database Format: documented in manual
- SM2 Algorithm: https://www.supermemo.com/en/articles/spaced-repetition-algorithm

---

**Next Steps:**
1. Review this spec with user
2. Create database schema
3. Implement SM2 scheduling
4. Build React UI for deck selection + review session
5. Add card browser & bulk operations
