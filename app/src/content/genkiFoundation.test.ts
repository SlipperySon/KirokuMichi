import { describe, expect, it } from 'vitest'
import { applyGenkiLessonOneFoundation, applyGenkiLessonOneGrammarScope } from './genkiFoundation'
import type { GrammarItem, VocabItem } from './curriculumService'

describe('Genki 1 foundation overlay', () => {
  it('adds greetings and numbers before extracted Lesson 1 vocab without duplicating surfaces', () => {
    const extracted: VocabItem[] = [
      { id: 'existing', surface: 'こんにちは', english: 'hello', lesson: 'genki_1_1', source: 'genki_1_textbook', page: 20 },
      { id: 'student', surface: '学生', english: 'student', lesson: 'genki_1_1', source: 'genki_1_textbook', page: 21 },
    ]

    const result = applyGenkiLessonOneFoundation('genki_1_1', extracted)

    expect(result[0]).toMatchObject({ surface: 'おはようございます', source: 'genki_1_foundation' })
    expect(result.filter(item => item.surface === 'こんにちは')).toHaveLength(1)
    expect(result.at(-1)).toMatchObject({ surface: '学生' })
  })

  it('narrows Genki 1 Lesson 1 grammar to beginner-safe patterns when possible', () => {
    const grammar: GrammarItem[] = [
      { id: 'desu', pattern: 'です', meaning: 'polite closure', lesson: 'genki_1_1', source: 'test', page: 1 },
      { id: 'deshou', pattern: 'でしょう', meaning: 'probably', lesson: 'genki_1_1', source: 'test', page: 1 },
    ]

    expect(applyGenkiLessonOneGrammarScope('genki_1_1', grammar).map(item => item.pattern)).toEqual(['です'])
    expect(applyGenkiLessonOneGrammarScope('genki_1_2', grammar)).toBe(grammar)
  })
})
