import type { LessonStep } from './lessonStudyPlanner'

const FIRST_SESSION_TEACH_CHUNKS = 1

/**
 * Day-1 budget: Intro + first teach chunk + its checkpoint + Cards + Speak.
 * Defers remaining teach sets, final mixed review, and workbook to "continue lesson".
 */
export function applyFirstSessionBudget(steps: LessonStep[], enabled: boolean): LessonStep[] {
  if (!enabled) return steps

  let teachSeen = 0
  const core: LessonStep[] = []

  for (const step of steps) {
    if (step.kind === 'teach') {
      teachSeen += 1
      if (teachSeen > FIRST_SESSION_TEACH_CHUNKS) continue
    }
    if (step.kind === 'final') continue
    if (step.kind === 'workbook') continue
    core.push(step)
  }

  const cards = steps.find(s => s.kind === 'cards')
  const speak = steps.find(s => s.kind === 'speak')
  if (cards && !core.some(s => s.kind === 'cards')) core.push(cards)
  if (speak && !core.some(s => s.kind === 'speak')) core.push(speak)

  return core.length > 0 ? core : steps
}

export function isFirstSessionCandidate(lessonsCompleted: string[], lessonId: string): boolean {
  if (lessonsCompleted.length > 0) return false
  return lessonId.endsWith('_1') || lessonId.match(/_1$/) !== null
}
