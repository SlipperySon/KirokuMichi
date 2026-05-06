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

export function StudyDashboard() {
  const intl = useIntl()
  const navigate = useNavigate()
  const settings = useAppStore(s => s.settings)
  const updateSettings = useAppStore(s => s.updateSettings)
  const activeUserId = useAppStore(s => s.activeUserId)
  const setActiveUserId = useAppStore(s => s.setActiveUserId)

  const [storage] = useState(() => new SQLiteStorage())
  const scheduler = settings.schedulerAlgorithm === 'fsrs' ? new FSRSScheduler() : new SM2Scheduler()
  const [service] = useState(() => new SRSService(storage, scheduler))

  const [dueCount, setDueCount] = useState(0)
  const [newCount, setNewCount] = useState(0)
  const [availableNewCount, setAvailableNewCount] = useState(0)
  const [grammarDueCount, setGrammarDueCount] = useState(0)
  const [streakData, setStreakData] = useState<StreakData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [recoveryPayload, setRecoveryPayload] = useState<SessionRecoveryPayload | null>(null)
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

    const [due, newC, streak, grammarDue] = await Promise.all([
      service.getDueCount(uid),
      service.getNewCount(uid),
      service.getStreakData(uid),
      service.getGrammarDueCount(uid),
    ])
    setDueCount(due)
    setNewCount(newC)
    setGrammarDueCount(grammarDue)
    // Cap new cards shown by daily limit minus due cards already scheduled
    const available = Math.max(0, settings.dailyCardLimit - due)
    setAvailableNewCount(Math.min(newC, available))
    setStreakData(streak)

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
    if (queue.length === 0) return
    const sessionId = await service.startSession(userId, 'vocab')
    navigate('/study/review', { state: { queue, grammarEntries: [], sessionId, userId } })
  }

  async function startGrammarReview() {
    navigate('/study/grammar')
  }

  async function resumeSession() {
    if (!recoveryPayload || !userId) return
    const queue = recoveryPayload.queue.slice(recoveryPayload.currentIndex)
    navigate('/study/review', {
      state: { queue, grammarEntries: [], sessionId: recoveryPayload.sessionId, userId },
    })
  }

  async function abandonSession() {
    if (!recoveryPayload) return
    await service.endSession(recoveryPayload.sessionId, recoveryPayload.stats)
    SessionRecovery.clear()
    setRecoveryPayload(null)
  }

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen text-gray-400">Loading…</div>
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Navigation />
      <main className="flex flex-col gap-8 p-6 max-w-xl mx-auto flex-1">
        <h1 className="text-2xl font-bold">{intl.formatMessage({ id: 'study.dashboard.title' })}</h1>

      {/* Recovery modal */}
      {recoveryPayload && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-labelledby="recovery-title">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 flex flex-col gap-4">
            <h2 id="recovery-title" className="text-lg font-bold">{intl.formatMessage({ id: 'study.dashboard.resume_title' })}</h2>
            <p className="text-sm text-gray-600">{intl.formatMessage({ id: 'study.dashboard.resume_body' })}</p>
            <div className="flex gap-3">
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

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
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

      {/* Review buttons */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={startWordReview}
          disabled={dueCount + newCount === 0}
          className="flex flex-col items-center px-4 py-5 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <span className="text-lg">Review Words</span>
          <span className="text-xs mt-1 opacity-80">{dueCount} due · {availableNewCount} new</span>
        </button>
        <button
          onClick={startGrammarReview}
          disabled={grammarDueCount === 0}
          className="flex flex-col items-center px-4 py-5 bg-purple-600 text-white rounded-xl font-semibold hover:bg-purple-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <span className="text-lg">Study Grammar</span>
          <span className="text-xs mt-1 opacity-80">{grammarDueCount} due</span>
        </button>
      </div>

    </main>
    </div>
  )
}
