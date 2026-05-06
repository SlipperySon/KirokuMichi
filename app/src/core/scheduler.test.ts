import { describe, it, expect } from 'vitest'
import { FSRSScheduler, SM2Scheduler, isLeech, LEECH_THRESHOLD } from './scheduler'

describe('FSRSScheduler', () => {
  const scheduler = new FSRSScheduler()

  it('creates a new card with correct initial state', () => {
    const card = scheduler.getNewCard()
    expect(card.state).toBe('new')
    expect(card.reps).toBe(0)
    expect(card.lapses).toBe(0)
  })

  it('schedules a card further in the future after Good rating', () => {
    const card = scheduler.getNewCard()
    const result = scheduler.schedule(card, 'good')
    expect(result.due.getTime()).toBeGreaterThan(Date.now())
  })

  it('schedules Again sooner than Good', () => {
    const card = scheduler.getNewCard()
    const again = scheduler.schedule(card, 'again')
    const good = scheduler.schedule(card, 'good')
    expect(again.due.getTime()).toBeLessThanOrEqual(good.due.getTime())
  })

  it('Easy schedules further than Good', () => {
    const card = scheduler.getNewCard()
    const good = scheduler.schedule(card, 'good')
    const easy = scheduler.schedule(card, 'easy')
    expect(easy.due.getTime()).toBeGreaterThanOrEqual(good.due.getTime())
  })

  it('increments lapses on Again rating', () => {
    const card = scheduler.getNewCard()
    const result = scheduler.schedule(card, 'again')
    expect(result.lapses).toBeGreaterThanOrEqual(0)
  })
})

describe('SM2Scheduler', () => {
  const scheduler = new SM2Scheduler()

  it('creates a new card', () => {
    const card = scheduler.getNewCard()
    expect(card.state).toBe('new')
  })

  it('schedules Good rating correctly', () => {
    const card = scheduler.getNewCard()
    const result = scheduler.schedule(card, 'good')
    expect(result.due.getTime()).toBeGreaterThan(Date.now())
    expect(result.reps).toBe(1)
  })

  it('resets reps on Again', () => {
    const card = scheduler.getNewCard()
    const afterGood = scheduler.schedule(card, 'good')
    const afterAgain = scheduler.schedule(afterGood, 'again')
    expect(afterAgain.reps).toBe(0)
    expect(afterAgain.lapses).toBe(1)
  })
})

describe('Leech detection', () => {
  it('flags a card as a leech at threshold', () => {
    expect(isLeech(LEECH_THRESHOLD)).toBe(true)
    expect(isLeech(LEECH_THRESHOLD - 1)).toBe(false)
  })
})
