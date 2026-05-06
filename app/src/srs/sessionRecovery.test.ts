import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { SessionRecovery } from './sessionRecovery'
import type { SessionRecoveryPayload } from '../study/types'

const PAYLOAD: SessionRecoveryPayload = {
  sessionId: 1,
  userId: 1,
  mode: 'srs',
  queue: [],
  currentIndex: 3,
  stats: { cardsReviewed: 3, correctCount: 2, startedAt: Date.now() - 5000 },
  savedAt: Date.now(),
}

beforeEach(() => localStorage.clear())
afterEach(() => localStorage.clear())

describe('SessionRecovery', () => {
  it('save then load returns equivalent payload', () => {
    SessionRecovery.save(PAYLOAD)
    const loaded = SessionRecovery.load()
    expect(loaded?.sessionId).toBe(PAYLOAD.sessionId)
    expect(loaded?.currentIndex).toBe(PAYLOAD.currentIndex)
  })

  it('load returns null when nothing saved', () => {
    expect(SessionRecovery.load()).toBeNull()
  })

  it('clear after save returns null from load', () => {
    SessionRecovery.save(PAYLOAD)
    SessionRecovery.clear()
    expect(SessionRecovery.load()).toBeNull()
  })

  it('isStale returns false for fresh payload', () => {
    const fresh = { ...PAYLOAD, savedAt: Date.now() }
    expect(SessionRecovery.isStale(fresh)).toBe(false)
  })

  it('isStale returns true for payload older than 24h', () => {
    const old = { ...PAYLOAD, savedAt: Date.now() - 25 * 60 * 60 * 1000 }
    expect(SessionRecovery.isStale(old)).toBe(true)
  })

  it('load returns null for corrupt JSON', () => {
    localStorage.setItem('kiroku_michi_recovery', 'not-valid-json{{{')
    expect(SessionRecovery.load()).toBeNull()
  })
})
