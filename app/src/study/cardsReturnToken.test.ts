import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearCardsReturnToken,
  consumeCardsReturnToken,
  issueCardsReturnToken,
} from './cardsReturnToken'

describe('cardsReturnToken', () => {
  beforeEach(() => {
    clearCardsReturnToken('genki_1_1')
  })

  it('issues an opaque token and allows remount verification', () => {
    const token = issueCardsReturnToken('genki_1_1', 42)
    expect(token.length).toBeGreaterThan(8)
    expect(consumeCardsReturnToken('genki_1_1', token)).toBe(true)
    // Second call succeeds via verified flag (React Strict Mode remount)
    expect(consumeCardsReturnToken('genki_1_1', token)).toBe(true)
    expect(consumeCardsReturnToken('genki_1_1', null)).toBe(true)
  })

  it('rejects missing or mismatched tokens', () => {
    const token = issueCardsReturnToken('genki_1_1', 7)
    expect(consumeCardsReturnToken('genki_1_1', null)).toBe(false)
    expect(consumeCardsReturnToken('genki_1_1', 'wrong-token')).toBe(false)
    expect(consumeCardsReturnToken('other_lesson', token)).toBe(false)
    expect(consumeCardsReturnToken('genki_1_1', token)).toBe(true)
  })

  it('rejects bare after=cards without a stored token', () => {
    expect(consumeCardsReturnToken('genki_1_1', '')).toBe(false)
  })

  it('issue clears prior verified flag', () => {
    const first = issueCardsReturnToken('genki_1_1', 1)
    expect(consumeCardsReturnToken('genki_1_1', first)).toBe(true)
    const second = issueCardsReturnToken('genki_1_1', 2)
    expect(consumeCardsReturnToken('genki_1_1', first)).toBe(false)
    expect(consumeCardsReturnToken('genki_1_1', second)).toBe(true)
  })
})
