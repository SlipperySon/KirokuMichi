import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store'
import { SQLiteStorage } from '../db/sqlite'
import { FSRSScheduler, SM2Scheduler } from '../core/scheduler'
import { SRSService } from '../srs/srsService'
import { Navigation } from '../components/Navigation'

interface GrammarPoint {
  id: number
  jlpt_level: string
  title: string
  pattern: string
  meaning: string
  explanation: string
  examples_json: string
}

interface Example {
  ja: string
  reading?: string
  en: string
}

function GrammarCard({ point, onNext }: { point: GrammarPoint; onNext: () => void }) {
  const [revealed, setRevealed] = useState(false)
  let examples: Example[] = []
  try { examples = JSON.parse(point.examples_json ?? '[]') } catch { examples = [] }

  return (
    <div className="flex flex-col gap-6">
      {/* Pattern front */}
      <div className="bg-indigo-50 rounded-2xl p-6 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-indigo-400 uppercase tracking-wide">{point.jlpt_level}</span>
          <span className="text-xs text-gray-400">{point.title}</span>
        </div>
        <p className="text-2xl font-bold text-indigo-800 font-mono" lang="ja">{point.pattern}</p>
        <p className="text-base text-gray-700">{point.meaning}</p>
      </div>

      {revealed ? (
        <>
          {/* Explanation */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-sm text-gray-700 leading-relaxed">{point.explanation}</p>
          </div>

          {/* Examples */}
          {examples.length > 0 && (
            <div className="flex flex-col gap-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Examples</p>
              {examples.map((ex, i) => (
                <div key={i} className="space-y-0.5">
                  <p className="text-gray-900" lang="ja">{ex.ja}</p>
                  {ex.reading && <p className="text-xs text-indigo-400" lang="ja">{ex.reading}</p>}
                  <p className="text-sm text-gray-500">{ex.en}</p>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={onNext}
            className="w-full px-4 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors"
          >
            Next →
          </button>
        </>
      ) : (
        <button
          onClick={() => setRevealed(true)}
          className="w-full px-4 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors"
        >
          Show Explanation
        </button>
      )}
    </div>
  )
}

export function GrammarReview() {
  const navigate = useNavigate()
  const { settings, activeUserId } = useAppStore()
  const [storage] = useState(() => new SQLiteStorage())
  const scheduler = settings.schedulerAlgorithm === 'fsrs' ? new FSRSScheduler() : new SM2Scheduler()
  const [service] = useState(() => new SRSService(storage, scheduler))

  const [queue, setQueue] = useState<GrammarPoint[] | null>(null)
  const [index, setIndex] = useState(0)
  const [sessionId, setSessionId] = useState<number | null>(null)
  const [reviewed, setReviewed] = useState(0)
  const [loading, setLoading] = useState(false)
  const userId = activeUserId ?? 1

  async function start() {
    setLoading(true)
    const points = await service.getGrammarQueue(userId, settings.dailyCardLimit || 20)
    const sid = await service.startSession(userId, 'grammar')
    setQueue(points)
    setSessionId(sid)
    setIndex(0)
    setReviewed(0)
    setLoading(false)
  }

  async function handleNext() {
    if (!queue || sessionId === null) return
    const point = queue[index]
    await service.markGrammarSeen(userId, point.id)
    const next = index + 1
    setReviewed(r => r + 1)

    if (next >= queue.length) {
      // End session
      await service.endSession(sessionId, { cardsReviewed: reviewed + 1, correctCount: reviewed + 1, startedAt: Date.now() })
      navigate('/study')
      return
    }
    setIndex(next)
  }

  // Start screen
  if (!queue) {
    return (
      <div className="flex flex-col min-h-screen">
        <Navigation />
        <main className="flex flex-col gap-6 p-6 max-w-xl mx-auto flex-1 items-center justify-center">
          <h1 className="text-2xl font-bold text-gray-900">Grammar Review</h1>
          <p className="text-gray-500 text-center text-sm">
            Review grammar patterns with explanations and examples.
          </p>
          <button
            onClick={start}
            disabled={loading}
            className="px-8 py-4 bg-indigo-600 text-white rounded-xl text-lg font-semibold hover:bg-indigo-700 disabled:opacity-40 transition-colors"
          >
            {loading ? 'Loading…' : 'Start Grammar Review'}
          </button>
          <button onClick={() => navigate('/study')} className="text-sm text-gray-400 hover:text-gray-600">
            ← Back
          </button>
        </main>
      </div>
    )
  }

  if (queue.length === 0) {
    return (
      <div className="flex flex-col min-h-screen">
        <Navigation />
        <main className="flex flex-col gap-4 p-6 max-w-xl mx-auto flex-1 items-center justify-center text-center">
          <p className="text-4xl">🎓</p>
          <p className="text-lg font-semibold text-gray-700">No grammar points yet</p>
          <p className="text-sm text-gray-500 max-w-xs">Import grammar content from the Practice tab or explore the JLPT section.</p>
          <button onClick={() => navigate('/study')} className="text-sm text-indigo-600 hover:text-indigo-800">← Back</button>
        </main>
      </div>
    )
  }

  const current = queue[index]

  return (
    <div className="flex flex-col min-h-screen">
      <Navigation />
      <main className="flex flex-col gap-6 p-6 max-w-xl mx-auto flex-1 w-full">
        <div className="flex items-center justify-between">
          <button onClick={() => navigate('/study')} className="text-sm text-gray-400 hover:text-gray-600">← Exit</button>
          <span className="text-sm text-gray-400">{index + 1} / {queue.length}</span>
        </div>

        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-purple-500 rounded-full transition-all"
            style={{ width: `${((index + 1) / queue.length) * 100}%` }}
          />
        </div>

        <GrammarCard key={current.id} point={current} onNext={handleNext} />
      </main>
    </div>
  )
}
