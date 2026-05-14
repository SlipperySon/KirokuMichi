/**
 * Phase 1 Integration Tests
 * Tests for SM2 scheduler, queue builder, card service, and deck service
 */

import { describe, it, expect } from 'vitest'
import { scheduleCard, getDefaultDeckConfig } from './sm2-scheduler'
import { buildDeckQueue, getDeckCounts, getNextCard } from './queue-builder'
import { answerCard, getCardRetention, estimateNextReviewTime } from './answer-card'
import type { Card, CardType, CardQueue } from '../types/card'
import { CardQueue as CQ } from '../types/card'
import { makeCardId, makeDeckId, makeNoteId } from '../types/card'

// Mock card factory
function createMockCard(overrides?: Partial<Card>): Card {
  return {
    id: makeCardId(Math.floor(Math.random() * 1e10)),
    noteId: makeNoteId(1),
    deckId: makeDeckId(1),
    templateIdx: 0,
    type: 0, // New
    queue: 0, // New queue
    due: 0,
    interval: 0,
    easeFactor: 2500,
    reps: 0,
    lapses: 0,
    remainingSteps: 0,
    originalDue: 0,
    originalDeckId: makeDeckId(1),
    flags: 0,
    mtime: Math.floor(Date.now() / 1000),
    usn: -1,
    customData: '',
    ...overrides,
  }
}

describe('Phase 1: SM2 Scheduler', () => {
  it('should schedule a new card to learning', () => {
    const card = createMockCard({ type: 0, queue: 0 })
    const config = getDefaultDeckConfig()

    const result = scheduleCard(card, 3, config) // Good response

    expect(result.type).toBe(1) // Learn
    expect(result.queue).toBe(1) // Learn queue
    expect(result.reps).toBe(1)
  })

  it('should keep ease at initial value for new cards', () => {
    const card = createMockCard({ type: 0, queue: 0 })
    const config = getDefaultDeckConfig()

    const result = scheduleCard(card, 3, config)

    expect(result.easeFactor).toBe(2500) // Initial ease
  })

  it('should apply SM2 ease deltas correctly', () => {
    const config = getDefaultDeckConfig()

    // Hard: -0.15
    const cardHard = createMockCard({ type: 2, queue: 2, easeFactor: 2500, interval: 10 })
    const resultHard = scheduleCard(cardHard, 2, config)
    expect(resultHard.easeFactor).toBe(2350) // 2500 - 150 = 2350

    // Easy: +0.15
    const cardEasy = createMockCard({ type: 2, queue: 2, easeFactor: 2500, interval: 10 })
    const resultEasy = scheduleCard(cardEasy, 4, config)
    expect(resultEasy.easeFactor).toBe(2650) // 2500 + 150 = 2650

    // Again: -0.2
    const cardAgain = createMockCard({ type: 2, queue: 2, easeFactor: 2500, interval: 10 })
    const resultAgain = scheduleCard(cardAgain, 1, config)
    expect(resultAgain.easeFactor).toBe(2300) // 2500 - 200 = 2300
  })

  it('should enforce minimum ease of 1.3', () => {
    const config = getDefaultDeckConfig()
    const card = createMockCard({
      type: 2,
      queue: 2,
      easeFactor: 1400, // Already low
      interval: 1,
    })

    const result = scheduleCard(card, 1, config) // Again - ease drops to 1200, but clamped to 1300

    expect(result.easeFactor).toBeGreaterThanOrEqual(1300) // Minimum ease
  })

  it('should handle lapse with relearning steps', () => {
    const config = getDefaultDeckConfig()
    config.lapse.delays = [10] // 10 minute relearn step

    const card = createMockCard({
      type: 2,
      queue: 2,
      interval: 10,
      easeFactor: 2500,
      lapses: 0,
    })

    const result = scheduleCard(card, 1, config) // Again (lapse)

    expect(result.lapses).toBe(1)
    expect(result.type).toBe(3) // Relearn
    expect(result.queue).toBe(1) // Learn queue
  })

  it('should increase reps count', () => {
    const card = createMockCard({ reps: 5 })
    const config = getDefaultDeckConfig()

    const result = scheduleCard(card, 3, config)

    expect(result.reps).toBe(6)
  })
})

describe('Phase 1: Queue Builder', () => {
  it('should prioritize learning cards due now', () => {
    const now = new Date()
    const nowSeconds = Math.floor(now.getTime() / 1000)

    const learningDue = createMockCard({
      type: 1,
      queue: CQ.Learn,
      due: nowSeconds - 60, // Due 60 seconds ago
    })

    const learningAhead = createMockCard({
      type: 1,
      queue: CQ.Learn,
      due: nowSeconds + 3600, // Due in 1 hour
    })

    const config = getDefaultDeckConfig()
    const queue = buildDeckQueue([learningAhead, learningDue], config, now)

    expect(queue[0].card.id).toBe(learningDue.id)
  })

  it('should prioritize review cards due today', () => {
    const now = new Date()
    const daysSinceEpoch = Math.floor((now.getTime() - new Date(2011, 0, 1).getTime()) / (24 * 60 * 60 * 1000))

    const reviewDue = createMockCard({
      type: 2,
      queue: CQ.Review,
      due: daysSinceEpoch - 1,
    })

    const newCard = createMockCard({
      type: 0,
      queue: CQ.New,
      due: 0,
    })

    const config = getDefaultDeckConfig()
    const queue = buildDeckQueue([newCard, reviewDue], config, now)

    expect(queue[0].card.id).toBe(reviewDue.id)
  })

  it('should respect new card per day limit', () => {
    const config = getDefaultDeckConfig()
    config.new.perDay = 2

    const new1 = createMockCard({ type: 0, queue: CQ.New, due: 0 })
    const new2 = createMockCard({ type: 0, queue: CQ.New, due: 1 })
    const new3 = createMockCard({ type: 0, queue: CQ.New, due: 2 })

    const queue = buildDeckQueue([new1, new2, new3], config)

    // Only 2 new cards should be shown
    const newCardsShown = queue.filter(q => q.card.queue === CQ.New).length
    expect(newCardsShown).toBeLessThanOrEqual(2)
  })

  it('should exclude suspended cards', () => {
    const suspended = createMockCard({
      type: 0,
      queue: -1, // Suspended
    })

    const new_card = createMockCard({
      type: 0,
      queue: CQ.New,
    })

    const config = getDefaultDeckConfig()
    const queue = buildDeckQueue([suspended, new_card], config)

    expect(queue.every(q => q.card.queue !== -1)).toBe(true)
  })

  it('should get deck counts correctly', () => {
    const config = getDefaultDeckConfig()

    const newCard = createMockCard({ type: 0, queue: CQ.New })
    const learningCard = createMockCard({ type: 1, queue: CQ.Learn })
    const reviewCard = createMockCard({ type: 2, queue: CQ.Review, due: 0 })

    const counts = getDeckCounts([newCard, learningCard, reviewCard], config)

    expect(counts.new).toBeGreaterThan(0)
    expect(counts.learning).toBeGreaterThan(0)
    expect(counts.review).toBeGreaterThan(0)
  })
})

describe('Phase 1: Answer Card', () => {
  it('should calculate review stats from response', () => {
    const card = createMockCard({ type: 2, queue: CQ.Review, interval: 10 })
    const config = getDefaultDeckConfig()

    const result = answerCard({ card, response: 3, reviewTime: 5000, config })

    expect(result.logEntry.ease).toBe(3)
    expect(result.logEntry.time).toBe(5000)
    expect(result.updated.reps).toBe(1)
  })

  it('should calculate retention correctly', () => {
    const card = createMockCard({
      reps: 10,
      lapses: 2,
    })

    const retention = getCardRetention(card)

    expect(retention.reps).toBe(10)
    expect(retention.lapses).toBe(2)
    expect(retention.retention).toBe(80) // (10-2)/10 * 100 = 80%
  })

  it('should estimate next review time for learning cards', () => {
    const now = new Date()
    const nowSeconds = Math.floor(now.getTime() / 1000)
    const futureTime = nowSeconds + 300 // 5 minutes

    const card = createMockCard({
      type: 1,
      queue: CQ.Learn,
      due: futureTime,
    })

    const updated = { ...card, due: futureTime }
    const estimate = estimateNextReviewTime(updated)

    expect(estimate.relative).toContain('minute')
    expect(estimate.timestamp).toBeGreaterThan(now.getTime())
  })

  it('should estimate next review time for review cards', () => {
    const now = new Date()
    const daysSinceEpoch = Math.floor((now.getTime() - new Date(2011, 0, 1).getTime()) / (24 * 60 * 60 * 1000))

    const card = createMockCard({
      type: 2,
      queue: CQ.Review,
      due: daysSinceEpoch + 3,
    })

    const updated = { ...card, due: daysSinceEpoch + 3 }
    const estimate = estimateNextReviewTime(updated)

    expect(estimate.days).toBe(3)
    expect(estimate.relative).toContain('3')
  })
})

describe('Phase 1: Integration', () => {
  it('should handle complete study flow', () => {
    const config = getDefaultDeckConfig()

    // Start with new card
    let card = createMockCard({ type: 0, queue: CQ.New })
    expect(card.reps).toBe(0)

    // Answer first time (Good) - enters learning with 2 steps [1, 10]
    const result1 = answerCard({ card, response: 3, reviewTime: 8000, config })
    card = result1.updated

    expect(card.reps).toBe(1)
    expect(card.type).toBe(1) // Now learning
    expect(card.remainingSteps).toBe(2) // 2 steps remaining

    // Answer again (Good) - advances through learning steps
    const result2 = answerCard({ card, response: 3, reviewTime: 4000, config })
    card = result2.updated

    expect(card.reps).toBe(2)
    expect(card.type).toBe(1) // Still learning (more steps)
    expect(card.remainingSteps).toBe(1) // 1 step remaining

    // Answer third time (Easy) - graduates to review
    const result3 = answerCard({ card, response: 4, reviewTime: 6000, config })
    card = result3.updated

    expect(card.reps).toBe(3)
    expect(card.type).toBe(2) // Now review
    expect(card.interval).toBeGreaterThan(1)
    expect(card.easeFactor).toBe(2500) // Still at initial ease (will change after first review)

    // Answer fourth time (Easy on review) - ease should increase
    const result4 = answerCard({ card, response: 4, reviewTime: 5000, config })
    card = result4.updated

    expect(card.reps).toBe(4)
    expect(card.type).toBe(2) // Still review
    expect(card.easeFactor).toBeGreaterThan(2500) // Now increased by +0.15
  })

  it('should handle lapse and recovery', () => {
    const config = getDefaultDeckConfig()

    let card = createMockCard({
      type: 2,
      queue: CQ.Review,
      interval: 10,
      easeFactor: 2500,
      reps: 15,
    })

    // Answer (Again - lapse)
    const resultLapse = answerCard({ card, response: 1, reviewTime: 3000, config })
    card = resultLapse.updated

    expect(card.lapses).toBe(1)
    expect(card.type).toBe(3) // Relearning
    expect(resultLapse.logEntry.ease).toBe(1)

    // Answer relearn step (Good)
    const resultRecover = answerCard({ card, response: 3, reviewTime: 5000, config })
    card = resultRecover.updated

    expect(card.type).toBe(2) // Back to review
  })

  it('should build queue with proper ordering', () => {
    const now = new Date()
    const config = getDefaultDeckConfig()

    // Create mixed queue
    const learningDue = createMockCard({
      id: makeCardId(1),
      type: 1,
      queue: CQ.Learn,
      due: Math.floor(now.getTime() / 1000) - 100,
    })

    const reviewDue = createMockCard({
      id: makeCardId(2),
      type: 2,
      queue: CQ.Review,
      due: Math.floor((now.getTime() - new Date(2011, 0, 1).getTime()) / (24 * 60 * 60 * 1000)),
    })

    const newCard = createMockCard({
      id: makeCardId(3),
      type: 0,
      queue: CQ.New,
      due: 0,
    })

    const queue = buildDeckQueue([newCard, reviewDue, learningDue], config, now)

    // Learning due now should be first
    expect(queue[0].card.id).toBe(1)
    // Then review due today
    expect(queue[1].card.id).toBe(2)
    // Then new
    expect(queue[2].card.id).toBe(3)
  })
})
