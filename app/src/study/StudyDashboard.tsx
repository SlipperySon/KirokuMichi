import { useState, useEffect, useCallback, type ComponentType, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useIntl } from 'react-intl'
import {
  Brain,
  GraduationCap,
  MessageCircle,
  Sparkles,
} from 'lucide-react'
import { useAppStore } from '../store'
import { SQLiteStorage } from '../db/sqlite'
import { FSRSScheduler, SM2Scheduler } from '../core/scheduler'
import { SRSService } from '../srs/srsService'
import { SessionRecovery } from '../srs/sessionRecovery'
import { Heatmap } from './Heatmap'
import { WeakPointPanel } from './WeakPointPanel'
import { Navigation } from '../components/Navigation'
import { DeckTree } from '../components/DeckTree'
import { FilteredDeckPanel } from '../components/FilteredDeckPanel'
import { DailyGoalRing } from '../components/DailyGoalRing'
import { EmptyState } from '../components/EmptyState'
import { SkeletonCard } from '../components/Skeleton'
import { toast } from '../components/toastStore'
import { calculateWeeklyGoal } from './weeklyGoals'
import { refreshStreakSnapshot } from './streakService'
import { getStudyPathAction } from './studyPathPlanner'
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

interface HomeAction {
  title: string
  description: string
  path?: string
  onClick?: () => void
  icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
  tone: 'indigo' | 'emerald' | 'amber' | 'slate'
  meta?: string
  disabled?: boolean
}

const ACTION_TONES: Record<HomeAction['tone'], { icon: string; border: string; hover: string; meta: string }> = {
  indigo: { icon: 'bg-indigo-50 text-indigo-700', border: 'border-indigo-100', hover: 'hover:border-indigo-300 hover:bg-indigo-50/60', meta: 'text-indigo-700' },
  emerald: { icon: 'bg-emerald-50 text-emerald-700', border: 'border-emerald-100', hover: 'hover:border-emerald-300 hover:bg-emerald-50/60', meta: 'text-emerald-700' },
  amber: { icon: 'bg-amber-50 text-amber-700', border: 'border-amber-100', hover: 'hover:border-amber-300 hover:bg-amber-50/60', meta: 'text-amber-700' },
  slate: { icon: 'bg-slate-100 text-slate-700', border: 'border-gray-200', hover: 'hover:border-gray-300 hover:bg-gray-50', meta: 'text-slate-600' },
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
  const learningPath = useAppStore(s => s.learningPath)

  const [storage] = useState(() => new SQLiteStorage())
  const scheduler = settings.schedulerAlgorithm === 'fsrs' ? new FSRSScheduler() : new SM2Scheduler()
  const [service] = useState(() => new SRSService(storage, scheduler))

  const activeDeckId = useAppStore(s => s.activeDeckId)

  const [dueCount, setDueCount] = useState(0)
  const [newCount, setNewCount] = useState(0)
  const [availableNewCount, setAvailableNewCount] = useState(0)
  const [grammarDueCount, setGrammarDueCount] = useState(0)
  const [mistakeCount, setMistakeCount] = useState(0)
  const [weeklyReviewedCount, setWeeklyReviewedCount] = useState(0)
  const [streakData, setStreakData] = useState<StreakData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [recoveryPayload, setRecoveryPayload] = useState<SessionRecoveryPayload | null>(null)
  const [previewCards, setPreviewCards] = useState<ReviewCard[]>([])
  const [decks, setDecks] = useState<{ id: number; name: string; parentId: number | null; cardCount: number }[]>([])
  const userId = activeUserId

  const init = useCallback(async () => {
    setLoadError(null)
    setIsLoading(true)
    try {
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

      // Ensure Default deck exists
      await service.ensureDefaultDeck(uid)

      const [due, newC, grammarDue, streak, mistakes, weeklyRows, preview, deckRows] = await Promise.all([
        service.getDueCount(uid),
        service.getNewCount(uid),
        service.getGrammarDueCount(uid),
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
        service.getDecks(uid),
      ])
      setDueCount(due)
      setNewCount(newC)
      setGrammarDueCount(grammarDue)
      setPreviewCards(preview)
      setDecks(deckRows)
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
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not load the study dashboard'
      setLoadError(message)
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }, [activeUserId, service, setActiveUserId, storage])

  useEffect(() => { void init() }, [init])

  async function startCramSession(cardStateIds: number[], deckName: string) {
    if (!userId) return
    const cards = await service.getCardsByStateIds(userId, cardStateIds)
    if (cards.length === 0) {
      toast.info('No cards in this filtered deck')
      return
    }
    const sessionId = await service.startSession(userId, 'cram')
    navigate('/study/review', {
      state: {
        queue: cards,
        grammarEntries: [],
        sessionId,
        userId,
        cramMode: true,
        cramDeckName: deckName,
      },
    })
  }

  async function startCramAll() {
    if (!userId) return
    const limit = settings.dailyCardLimit
    const cards = await service.getDueCards(userId, limit, activeDeckId)
    if (cards.length === 0) {
      toast.info('No due cards to cram')
      return
    }
    const sessionId = await service.startSession(userId, 'cram')
    const deckName = decks.find(d => d.id === activeDeckId)?.name ?? 'All decks'
    navigate('/study/review', {
      state: {
        queue: cards,
        grammarEntries: [],
        sessionId,
        userId,
        cramMode: true,
        cramDeckName: deckName,
      },
    })
  }

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

  function go(path: string) {
    navigate(path)
  }

  const pathAction = getStudyPathAction({
    learningPath,
    currentLesson,
    lessonsCompleted,
    dueCount,
    availableNewCount,
    grammarDueCount,
    mistakeCount,
    reviewedToday: dailyStats.todayReviewed,
    dailyGoal: settings.dailyGoal,
    hasRecovery: Boolean(recoveryPayload),
  })

  function runPathAction() {
    if (pathAction.kind === 'recovery') {
      void resumeSession()
      return
    }
    if (pathAction.kind === 'review') {
      void startWordReview()
      return
    }
    if (pathAction.route) {
      navigate(pathAction.route)
    }
  }

  const learningActions: HomeAction[] = [
    { title: 'Course', description: 'Textbook curriculum and lesson study.', path: '/learn', icon: GraduationCap, tone: 'indigo' },
    { title: 'Learning Path', description: 'Generate a CEFR-gated weekly plan.', path: '/study/path', icon: Sparkles, tone: 'emerald' },
  ]

  const practiceActions: HomeAction[] = [
    { title: 'Scenarios', description: 'Roleplay textbook and workbook situations.', path: '/scenarios', icon: MessageCircle, tone: 'indigo' },
    { title: 'Review hub', description: 'Anki-style words + grammar SRS.', path: '/study/srs', icon: Brain, tone: 'slate' },
  ]

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

  if (loadError) {
    return (
      <div className="flex flex-col min-h-screen">
        <Navigation />
        <main className="flex w-full max-w-2xl mx-auto flex-1 flex-col gap-4 px-4 py-6 sm:p-6">
          <EmptyState
            icon={<Brain className="mx-auto h-10 w-10 text-indigo-500" />}
            title="Study dashboard could not load"
            description={loadError}
            action={
              <button
                type="button"
                onClick={() => void init()}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
              >
                Try again
              </button>
            }
          />
        </main>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Navigation />
      <main className="flex w-full flex-1 flex-col gap-6 px-4 py-6 sm:p-6 max-w-6xl mx-auto">

        {/* Page header */}
        <div className="flex flex-col gap-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600">Today</p>
          <h1 className="text-2xl font-bold text-gray-950">KirokuMichi</h1>
        </div>

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

        {/* ── Two-column layout ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 items-start">

          {/* LEFT — act-now zone */}
          <div className="flex flex-col gap-4">

            {/* Goal ring + streak */}
            <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-4">
              <DailyGoalRing reviewed={dailyStats.todayReviewed} goal={settings.dailyGoal} size={56} />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 tabular-nums">
                  {dailyStats.todayReviewed} / {settings.dailyGoal} cards today
                </p>
                <p className="text-sm text-gray-500 mt-0.5">
                  <span className="text-orange-600 font-medium">🔥 {dailyStats.currentStreak} day streak</span>
                  {settings.streakFreezeTokens > 0 && (
                    <span className="ml-2 text-blue-600">❄️ {settings.streakFreezeTokens}</span>
                  )}
                </p>
                {dailyStats.currentStreak > 0 && dailyStats.currentStreak < dailyStats.longestStreak && (
                  <p className="text-xs text-gray-400 mt-0.5">Best: {dailyStats.longestStreak} days</p>
                )}
              </div>
            </div>

            {/* Learning path-guided next step */}
            <section className="bg-white border border-indigo-100 rounded-xl p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700">
                  <Sparkles className="h-5 w-5" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600">Today's Path</p>
                    {pathAction.meta && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                        {pathAction.meta}
                      </span>
                    )}
                  </div>
                  <h2 className="mt-1 text-lg font-bold text-gray-950">{pathAction.title}</h2>
                  <p className="mt-1 text-sm text-gray-600">{pathAction.description}</p>
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <button
                      type="button"
                      onClick={runPathAction}
                      className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
                    >
                      {pathAction.actionLabel}
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate('/study/path')}
                      className="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      View Plan
                    </button>
                  </div>
                </div>
              </div>
            </section>

            {/* Review / Cram / Grammar */}
            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                onClick={startWordReview}
                disabled={dueCount + newCount === 0}
                className="flex-1 flex flex-col items-center px-4 py-4 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span>Review Cards</span>
                <span className="text-xs mt-1 opacity-80">{dueCount} due · {availableNewCount} new</span>
              </button>
              {grammarDueCount > 0 && (
                <button
                  type="button"
                  onClick={() => navigate('/study/grammar')}
                  className="flex flex-col items-center rounded-xl border-2 border-violet-200 bg-violet-50 px-4 py-4 font-semibold text-violet-900 hover:bg-violet-100 sm:min-w-[8rem]"
                >
                  <span className="text-sm">Grammar</span>
                  <span className="mt-1 text-xs opacity-80">{grammarDueCount} due</span>
                </button>
              )}
              <button
                onClick={startCramAll}
                disabled={dueCount === 0}
                className="flex-shrink-0 flex flex-col items-center px-4 py-4 bg-amber-500 text-white rounded-xl font-semibold hover:bg-amber-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                title="Review without affecting SRS scheduling"
              >
                <span className="text-sm">Cram</span>
                <span className="text-xs mt-1 opacity-80">No schedule</span>
              </button>
            </div>

            {/* Preview due cards */}
            {previewCards.length > 0 ? (
              <div className="grid grid-cols-3 gap-2">
                {previewCards.map(card => (
                  <button
                    key={card.cardStateId}
                    onClick={startWordReview}
                    className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-center hover:border-indigo-300 hover:bg-indigo-50 transition-colors"
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
                    Open Course
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
                <span>Drill {mistakeCount} recent mistake{mistakeCount === 1 ? '' : 's'}</span>
                <span className="text-xs mt-1 text-amber-700">Last 7 days · cards you rated Again</span>
              </button>
            )}

            {/* Weak-point analysis */}
            <WeakPointPanel />

            {/* Compact secondary nav — tools live under Review / Library */}
            <div className="grid gap-4 sm:grid-cols-2">
              <HomeSection title="Course" description="Curriculum and weekly plan." compact>
                {learningActions.map(action => (
                  <HomeActionButton key={action.title} action={action} onNavigate={go} />
                ))}
              </HomeSection>
              <HomeSection title="More" description="Speak and Anki review hub." compact>
                {practiceActions.map(action => (
                  <HomeActionButton key={action.title} action={action} onNavigate={go} />
                ))}
              </HomeSection>
            </div>
            <button
              type="button"
              onClick={() => navigate('/study/srs')}
              className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-left text-sm font-semibold text-gray-800 hover:bg-gray-50"
            >
              Open Review hub (browser, templates, stats) →
            </button>
          </div>

          {/* RIGHT — overview zone */}
          <div className="flex flex-col gap-4">

            {/* Due / New stat tiles */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-indigo-50 rounded-xl p-4">
                <div className="text-3xl font-bold text-indigo-600 tabular-nums">{dueCount}</div>
                <div className="text-sm text-gray-500 mt-1">{intl.formatMessage({ id: 'study.dashboard.due' }, { count: dueCount })}</div>
              </div>
              <div className="bg-green-50 rounded-xl p-4">
                <div className="text-3xl font-bold text-green-600 tabular-nums">{availableNewCount}</div>
                <div className="text-sm text-gray-500 mt-1">{intl.formatMessage({ id: 'study.dashboard.new' }, { count: availableNewCount })}</div>
                {newCount > availableNewCount && (
                  <div className="text-xs text-gray-400 mt-1">+{newCount - availableNewCount} queued</div>
                )}
              </div>
            </div>

            {/* Heatmap */}
            {streakData && (
              <div className="bg-white border border-gray-200 rounded-xl p-4 overflow-hidden">
                <Heatmap data={streakData.days} currentStreak={streakData.currentStreak} />
              </div>
            )}

            {/* Weekly goal */}
            {(() => {
              const weeklyGoal = calculateWeeklyGoal({ goalDate: settings.goalDate, cardsNeeded: dueCount + newCount })
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
                        {weeklyReviewedCount} / {weeklyGoal.cardsPerWeekNeeded} cards this week
                      </p>
                      <p className="text-xs text-amber-700 mt-1">
                        {settings.jlptTarget} · {weeklyGoal.weeksRemaining}w remaining
                        {weeklyGoal.isPastDue ? ' (past due)' : ''}
                      </p>
                    </div>
                    <div className="text-xl font-bold text-amber-900 tabular-nums">{progressPct}%</div>
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

            {/* Deck tree + filtered decks */}
            {decks.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col gap-4">
                <DeckTree
                  decks={decks}
                  service={service}
                  userId={userId ?? 1}
                  onDecksChanged={() => void init()}
                />
                <hr className="border-gray-100" />
                <FilteredDeckPanel
                  service={service}
                  userId={userId ?? 1}
                  onStartCram={(cardStateIds, deckName) => void startCramSession(cardStateIds, deckName)}
                />
              </div>
            )}

            {/* Daily limit */}
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-900">Daily limit</p>
                  <p className="text-xs text-gray-500 mt-0.5">{settings.dailyCardLimit} cards/day</p>
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

          </div>{/* end right column */}
        </div>{/* end two-column grid */}

      </main>
    </div>
  )
}

function HomeSection({ title, description, children, compact }: { title: string; description: string; children: ReactNode; compact?: boolean }) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 min-w-0">
      <div className="mb-4">
        <h2 className="text-base font-bold text-gray-950">{title}</h2>
        <p className="mt-1 text-sm text-gray-600">{description}</p>
      </div>
      <div className={`grid gap-3 ${compact ? 'grid-cols-1' : 'sm:grid-cols-2 xl:grid-cols-3'}`}>{children}</div>
    </section>
  )
}

function HomeActionButton({ action, onNavigate }: { action: HomeAction; onNavigate: (path: string) => void }) {
  const tone = ACTION_TONES[action.tone]
  const Icon = action.icon

  return (
    <button
      type="button"
      disabled={action.disabled}
      onClick={() => {
        if (action.onClick) action.onClick()
        else if (action.path) onNavigate(action.path)
      }}
      className={`flex min-h-28 w-full gap-3 rounded-lg border ${tone.border} bg-white p-3 text-left transition-colors ${tone.hover} disabled:cursor-not-allowed disabled:opacity-70`}
    >
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${tone.icon}`}>
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block font-semibold text-gray-950">{action.title}</span>
        <span className="mt-1 block text-sm leading-5 text-gray-600">{action.description}</span>
        {action.meta && <span className={`mt-2 block text-xs font-bold ${tone.meta}`}>{action.meta}</span>}
      </span>
    </button>
  )
}
