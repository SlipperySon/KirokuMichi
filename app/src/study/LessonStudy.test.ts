import { describe, expect, it } from 'vitest'
import { buildLessonPlan } from './lessonStudyPlanner'

describe('buildLessonPlan', () => {
  it('keeps foundation items first and then follows source page order', () => {
    const plan = buildLessonPlan(
      [
        {
          id: 'late',
          surface: 'おねえさん',
          english: 'older sister',
          lesson: 'genki_1_1',
          source: 'genki_1_textbook',
          page: 32,
        },
        {
          id: 'foundation',
          surface: 'こんにちは',
          english: 'hello',
          lesson: 'genki_1_1',
          source: 'genki_1_foundation',
          page: 0,
        },
        {
          id: 'early',
          surface: 'すうじ',
          english: 'numbers',
          lesson: 'genki_1_1',
          source: 'genki_1_textbook',
          page: 10,
        },
      ],
      [
        {
          id: 'desu',
          pattern: 'です',
          meaning: 'polite to be',
          lesson: 'genki_1_1',
          source: 'cefr_grammar',
          page: 0,
        },
      ],
      'genki_1_1'
    )

    const firstTeachStep = plan.find(step => step.kind === 'teach')
    expect(firstTeachStep?.kind).toBe('teach')
    if (firstTeachStep?.kind !== 'teach') return

    expect(firstTeachStep.items.map(item => item.title)).toEqual([
      'こんにちは',
      'すうじ',
      'おねえさん',
      'です',
    ])
  })
})
