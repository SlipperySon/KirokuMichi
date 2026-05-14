/**
 * Deck types and interfaces - Verified from Anki source
 */

import type { DeckId, NoteTypeId } from './card'

/**
 * New card settings in deck config
 */
export interface NewCardSettings {
  delays: number[]          // learning steps in minutes (e.g., [1, 10])
  ints: number[]            // graduating and easy intervals in days (e.g., [1, 4])
  initialFactor: number     // initial ease (e.g., 2500 = 2.5)
  separate: boolean         // separate new/review cards?
  perDay?: number           // new cards per day limit
  order?: number            // 0=random, 1=added order, 2=due order
}

/**
 * Review settings in deck config
 */
export interface ReviewSettings {
  perDay: number            // daily review limit
  ease4: number             // bonus for "easy" (e.g., 1.3 = +0.3)
  fuzz: number              // randomization factor (e.g., 0.05)
}

/**
 * Lapse (failure) settings in deck config
 */
export interface LapseSettings {
  delays: number[]          // relearning steps in minutes (e.g., [10])
  mult: number              // interval multiplier after lapse (e.g., 0.5)
  minInt: number            // minimum interval after lapse (e.g., 1)
  leechFails: number        // lapses before leech (e.g., 8)
}

/**
 * Deck configuration
 * Stored as JSON in col.dconf
 */
export interface DeckConfig {
  id: DeckId                // deck config ID
  name: string              // config name
  new: NewCardSettings
  review: ReviewSettings
  lapse: LapseSettings
  timer?: {
    useCurrent: boolean     // show remaining time?
  }
  autoplay?: boolean
  replayq?: boolean
}

/**
 * Single deck
 * Stored as JSON in col.decks
 */
export interface Deck {
  id: DeckId
  name: string              // deck name (can have :: for hierarchy)
  desc: string              // description
  conf: DeckId              // config ID
  collapsed: boolean        // is deck collapsed in tree?
  browserCollapsed?: boolean
  lastNote?: number         // last note ID (for new card ordering)
  dyn: 0 | 1                // 0=normal, 1=filtered (dynamic)
}

/**
 * Deck tree node (for UI navigation)
 */
export interface DeckNode extends Deck {
  children: DeckNode[]      // child decks
  level: number             // depth in tree (0=root)
  newCount: number          // cards due in this deck
  learnCount: number        // cards in learning
  reviewCount: number       // cards due for review
}

/**
 * Deck counts
 */
export interface DeckCounts {
  new: number
  learning: number
  review: number
}

/**
 * Filtered deck (temporary deck from search)
 */
export interface FilteredDeck extends Deck {
  dyn: 1                    // always 1 for filtered decks
  searchString: string      // search query
  dailyLimit: number        // limit per day
  cardOrder: number         // 0=due, 1=random, 2=interval, 3=ease, 4=added
}

/**
 * Create deck request
 */
export interface CreateDeckRequest {
  name: string
  parentId?: DeckId
  configId?: DeckId
}

/**
 * Update deck request
 */
export interface UpdateDeckRequest {
  deckId: DeckId
  name?: string
  configId?: DeckId
  collapsed?: boolean
}
