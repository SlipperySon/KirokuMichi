/**
 * SM2 Scheduler - Spaced Repetition Scheduling
 * Verified from Anki rslib/src/scheduler/states/review.rs
 *
 * This is the core scheduling algorithm that determines:
 * - New interval for the card
 * - New ease factor
 * - New card state (queue/type)
 * - When card should next be reviewed
 */

import type { Card, CardQueue, CardResponse, CardType, ScheduleResult } from '../types/card'
import type { DeckConfig } from '../types/deck'
import { CardQueue as CQ } from '../types/card'

/**
 * SM2 Constants (Verified from ANKI_SPEC_VERIFIED.md)
 */
export const SM2_INITIAL_EASE = 2.5
export const SM2_MINIMUM_EASE = 1.3
export const SM2_EASE_AGAIN_DELTA = -0.2      // factor -= 0.2
export const SM2_EASE_HARD_DELTA = -0.15      // factor -= 0.15
export const SM2_EASE_GOOD_DELTA = 0.0        // factor unchanged
export const SM2_EASE_EASY_DELTA = 0.15       // factor += 0.15

/**
 * Current time in days since 2011-01-01 (Anki epoch)
 */
function getCurrentDueDay(now: Date): number {
  const ankilEpoch = new Date(2011, 0, 1).getTime()
  const nowMs = now.getTime()
  const daysSince = Math.floor((nowMs - ankilEpoch) / (24 * 60 * 60 * 1000))
  return daysSince
}

/**
 * Current time in seconds (for learning card due times)
 */
function getCurrentUnixSeconds(now: Date): number {
  return Math.floor(now.getTime() / 1000)
}

/**
 * Generate random fuzz for interval (±5% to avoid clustering)
 */
function applyFuzz(interval: number, fuzzFactor: number = 0.05): number {
  const fuzz = interval * fuzzFactor
  const randomFuzz = Math.random() * fuzz * 2 - fuzz  // ±fuzz
  return Math.max(1, interval + randomFuzz)
}

/**
 * Answer a review card (card is in review state)
 */
function scheduleReviewCard(
  card: Card,
  response: CardResponse,
  config: DeckConfig,
  now: Date
): Card {
  const currentEase = card.easeFactor / 1000
  const currentInterval = card.interval
  const currentDue = getCurrentDueDay(now)

  let newEase = currentEase
  let newInterval = currentInterval
  let newQueue: CardQueue = CQ.Review
  let newType: CardType = 2 // Review
  let newLapses = card.lapses

  if (response === 1) {
    // AGAIN - card failed (lapse)
    newLapses = card.lapses + 1
    newEase = Math.max(SM2_MINIMUM_EASE, currentEase + SM2_EASE_AGAIN_DELTA)

    // Lapsed card goes back to learning with relearning steps
    const lapseSteps = config.lapse.delays  // e.g., [10] (minutes)
    if (lapseSteps.length > 0) {
      const firstStep = lapseSteps[0] * 60  // convert to seconds
      const dueSeconds = getCurrentUnixSeconds(now) + firstStep
      return {
        ...card,
        type: 3,  // Relearn
        queue: CQ.Learn,
        due: dueSeconds,
        interval: Math.round(currentInterval * config.lapse.mult),
        easeFactor: Math.round(newEase * 1000),
        lapses: newLapses,
        reps: card.reps + 1,
      }
    } else {
      // No relearning steps, go directly back to review with reduced interval
      newInterval = Math.max(
        config.lapse.minInt,
        Math.round(currentInterval * config.lapse.mult)
      )
      newQueue = CQ.Review
      newType = 2  // Review
    }
  } else if (response === 2) {
    // HARD - review without interval change
    newEase = Math.max(SM2_MINIMUM_EASE, currentEase + SM2_EASE_HARD_DELTA)
    newInterval = currentInterval  // no change
  } else if (response === 3) {
    // GOOD - normal progression
    newEase = Math.max(SM2_MINIMUM_EASE, currentEase + SM2_EASE_GOOD_DELTA)
    newInterval = Math.round(currentInterval * newEase)
  } else if (response === 4) {
    // EASY - fast progression
    newEase = currentEase + SM2_EASE_EASY_DELTA
    newInterval = Math.round(currentInterval * newEase)
  }

  // Cap interval at max
  if (newInterval > config.review.perDay * 100) {
    newInterval = config.review.perDay * 100
  }

  // Apply fuzz
  const fuzzedInterval = applyFuzz(newInterval, config.review.fuzz)
  const newDue = currentDue + Math.round(fuzzedInterval)

  return {
    ...card,
    type: newType,
    queue: newQueue,
    due: newDue,
    interval: Math.round(fuzzedInterval),
    easeFactor: Math.round(newEase * 1000),
    lapses: newLapses,
    reps: card.reps + 1,
  }
}

/**
 * Answer a learning card (in the middle of learning steps)
 */
function scheduleLearnCard(
  card: Card,
  response: CardResponse,
  config: DeckConfig,
  now: Date
): Card {
  const learnSteps = config.new.delays  // [1, 10] minutes
  const easyInterval = config.new.ints[1]  // graduating interval
  const currentEase = SM2_INITIAL_EASE

  if (response === 1) {
    // AGAIN - restart learning steps
    if (learnSteps.length > 0) {
      const firstStep = learnSteps[0] * 60  // convert to seconds
      const dueSeconds = getCurrentUnixSeconds(now) + firstStep
      return {
        ...card,
        type: 1,  // Learn
        queue: CQ.Learn,
        due: dueSeconds,
        reps: card.reps + 1,
      }
    }
    // No steps, treat as new again
    return {
      ...card,
      type: 0,  // New
      queue: CQ.New,
      due: 0,
    }
  } else if (response === 2) {
    // HARD - repeat same step
    const currentStepIndex = card.remainingSteps > 0 ? learnSteps.length - card.remainingSteps : 0
    if (currentStepIndex < learnSteps.length) {
      const stepDuration = learnSteps[currentStepIndex] * 60
      const dueSeconds = getCurrentUnixSeconds(now) + stepDuration
      return {
        ...card,
        type: 1,
        queue: CQ.Learn,
        due: dueSeconds,
        reps: card.reps + 1,
      }
    }
    // No more steps, graduate
    return {
      ...card,
      type: 2,  // Review
      queue: CQ.Review,
      due: getCurrentDueDay(now) + config.new.ints[0],  // graduating interval
      interval: config.new.ints[0],
      easeFactor: Math.round(currentEase * 1000),
      reps: card.reps + 1,
    }
  } else if (response === 3 || response === 4) {
    // GOOD or EASY - advance to next step or graduate
    const remainingSteps = Math.max(0, card.remainingSteps - 1)

    if (remainingSteps > 0) {
      // More steps to go
      const nextStepIndex = learnSteps.length - remainingSteps
      if (nextStepIndex < learnSteps.length) {
        const stepDuration = learnSteps[nextStepIndex] * 60
        const dueSeconds = getCurrentUnixSeconds(now) + stepDuration
        return {
          ...card,
          type: 1,
          queue: CQ.Learn,
          due: dueSeconds,
          remainingSteps,
          reps: card.reps + 1,
        }
      }
    }

    // Graduation
    const graduatingInterval = response === 4
      ? config.new.ints[1]  // easy interval
      : config.new.ints[0]  // graduating interval

    return {
      ...card,
      type: 2,  // Review
      queue: CQ.Review,
      due: getCurrentDueDay(now) + graduatingInterval,
      interval: graduatingInterval,
      easeFactor: Math.round(currentEase * 1000),
      remainingSteps: 0,
      reps: card.reps + 1,
    }
  }

  return card
}

/**
 * Answer a new card (never reviewed before)
 */
function scheduleNewCard(
  card: Card,
  response: CardResponse,
  config: DeckConfig,
  now: Date
): Card {
  const learnSteps = config.new.delays  // [1, 10] minutes

  if (response === 1) {
    // AGAIN - treat as failed, restart learning
    if (learnSteps.length > 0) {
      const firstStep = learnSteps[0] * 60
      return {
        ...card,
        type: 1,  // Learn
        queue: CQ.Learn,
        due: getCurrentUnixSeconds(now) + firstStep,
        reps: card.reps + 1,
      }
    }
    // No learning steps, keep as new
    return {
      ...card,
      reps: card.reps + 1,
    }
  } else if (response === 4 && learnSteps.length === 0) {
    // EASY with no learning steps - graduate immediately
    return {
      ...card,
      type: 2,  // Review
      queue: CQ.Review,
      due: getCurrentDueDay(now) + config.new.ints[1],  // easy interval
      interval: config.new.ints[1],
      easeFactor: Math.round(SM2_INITIAL_EASE * 1000),
      reps: card.reps + 1,
    }
  } else {
    // HARD or GOOD or EASY with learning steps - enter learning
    if (learnSteps.length > 0) {
      const firstStep = learnSteps[0] * 60
      return {
        ...card,
        type: 1,  // Learn
        queue: CQ.Learn,
        due: getCurrentUnixSeconds(now) + firstStep,
        remainingSteps: learnSteps.length,
        reps: card.reps + 1,
      }
    }
    // No steps, graduate
    const interval = response === 2 ? 1 : config.new.ints[0]
    return {
      ...card,
      type: 2,  // Review
      queue: CQ.Review,
      due: getCurrentDueDay(now) + interval,
      interval,
      easeFactor: Math.round(SM2_INITIAL_EASE * 1000),
      reps: card.reps + 1,
    }
  }
}

/**
 * Schedule a card based on response
 * Main entry point for scheduling
 */
export function scheduleCard(
  card: Card,
  response: CardResponse,
  config: DeckConfig,
  now: Date = new Date()
): Card {
  switch (card.type) {
    case 0:  // New
      return scheduleNewCard(card, response, config, now)
    case 1:  // Learn
      return scheduleLearnCard(card, response, config, now)
    case 2:  // Review
      return scheduleReviewCard(card, response, config, now)
    case 3:  // Relearn
      return scheduleLearnCard(card, response, config, now)  // treat like learning
    default:
      throw new Error(`Unknown card type: ${card.type}`)
  }
}

/**
 * Get default deck config (Anki defaults)
 */
export function getDefaultDeckConfig(): DeckConfig {
  return {
    id: 1 as any,
    name: 'Default',
    new: {
      delays: [1, 10],           // 1 min, 10 min
      ints: [1, 4],              // graduating: 1 day, easy: 4 days
      initialFactor: 2500,       // 2.5
      separate: true,
      perDay: 20,
      order: 0,                  // random
    },
    review: {
      perDay: 200,
      ease4: 1.3,                // bonus for easy
      fuzz: 0.05,                // 5% randomization
    },
    lapse: {
      delays: [10],              // 10 minutes
      mult: 0.5,                 // 50% of original interval
      minInt: 1,                 // minimum 1 day
      leechFails: 8,             // leech after 8 lapses
    },
  }
}
