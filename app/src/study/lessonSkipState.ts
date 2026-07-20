/**
 * Durable skip/defer flags for a lesson when the full rail snapshot is absent
 * or the learner left mid-rail. Skip never means "done" — Today must reopen debt.
 */

export type LessonSkipKind = 'cards_deferred' | 'speak_pending'

export interface LessonSkipState {
  lessonId: string
  cardsDeferred: boolean
  speakPending: boolean
  updatedAt: string
}

const STORAGE_KEY = 'kiroku-lesson-skip-state'

function readAll(): Record<string, LessonSkipState> {
  if (typeof localStorage === 'undefined') return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, LessonSkipState>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeAll(map: Record<string, LessonSkipState>): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
  } catch {
    /* quota / private mode */
  }
}

export function getLessonSkipState(lessonId: string): LessonSkipState | null {
  if (!lessonId) return null
  return readAll()[lessonId] ?? null
}

export function markCardsDeferred(lessonId: string): void {
  if (!lessonId) return
  const all = readAll()
  const prev = all[lessonId]
  all[lessonId] = {
    lessonId,
    cardsDeferred: true,
    speakPending: prev?.speakPending ?? true,
    updatedAt: new Date().toISOString(),
  }
  writeAll(all)
}

export function markSpeakPending(lessonId: string): void {
  if (!lessonId) return
  const all = readAll()
  const prev = all[lessonId]
  all[lessonId] = {
    lessonId,
    cardsDeferred: prev?.cardsDeferred ?? false,
    speakPending: true,
    updatedAt: new Date().toISOString(),
  }
  writeAll(all)
}

export function clearLessonSkipState(lessonId: string): void {
  if (!lessonId) return
  const all = readAll()
  if (!(lessonId in all)) return
  delete all[lessonId]
  writeAll(all)
}

/** First incomplete lesson with skip debt (prefer currentLesson). */
export function findSkipDebt(
  currentLesson: string | null,
  lessonsCompleted: string[],
): LessonSkipState | null {
  const completed = new Set(lessonsCompleted)
  const all = readAll()
  if (currentLesson && !completed.has(currentLesson) && all[currentLesson]) {
    const s = all[currentLesson]
    if (s.cardsDeferred || s.speakPending) return s
  }
  for (const [id, s] of Object.entries(all)) {
    if (completed.has(id)) continue
    if (s.cardsDeferred || s.speakPending) return s
  }
  return null
}
