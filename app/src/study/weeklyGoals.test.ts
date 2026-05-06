import { describe, expect, it } from 'vitest'
import { calculateWeeklyGoal } from './weeklyGoals'

describe('calculateWeeklyGoal', () => {
  it('returns null when goal date is missing', () => {
    expect(calculateWeeklyGoal({ goalDate: null, cardsNeeded: 120 })).toBeNull()
  })

  it('calculates weekly need for future goal date', () => {
    const result = calculateWeeklyGoal({
      goalDate: '2026-12-31',
      cardsNeeded: 120,
      now: new Date('2026-05-01T10:00:00.000Z'),
    })
    expect(result).not.toBeNull()
    expect(result?.weeksRemaining).toBeGreaterThan(1)
    expect(result?.cardsPerWeekNeeded).toBe(Math.ceil(120 / (result?.weeksRemaining ?? 1)))
    expect(result?.isPastDue).toBe(false)
  })

  it('treats urgent near-term goal as at least one week', () => {
    const result = calculateWeeklyGoal({
      goalDate: '2026-05-07',
      cardsNeeded: 21,
      now: new Date('2026-05-06T10:00:00.000Z'),
    })
    expect(result?.weeksRemaining).toBe(1)
    expect(result?.cardsPerWeekNeeded).toBe(21)
    expect(result?.isPastDue).toBe(false)
  })

  it('handles past goal dates without crashing', () => {
    const result = calculateWeeklyGoal({
      goalDate: '2026-05-01',
      cardsNeeded: 10,
      now: new Date('2026-05-06T10:00:00.000Z'),
    })
    expect(result?.weeksRemaining).toBe(1)
    expect(result?.cardsPerWeekNeeded).toBe(10)
    expect(result?.isPastDue).toBe(true)
  })
})
