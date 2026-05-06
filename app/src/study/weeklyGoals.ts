export interface WeeklyGoalInput {
  goalDate: string | null
  cardsNeeded: number
  now?: Date
}

export interface WeeklyGoalMetrics {
  cardsNeeded: number
  weeksRemaining: number
  cardsPerWeekNeeded: number
  isPastDue: boolean
}

export function calculateWeeklyGoal(input: WeeklyGoalInput): WeeklyGoalMetrics | null {
  const { goalDate, cardsNeeded, now = new Date() } = input
  if (!goalDate) return null

  const parsedDate = new Date(goalDate)
  if (Number.isNaN(parsedDate.getTime())) return null

  // Use end-of-day so the selected target date itself counts.
  parsedDate.setHours(23, 59, 59, 999)
  const diffMs = parsedDate.getTime() - now.getTime()
  const msPerWeek = 7 * 24 * 60 * 60 * 1000
  const weeksRemaining = Math.max(1, Math.ceil(diffMs / msPerWeek))
  const safeCardsNeeded = Math.max(0, cardsNeeded)

  return {
    cardsNeeded: safeCardsNeeded,
    weeksRemaining,
    cardsPerWeekNeeded: Math.ceil(safeCardsNeeded / weeksRemaining),
    isPastDue: diffMs < 0,
  }
}
