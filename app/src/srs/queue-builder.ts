/**
 * Queue Builder - Determines card presentation order
 * Verified from Anki rslib/src/scheduler/mod.rs
 *
 * Priority order:
 * 1. Learning cards due now (seconds since epoch)
 * 2. Review cards due today (days since 2011-01-01)
 * 3. New cards (up to perDay limit)
 * 4. Learning cards due ahead
 */

import type { Card, CardQueue, CardType } from '../types/card'
import type { DeckConfig, DeckCounts } from '../types/deck'
import { CardQueue as CQ } from '../types/card'

interface QueuedCard {
  card: Card
  displayOrder: number
}

/**
 * Get current time in seconds (for learning card due times)
 */
function getCurrentUnixSeconds(): number {
  return Math.floor(Date.now() / 1000)
}

/**
 * Get current time in days since 2011-01-01 (Anki epoch)
 */
function getCurrentDueDay(): number {
  const ankilEpoch = new Date(2011, 0, 1).getTime()
  const nowMs = Date.now()
  const daysSince = Math.floor((nowMs - ankilEpoch) / (24 * 60 * 60 * 1000))
  return daysSince
}

/**
 * Build queue for a single deck
 * Returns cards in presentation order with queue position
 */
export function buildDeckQueue(
  cards: Card[],
  config: DeckConfig,
  now: Date = new Date()
): QueuedCard[] {
  const currentSeconds = Math.floor(now.getTime() / 1000)
  const currentDay = getCurrentDueDay()

  // Categorize cards by queue type
  const learningDueNow: Card[] = []
  const learningAhead: Card[] = []
  const reviewDueToday: Card[] = []
  const newCards: Card[] = []

  for (const card of cards) {
    // Skip suspended/buried cards
    if (card.queue === CQ.Suspended || card.queue === CQ.SchedBuried || card.queue === CQ.UserBuried) {
      continue
    }

    // Learning and relearning cards (queue 1 or 3, due is unix timestamp)
    if (card.queue === CQ.Learn || card.queue === CQ.DayLearn) {
      if (card.due <= currentSeconds) {
        learningDueNow.push(card)
      } else {
        learningAhead.push(card)
      }
    }
    // Review cards (queue 2, due is days since epoch)
    else if (card.queue === CQ.Review) {
      if (card.due <= currentDay) {
        reviewDueToday.push(card)
      }
    }
    // New cards (queue 0, due is order)
    else if (card.queue === CQ.New) {
      newCards.push(card)
    }
  }

  // Sort each category
  // Learning cards: due earliest first
  learningDueNow.sort((a, b) => a.due - b.due)
  learningAhead.sort((a, b) => a.due - b.due)

  // Review cards: due earliest first
  reviewDueToday.sort((a, b) => a.due - b.due)

  // New cards: preserve insertion order (due = order)
  newCards.sort((a, b) => a.due - b.due)

  // Build final queue with display order
  const queue: QueuedCard[] = []
  let displayOrder = 0

  // 1. Learning cards due now (highest priority)
  for (const card of learningDueNow) {
    queue.push({ card, displayOrder: displayOrder++ })
  }

  // 2. Review cards due today
  for (const card of reviewDueToday) {
    queue.push({ card, displayOrder: displayOrder++ })
  }

  // 3. New cards (up to perDay limit)
  const newLimit = config.new.perDay || 20
  const newCardsToShow = newCards.slice(0, newLimit)
  for (const card of newCardsToShow) {
    queue.push({ card, displayOrder: displayOrder++ })
  }

  // 4. Learning cards due ahead (lowest priority)
  for (const card of learningAhead) {
    queue.push({ card, displayOrder: displayOrder++ })
  }

  return queue
}

/**
 * Get deck counts (new, learning, review)
 */
export function getDeckCounts(
  cards: Card[],
  config: DeckConfig,
  now: Date = new Date()
): DeckCounts {
  const currentSeconds = Math.floor(now.getTime() / 1000)
  const currentDay = getCurrentDueDay()

  let newCount = 0
  let learningCount = 0
  let reviewCount = 0

  for (const card of cards) {
    // Skip suspended/buried
    if (card.queue === CQ.Suspended || card.queue === CQ.SchedBuried || card.queue === CQ.UserBuried) {
      continue
    }

    if (card.queue === CQ.Learn || card.queue === CQ.DayLearn) {
      // All learning cards, regardless of due time
      learningCount++
    } else if (card.queue === CQ.Review) {
      // Count only review cards due today
      if (card.due <= currentDay) {
        reviewCount++
      }
    } else if (card.queue === CQ.New) {
      // Count only up to perDay limit
      if (newCount < (config.new.perDay || 20)) {
        newCount++
      }
    }
  }

  return { new: newCount, learning: learningCount, review: reviewCount }
}

/**
 * Get next card from queue
 */
export function getNextCard(queue: QueuedCard[]): Card | null {
  if (queue.length === 0) return null
  return queue[0].card
}

/**
 * Remove card from queue and get next
 */
export function removeFromQueue(queue: QueuedCard[], cardId: number): Card | null {
  const index = queue.findIndex(q => q.card.id === cardId)
  if (index >= 0) {
    queue.splice(index, 1)
  }
  return getNextCard(queue)
}

/**
 * Get card by ID from queue
 */
export function getCardFromQueue(queue: QueuedCard[], cardId: number): Card | null {
  const item = queue.find(q => q.card.id === cardId)
  return item?.card || null
}

/**
 * Rebuild queue display order after changes (e.g., after answering a card)
 */
export function rebuildQueueOrder(queue: QueuedCard[]): void {
  for (let i = 0; i < queue.length; i++) {
    queue[i].displayOrder = i
  }
}

/**
 * Filter queue by deck ID (for multi-deck scenarios)
 */
export function filterQueueByDeck(queue: QueuedCard[], deckId: number): QueuedCard[] {
  return queue.filter(q => q.card.deckId === deckId)
}
