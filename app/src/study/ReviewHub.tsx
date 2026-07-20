import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart3,
  BookOpen,
  Brain,
  FileText,
  Layers,
  LibraryBig,
  Package,
  PenSquare,
} from 'lucide-react'
import { Navigation } from '../components/Navigation'
import { toast } from '../components/toastStore'
import { SQLiteStorage } from '../db/sqlite'
import { FSRSScheduler, SM2Scheduler } from '../core/scheduler'
import { SRSService } from '../srs/srsService'
import { useAppStore } from '../store'
import { interleaveDueAndNew } from './reviewInterleave'

/**
 * Unified Anki-style SRS home: path dues + Extra Anki decks + card tools.
 */
export function ReviewHub() {
  const navigate = useNavigate()
  const settings = useAppStore(s => s.settings)
  const updateSettings = useAppStore(s => s.updateSettings)
  const activeUserId = useAppStore(s => s.activeUserId)
  const activeDeckId = useAppStore(s => s.activeDeckId)
  const userId = activeUserId ?? 1

  const [storage] = useState(() => new SQLiteStorage())
  const scheduler = settings.schedulerAlgorithm === 'fsrs' ? new FSRSScheduler() : new SM2Scheduler()
  const [service] = useState(() => new SRSService(storage, scheduler))

  const [dueCount, setDueCount] = useState(0)
  const [extraDueCount, setExtraDueCount] = useState(0)
  const [newCount, setNewCount] = useState(0)
  const [grammarDueCount, setGrammarDueCount] = useState(0)
  const [mistakeCount, setMistakeCount] = useState(0)
  const [extraDecks, setExtraDecks] = useState<Array<{
    id: number
    name: string
    cardCount: number
    dueCount: number
    newCount: number
  }>>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const [due, extraDue, news, grammarDue, mistakes, extras] = await Promise.all([
        service.getDueCount(userId, 'path'),
        service.getDueCount(userId, 'extra'),
        service.getNewCount(userId, 'path'),
        service.getGrammarDueCount(userId),
        service.getRecentMistakeCount(userId, 7),
        service.listExtraDecks(userId),
      ])
      setDueCount(due)
      setExtraDueCount(extraDue)
      setNewCount(news)
      setGrammarDueCount(grammarDue)
      setMistakeCount(mistakes)
      setExtraDecks(extras)
    } catch {
      // leave zeros
    } finally {
      setLoading(false)
    }
  }, [service, userId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.location.hash === '#extra-decks') {
      document.getElementById('extra-decks')?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [loading])

  async function startWordReview(lane: 'path' | 'extra' | 'all' = 'path', deckId?: number | null) {
    const limit = settings.dailyCardLimit
    const dueLimit = Math.max(1, limit)
    const [due, news] = await Promise.all([
      service.getDueCards(userId, dueLimit, deckId ?? activeDeckId, lane),
      service.getNewCards(userId, Math.max(0, limit), lane),
    ])
    const queue = interleaveDueAndNew(due, news, limit).filter(
      c => c.type === 'vocabulary' || c.type === 'kanji' || c.type === 'hiragana' || c.type === 'katakana' || c.type === 'sentence' || c.type === 'grammar',
    )
    if (queue.length === 0) {
      toast.info(lane === 'extra' ? 'No Extra deck cards are due right now.' : 'No word cards are due right now.')
      return
    }
    const sessionId = await service.startSession(userId, lane === 'extra' ? 'extra' : 'vocab')
    navigate('/study/review', { state: { queue, grammarEntries: [], sessionId, userId } })
  }

  const tools = [
    { title: 'Card Browser', path: '/study/browser', icon: LibraryBig, description: 'Search, edit, suspend' },
    { title: 'Create Card', path: '/study/create', icon: PenSquare, description: 'Add your own card' },
    { title: 'Templates', path: '/study/templates', icon: Layers, description: 'Deck layouts' },
    { title: 'Mistakes', path: '/study/mistakes', icon: FileText, description: mistakeCount > 0 ? `${mistakeCount} recent` : 'Recent Again ratings' },
    { title: 'Stats', path: '/study/stats', icon: BarChart3, description: 'Retention history' },
    { title: 'Import .apkg', path: '/tutor', icon: Package, description: 'Adds to Extra Anki decks' },
  ]

  return (
    <div className="flex min-h-screen flex-col">
      <Navigation />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6 sm:p-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600">Review</p>
          <h1 className="mt-1 text-2xl font-bold text-gray-950">Anki-style SRS</h1>
          <p className="mt-1 text-sm text-gray-600">
            Path cards (lessons) drive Today. Imported .apkg files live under Extra and do not block the curriculum
            unless you opt in.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl bg-indigo-50 p-4">
            <div className="text-2xl font-bold tabular-nums text-indigo-700">{loading ? '—' : dueCount}</div>
            <div className="text-xs text-gray-600">Path due</div>
          </div>
          <div className="rounded-xl bg-amber-50 p-4">
            <div className="text-2xl font-bold tabular-nums text-amber-800">{loading ? '—' : extraDueCount}</div>
            <div className="text-xs text-gray-600">Extra due</div>
          </div>
          <div className="rounded-xl bg-green-50 p-4">
            <div className="text-2xl font-bold tabular-nums text-green-700">{loading ? '—' : newCount}</div>
            <div className="text-xs text-gray-600">Path new</div>
          </div>
          <div className="rounded-xl bg-violet-50 p-4">
            <div className="text-2xl font-bold tabular-nums text-violet-700">{loading ? '—' : grammarDueCount}</div>
            <div className="text-xs text-gray-600">Grammar due</div>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => { void startWordReview('path') }}
            disabled={dueCount + newCount === 0}
            className="flex flex-1 flex-col items-center rounded-xl bg-indigo-600 px-4 py-4 font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <span className="inline-flex items-center gap-2">
              <Brain className="h-4 w-4" aria-hidden />
              Review path cards
            </span>
            <span className="mt-1 text-xs opacity-80">
              {dueCount} due · {newCount} new
              {grammarDueCount > 0 ? ` · ${grammarDueCount} grammar after` : ''}
            </span>
          </button>
          <button
            type="button"
            onClick={() => navigate('/study/grammar')}
            disabled={grammarDueCount === 0}
            className="flex flex-1 flex-col items-center rounded-xl border border-violet-200 bg-white px-4 py-4 font-semibold text-violet-900 hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <span className="inline-flex items-center gap-2">
              <BookOpen className="h-4 w-4" aria-hidden />
              Catalog grammar
            </span>
            <span className="mt-1 text-xs opacity-80">
              {grammarDueCount > 0 ? `${grammarDueCount} due` : 'Nothing due'}
            </span>
          </button>
        </div>

        <section id="extra-decks" className="rounded-xl border border-amber-200 bg-amber-50/40 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-amber-950">Extra Anki decks</h2>
              <p className="mt-1 text-xs text-amber-900/80">
                User-imported .apkg files. Skipping these never blocks lesson progress. Lesson-linked cards from an
                import still count as path dues.
              </p>
            </div>
            <label className="flex items-center gap-2 text-xs text-amber-950">
              <input
                type="checkbox"
                checked={settings.includeExtraInToday}
                onChange={e => updateSettings({ includeExtraInToday: e.target.checked })}
                className="rounded border-amber-400"
              />
              Include Extra in Today
            </label>
          </div>

          {extraDecks.length === 0 ? (
            <p className="mt-3 text-sm text-amber-900/70">
              No Extra decks yet. Import an .apkg from Tutor / My Content — it will appear here.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {extraDecks.map(deck => (
                <li
                  key={deck.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-100 bg-white px-3 py-2"
                >
                  <div>
                    <div className="text-sm font-semibold text-gray-900">{deck.name}</div>
                    <div className="text-xs text-gray-500">
                      {deck.dueCount} due · {deck.newCount} new · {deck.cardCount} cards
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => { void startWordReview('extra', deck.id) }}
                    disabled={deck.dueCount + deck.newCount === 0}
                    className="rounded-lg bg-amber-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-800 disabled:opacity-40"
                  >
                    Study
                  </button>
                </li>
              ))}
            </ul>
          )}

          {extraDueCount > 0 && (
            <button
              type="button"
              onClick={() => { void startWordReview('extra') }}
              className="mt-3 w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm font-semibold text-amber-950 hover:bg-amber-50"
            >
              Study all Extra dues ({extraDueCount})
            </button>
          )}
        </section>

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
