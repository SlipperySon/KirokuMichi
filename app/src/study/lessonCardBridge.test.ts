import { describe, expect, it } from 'vitest'
import {
  orderLessonReviewCards,
  priorityFrontsFromLessonSignals,
  vocabToSeedItems,
} from './lessonCardBridge'
import type { ReviewCard } from './types'

function card(partial: Partial<ReviewCard> & Pick<ReviewCard, 'cardStateId' | 'front'>): ReviewCard {
  return {
    cardId: partial.cardStateId,
    type: 'vocabulary',
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

describe('lessonCardBridge', () => {
  it('maps vocab to seed items', () => {
    expect(vocabToSeedItems([
      { id: '1', surface: '猫', english: 'cat', lesson: 'genki_1_1', source: 'genki', page: 1 },
    ])).toEqual([
      { id: '1', front: '猫', back: 'cat', reading: null, originRef: '1' },
    ])
  })

  it('builds priority fronts from again + miss signals', () => {
    const fronts = priorityFrontsFromLessonSignals({
      vocab: [
        { id: 'a', surface: '犬', english: 'dog', lesson: 'genki_1_1', source: 'g', page: 1 },
        { id: 'b', surface: '鳥', english: 'bird', lesson: 'genki_1_1', source: 'g', page: 1 },
      ],
      grammar: [
        { id: 'g1', pattern: '〜は', meaning: 'topic', lesson: 'genki_1_1', source: 'g', page: 1 },
      ],
      againItemIds: ['vocab:a'],
      missedItemIds: ['grammar:g1'],
    })
    expect(fronts).toEqual(['犬', '〜は'])
  })

  it('maps typed-recall miss ids back to vocab fronts', () => {
    const fronts = priorityFrontsFromLessonSignals({
      vocab: [
        { id: 'a', surface: '犬', english: 'dog', lesson: 'genki_1_1', source: 'g', page: 1 },
      ],
      grammar: [],
      againItemIds: [],
      missedItemIds: ['vocab:a:typed'],
    })
    expect(fronts).toEqual(['犬'])
  })

  it('orders priority fronts first and caps the queue', () => {
    const ordered = orderLessonReviewCards(
      [
        card({ cardStateId: 1, front: '鳥' }),
        card({ cardStateId: 2, front: '犬' }),
        card({ cardStateId: 3, front: '猫' }),
      ],
      ['犬', '猫'],
      2,
    )
    expect(ordered.map(c => c.front)).toEqual(['犬', '猫'])
  })
})
