import { describe, expect, it } from 'vitest'
import { getStudyPathAction, type StudyPathPlannerInput } from './studyPathPlanner'
import { LESSON_RAIL_PHASES, railPhaseFromStepKind } from './lessonSessionPersistence'
import { buildLessonPlan } from './lessonStudyPlanner'
import { interleaveDueAndNew } from './reviewInterleave'
import type { ReviewCard } from './types'

/**
 * Phase 5 redesign gate — locks science + Anki reuse contracts.
 */
describe('learning environment redesign gate', () => {
  const base: StudyPathPlannerInput = {
    learningPath: null,
    currentLesson: null,
    lessonsCompleted: [],
    dueCount: 0,
    availableNewCount: 0,
    grammarDueCount: 0,
    mistakeCount: 0,
    reviewedToday: 0,
    dailyGoal: 20,
    hasRecovery: false,
  }

  it('keeps Today priority: recovery → dues → current lesson → path lesson', () => {
    expect(getStudyPathAction({ ...base, hasRecovery: true, dueCount: 9 }).kind).toBe('recovery')
    expect(getStudyPathAction({ ...base, dueCount: 3, currentLesson: 'genki_1_1' }).kind).toBe('review')
    expect(getStudyPathAction({ ...base, currentLesson: 'genki_1_1' }).kind).toBe('current-lesson')
  })

  it('maps the lesson plan onto the six-phase science rail', () => {
    const plan = buildLessonPlan(
      [{ id: 'v1', surface: '学生', english: 'student', lesson: 'genki_1_1', source: 'g', page: 1 }],
      [{ id: 'g1', pattern: 'です', meaning: 'polite to be', lesson: 'genki_1_1', source: 'g', page: 1 }],
      'genki_1_1',
    )
    const kinds = plan.map(step => step.kind)
    expect(kinds[0]).toBe('intro')
    expect(kinds).toContain('teach')
    expect(kinds).toContain('cards')
    expect(kinds.at(-1)).toBe('speak')
    expect(LESSON_RAIL_PHASES.map(p => p.id)).toEqual([
      'intro', 'teach', 'check', 'practice', 'cards', 'speak',
    ])
    expect(railPhaseFromStepKind('checkpoint')).toBe('check')
    expect(railPhaseFromStepKind('workbook')).toBe('practice')
  })

  it('does not starve dues when interleaving new cards (5 due : 1 new)', () => {
    const due = Array.from({ length: 5 }, (_, i) => ({
      cardStateId: i + 1,
      cardId: i + 1,
      type: 'vocabulary' as const,
      front: `d${i}`,
      back: `d${i}`,
      reading: null,
      audioUrl: null,
      jlptLevel: null,
      userNote: null,
      exampleSentence: null,
      exampleTranslation: null,
      state: 'review' as const,
      lapses: 0,
      stability: 1,
      difficulty: 5,
      due: new Date().toISOString(),
    })) satisfies ReviewCard[]
    const news = [{
      cardStateId: 99,
      cardId: 99,
      type: 'vocabulary' as const,
      front: 'n0',
      back: 'n0',
      reading: null,
      audioUrl: null,
      jlptLevel: null,
      userNote: null,
      exampleSentence: null,
      exampleTranslation: null,
      state: 'new' as const,
      lapses: 0,
      stability: 0,
      difficulty: 0,
      due: new Date().toISOString(),
    }] satisfies ReviewCard[]
    const queue = interleaveDueAndNew(due, news, 6)
    expect(queue.slice(0, 5).every(c => c.front.startsWith('d'))).toBe(true)
    expect(queue[5]?.front).toBe('n0')
  })

  it('injects typed free-recall into checkpoint chunks', () => {
    const plan = buildLessonPlan(
      [
        { id: 'v1', surface: '学生', english: 'student', lesson: 'genki_1_1', source: 'g', page: 1 },
        { id: 'v2', surface: '先生', english: 'teacher', lesson: 'genki_1_1', source: 'g', page: 2 },
        { id: 'v3', surface: '友だち', english: 'friend', lesson: 'genki_1_1', source: 'g', page: 3 },
        { id: 'v4', surface: '本', english: 'book', lesson: 'genki_1_1', source: 'g', page: 4 },
      ],
      [{ id: 'g1', pattern: 'です', meaning: 'polite to be', lesson: 'genki_1_1', source: 'g', page: 1 }],
      'genki_1_1',
    )
    const checkpoint = plan.find(step => step.kind === 'checkpoint')
    expect(checkpoint?.kind).toBe('checkpoint')
    if (checkpoint?.kind !== 'checkpoint') return
    expect(checkpoint.questions.some(q => q.recallMode === 'typed')).toBe(true)
  })
})
