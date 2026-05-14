/**
 * Card types and interfaces - Verified from Anki source
 */

export type CardId = number & { readonly __brand: 'CardId' }
export type NoteId = number & { readonly __brand: 'NoteId' }
export type DeckId = number & { readonly __brand: 'DeckId' }
export type NoteTypeId = number & { readonly __brand: 'NoteTypeId' }

export function makeCardId(id: number): CardId {
  return id as CardId
}

export function makeNoteId(id: number): NoteId {
  return id as NoteId
}

export function makeDeckId(id: number): DeckId {
  return id as DeckId
}

export function makeNoteTypeId(id: number): NoteTypeId {
  return id as NoteTypeId
}

/**
 * Card type - from ANKI_SPEC_VERIFIED
 * This is the "current state" of the card
 */
export enum CardType {
  New = 0,      // Never reviewed
  Learn = 1,    // In learning steps
  Review = 2,   // In spaced repetition
  Relearn = 3,  // Lapsed, now in relearning steps
}

/**
 * Card queue - where the card appears in the scheduling system
 * This is separate from CardType!
 */
export enum CardQueue {
  New = 0,           // due is order in new queue
  Learn = 1,         // due is unix timestamp
  Review = 2,        // due is days since epoch
  DayLearn = 3,      // learning spanning midnight
  PreviewRepeat = 4, // preview cards, failed ones go here
  Suspended = -1,    // not due
  SchedBuried = -2,  // buried by scheduler (sibling burial)
  UserBuried = -3,   // buried by user
}

/**
 * FSRS memory state (optional, for newer scheduler)
 */
export interface FsrsMemoryState {
  stability: number    // Expected memory stability in days
  difficulty: number   // Difficulty 1.0-10.0
}

/**
 * Card in database
 * From schema11.sql - all fields verified
 */
export interface Card {
  id: CardId
  noteId: NoteId
  deckId: DeckId
  templateIdx: number        // ord field - which template created this
  mtime: number              // modification timestamp (seconds)
  usn: number                // update sequence number (sync)
  type: CardType             // current state
  queue: CardQueue           // queue assignment
  due: number                // context-dependent:
                             //   new/review: days since 2011-01-01
                             //   learn: unix timestamp (seconds)
  interval: number           // interval in days
  easeFactor: number         // ease × 1000 (e.g., 2500 = 2.5)
  reps: number               // total review count
  lapses: number             // times card was lapsed
  remainingSteps: number     // steps left (calculated, not persisted)
  originalDue: number        // filtered decks: original due
  originalDeckId: DeckId     // filtered decks: original deck
  flags: number              // user flags + marked bit
  originalPosition?: number  // filtered decks: position in new queue
  memoryState?: FsrsMemoryState  // FSRS: memory state
  desiredRetention?: number  // FSRS: target retention
  decay?: number             // FSRS: decay rate
  lastReviewTime?: number    // last review timestamp
  customData: string         // JSON: custom state (empty string default)
}

/**
 * Scheduling result from SM2 scheduler
 */
export interface ScheduleResult {
  newInterval: number        // days
  newEase: number            // × 1000
  newQueue: CardQueue
  newType: CardType
  due: number                // absolute due time/date
  lapses: number
}

/**
 * Card with next possible states
 */
export interface QueuedCard {
  card: Card
  kind: 'new' | 'learning' | 'review'
  nextStates: SchedulingStates
}

/**
 * Possible next states after answering
 */
export interface SchedulingStates {
  current: Card           // current card state (for display)
  again: Card             // state after "Again" (1)
  hard: Card              // state after "Hard" (2)
  good: Card              // state after "Good" (3)
  easy: Card              // state after "Easy" (4)
}

/**
 * Review log entry
 * From revlog table in schema11.sql
 */
export interface ReviewLogEntry {
  id: number                 // timestamp-based
  cardId: CardId
  usn: number                // update sequence number
  ease: 1 | 2 | 3 | 4        // rating: Again, Hard, Good, Easy
  interval: number           // days assigned after review
  lastInterval: number       // days before this review
  factor: number             // ease assigned (× 1000)
  time: number               // milliseconds taken
  type: 0 | 1 | 2            // 0=learn, 1=review, 2=relearn
}

/**
 * Response when answering a card
 */
export type CardResponse = 1 | 2 | 3 | 4  // Again, Hard, Good, Easy
