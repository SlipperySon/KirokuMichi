import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearLessonSession,
  hasResumableLessonSession,
  loadLessonSession,
  saveLessonSession,
  type LessonSessionSnapshot,
} from './lessonSessionPersistence'

function sampleSnapshot(overrides: Partial<LessonSessionSnapshot> = {}): LessonSessionSnapshot {
  return {
    version: 1,
    lesson: {
      vocab: [{ id: 'v1', surface: '学生', english: 'student', lesson: 'genki_1_1', source: 'genki_1_textbook', page: 32 }],
      grammar: [],
      lessonId: 'genki_1_1',
      lessonTitle: 'Genki I - Lesson 1',
      cefrLevel: 'a1',
    },
    stepIndex: 2,
    teachIndex: 1,
    questionIndex: 0,
    answers: [],
    selfAssessments: [],
    workbookResponses: {},
    speakResponse: '',
    speakCompleted: false,
    cardsCompleted: false,
    cardsDeferred: false,
    updatedAt: '2026-07-17T00:00:00.000Z',
    ...overrides,
  }
}

describe('lessonSessionPersistence', () => {
  beforeEach(() => {
    clearLessonSession('genki_1_1')
  })

  it('saves and loads a mid-lesson snapshot', () => {
    saveLessonSession(sampleSnapshot())
    const loaded = loadLessonSession('genki_1_1')
    expect(loaded?.stepIndex).toBe(2)
    expect(loaded?.teachIndex).toBe(1)
    expect(loaded?.lesson.lessonTitle).toBe('Genki I - Lesson 1')
  })

  it('treats unfinished speak as resumable', () => {
    saveLessonSession(sampleSnapshot({ speakCompleted: false }))
    expect(hasResumableLessonSession('genki_1_1')).toBe(true)
  })

  it('is not resumable after speak is marked complete', () => {
    saveLessonSession(sampleSnapshot({ speakCompleted: true }))
    expect(hasResumableLessonSession('genki_1_1')).toBe(false)
  })

  it('clears snapshots', () => {
    saveLessonSession(sampleSnapshot())
    clearLessonSession('genki_1_1')
    expect(loadLessonSession('genki_1_1')).toBeNull()
  })
})
