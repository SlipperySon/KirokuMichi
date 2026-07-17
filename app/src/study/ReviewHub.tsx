import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart3,
  BookOpen,
  Brain,
  FileText,
  Layers,
  LibraryBig,
  PenSquare,
} from 'lucide-react'
import { Navigation } from '../components/Navigation'
import { toast } from '../components/toastStore'
import { SQLiteStorage } from '../db/sqlite'
import { FSRSScheduler, SM2Scheduler } from '../core/scheduler'
import { SRSService } from '../srs/srsService'
import { useAppStore } from '../store'
import type { ReviewCard } from './types'
import { interleaveDueAndNew } from './reviewInterleave'

/**
 * Unified Anki-style SRS home: word dues + grammar dues + card tools.
 */
export function ReviewHub() {
  const navigate = useNavigate()
  const settings = useAppStore(s => s.settings)
  const activeUserId = useAppStore(s => s.activeUserId)
  const activeDeckId = useAppStore(s => s.activeDeckId)
  const userId = activeUserId ?? 1

  const [storage] = useState(() => new SQLiteStorage())
  const scheduler = settings.schedulerAlgorithm === 'fsrs' ? new FSRSScheduler() : new SM2Scheduler()
  const [service] = useState(() => new SRSService(storage, scheduler))

  const [dueCount, setDueCount] = useState(0)
  const [newCount, setNewCount] = useState(0)
  const [grammarDueCount, setGrammarDueCount] = useState(0)
  const [mistakeCount, setMistakeCount] = useState(0)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const [due, news, grammarDue, mistakes] = await Promise.all([
        service.getDueCount(userId),
        service.getNewCount(userId),
        service.getGrammarDueCount(userId),
        service.getRecentMistakeCount(userId, 7),
      ])
      setDueCount(due)
      setNewCount(news)
      setGrammarDueCount(grammarDue)
      setMistakeCount(mistakes)
    } catch {
      // leave zeros
    } finally {
      setLoading(false)
    }
  }, [service, userId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  async function startWordReview() {
    const limit = settings.dailyCardLimit
    const dueLimit = Math.max(1, limit)
    const [due, news] = await Promise.all([
      service.getDueCards(userId, dueLimit, activeDeckId),
      service.getNewCards(userId, Math.max(0, limit)),
    ])
    const queue = interleaveDueAndNew(due, news, limit).filter(
      c => c.type === 'vocabulary' || c.type === 'kanji' || c.type === 'hiragana' || c.type === 'katakana',
    )
    if (queue.length === 0) {
      toast.info('No word cards are due right now.')
      return
    }
    const sessionId = await service.startSession(userId, 'vocab')
    navigate('/study/review', { state: { queue, grammarEntries: [], sessionId, userId } })
  }

  const tools = [
    { title: 'Card Browser', path: '/study/browser', icon: LibraryBig, description: 'Search, edit, suspend' },
    { title: 'Create Card', path: '/study/create', icon: PenSquare, description: 'Add your own card' },
    { title: 'Templates', path: '/study/templates', icon: Layers, description: 'Deck layouts' },
    { title: 'Mistakes', path: '/study/mistakes', icon: FileText, description: mistakeCount > 0 ? `${mistakeCount} recent` : 'Recent Again ratings' },
    { title: 'Stats', path: '/study/stats', icon: BarChart3, description: 'Retention history' },
  ]

  return (
    <div className="flex min-h-screen flex-col">
      <Navigation />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6 sm:p-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600">Review</p>
          <h1 className="mt-1 text-2xl font-bold text-gray-950">Anki-style SRS</h1>
          <p className="mt-1 text-sm text-gray-600">
            Spaced retrieval for words and grammar. This is the same scheduler used after lessons.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl bg-indigo-50 p-4">
            <div className="text-2xl font-bold tabular-nums text-indigo-700">{loading ? '—' : dueCount}</div>
            <div className="text-xs text-gray-600">Words due</div>
          </div>
          <div className="rounded-xl bg-green-50 p-4">
            <div className="text-2xl font-bold tabular-nums text-green-700">{loading ? '—' : newCount}</div>
            <div className="text-xs text-gray-600">New</div>
          </div>
          <div className="rounded-xl bg-violet-50 p-4">
            <div className="text-2xl font-bold tabular-nums text-violet-700">{loading ? '—' : grammarDueCount}</div>
            <div className="text-xs text-gray-600">Grammar due</div>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => { void startWordReview() }}
            disabled={dueCount + newCount === 0}
            className="flex flex-1 flex-col items-center rounded-xl bg-indigo-600 px-4 py-4 font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <span className="inline-flex items-center gap-2">
              <Brain className="h-4 w-4" aria-hidden />
              Review words
            </span>
            <span className="mt-1 text-xs opacity-80">{dueCount} due · {newCount} new</span>
          </button>
          <button
            type="button"
            onClick={() => navigate('/study/grammar')}
            disabled={grammarDueCount === 0}
            className="flex flex-1 flex-col items-center rounded-xl border-2 border-violet-200 bg-violet-50 px-4 py-4 font-semibold text-violet-900 hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <span className="inline-flex items-center gap-2">
              <BookOpen className="h-4 w-4" aria-hidden />
              Review grammar
            </span>
            <span className="mt-1 text-xs opacity-80">
              {grammarDueCount > 0 ? `${grammarDueCount} due` : 'Nothing due'}
            </span>
          </button>
        </div>

        <section>
          <h2 className="text-sm font-semibold text-gray-800">Card tools</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {tools.map(tool => {
              const Icon = tool.icon
              return (
                <button
                  key={tool.path}
                  type="button"
                  onClick={() => navigate(tool.path)}
                  className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white px-3 py-3 text-left hover:border-indigo-200 hover:bg-indigo-50/40"
                >
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-gray-500" aria-hidden />
                  <span>
                    <span className="block text-sm font-semibold text-gray-900">{tool.title}</span>
                    <span className="block text-xs text-gray-500">{tool.description}</span>
                  </span>
                </button>
              )
            })}
          </div>
        </section>
      </main>
    </div>
  )
}
