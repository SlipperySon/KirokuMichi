import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useIntl } from 'react-intl'
import { useAppStore } from '../store'
import { SQLiteStorage } from '../db/sqlite'
import { FSRSScheduler, SM2Scheduler } from '../core/scheduler'
import { SRSService } from '../srs/srsService'
import { SessionRecovery } from '../srs/sessionRecovery'
import { Heatmap } from './Heatmap'
import { WeakPointPanel } from './WeakPointPanel'
import { Navigation } from '../components/Navigation'
import { DailyGoalRing } from '../components/DailyGoalRing'
import { EmptyState } from '../components/EmptyState'
import { SkeletonCard } from '../components/Skeleton'
import { toast } from '../components/toastStore'
import { calculateWeeklyGoal } from './weeklyGoals'
import { refreshStreakSnapshot } from './streakService'
import type { ReviewCard, GrammarQuestion, StreakData, SessionRecoveryPayload } from './types'

function interleaveQueue(due: ReviewCard[], newCards: ReviewCard[], limit: number): ReviewCard[] {
  const queue: ReviewCard[] = []
  let di = 0, ni = 0, pos = 0
  while (queue.length < limit && (di < due.length || ni < newCards.length)) {
    // Insert 1 new card every 5 positions
    if (ni < newCards.length && pos > 0 && pos % 5 === 0) {
      queue.push(newCards[ni++])
    } else if (di < due.length) {
      queue.push(due[di++])
    } else if (ni < newCards.length) {
      queue.push(newCards[ni++])
    }
    pos++
  }
  return queue
}

function lessonRouteFromId(lessonId: string) {
  const match = lessonId.match(/^(genki_[12]|quartet_[12])_(\d+)$/)
  if (!match) return '/learn/lessons'
  const [, series, lessonNumber] = match
  const cefr = series === 'genki_1'
    ? 'a1'
    : series === 'genki_2'
      ? 'a2'
      : series === 'quartet_1'
        ? 'b1'
        : 'b2'
  return `/learn/lessons/${cefr}/${lessonNumber}`
}

export function StudyDashboard() {
  const intl = useIntl()
  const navigate = useNavigate()
  const settings = useAppStore(s => s.settings)
  const updateSettings = useAppStore(s => s.updateSettings)
  const activeUserId = useAppStore(s => s.activeUserId)
  const setActiveUserId = useAppStore(s => s.setActiveUserId)
  const dailyStats = useAppStore(s => s.dailyStats)
  const setDailyStats = useAppStore(s => s.setDailyStats)

  const currentLesson = useAppStore(s => s.currentLesson)
  const lessonsCompleted = useAppStore(s => s.lessonsCompleted)

  const [storage] = useState(() => new SQLiteStorage())
  const scheduler = settings.schedulerAlgorithm === 'fsrs' ? new FSRSScheduler() : new SM2Scheduler()
  const [service] = useState(() => new SRSService(storage, scheduler))

  const [dueCount, setDueCount] = useState(0)
  const [newCount, setNewCount] = useState(0)
  const [availableNewCount, setAvailableNewCount] = useState(0)
  const [mistakeCount, setMistakeCount] = useState(0)
  const [weeklyReviewedCount, setWeeklyReviewedCount] = useState(0)
  const [streakData, setStreakData] = useState<StreakData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [recoveryPayload, setRecoveryPayload] = useState<SessionRecoveryPayload | null>(null)
  const [previewCards, setPreviewCards] = useState<ReviewCard[]>([])
  const userId = activeUserId

  const init = useCallback(async () => {
    // Ensure DB is ready and user row exists
    let uid = activeUserId
    if (!uid) {
      const rows = await storage.query<{ id: number }>('SELECT id FROM users LIMIT 1')
      if (rows[0]) {
        uid = rows[0].id
      } else {
        await storage.execute(`INSERT INTO users (jlpt_level, study_mode, hover_delay_ms, hiragana_complete, onboarding_complete) VALUES ('N5','standard',2000,0,1)`)
        const r = await storage.query<{ id: number }>('SELECT id FROM users ORDER BY id DESC LIMIT 1')
        uid = r[0].id
      }
      setActiveUserId(uid)
    }

    const [due, newC, streak, mistakes, weeklyRows, preview] = await Promise.all([
      service.getDueCount(uid),
      service.getNewCount(uid),
      service.getStreakData(uid),
      service.getRecentMistakeCount(uid, 7),
      storage.query<{ date: string; cardsReviewed: number }>(
        `SELECT
          date(started_at) AS date,
          SUM(cards_reviewed) AS cardsReviewed
         FROM sessions
         WHERE user_id = ?
           AND started_at >= date('now', 'weekday 1', '-7 days')
           AND ended_at IS NOT NULL
         GROUP BY date(started_at)`,
        [uid]
      ),
      service.getDueCards(uid, 3),
    ])
    setDueCount(due)
    setNewCount(newC)
    setPreviewCards(preview)
    // Cap new cards shown by daily limit minus due cards already scheduled
    const available = Math.max(0, settings.dailyCardLimit - due)
    setAvailableNewCount(Math.min(newC, available))
    setStreakData(streak)
    setMistakeCount(mistakes)

    // Refresh cached daily snapshot (used by Navigation badge) so it stays in
    // sync after a review session completes. Read settings via getState() to
    // avoid stale closure values without forcing settings into the useCallback
    // deps (which would re-run init on every settings keystroke).
    try {
      const latest = useAppStore.getState().settings
      const { snapshot, patch } = await refreshStreakSnapshot(service, uid, {
        streakFreezeTokens: latest.streakFreezeTokens,
        lastStreakAward: latest.lastStreakAward,
        lastFreezeUsedDate: latest.lastFreezeUsedDate,
      })
      setDailyStats(snapshot)
      if (Object.keys(patch).length > 0) updateSettings(patch)
    } catch {
      // Non-fatal
    }

    const reviewedThisWeek = weeklyRows.reduce((sum, row) => sum + (row.cardsReviewed ?? 0), 0)
    setWeeklyReviewedCount(reviewedThisWeek)

    // Check for recovery
    const payload = SessionRecovery.load()
    if (payload && !SessionRecovery.isStale(payload)) {
      const openSession = await storage.query<{ id: number }>(
        `SELECT id FROM sessions WHERE id = ? AND ended_at IS NULL`, [payload.sessionId]
      )
      if (openSession.length > 0) {
        setRecoveryPayload(payload)
      } else {
        SessionRecovery.clear()
      }
    } else if (payload) {
      SessionRecovery.clear()
    }

    setIsLoading(false)
  }, [activeUserId, service, setActiveUserId, storage])

  useEffect(() => { void init() }, [init])

  async function startWordReview() {
    if (!userId) return
    const limit = settings.dailyCardLimit
    const [due, newCards] = await Promise.all([
      service.getDueCards(userId, limit),
      service.getNewCards(userId, Math.max(0, limit - (await service.getDueCount(userId)))),
    ])
    const queue = interleaveQueue(due, newCards, limit).filter(
      c => c.type === 'vocabulary' || c.type === 'kanji' || c.type === 'hiragana' || c.type === 'katakana'
    )
    if (queue.length === 0) {
      toast.info('No review cards are available right now.')
      return
    }
    const sessionId = await service.startSession(userId, 'vocab')
    toast.success(`Starting ${queue.length}-card review`)
    navigate('/study/review', { state: { queue, grammarEntries: [], sessionId, userId } })
  }

  async function resumeSession() {
    if (!recoveryPayload || !userId) return
    const queue = recoveryPayload.queue.slice(recoveryPayload.currentIndex)
    toast.info('Review session resumed')
    navigate('/study/review', {
      state: { queue, grammarEntries: [], sessionId: recoveryPayload.sessionId, userId },
    })
  }

  async function abandonSession() {
    if (!recoveryPayload) return
    await service.endSession(recoveryPayload.sessionId, recoveryPayload.stats)
    SessionRecovery.clear()
    setRecoveryPayload(null)
    toast.success('Previous review session saved and closed')
  }

  if (isLoading) {
    return (
      <div className="flex flex-col min-h-screen">
        <Navigation />
        <main className="flex flex-col gap-4 w-full max-w-2xl mx-auto flex-1 px-4 py-6 sm:p-6">
          <SkeletonCard />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SkeletonCard />
            <SkeletonCard />
          </div>
          <SkeletonCard className="min-h-40" />
        </main>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Navigation />
      <main className="flex flex-col gap-8 w-full px-4 py-6 sm:p-6 max-w-2xl mx-auto flex-1">
        <h1 className="text-2xl font-bold">{intl.formatMessage({ id: 'study.dashboard.title' })}</h1>

      {/* Recovery modal */}
      {recoveryPayload && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-labelledby="recovery-title">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 flex flex-col gap-4">
            <h2 id="recovery-title" className="text-lg font-bold">{intl.formatMessage({ id: 'study.dashboard.resume_title' })}</h2>
            <p className="text-sm text-gray-600">{intl.formatMessage({ id: 'study.dashboard.resume_body' })}</p>
            <div className="flex flex-col sm:flex-row gap-3">
              <button onClick={resumeSession} className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700">
                {intl.formatMessage({ id: 'study.dashboard.resume' })}
              </button>
              <button onClick={abandonSession} className="flex-1 px-4 py-2 border-2 border-gray-200 rounded-xl font-medium hover:bg-gray-50">
                {intl.formatMessage({ id: 'study.dashboard.abandon' })}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Daily goal + streak banner */}
      <div className="bg-white border-2 border-indigo-100 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <DailyGoalRing
          reviewed={dailyStats.todayReviewed}
          goal={settings.dailyGoal}
          size={64}
        />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900">
            {dailyStats.todayReviewed} / {settings.dailyGoal} today
          </p>
          <p className="text-sm text-gray-600 mt-0.5">
            <span className="text-orange-600 font-semibold">🔥 {dailyStats.currentStreak}</span>
            <span className="text-gray-400"> day streak</span>
            {settings.streakFreezeTokens > 0 && (
              <span className="ml-2 text-blue-600 font-semibold">
                ❄️ {settings.streakFreezeTokens} freeze{settings.streakFreezeTokens === 1 ? '' : 's'}
              </span>
            )}
          </p>
          {dailyStats.currentStreak > 0 && dailyStats.currentStreak < dailyStats.longestStreak && (
            <p className="text-xs text-gray-400 mt-0.5">Best: {dailyStats.longestStreak} days</p>
          )}
        </div>
      </div>

      {/* Smart CTA */}
      {(() => {
        if (currentLesson && !lessonsCompleted.includes(currentLesson)) {
          const label = currentLesson.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
          return (
            <button
              onClick={() => navigate(lessonRouteFromId(currentLesson))}
              className="w-full flex items-center gap-3 px-5 py-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl font-semibold hover:from-purple-700 hover:to-indigo-700 transition-all shadow-md"
            >
              <span className="text-2xl">📖</span>
              <div className="text-left">
                <span className="block text-base">Continue Learning</span>
                <span className="block text-xs opacity-80 mt-0.5">{label}</span>
              </div>
            </button>
          )
        }
        if (dueCount > 0) {
          return (
            <button
              onClick={startWordReview}
              className="w-full flex items-center gap-3 px-5 py-4 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-xl font-semibold hover:from-indigo-700 hover:to-blue-700 transition-all shadow-md"
            >
              <span className="text-2xl">🧠</span>
              <div className="text-left">
                <span className="block text-base">Review {dueCount} Due Card{dueCount === 1 ? '' : 's'}</span>
                <span className="block text-xs opacity-80 mt-0.5">Keep your streak alive</span>
              </div>
            </button>
          )
        }
        return (
          <button
            onClick={() => navigate('/learn')}
            className="w-full flex items-center gap-3 px-5 py-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-semibold hover:from-green-700 hover:to-emerald-700 transition-all shadow-md"
          >
            <span className="text-2xl">🎯</span>
            <div className="text-left">
              <span className="block text-base">Start Next Lesson</span>
              <span className="block text-xs opacity-80 mt-0.5">All reviews complete — learn something new</span>
            </div>
          </button>
        )
      })()}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-indigo-50 rounded-xl p-4">
          <div className="text-3xl font-bold text-indigo-600">{dueCount}</div>
          <div className="text-sm text-gray-500 mt-1">{intl.formatMessage({ id: 'study.dashboard.due' }, { count: dueCount })}</div>
        </div>
        <div className="bg-green-50 rounded-xl p-4">
          <div className="text-3xl font-bold text-green-600">{availableNewCount}</div>
          <div className="text-sm text-gray-500 mt-1">{intl.formatMessage({ id: 'study.dashboard.new' }, { count: availableNewCount })}</div>
          {newCount > availableNewCount && (
            <div className="text-xs text-gray-400 mt-2">+{newCount - availableNewCount} queued</div>
          )}
        </div>
      </div>

      {/* Heatmap */}
      {streakData && (
        <Heatmap data={streakData.days} currentStreak={streakData.currentStreak} />
      )}

      {/* Weekly goals */}
      {(() => {
        const weeklyGoal = calculateWeeklyGoal({
          goalDate: settings.goalDate,
          cardsNeeded: dueCount + newCount,
        })
        if (!weeklyGoal) return null
        const progressPct = weeklyGoal.cardsPerWeekNeeded <= 0
          ? 100
          : Math.min(100, Math.round((weeklyReviewedCount / weeklyGoal.cardsPerWeekNeeded) * 100))

        return (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-semibold text-amber-900">Weekly goal</p>
                <p className="text-sm text-amber-800 mt-1">
                  {weeklyReviewedCount} cards this week · {weeklyGoal.cardsPerWeekNeeded} needed for goal
                </p>
                <p className="text-xs text-amber-700 mt-1">
                  Target {settings.jlptTarget} in {weeklyGoal.weeksRemaining} week{weeklyGoal.weeksRemaining === 1 ? '' : 's'}
                  {weeklyGoal.isPastDue ? ' (goal date passed)' : ''}
                </p>
              </div>
              <div className="text-right">
                <div className="text-xl font-bold text-amber-900">{progressPct}%</div>
              </div>
            </div>
            <div className="mt-3 h-2 bg-amber-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-500 transition-all"
                style={{ width: `${progressPct}%` }}
                role="progressbar"
                aria-valuenow={progressPct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Weekly goal progress"
              />
            </div>
          </div>
        )
      })()}

      {/* Weak-point analysis */}
      <WeakPointPanel />

      {/* Daily limit adjustment */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-gray-900">Daily card limit</p>
            <p className="text-xs text-gray-500 mt-0.5">Adjust your pace (current: {settings.dailyCardLimit})</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => updateSettings({ dailyCardLimit: Math.max(0, settings.dailyCardLimit - 5) })}
              className="px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Decrease daily limit"
            >
              −
            </button>
            <input
              type="number"
              min={0}
              max={100}
              value={settings.dailyCardLimit}
              onChange={e => updateSettings({ dailyCardLimit: Number(e.target.value) })}
              className="w-16 px-3 py-2 border border-gray-300 rounded-lg text-center text-sm"
              aria-label="Daily card limit"
            />
            <button
              onClick={() => updateSettings({ dailyCardLimit: Math.min(100, settings.dailyCardLimit + 5) })}
              className="px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Increase daily limit"
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* Review button */}
      <button
        onClick={startWordReview}
        disabled={dueCount + newCount === 0}
        className="w-full flex flex-col items-center px-4 py-5 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <span className="text-lg">Review Cards</span>
        <span className="text-xs mt-1 opacity-80">{dueCount} due · {availableNewCount} new</span>
      </button>

      {/* Preview due cards */}
      {previewCards.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {previewCards.map(card => (
            <button
              key={card.cardStateId}
              onClick={startWordReview}
              className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-2 text-center hover:border-indigo-300 hover:bg-indigo-50 transition-colors"
            >
              <p className="text-sm font-semibold text-gray-900 truncate" lang="ja">{card.front}</p>
              {card.reading && <p className="text-xs text-gray-500 truncate">{card.reading}</p>}
            </button>
          ))}
        </div>
      ) : dueCount === 0 && availableNewCount === 0 && mistakeCount === 0 ? (
        <EmptyState
          compact
          icon="✓"
          title="Nothing due right now"
          description="You are caught up. Start a lesson, browse scenarios, or practice a conversation."
          action={
            <button
              onClick={() => navigate('/learn')}
              className="px-4 py-2 text-sm font-semibold text-indigo-800 bg-indigo-50 rounded-lg hover:bg-indigo-100"
            >
              Open Learn
            </button>
          }
        />
      ) : null}

      {/* Mistake drill */}
      {mistakeCount > 0 && (
        <button
          onClick={() => navigate('/study/mistakes')}
          className="w-full flex flex-col items-center px-4 py-3 bg-white border-2 border-amber-300 text-amber-900 rounded-xl font-semibold hover:bg-amber-50 transition-colors"
        >
          <span className="text-base">Drill {mistakeCount} recent mistake{mistakeCount === 1 ? '' : 's'}</span>
          <span className="text-xs mt-1 text-amber-700">Last 7 days · cards you rated Again</span>
        </button>
      )}

    </main>
    </div>
  )
}
