import { describe, expect, it } from 'vitest'
import { getStudyPathAction, lessonRouteFromId, type StudyPathPlannerInput } from './studyPathPlanner'

const baseInput: StudyPathPlannerInput = {
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

describe('studyPathPlanner', () => {
  it('keeps reviews ahead of new lesson work', () => {
    const action = getStudyPathAction({
      ...baseInput,
      dueCount: 5,
      currentLesson: 'genki_1_2',
    })

    expect(action.kind).toBe('review')
    expect(action.route).toBe('/study/review')
    expect(action.reviewLane).toBe('path')
  })

  it('mentions grammar due on the review action without switching to grammar first', () => {
    const action = getStudyPathAction({
      ...baseInput,
      dueCount: 4,
      grammarDueCount: 2,
    })

    expect(action.kind).toBe('review')
    expect(action.description).toContain('2 grammar')
  })

  it('does not let Extra dues block the path by default', () => {
    const action = getStudyPathAction({
      ...baseInput,
      dueCount: 0,
      extraDueCount: 40,
      currentLesson: 'genki_1_2',
    })
    expect(action.kind).toBe('current-lesson')
  })

  it('includes Extra in Today when opted in', () => {
    const action = getStudyPathAction({
      ...baseInput,
      dueCount: 2,
      extraDueCount: 5,
      includeExtraInToday: true,
    })
    expect(action.kind).toBe('review')
    expect(action.title).toContain('7')
    expect(action.reviewLane).toBe('all')
  })

  it('escalates to catch-up when backlog is high', () => {
    const action = getStudyPathAction({
      ...baseInput,
      dueCount: 90,
      currentLesson: 'genki_1_2',
    })
    expect(action.kind).toBe('catch-up')
  })

  it('prioritizes finish-speak over starting a new path lesson', () => {
    const action = getStudyPathAction({
      ...baseInput,
      speakPendingLessonId: 'genki_1_1',
      learningPath: {
        generatedAt: '2026-06-24T00:00:00.000Z',
        weeks: [{
          week: 1,
          focus: 'A1',
          dailyGoal: 20,
          activities: [],
          milestone: 'Lesson 2',
          lessons: [
            { id: 'genki_1_1', series: 'Genki I', lessonNumber: 1 },
            { id: 'genki_1_2', series: 'Genki I', lessonNumber: 2 },
          ],
        }],
      },
    })
    expect(action.kind).toBe('finish-speak')
    expect(action.lessonId).toBe('genki_1_1')
  })

  it('offers Extra decks after path is clear', () => {
    const action = getStudyPathAction({
      ...baseInput,
      learningPath: {
        generatedAt: '2026-06-24T00:00:00.000Z',
        weeks: [{
          week: 1,
          focus: 'A1',
          dailyGoal: 20,
          activities: [],
          milestone: 'Done',
          lessons: [{ id: 'genki_1_1', series: 'Genki I', lessonNumber: 1 }],
        }],
      },
      lessonsCompleted: Array.from({ length: 23 }, (_, i) =>
        i < 12 ? `genki_1_${i + 1}` : `genki_2_${i - 11}`,
      ),
      extraDueCount: 12,
    })
    // May be path-lesson (curriculum continues) or extra — if curriculum exhausted, extra
    expect(['extra-decks', 'path-lesson', 'grammar', 'mistakes', 'free-study']).toContain(action.kind)
  })

  it('continues an active incomplete lesson before starting path lessons', () => {
    const action = getStudyPathAction({
      ...baseInput,
      currentLesson: 'genki_1_2',
      learningPath: {
        generatedAt: '2026-06-24T00:00:00.000Z',
        weeks: [{
          week: 1,
          focus: 'A1',
          dailyGoal: 20,
          activities: [],
          milestone: 'Lesson 3',
          lessons: [{ id: 'genki_1_3', series: 'Genki I', lessonNumber: 3 }],
        }],
      },
    })

    expect(action.kind).toBe('current-lesson')
    expect(action.route).toBe('/learn/lessons/a1/2?autostart=1')
  })

  it('starts the next incomplete learning-path lesson', () => {
    const action = getStudyPathAction({
      ...baseInput,
      lessonsCompleted: ['genki_1_1'],
      learningPath: {
        generatedAt: '2026-06-24T00:00:00.000Z',
        weeks: [{
          week: 1,
          focus: 'A1',
          dailyGoal: 20,
          activities: [],
          milestone: 'Lesson 2',
          lessons: [
            { id: 'genki_1_1', series: 'Genki I', lessonNumber: 1 },
            { id: 'genki_1_2', series: 'Genki I', lessonNumber: 2 },
          ],
        }],
      },
    })
    expect(action.kind).toBe('path-lesson')
    expect(action.lessonId).toBe('genki_1_2')
    expect(action.route).toBe('/learn/lessons/a1/2?autostart=1')
  })

  it('continues textbook curriculum when the path window is caught up', () => {
    const action = getStudyPathAction({
      ...baseInput,
      lessonsCompleted: ['genki_1_1', 'genki_1_2', 'genki_1_3', 'genki_1_4'],
      learningPath: {
        generatedAt: '2026-06-24T00:00:00.000Z',
        weeks: [{
          week: 1,
          focus: 'A1',
          dailyGoal: 20,
          activities: [],
          milestone: 'Done',
          lessons: [
            { id: 'genki_1_1', series: 'Genki I', lessonNumber: 1 },
            { id: 'genki_1_2', series: 'Genki I', lessonNumber: 2 },
            { id: 'genki_1_3', series: 'Genki I', lessonNumber: 3 },
            { id: 'genki_1_4', series: 'Genki I', lessonNumber: 4 },
          ],
        }],
      },
    })

    expect(action.kind).toBe('path-lesson')
    expect(action.lessonId).toBe('genki_1_5')
    expect(action.route).toBe('/learn/lessons/a1/5?autostart=1')
    expect(action.meta).toBe('Curriculum')
  })

  it('falls back to grammar then mistakes, then path setup', () => {
    expect(getStudyPathAction({ ...baseInput, grammarDueCount: 2 }).kind).toBe('grammar')
    expect(getStudyPathAction({ ...baseInput, mistakeCount: 1 }).kind).toBe('mistakes')
    expect(getStudyPathAction(baseInput).kind).toBe('generate-path')
  })

  it('resumes mid-lesson rail when a session snapshot exists', () => {
    const action = getStudyPathAction({
      ...baseInput,
      currentLesson: 'genki_1_2',
      hasResumableLesson: true,
    })

    expect(action.kind).toBe('current-lesson')
    expect(action.route).toBe('/learn/study?resume=genki_1_2')
    expect(action.actionLabel).toBe('Resume Lesson')
  })

  it('maps textbook lesson ids to learner routes', () => {
    expect(lessonRouteFromId('genki_1_4')).toBe('/learn/lessons/a1/4')
    expect(lessonRouteFromId('genki_1_4', { autostart: true })).toBe('/learn/lessons/a1/4?autostart=1')
    expect(lessonRouteFromId('genki_1_4', { resume: true })).toBe('/learn/study?resume=genki_1_4')
    expect(lessonRouteFromId('genki_2_4')).toBe('/learn/lessons/a2/4')
    expect(lessonRouteFromId('quartet_1_4')).toBe('/learn/lessons/b1/4')
    expect(lessonRouteFromId('quartet_2_4')).toBe('/learn/lessons/b2/4')
  })
})
