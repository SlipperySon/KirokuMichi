import { validateJapaneseProduction } from './productionValidation'

const STORAGE_PREFIX = 'kiroku-scenario-practice:'

export function scenarioPracticeKey(lessonId: string): string {
  return `${STORAGE_PREFIX}${lessonId}`
}

export function markScenarioPracticeComplete(lessonId: string): void {
  if (typeof localStorage === 'undefined' || !lessonId) return
  try {
    localStorage.setItem(scenarioPracticeKey(lessonId), new Date().toISOString())
  } catch {
    /* quota / private mode */
  }
}

export function hasScenarioPractice(lessonId: string): boolean {
  if (typeof localStorage === 'undefined' || !lessonId) return false
  try {
    return Boolean(localStorage.getItem(scenarioPracticeKey(lessonId)))
  } catch {
    return false
  }
}

export function clearScenarioPractice(lessonId: string): void {
  if (typeof localStorage === 'undefined' || !lessonId) return
  try {
    localStorage.removeItem(scenarioPracticeKey(lessonId))
  } catch {
    /* ignore */
  }
}

/** Returns true when the learner sent valid pushed output in scenario chat. */
export function tryCompleteScenarioPractice(lessonId: string, message: string): boolean {
  const check = validateJapaneseProduction(message, { minChars: 8 })
  if (!check.ok) return false
  markScenarioPracticeComplete(lessonId)
  return true
}
