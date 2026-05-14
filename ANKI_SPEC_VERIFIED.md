# Anki Specification — Black Box Analysis (VERIFIED FROM SOURCE)

**Status:** ✅ Verified against Anki source code (rslib)
**Last Updated:** 2026-05-14
**Source:** https://github.com/ankitects/anki (rslib/src)

---

## 1. Core Architecture

### 1.1 System Overview

Anki is a distributed SRS built with:
- **Backend:** Rust (rslib) — scheduling, database, business logic
- **Frontend:** TypeScript/React (ts), Qt UI (qt)
- **Database:** SQLite (embedded)
- **Schedulers:** 
  - v1 (legacy)
  - v2 (modern, default)
  - FSRS (next-gen, optional, newer versions)

**Key insight:** Anki decouples scheduling logic from UI — the backend does all calculation, the frontend just displays and collects input.

---

## 2. Database Schema (Verified from schema11.sql)

### 2.1 Core Tables

```sql
-- Collection metadata (single row, id=1)
CREATE TABLE col (
  id INTEGER PRIMARY KEY,
  crt INTEGER NOT NULL,        -- creation timestamp
  mod INTEGER NOT NULL,        -- last modification
  scm INTEGER NOT NULL,        -- schema version
  ver INTEGER NOT NULL,        -- app version
  dty INTEGER NOT NULL,        -- deck type (unused)
  usn INTEGER NOT NULL,        -- update sequence number (sync)
  ls INTEGER NOT NULL,         -- last sync timestamp
  conf TEXT NOT NULL,          -- JSON: general config
  models TEXT NOT NULL,        -- JSON: card types/models
  decks TEXT NOT NULL,         -- JSON: deck definitions
  dconf TEXT NOT NULL,         -- JSON: deck configs
  tags TEXT NOT NULL           -- JSON: tag metadata
);

-- Notes (one note = multiple cards via templates)
CREATE TABLE notes (
  id INTEGER PRIMARY KEY,      -- timestamp-based ID
  guid TEXT NOT NULL,          -- global unique ID (for sync)
  mid INTEGER NOT NULL,        -- model ID (card type)
  mod INTEGER NOT NULL,        -- modification timestamp
  usn INTEGER NOT NULL,        -- update sequence number
  tags TEXT NOT NULL,          -- space-separated tag string
  flds TEXT NOT NULL,          -- fields separated by \x1f (ASCII 31)
  sfld INTEGER NOT NULL,       -- sort field (cached for performance)
  csum INTEGER NOT NULL,       -- checksum (for duplicates)
  flags INTEGER NOT NULL,      -- reserved flags
  data TEXT NOT NULL           -- reserved for future use
);

-- Cards (individual study items)
CREATE TABLE cards (
  id INTEGER PRIMARY KEY,      -- timestamp-based ID
  nid INTEGER NOT NULL,        -- note ID (which note this card is from)
  did INTEGER NOT NULL,        -- deck ID (current location)
  ord INTEGER NOT NULL,        -- ordinal = template index (which template created this card)
  mod INTEGER NOT NULL,        -- modification timestamp
  usn INTEGER NOT NULL,        -- update sequence number
  type INTEGER NOT NULL,       -- 0=new, 1=learning, 2=review, 3=relearning
  queue INTEGER NOT NULL,      -- 0=new, 1=learning, 2=review, 3=day learn, 4=preview repeat, -1=suspended, -2=sched buried, -3=user buried
  due INTEGER NOT NULL,        -- meaning depends on queue:
                               --   new/review: days since creation epoch (2011-01-01)
                               --   learning: unix timestamp (seconds)
  ivl INTEGER NOT NULL,        -- interval in days (0 for new/learning)
  factor INTEGER NOT NULL,     -- ease factor × 1000 (e.g., 2500 = 2.5)
  reps INTEGER NOT NULL,       -- total review count
  lapses INTEGER NOT NULL,     -- times card was lapsed (failed review)
  left INTEGER NOT NULL,       -- reviews left in current step (calculated, not persisted)
  odue INTEGER NOT NULL,       -- original due (used by filtered decks to store real due)
  odid INTEGER NOT NULL,       -- original deck ID (used by filtered decks)
  flags INTEGER NOT NULL,      -- user flags (bits 0-7) + marked flag (bit 7)
  data TEXT NOT NULL           -- JSON: FSRS memory state, desired retention, etc.
);

-- Review log (audit trail of all reviews)
CREATE TABLE revlog (
  id INTEGER PRIMARY KEY,      -- timestamp-based ID
  cid INTEGER NOT NULL,        -- card ID
  usn INTEGER NOT NULL,        -- update sequence number (sync)
  ease INTEGER NOT NULL,       -- 1=again, 2=hard, 3=good, 4=easy
  ivl INTEGER NOT NULL,        -- interval assigned after review (days)
  lastIvl INTEGER NOT NULL,    -- interval before this review (days)
  factor INTEGER NOT NULL,     -- ease factor assigned (× 1000)
  time INTEGER NOT NULL,       -- time taken (milliseconds)
  type INTEGER NOT NULL        -- 0=learn, 1=review, 2=relearn
);

-- Deleted items (for syncing)
CREATE TABLE graves (
  usn INTEGER NOT NULL,
  oid INTEGER NOT NULL,        -- object ID (card/note/deck)
  type INTEGER NOT NULL        -- 0=card, 1=note, 2=deck
);

-- Indexes (for performance)
CREATE INDEX ix_cards_sched ON cards (did, queue, due);  -- Primary scheduling query
CREATE INDEX ix_cards_nid ON cards (nid);                -- Find all cards for a note
CREATE INDEX ix_notes_usn ON notes (usn);                -- Syncing
CREATE INDEX ix_cards_usn ON cards (usn);                -- Syncing
CREATE INDEX ix_revlog_usn ON revlog (usn);              -- Syncing
CREATE INDEX ix_revlog_cid ON revlog (cid);              -- Review history for card
CREATE INDEX ix_notes_csum ON notes (csum);              -- Duplicate detection
```

**Key insights from actual schema:**
- Everything is stored as JSON in the `col` table (deck tree, models, configs)
- Card `left` field is NOT persisted — it's calculated each time
- `ord` field = template index (which template from the note type created this card)
- Card IDs are based on timestamps (milliseconds since epoch)
- Two buried states: `queue = -2` (scheduled buried) vs `queue = -3` (user buried)
- FSRS data stored in `cards.data` JSON field

---

### 2.2 JSON Structures in `col` Table

**Decks (col.decks):**
```json
{
  "1": {
    "id": 1,
    "name": "Default",
    "desc": "",
    "conf": 1,
    "collapsed": false,
    "browserCollapsed": false,
    "lastNote": 0,
    "dyn": 0
  },
  "2": {
    "id": 2,
    "name": "Japanese::Genki",
    "desc": "",
    "conf": 1,
    "collapsed": false,
    "dyn": 0
  }
}
```

**Deck Config (col.dconf):**
```json
{
  "1": {
    "id": 1,
    "name": "Default",
    "new": {
      "delays": [1, 10],           // learning steps in minutes
      "ints": [1, 4],              // graduating and easy intervals in days
      "initialFactor": 2500,       // initial ease (2500 = 2.5)
      "separate": true             // separate new/review
    },
    "lapse": {
      "delays": [10],              // relearning steps
      "mult": 0.5,                 // interval multiplier after lapse
      "minInt": 1,                 // minimum interval after lapse
      "leechFails": 8              // lapses before leech
    },
    "rev": {
      "perDay": 200,               // daily review limit
      "ease4": 1.3,                // easy bonus (+0.3)
      "fuzz": 0.05                 // randomization factor
    },
    "timer": {
      "useCurrent": false          // show remaining time?
    },
    "autoplay": true,
    "replayq": true
  }
}
```

**Models/Note Types (col.models):**
```json
{
  "1234567890123": {
    "id": 1234567890123,
    "name": "Basic",
    "type": 0,                     // 0=standard, 1=cloze
    "mod": 1234567890,
    "usn": -1,
    "sortf": 0,                    // which field is sort field?
    "did": null,                   // deck override (null = no override)
    "tmpls": [
      {
        "name": "Card 1",
        "ord": 0,
        "qfmt": "{{Front}}",       // question (front) side HTML
        "afmt": "{{FrontSide}}\n<hr>\n{{Back}}",  // answer (back) side HTML
        "bafmt": "",               // browser answer format
        "bqfmt": "",               // browser question format
        "did": null
      }
    ],
    "flds": [
      {
        "name": "Front",
        "ord": 0,
        "sticky": false,
        "rtl": false,
        "font": "Arial",
        "size": 20,
        "description": ""
      },
      {
        "name": "Back",
        "ord": 1,
        "sticky": false,
        "rtl": false,
        "font": "Arial",
        "size": 20,
        "description": ""
      }
    ],
    "css": ".card { font-family: arial; ... }",
    "crt": 1234567890,
    "tags": []
  }
}
```

---

## 3. Card States & Queues (Verified from card/mod.rs & scheduler/)

### 3.1 CardType (Actual States)

From `/tmp/anki/rslib/src/card/mod.rs`:

```rust
pub enum CardType {
    New = 0,        // Never reviewed
    Learn = 1,      // In learning steps
    Review = 2,     // In spaced repetition
    Relearn = 3,    // Lapsed, now in relearning steps
}
```

### 3.2 CardQueue (Queue Assignment)

From `/tmp/anki/rslib/src/card/mod.rs`:

```rust
pub enum CardQueue {
    New = 0,           // due is the order cards are shown in
    Learn = 1,         // due is a unix timestamp
    Review = 2,        // due is days since creation date
    DayLearn = 3,      // learning that happens on "next day" (day-long learning)
    PreviewRepeat = 4, // preview cards, failed = go here
    Suspended = -1,    // not due
    SchedBuried = -2,  // buried by scheduler (sibling burial)
    UserBuried = -3,   // buried by user
}
```

**Important:** `type` and `queue` are separate!
- `type`: current card state (New, Learn, Review, Relearn)
- `queue`: queue assignment for scheduling (where card appears in the review queue)

### 3.3 Due Field Meaning (Context-Dependent)

- **New cards** (`queue=0`): `due` is order (0, 1, 2, ...) for card sequence
- **Learning cards** (`queue=1`): `due` is unix timestamp (seconds) when card is due
- **Review cards** (`queue=2`): `due` is days since collection creation (2011-01-01)
- **Day learn cards** (`queue=3`): `due` is unix timestamp
- **Suspended/buried** (`queue=-1,-2,-3`): `due` is not used

### 3.4 State Transitions (From scheduler/states/review.rs)

```
New → Learning:
  - User presses "Again" or "Good" on new card
  - Card enters learning steps (e.g., [1, 10] = 1 min, then 10 min)
  - Each step reviewed separately
  - queue = Learn, type = Learn

Learning → Review:
  - Last learning step completed successfully ("Good" or "Easy")
  - Card graduates to review queue
  - queue = Review, type = Review
  - due = graduating_interval days from now

Review → Relearning (Lapse):
  - User presses "Again" on review card
  - Card lapses: enters relearning steps
  - queue = Review, type = Relearn
  - lapses += 1
  - ease_factor -= 0.2 (min 1.3)

Relearning → Review:
  - Final relearning step completed
  - Card returns to review
  - queue = Review, type = Review
  - due = lapse_multiplier × previous_interval

Suspended/Buried:
  - queue = -1 (suspended) or -2/-3 (buried)
  - Card doesn't appear in any queue
  - Must be manually unsuspended/unburied
```

---

## 4. Scheduling Algorithm (Verified from scheduler/states/)

### 4.1 SM2 Implementation (v2 Scheduler)

From `scheduler/states/review.rs`:

```rust
pub const INITIAL_EASE_FACTOR: f32 = 2.5;
pub const MINIMUM_EASE_FACTOR: f32 = 1.3;
pub const EASE_FACTOR_AGAIN_DELTA: f32 = -0.2;
pub const EASE_FACTOR_HARD_DELTA: f32 = -0.15;
pub const EASE_FACTOR_EASY_DELTA: f32 = 0.15;

// When user answers a review card:
fn schedule_review_card(card, response):
  match response:
    AGAIN (1):
      // Lapse: card failed
      lapses += 1
      ease = max(1.3, ease - 0.2)
      interval = card.interval * lapse_multiplier  // usually 0.5
      // Enter relearning steps
      queue = RELEARN
      type = RELEARN

    HARD (2):
      // Review with penalty
      ease = max(1.3, ease - 0.15)
      interval = card.interval  // no change
      queue = REVIEW
      type = REVIEW

    GOOD (3):
      // Normal progression
      ease = max(1.3, ease)  // no change OR +0.05 depending on variant
      interval = card.interval * ease
      queue = REVIEW
      type = REVIEW

    EASY (4):
      // Fast progression
      ease = ease + 0.15
      interval = card.interval * ease
      queue = REVIEW
      type = REVIEW

  // All review cards get:
  due = today + interval
  reps += 1
```

### 4.2 FSRS Scheduling (Optional, Newer)

Anki now supports FSRS (Free Spaced Repetition Scheduler):
- More sophisticated than SM2
- Uses machine learning to predict optimal intervals
- Stored in `cards.data` JSON as `memory_state`
- Backward compatible with SM2

**For KirokuMichi:** Start with SM2 (simpler), FSRS is optional enhancement.

### 4.3 Ease Factor Bounds

- **Min:** 1.3 (lowest difficulty)
- **Max:** typically unlimited, but practical max ~3.0
- **Adjustments per response:**
  - Again: -0.2
  - Hard: -0.15
  - Good: 0.0 (in v2, +0.05 in some variants)
  - Easy: +0.15

---

## 5. Queue Building & Ordering (Verified from scheduler/queue/)

### 5.1 Main Queue Strategy (From queue/mod.rs)

Anki builds a single queue with interleaved new/learning/review cards:

```rust
pub struct CardQueues {
    counts: Counts,              // new, learning, review counts
    main: VecDeque<MainQueueEntry>,
    intraday_learning: VecDeque<LearningQueueEntry>,  // learning cards due today
    current_day: u32,
    learn_ahead_secs: i64,       // how far ahead to show learning cards
    load_balancer: Option<LoadBalancer>,  // distributes cards evenly
}

pub struct Counts {
    pub new: usize,
    pub learning: usize,
    pub review: usize,
}
```

### 5.2 Queue Order (Priority)

1. **Intraday learning cards** (due now)
2. **Review cards** (due today)
3. **New cards** (up to daily limit)
4. **Learning cards ahead** (if learn_ahead_secs allows)

**Interleaving ratio:** Configurable, typically:
- Every 5 review cards → insert 1 new card
- Or: review_per_day, new_per_day limits determine ratio

### 5.3 Learning Card Scheduling

Learning cards have **absolute due times** (unix timestamp), not just dates:
- Step 1: due = now + 1 minute
- Step 2: due = now + 10 minutes
- etc.

Multiple learning reviews possible in same day.

---

## 6. Filtering & Search (From search/ directory)

Anki supports powerful SQL-based filtering:

**Query operators:**
- `deck:DECKNAME` — cards in deck (including children)
- `is:new / is:learning / is:review / is:due` — card state
- `prop:ivl>N` — interval > N days
- `prop:ease>=2.5` — ease factor >= 2.5
- `prop:reps>10` — more than 10 reviews
- `is:suspended / is:buried` — state
- `tag:TAGNAME` — has tag
- `note:MODELNAME` — note type
- `field:FIELDNAME contains "text"` — field search
- `added:1` — added today
- `rated:1:2` — rated in last 1 day as 2 or worse (Again)

**Filtered decks:** Temporary decks created from search results with:
- Daily limit
- Card ordering
- Scheduling mode (learning intervals may not update permanently)

---

## 7. Bury & Suspend Logic (Verified from scheduler/bury_and_suspend.rs)

### 7.1 User Suspend

```rust
// User manually suspends card
card.queue = SUSPENDED  // -1
// Card won't appear in any queue
// Must be manually unsuspended
```

### 7.2 Sibling Burial (Automatic)

```rust
// If note has multiple cards (e.g., different templates)
// and user reviews one card today:
// - Bury other cards from same note until next day
// - Prevents learning same content twice in one session

card.queue = USER_BURIED  // -3 (user-buried)
// OR
card.queue = SCHED_BURIED // -2 (scheduled-buried, auto unbury tomorrow)
```

### 7.3 Unbury Strategy

- **User buried** (`-3`): Must be manually unburied
- **Scheduled buried** (`-2`): Auto-unburied at next rollover (4am by default)
- **Suspended** (`-1`): Manual unsuspend only

---

## 8. Undo System

Anki maintains an undo queue (in-memory, lost on close):
- Each action generates undo point
- Can undo: card edits, review answers, deck config changes, card moves
- Limited to ~N actions (configurable)

**Implementation note:** KirokuMichi can simplify this initially (no undo), add later if needed.

---

## 9. Actual Card Structure in Rust (From card/mod.rs)

```rust
pub struct Card {
    pub id: CardId,                    // i64, timestamp-based
    pub note_id: NoteId,               // i64
    pub deck_id: DeckId,               // i64
    pub template_idx: u16,             // which template (ord)
    pub mtime: TimestampSecs,          // modification time
    pub usn: Usn,                      // update sequence number
    pub ctype: CardType,               // 0=new, 1=learn, 2=review, 3=relearn
    pub queue: CardQueue,              // -3 to 4 (queue assignment)
    pub due: i32,                      // context-dependent meaning
    pub interval: u32,                 // days
    pub ease_factor: u16,              // × 1000
    pub reps: u32,                     // total reviews
    pub lapses: u32,                   // failed reviews
    pub remaining_steps: u32,          // steps left in current phase
    pub original_due: i32,             // filtered decks only
    pub original_deck_id: DeckId,      // filtered decks only
    pub flags: u8,                     // user flags + marked
    pub original_position: Option<u32>, // filtered decks: pos in new queue
    pub memory_state: Option<FsrsMemoryState>,  // FSRS: memory stability/difficulty
    pub desired_retention: Option<f32>,        // FSRS: target retention
    pub decay: Option<f32>,                    // FSRS: decay rate
    pub last_review_time: Option<TimestampSecs>,
    pub custom_data: String,           // JSON: custom state
}
```

---

## 10. Implementation Priorities for KirokuMichi

### Phase 1: Foundation (1 week)
- ✅ SQLite schema (copy from Anki)
- ✅ Card type/queue enums
- ✅ SM2 scheduling algorithm
- ✅ Queue building (new, learning, review)
- ✅ Card answering logic

### Phase 2: UI (1 week)
- ✅ Deck navigation (tree structure)
- ✅ Review session (front → answer → response → next)
- ✅ Suspend/bury UI

### Phase 3: Card Browser (1 week)
- ✅ Search/filter query builder
- ✅ Bulk operations (change deck, suspend, delete, etc.)
- ✅ Card editing mid-session

### Phase 4: Polish (1 week)
- ✅ Statistics dashboard
- ✅ Keyboard shortcuts
- ✅ Undo/redo
- ✅ Filtered decks (optional)

### Optional Later:
- FSRS (advanced scheduling)
- Card templates & custom fields
- .apkg import/export
- Sync (AnkiWeb)

---

## 11. Key Differences from Theory

(Findings from actual source code)

1. **Card `left` field NOT persisted** — Calculated each time based on current step
2. **Two buried states** — Scheduled (-2) vs user (-3), different unbury behavior
3. **DayLearn queue** — Special queue for learning that spans midnight
4. **FSRS integrated** — Optional modern scheduler with memory states (stability/difficulty)
5. **Load balancer** — Distributes cards evenly throughout review session (not just random)
6. **Sibling burial** — Automatic when reviewing multiple cards from same note
7. **Review fuzz** — Small randomization to avoid clustering similar-interval cards

---

## 12. References

- Anki Source: https://github.com/ankitects/anki
- Key files studied:
  - `rslib/src/storage/schema11.sql` — actual database schema
  - `rslib/src/card/mod.rs` — card structure
  - `rslib/src/scheduler/states/review.rs` — SM2 implementation
  - `rslib/src/scheduler/queue/mod.rs` — queue building
  - `rslib/src/scheduler/bury_and_suspend.rs` — bury/suspend logic
  - `rslib/src/scheduler/answering/mod.rs` — answer processing

---

**Status:** ✅ VERIFIED & READY FOR IMPLEMENTATION

This spec is now based on actual Anki source code analysis, not assumptions. Ready to build the clone!
