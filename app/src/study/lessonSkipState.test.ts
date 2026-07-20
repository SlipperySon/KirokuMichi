import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearLessonSkipState,
  findSkipDebt,
  getLessonSkipState,
  markCardsDeferred,
  markSpeakPending,
} from './lessonSkipState'

describe('lessonSkipState', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('marks cards deferred and implies speak still pending', () => {
    markCardsDeferred('genki_1_1')
    const s = getLessonSkipState('genki_1_1')
    expect(s?.cardsDeferred).toBe(true)
    expect(s?.speakPending).toBe(true)
  })

  it('finds skip debt preferring current lesson', () => {
    markSpeakPending('genki_1_2')
    markCardsDeferred('genki_1_1')
    const debt = findSkipDebt('genki_1_2', [])
    expect(debt?.lessonId).toBe('genki_1_2')
  })

  it('clears skip state on complete', () => {
    markCardsDeferred('genki_1_1')
    clearLessonSkipState('genki_1_1')
    expect(getLessonSkipState('genki_1_1')).toBeNull()
  })

  it('ignores completed lessons when finding debt', () => {
    markSpeakPending('genki_1_1')
    expect(findSkipDebt(null, ['genki_1_1'])).toBeNull()
  })
})
