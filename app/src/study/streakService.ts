/**
 * Streak Service
 *
 * Wraps `SRSService.getStreakData` with two extra concerns:
 *   1. Applies the freeze-token policy (auto-consume on a single-day gap,
 *      auto-award when crossing 7/14/30/60-day thresholds).
 *   2. Returns a small `DailyStats` snapshot suitable for nav badges
 *      (current streak + today's reviewed count).
 *
 * The freeze policy mutates `settings.streakFreezeTokens`,
 * `settings.lastStreakAward`, and `settings.lastFreezeUsedDate` via the
 * Zustand store action passed in. Keeping the logic out of components means
 * it can be invoked from App's mount effect and after each session ends.
 */

import type { SRSService } from '../srs/srsService'
import type { StreakData } from './types'

interface FreezeSettings {
  streakFreezeTokens: number
  lastStreakAward: number
  lastFreezeUsedDate: string | null
}

const FREEZE_AWARD_THRESHOLDS = [7, 14, 30, 60, 100, 180, 365]

export interface StreakSnapshot {
  currentStreak: number
  longestStreak: number
  todayReviewed: number
}

/**
 * Pure helper — given the raw StreakData and the current freeze settings,
 * returns the updated streak length and the settings patch (if any).
 *
 * Rules:
 *  - If today has reviews, no token usage.
 *  - If today has NO reviews but YESTERDAY had reviews → streak is intact (we
 *    only break streaks when there's a full-day gap with no reviews).
 *  - If today AND yesterday both have NO reviews but the user has a freeze
 *    token AND we haven't already used a token today → consume one, "extend"
 *    yesterday's run forward, so the user still has a chance to study today.
 *  - When the live streak crosses a new threshold (7, 14, 30…) AND that
 *    threshold is above `lastStreakAward`, award one token.
 */
export function applyFreezePolicy(
  streak: StreakData,
  freeze: FreezeSettings,
  todayIso: string
): { effectiveStreak: number; patch: Partial<FreezeSettings> } {
  const patch: Partial<FreezeSettings> = {}
  let effectiveStreak = streak.currentStreak

  const days = streak.days
  const today = days[days.length - 1]
  const yesterday = days[days.length - 2]

  // Freeze consumption: today empty AND yesterday empty AND we have a token
  // AND we haven't already burned a freeze today.
  const todayEmpty = !today || today.cardsReviewed === 0
  const yesterdayEmpty = !yesterday || yesterday.cardsReviewed === 0
  const alreadyUsedToday = freeze.lastFreezeUsedDate === todayIso

  if (
    todayEmpty &&
    yesterdayEmpty &&
    freeze.streakFreezeTokens > 0 &&
    !alreadyUsedToday &&
    streak.currentStreak === 0 // getStreakData already broke the streak
  ) {
    // Look further back — was the day-before-yesterday active? If so we can
    // rescue a 1-day gap.
    let priorRun = 0
    for (let i = days.length - 3; i >= 0; i--) {
      if (days[i].cardsReviewed > 0) priorRun++
      else break
    }
    if (priorRun > 0) {
      effectiveStreak = priorRun
      patch.streakFreezeTokens = freeze.streakFreezeTokens - 1
      patch.lastFreezeUsedDate = todayIso
    }
  }

  // Threshold awards (based on the effective streak)
  const nextAward = FREEZE_AWARD_THRESHOLDS.find(
    t => effectiveStreak >= t && t > freeze.lastStreakAward
  )
  if (nextAward) {
    patch.streakFreezeTokens = (patch.streakFreezeTokens ?? freeze.streakFreezeTokens) + 1
    patch.lastStreakAward = nextAward
  }

  return { effectiveStreak, patch }
}

/**
 * Wrapper that runs the freeze policy and returns the snapshot the UI cares
 * about. The caller is responsible for persisting `patch` via `updateSettings`.
 */
export async function refreshStreakSnapshot(
  service: SRSService,
  userId: number,
  freeze: FreezeSettings
): Promise<{ snapshot: StreakSnapshot; patch: Partial<FreezeSettings>; longestStreak: number }> {
  const streak = await service.getStreakData(userId)
  const todayIso = new Date().toISOString().split('T')[0]
  const { effectiveStreak, patch } = applyFreezePolicy(streak, freeze, todayIso)
  const today = streak.days[streak.days.length - 1]
  return {
    snapshot: {
      currentStreak: effectiveStreak,
      longestStreak: streak.longestStreak,
      todayReviewed: today?.cardsReviewed ?? 0,
    },
    longestStreak: streak.longestStreak,
    patch,
  }
}
