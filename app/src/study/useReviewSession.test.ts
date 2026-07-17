import { describe, expect, it } from 'vitest'
import { resolveCardVariant } from './useReviewSession'
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
