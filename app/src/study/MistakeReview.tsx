/**
 * Mistake Review Mode
 *
 * Surfaces the most-recent "Again" ratings (and any free-form mistakes
 * logged from the Conversation Partner) so the user can drill them as a
 * focused queue. Reuses the existing ReviewSession via React Router state.
 */

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store'
import { SQLiteStorage } from '../db/sqlite'
import { FSRSScheduler, SM2Scheduler } from '../core/scheduler'
import { SRSService } from '../srs/srsService'
import { Navigation } from '../components/Navigation'
import { EmptyState } from '../components/EmptyState'
import { SkeletonList } from '../components/Skeleton'

interface MistakeRow {
  mistakeId: number
  cardId: number | null
  cardStateId: number | null
  front: string | null
  back: string | null
  reading: string | null
  audioUrl: string | null
  type: string | null
  userInput: string | null
  correctAnswer: string
  loggedAt: string
}

const WINDOW_OPTIONS = [
  { label: '24h', days: 1 },
  { label: '3d', days: 3 },
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
] as const

function formatTimeAgo(iso: string): string {
  const then = new Date(iso.endsWith('Z') ? iso : `${iso}Z`).getTime()
  const diffMin = Math.max(0, Math.round((Date.now() - then) / 60000))
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.round(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  return `${Math.round(diffHr / 24)}d ago`
}

export function MistakeReview() {
  const navigate = useNavigate()
  const settings = useAppStore(s => s.settings)
  const activeUserId = useAppStore(s => s.activeUserId)

  const [storage] = useState(() => new SQLiteStorage())
  const scheduler = useMemo(
    () => (settings.schedulerAlgorithm === 'fsrs' ? new FSRSScheduler() : new SM2Scheduler()),
    [settings.schedulerAlgorithm]
  )
  const [service] = useState(() => new SRSService(storage, scheduler))

  const [windowDays, setWindowDays] = useState<number>(7)
  const [mistakes, setMistakes] = useState<MistakeRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)

  const refresh = useCallback(async () => {
    if (!activeUserId) return
    setIsLoading(true)
    try {
      const rows = await service.getRecentMistakes(activeUserId, windowDays)
      setMistakes(rows as MistakeRow[])
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load mistakes')
    } finally {
      setIsLoading(false)
    }
  }, [activeUserId, service, windowDays])

  useEffect(() => {
    void refresh()
  }, [refresh])

  // Group by card so the same card mistaken N times shows as one entry with a count
  const grouped = useMemo(() => {
    const map = new Map<string, { rows: MistakeRow[]; key: string }>()
    for (const m of mistakes) {
      // Free-form mistakes (cardId=null) keyed by correctAnswer text
      const key = m.cardId != null ? `card:${m.cardId}` : `text:${m.correctAnswer}`
      const existing = map.get(key)
      if (existing) existing.rows.push(m)
      else map.set(key, { rows: [m], key })
    }
    return Array.from(map.values()).sort(
      (a, b) => new Date(b.rows[0].loggedAt).getTime() - new Date(a.rows[0].loggedAt).getTime()
    )
  }, [mistakes])

  const drillableStateIds = useMemo(
    () =>
      Array.from(
        new Set(
          mistakes
            .filter(m => m.cardStateId != null)
            .map(m => m.cardStateId as number)
        )
      ),
    [mistakes]
  )

  async function startDrill() {
    if (!activeUserId || drillableStateIds.length === 0) return
    setStarting(true)
    try {
      const queue = await service.getCardsByStateIds(activeUserId, drillableStateIds)
      if (queue.length === 0) {
        setError('No drillable cards (mistakes may be from free-form practice).')
        setStarting(false)
        return
      }
      const sessionId = await service.startSession(activeUserId, 'srs')
      navigate('/study/review', {
        state: { queue, grammarEntries: [], sessionId, userId: activeUserId, mode: 'mistake_drill' },
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start drill')
      setStarting(false)
    }
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Navigation />
      <main className="flex flex-col gap-6 p-6 max-w-2xl mx-auto flex-1 w-full">
        <header className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold text-gray-900">Mistake Review</h1>
          <p className="text-sm text-gray-600">
            Cards you've recently rated <em>Again</em> — drill them in a focused session before they
            decay further.
          </p>
        </header>

        {/* Window selector */}
        <div className="flex gap-2" role="tablist" aria-label="Time window">
          {WINDOW_OPTIONS.map(opt => (
            <button
              key={opt.days}
              role="tab"
              aria-selected={windowDays === opt.days}
              onClick={() => setWindowDays(opt.days)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                windowDays === opt.days
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              Last {opt.label}
            </button>
          ))}
        </div>

        {/* Drill CTA */}
        <div className="flex items-center justify-between gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div>
            <p className="font-semibold text-amber-900">
              {drillableStateIds.length} {drillableStateIds.length === 1 ? 'card' : 'cards'} to drill
            </p>
            <p className="text-xs text-amber-700 mt-0.5">
              {mistakes.length - drillableStateIds.length > 0
                ? `${mistakes.length - drillableStateIds.length} free-form mistakes (no card to drill)`
                : 'All mistakes are drillable'}
            </p>
          </div>
          <button
            onClick={startDrill}
            disabled={drillableStateIds.length === 0 || starting}
            className="px-4 py-2 bg-amber-600 text-white rounded-lg font-semibold hover:bg-amber-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {starting ? 'Starting…' : 'Drill these'}
          </button>
        </div>

        {/* List */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">
            {error}
          </div>
        )}

        {isLoading ? (
          <SkeletonList count={4} />
        ) : grouped.length === 0 ? (
          <EmptyState
            icon="🎉"
            title="No mistakes in this window"
            description="Mistakes appear here when you rate a card 'Again' during review, or after conversation corrections. Keep up the streak!"
            action={
              <button
                onClick={() => navigate('/study')}
                className="px-4 py-2 text-sm font-medium text-indigo-700 bg-indigo-50 rounded-lg hover:bg-indigo-100"
              >
                Back to Dashboard
              </button>
            }
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {grouped.map(({ rows, key }) => {
              const head = rows[0]
              const count = rows.length
              const isFreeform = head.cardId == null
              return (
                <li
                  key={key}
                  className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col gap-2"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 break-words" lang="ja">
                        {head.front ?? head.correctAnswer}
                      </p>
                      {head.reading && (
                        <p className="text-sm text-gray-600">{head.reading}</p>
                      )}
                      {head.back && (
                        <p className="text-sm text-gray-700 mt-1">{head.back}</p>
                      )}
                      {isFreeform && (
                        <p className="text-xs text-gray-500 mt-1 italic">
                          Free-form mistake (from chat)
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {count > 1 && (
                        <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-700 text-xs font-semibold">
                          ×{count}
                        </span>
                      )}
                      <span className="text-xs text-gray-400">
                        {formatTimeAgo(head.loggedAt)}
                      </span>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </main>
    </div>
  )
}
