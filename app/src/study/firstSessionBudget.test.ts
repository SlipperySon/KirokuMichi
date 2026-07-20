import { describe, expect, it } from 'vitest'
import { applyFirstSessionBudget, isFirstSessionCandidate } from './firstSessionBudget'
import { buildLessonPlan } from './lessonStudyPlanner'

describe('firstSessionBudget', () => {
  const vocab = [
    { id: 'v1', surface: 'A', english: 'a', lesson: 'genki_1_1', source: 's', page: 10 },
    { id: 'v2', surface: 'B', english: 'b', lesson: 'genki_1_1', source: 's', page: 20 },
    { id: 'v3', surface: 'C', english: 'c', lesson: 'genki_1_1', source: 's', page: 30 },
  ]
  const grammar = [
    { id: 'g1', pattern: 'です', meaning: 'to be', lesson: 'genki_1_1', source: 's', page: 0 },
  ]

  it('detects first lesson as first-session candidate', () => {
    expect(isFirstSessionCandidate([], 'genki_1_1')).toBe(true)
    expect(isFirstSessionCandidate(['genki_1_1'], 'genki_1_2')).toBe(false)
  })

  it('caps day-1 rail to intro + one teach chunk + checkpoint + cards + speak', () => {
    const full = buildLessonPlan(vocab, grammar, 'genki_1_1', [
      {
        id: 'wb1',
        type: 'roleplay',
        practiceMode: 'output',
        focus: 'greeting',
        prompt: 'Greet',
        support: 'Use です',
        source: 'workbook',
        sourceKey: 'genki_1_workbook',
        page: 12,
      },
    ])
    const budgeted = applyFirstSessionBudget(full, true)

    expect(budgeted[0]?.kind).toBe('intro')
    expect(budgeted.some(s => s.kind === 'workbook')).toBe(false)
    expect(budgeted.some(s => s.kind === 'final')).toBe(false)
    expect(budgeted.filter(s => s.kind === 'teach').length).toBe(1)
    expect(budgeted.at(-2)?.kind).toBe('cards')
    expect(budgeted.at(-1)?.kind).toBe('speak')
  })
})
