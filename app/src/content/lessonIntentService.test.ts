import { describe, expect, it } from 'vitest'
import { buildLessonIntent } from './lessonIntentService'

describe('buildLessonIntent', () => {
  it('uses authored A2 output skills instead of relying on the first scenario', () => {
    const intent = buildLessonIntent({
      cefr: 'a2',
      lessonNum: 5,
      lessonId: 'genki_2_5',
      vocab: [],
      grammar: [],
      scenarios: [{
        id: 'scenario',
        title: 'Scenario',
        titleJa: '場面',
        description: 'test',
        textbook: 'Genki 2',
        textbookKey: 'genki_2_textbook',
        level: 'A2',
        lessonId: 'genki_2_5',
        coreLessonId: 'genki_2_5',
        page: 0,
        sourceKind: 'curated',
        canDo: 'This should not become the lesson output skill.',
        participants: ['A', 'B'],
        sampleDialogue: '',
        lines: [],
        practicePrompts: [],
      }],
      workbookPractice: [],
    })

    expect(intent.objective).toContain('prepared states')
    expect(intent.outputSkill).toContain('Report yes/no questions')
    expect(intent.outputSkill).not.toContain('This should not')
  })

  it('uses authored B1 output skills for Quartet lessons', () => {
    const intent = buildLessonIntent({
      cefr: 'b1',
      lessonNum: 3,
      lessonId: 'quartet_1_3',
      vocab: [],
      grammar: [],
      scenarios: [{
        id: 'scenario',
        title: 'Scenario',
        titleJa: '場面',
        description: 'test',
        textbook: 'Quartet 1',
        textbookKey: 'quartet_1_textbook',
        level: 'B1',
        lessonId: 'quartet_1_3',
        coreLessonId: 'quartet_1_3',
        page: 0,
        sourceKind: 'curated',
        canDo: 'This should not become the lesson output skill.',
        participants: ['A', 'B'],
        sampleDialogue: '',
        lines: [],
        practicePrompts: [],
      }],
      workbookPractice: [],
    })

    expect(intent.objective).toContain('social topics')
    expect(intent.outputSkill).toContain('Discuss social topics')
    expect(intent.outputSkill).not.toContain('This should not')
  })

  it('uses authored B2 output skills for Quartet 2 lessons', () => {
    const intent = buildLessonIntent({
      cefr: 'b2',
      lessonNum: 4,
      lessonId: 'quartet_2_4',
      vocab: [],
      grammar: [],
      scenarios: [],
      workbookPractice: [],
    })

    expect(intent.objective).toContain('high-pressure topics')
    expect(intent.outputSkill).toContain('strong emotional reactions')
  })

  it('uses lesson-specific authored objectives for beginner lessons', () => {
    const intent = buildLessonIntent({
      cefr: 'a1',
      lessonNum: 6,
      lessonId: 'genki_1_6',
      vocab: [],
      grammar: [],
      scenarios: [],
      workbookPractice: [],
    })

    expect(intent.objective).toContain('て-form')
    expect(intent.objective).toContain('requests')
    expect(intent.outputSkill).toContain('Ask for help')
  })
})
