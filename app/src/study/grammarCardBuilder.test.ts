import { describe, expect, it } from 'vitest'
import {
  buildGrammarQuestionForCard,
  grammarCardFields,
  grammarEntriesFromCards,
} from './grammarCardBuilder'
import type { ReviewCard } from './types'

describe('grammarCardBuilder', () => {
  const grammarItem = {
    id: 'g1',
    pattern: 'です',
    meaning: 'polite to be',
    explanation: 'Copula for nouns and na-adjectives.',
    lesson: 'genki_1_1',
    source: 'genki',
    page: 34,
    examples: [{ japanese: 'わたしは学生です', english: 'I am a student' }],
  }

  it('builds cloze front from example sentence', () => {
    const fields = grammarCardFields(grammarItem)
    expect(fields.front).toContain('[___]')
    expect(fields.back).toContain('です')
  })

  it('maps grammar cards in queue to cloze questions', () => {
    const card: ReviewCard = {
      cardStateId: 42,
      cardId: 42,
      type: 'grammar',
      front: 'わたしは学生[___]',
      back: 'です — polite to be',
      reading: null,
      audioUrl: null,
      jlptLevel: null,
      userNote: null,
      exampleSentence: 'わたしは学生です',
      exampleTranslation: 'I am a student',
      state: 'new',
      lapses: 0,
      stability: 0,
      difficulty: 0,
      due: '2026-01-01',
    }
    const entries = grammarEntriesFromCards(
      [card],
      new Map([[grammarItem.pattern, grammarItem]]),
      ['です', 'は'],
    )
    expect(entries).toHaveLength(1)
    expect(entries[0]?.[0]).toBe(42)
    const question = entries[0]?.[1]
    expect(question?.answer).toBe('です')
    expect(question?.options).toContain('です')
    expect(buildGrammarQuestionForCard(card, grammarItem, ['です', 'は']).prompt).toContain('[___]')
  })
})
