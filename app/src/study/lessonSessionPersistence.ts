import type { LessonStudyState } from './lessonStudyPlanner'

const STORAGE_PREFIX = 'kiroku-lesson-session:'

export interface LessonSessionSnapshot {
  version: 1
  lesson: LessonStudyState
  stepIndex: number
  teachIndex: number
  questionIndex: number
  answers: Array<{
    itemId: string
    prompt: string
    correctAnswer: string
    selectedAnswer: string
    isCorrect: boolean
  }>
  selfAssessments: Array<{
    itemId: string
    title: string
    body: string
    type: 'vocab' | 'grammar'
    rating: 'again' | 'good'
  }>
  workbookResponses: Record<string, { response: string; completed: boolean }>
  speakResponse: string
  speakCompleted: boolean
  cardsCompleted: boolean
  cardsDeferred: boolean
  updatedAt: string
}

export function lessonSessionKey(lessonId: string): string {
  return `${STORAGE_PREFIX}${lessonId}`
}

export function saveLessonSession(snapshot: LessonSessionSnapshot): void {
  if (typeof localStorage === 'undefined') return
  if (!snapshot.lesson.lessonId || snapshot.lesson.lessonId.endsWith('_drill')) return
  try {
    localStorage.setItem(
      lessonSessionKey(snapshot.lesson.lessonId),
      JSON.stringify({ ...snapshot, updatedAt: new Date().toISOString() }),
    )
  } catch {
    /* quota / private mode */
  }
}

export function loadLessonSession(lessonId: string): LessonSessionSnapshot | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(lessonSessionKey(lessonId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as LessonSessionSnapshot
    if (parsed.version !== 1 || parsed.lesson?.lessonId !== lessonId) return null
    return parsed
  } catch {
    return null
  }
}

export function clearLessonSession(lessonId: string): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.removeItem(lessonSessionKey(lessonId))
  } catch {
    /* ignore */
  }
}

export function hasResumableLessonSession(lessonId: string): boolean {
  const snap = loadLessonSession(lessonId)
  if (!snap) return false
  return !snap.speakCompleted
}

/** High-level rail phase for the 6-step progress UI. */
export type LessonRailPhase = 'intro' | 'teach' | 'check' | 'practice' | 'cards' | 'speak'

export function railPhaseFromStepKind(kind: string): LessonRailPhase {
  switch (kind) {
    case 'intro':
      return 'intro'
    case 'teach':
      return 'teach'
    case 'checkpoint':
    case 'final':
      return 'check'
    case 'workbook':
      return 'practice'
    case 'cards':
      return 'cards'
    case 'speak':
      return 'speak'
    default:
      return 'teach'
  }
}

export const LESSON_RAIL_PHASES: Array<{ id: LessonRailPhase; label: string }> = [
  { id: 'intro', label: 'Intro' },
  { id: 'teach', label: 'Teach' },
  { id: 'check', label: 'Check' },
  { id: 'practice', label: 'Practice' },
  { id: 'cards', label: 'Cards' },
  { id: 'speak', label: 'Speak' },
]
