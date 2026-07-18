import { describe, expect, it } from 'vitest'
import { planAgainRequeue, resolveCardVariant, MAX_AGAIN_REQUEUES } from './useReviewSession'
import type { ReviewCard } from './types'

function card(partial: Partial<ReviewCard> & Pick<ReviewCard, 'cardStateId' | 'type'>): ReviewCard {
  return {
    cardId: partial.cardStateId,
    front: 'front',
    back: 'back',
    reading: null,
    audioUrl: null,
    jlptLevel: null,
    userNote: null,
    exampleSentence: null,
    exampleTranslation: null,
    state: 'new',
    lapses: 0,
    stability: 0,
    difficulty: 0,
    due: '2026-01-01',
    ...partial,
  }
}

describe('resolveCardVariant', () => {
  it('uses listen-then-type for sentence cards', () => {
    expect(resolveCardVariant(card({ cardStateId: 3, type: 'sentence' }))).toBe('listening')
  })

  it('uses grammar cloze for grammar cards', () => {
    expect(resolveCardVariant(card({ cardStateId: 3, type: 'grammar' }))).toBe('grammar')
  })

  it('rotates writing variant for vocabulary cards', () => {
    expect(resolveCardVariant(card({ cardStateId: 7, type: 'vocabulary' }))).toBe('writing')
    expect(resolveCardVariant(card({ cardStateId: 8, type: 'vocabulary' }))).toBe('reading')
  })
})

describe('planAgainRequeue', () => {
  it('inserts several positions ahead in the middle of a queue', () => {
    expect(planAgainRequeue(0, 10, 0)).toBe(4)
    expect(planAgainRequeue(2, 10, 0, 3)).toBe(5)
  })

  it('clamps to the end when near the end of the queue', () => {
    expect(planAgainRequeue(8, 10, 0)).toBe(10)
    expect(planAgainRequeue(9, 10, 0)).toBe(10)
  })

  it('returns null after the per-card requeue cap', () => {
    expect(planAgainRequeue(0, 10, MAX_AGAIN_REQUEUES)).toBeNull()
    expect(planAgainRequeue(0, 10, MAX_AGAIN_REQUEUES - 1)).toBe(4)
  })

  it('returns null for empty or out-of-range queues', () => {
    expect(planAgainRequeue(0, 0, 0)).toBeNull()
    expect(planAgainRequeue(-1, 5, 0)).toBeNull()
    expect(planAgainRequeue(5, 5, 0)).toBeNull()
  })
})
