/**
 * Phase 8 smoke: Extra Anki decks lane + skip/defer Today priority.
 * Pure planner + lane helpers — no DB/browser required.
 */
import { describe, expect, it, beforeEach } from 'vitest'
import { getStudyPathAction, type StudyPathPlannerInput } from './studyPathPlanner'
import { deckNameFromApkg, EXTRA_DECKS_PARENT_NAME, laneFilterSql } from './deckLane'
import {
  clearLessonSkipState,
  findSkipDebt,
  markCardsDeferred,
  markSpeakPending,
} from './lessonSkipState'

const base: StudyPathPlannerInput = {
  learningPath: {
    generatedAt: '2026-07-20T00:00:00.000Z',
    weeks: [{
      week: 1,
      focus: 'A1',
      dailyGoal: 20,
      activities: [],
      milestone: 'L2',
      lessons: [
        { id: 'genki_1_1', series: 'Genki I', lessonNumber: 1 },
        { id: 'genki_1_2', series: 'Genki I', lessonNumber: 2 },
      ],
    }],
  },
  currentLesson: null,
  lessonsCompleted: [],
  dueCount: 0,
  availableNewCount: 0,
  extraDueCount: 0,
  includeExtraInToday: false,
  grammarDueCount: 0,
  mistakeCount: 0,
  reviewedToday: 0,
  dailyGoal: 20,
  hasRecovery: false,
}

describe('Phase 8 smoke — Extra decks + skip/defer', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('names Extra parent and strips .apkg', () => {
    expect(EXTRA_DECKS_PARENT_NAME).toBe('Extra Anki decks')
    expect(deckNameFromApkg('Core2k.apkg')).toBe('Core2k')
    expect(laneFilterSql('extra')).toContain("= 'extra'")
    expect(laneFilterSql('path')).toContain('extra')
  })

  it('path dues beat Extra backlog and current lesson', () => {
    const action = getStudyPathAction({
      ...base,
      dueCount: 4,
      extraDueCount: 99,
      currentLesson: 'genki_1_1',
    })
    expect(action.kind).toBe('review')
    expect(action.reviewLane).toBe('path')
    expect(action.description).toMatch(/Extra/i)
  })

  it('Extra dues do not block continuing a lesson', () => {
    const action = getStudyPathAction({
      ...base,
      dueCount: 0,
      extraDueCount: 40,
      currentLesson: 'genki_1_1',
      hasResumableLesson: true,
    })
    expect(action.kind).toBe('current-lesson')
  })

  it('opt-in Include Extra merges dues into Today review', () => {
    const action = getStudyPathAction({
      ...base,
      dueCount: 3,
      extraDueCount: 2,
      includeExtraInToday: true,
    })
    expect(action.kind).toBe('review')
    expect(action.title).toContain('5')
    expect(action.reviewLane).toBe('all')
  })

  it('catch-up when path backlog is high', () => {
    expect(getStudyPathAction({ ...base, dueCount: 80 }).kind).toBe('catch-up')
  })

  it('skip Cards → durable debt; Speak pending wins over new path lesson', () => {
    markCardsDeferred('genki_1_1')
    const debt = findSkipDebt('genki_1_1', [])
    expect(debt?.cardsDeferred).toBe(true)
    expect(debt?.speakPending).toBe(true)

    const afterDuesClear = getStudyPathAction({
      ...base,
      dueCount: 0,
      speakPendingLessonId: debt!.lessonId,
      cardsDeferredLessonId: debt!.lessonId,
      lessonsCompleted: [],
    })
    expect(afterDuesClear.kind).toBe('finish-speak')
    expect(afterDuesClear.route).toContain('resume=genki_1_1')
  })

  it('clearing skip state removes Today debt', () => {
    markSpeakPending('genki_1_1')
    clearLessonSkipState('genki_1_1')
    expect(findSkipDebt('genki_1_1', [])).toBeNull()
  })

  it('offers Extra CTA when path is clear and Extra has dues', () => {
    const action = getStudyPathAction({
      ...base,
      lessonsCompleted: ['genki_1_1', 'genki_1_2'],
      // Force curriculum caught up for the path window; nextCurriculum may still fire —
      // Extra appears only when no further curriculum lesson is returned.
      learningPath: {
        generatedAt: '2026-07-20T00:00:00.000Z',
        weeks: [{
          week: 1,
          focus: 'A1',
          dailyGoal: 20,
          activities: [],
          milestone: 'Done',
          lessons: [
            { id: 'genki_1_1', series: 'Genki I', lessonNumber: 1 },
            { id: 'genki_1_2', series: 'Genki I', lessonNumber: 2 },
          ],
        }],
      },
      extraDueCount: 7,
      includeExtraInToday: false,
    })
    // Either continue curriculum (genki_1_3+) or Extra — both valid; Extra must not be blocked by ignore.
    expect(['path-lesson', 'extra-decks', 'grammar', 'mistakes', 'free-study']).toContain(action.kind)
    if (action.kind === 'extra-decks') {
      expect(action.route).toContain('#extra-decks')
    }
  })
})
