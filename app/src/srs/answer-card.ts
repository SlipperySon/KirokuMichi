/**
 * Answer Card - Handles the review answering workflow
 * Processes user responses and manages state transitions
 */

import type { Card, CardResponse, ReviewLogEntry } from '../types/card'
import type { DeckConfig } from '../types/deck'
import { scheduleCard } from './sm2-scheduler'
import { buildDeckQueue, getDeckCounts } from './queue-builder'

export interface CardAnswerContext {
  card: Card
  response: CardResponse
  reviewTime: number // milliseconds
  config: DeckConfig
}

export interface AnswerResult {
  original: Card
  updated: Card
  logEntry: ReviewLogEntry
  nextCard: Card | null
}

/**
 * Answer a single card with response
 */
export function answerCard(context: CardAnswerContext): { updated: Card; logEntry: ReviewLogEntry } {
  const { card, response, reviewTime, config } = context

  // Schedule the card using SM2
  const updated = scheduleCard(card, response, config)

  // Create review log entry (Anki standard format)
  const logEntry: ReviewLogEntry = {
    id: Math.floor(Date.now()), // timestamp-based ID
    cardId: card.id,
    usn: -1, // unsynchronized
    ease: response,
    interval: updated.interval,
    lastInterval: card.interval,
    factor: updated.easeFactor,
    time: reviewTime,
    type: card.type as 0 | 1 | 2, // 0=learn, 1=review, 2=relearn
  }

  return { updated, logEntry }
}

/**
 * Process a batch of card answers
 */
export function answerCards(
  cards: Array<{ card: Card; response: CardResponse; reviewTime: number }>,
  config: DeckConfig
): Array<{ original: Card; updated: Card; logEntry: ReviewLogEntry }> {
  return cards.map(({ card, response, reviewTime }) => {
    const { updated, logEntry } = answerCard({
      card,
      response,
      reviewTime,
      config,
    })
    return { original: card, updated, logEntry }
  })
}

/**
 * Get card review feedback
 * Determines the difficulty spike/drop and streak status
 */
export function getCardReviewFeedback(
  original: Card,
  updated: Card,
  response: CardResponse
): {
  intervalChange: number
  easeChange: number
  isImprovement: boolean
  description: string
} {
  const intervalChange = updated.interval - original.interval
  const easeChange = updated.easeFactor - original.easeFactor

  let description = ''
  let isImprovement = false

  if (response === 1) {
    // AGAIN
    description = 'Card failed - back to learning'
    isImprovement = false
  } else if (response === 2) {
    // HARD
    description = 'Hard - interval unchanged'
    isImprovement = false
  } else if (response === 3) {
    // GOOD
    description = 'Good - normal progression'
    isImprovement = intervalChange > 0
  } else if (response === 4) {
    // EASY
    description = 'Easy - fast progression'
    isImprovement = true
  }

  return {
    intervalChange,
    easeChange,
    isImprovement,
    description,
  }
}

/**
 * Validate answer is valid for card state
 */
export function validateAnswer(card: Card, response: CardResponse): {
  valid: boolean
  reason?: string
} {
  // All responses are valid (1-4)
  if (response < 1 || response > 4) {
    return { valid: false, reason: 'Invalid response: must be 1-4' }
  }

  // Can't answer suspended/buried cards
  if (card.queue === -1 || card.queue === -2 || card.queue === -3) {
    return { valid: false, reason: 'Card is suspended or buried' }
  }

  return { valid: true }
}

/**
 * Calculate review statistics for a session
 */
export interface ReviewStats {
  totalReviewed: number
  again: number
  hard: number
  good: number
  easy: number
  averageTime: number
  passRate: number
  firstPassRate: number
}

export function calculateReviewStats(logEntries: ReviewLogEntry[]): ReviewStats {
  if (logEntries.length === 0) {
    return {
      totalReviewed: 0,
      again: 0,
      hard: 0,
      good: 0,
      easy: 0,
      averageTime: 0,
      passRate: 0,
      firstPassRate: 0,
    }
  }

  let again = 0
  let hard = 0
  let good = 0
  let easy = 0
  let totalTime = 0

  const firstReviews = new Set<number>() // cardIds that are being reviewed for first time

  for (const log of logEntries) {
    totalTime += log.time

    if (log.ease === 1) again++
    else if (log.ease === 2) hard++
    else if (log.ease === 3) good++
    else if (log.ease === 4) easy++

    // First pass = no lapses before this
    if (log.type === 0) {
      firstReviews.add(log.cardId)
    }
  }

  const passCount = hard + good + easy
  const passRate = logEntries.length > 0 ? (passCount / logEntries.length) * 100 : 0
  const firstPassRate = (logEntries.filter(l => firstReviews.has(l.cardId)).length / logEntries.length) * 100 || 0
  const averageTime = Math.round(totalTime / logEntries.length)

  return {
    totalReviewed: logEntries.length,
    again,
    hard,
    good,
    easy,
    averageTime,
    passRate: Math.round(passRate),
    firstPassRate: Math.round(firstPassRate),
  }
}

/**
 * Estimate next review time for a card
 */
export function estimateNextReviewTime(updated: Card): {
  days: number | null
  timestamp: number | null
  relative: string
} {
  const now = new Date()

  // Learning/relearning cards: due is unix timestamp (seconds)
  if (updated.queue === 1 || updated.queue === 3) {
    const dueDate = new Date(updated.due * 1000)
    const diffMs = dueDate.getTime() - now.getTime()
    const days = Math.ceil(diffMs / (24 * 60 * 60 * 1000))

    let relative = ''
    if (diffMs < 60 * 1000) {
      relative = 'in less than a minute'
    } else if (diffMs < 60 * 60 * 1000) {
      const mins = Math.ceil(diffMs / (60 * 1000))
      relative = `in ${mins} minute${mins > 1 ? 's' : ''}`
    } else if (diffMs < 24 * 60 * 60 * 1000) {
      const hours = Math.ceil(diffMs / (60 * 60 * 1000))
      relative = `in ${hours} hour${hours > 1 ? 's' : ''}`
    } else {
      relative = `in ${days} day${days > 1 ? 's' : ''}`
    }

    return {
      days: Math.max(0, days),
      timestamp: dueDate.getTime(),
      relative,
    }
  }

  // Review cards: due is days since epoch
  if (updated.queue === 2) {
    const ankilEpoch = new Date(2011, 0, 1).getTime()
    const dueMs = updated.due * (24 * 60 * 60 * 1000) + ankilEpoch
    const dueDate = new Date(dueMs)
    const diffDays = Math.ceil((dueDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))

    let relative = ''
    if (diffDays <= 0) {
      relative = 'today'
    } else if (diffDays === 1) {
      relative = 'tomorrow'
    } else {
      relative = `in ${diffDays} days`
    }

    return {
      days: Math.max(0, diffDays),
      timestamp: dueDate.getTime(),
      relative,
    }
  }

  // New cards or suspended
  return { days: null, timestamp: null, relative: 'not scheduled' }
}

/**
 * Get card retention information
 */
export function getCardRetention(card: Card): {
  reps: number
  lapses: number
  retention: number
} {
  const retention = card.reps > 0 ? Math.round(((card.reps - card.lapses) / card.reps) * 100) : 0

  return {
    reps: card.reps,
    lapses: card.lapses,
    retention,
  }
}

/**
 * Determine if card is a leech
 */
export function isLeech(card: Card, leechFails: number = 8): boolean {
  return card.lapses >= leechFails
}

/**
 * Get recommended action for card
 */
export function getRecommendedAction(
  card: Card,
  response: CardResponse,
  config: DeckConfig
): {
  action: 'normal' | 'warning' | 'leech'
  message: string
} {
  const leeches = config.lapse.leechFails

  if (card.lapses >= leeches) {
    return {
      action: 'leech',
      message: `This card is a leech (${card.lapses} lapses). Consider deleting or suspending it.`,
    }
  }

  if (response === 1 && card.reps > 5) {
    return {
      action: 'warning',
      message: 'This card has been failed multiple times. You might want to study the material differently.',
    }
  }

  return {
    action: 'normal',
    message: 'Keep studying!',
  }
}
