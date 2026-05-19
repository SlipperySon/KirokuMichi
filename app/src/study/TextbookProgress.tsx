import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store'
import { SQLiteStorage } from '../db/sqlite'
import { FSRSScheduler, SM2Scheduler } from '../core/scheduler'
import { SRSService } from '../srs/srsService'

/** Keys stored in localStorage['kiroku-textbook-links'] */
interface TextbookLinks {
  [textbookKey: string]: number // deckId
}

const TEXTBOOK_DISPLAY: Record<string, string> = {
  genki_1: 'Genki I',
  genki_2: 'Genki II',
  quartet_1: 'Quartet 1',
  quartet_2: 'Quartet 2',
}

interface DeckStats {
  total: number
  due: number
  newCards: number
}

interface TextbookCard {
  textbookKey: string
  textbookName: string
  deckId: number
  deckName: string
  stats: DeckStats | null
}

export function TextbookProgress() {
  const navigate = useNavigate()
  const settings = useAppStore(s => s.settings)
  const activeUserId = useAppStore(s => s.activeUserId)
  const setActiveDeckId = useAppStore(s => s.setActiveDeckId)

  const [storage] = useState(() => new SQLiteStorage())
  const scheduler = settings.schedulerAlgorithm === 'fsrs' ? new FSRSScheduler() : new SM2Scheduler()
  const [service] = useState(() => new SRSService(storage, scheduler))

  const userId = activeUserId ?? 1

  const [cards, setCards] = useState<TextbookCard[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    void (async () => {
      setIsLoading(true)
      try {
        // Read linked textbooks from localStorage
        const raw = localStorage.getItem('kiroku-textbook-links')
        if (!raw) { setCards([]); return }

        let links: TextbookLinks
        try {
          links = JSON.parse(raw) as TextbookLinks
        } catch {
          setCards([]); return
        }

        const entries = Object.entries(links).filter(([, deckId]) => deckId != null)
        if (entries.length === 0) { setCards([]); return }

        // Load all decks for name lookup
        const allDecks = await service.getDecks(userId)
        const deckById = new Map(allDecks.map(d => [d.id, d.name]))

        // For each linked textbook, load deck stats
        const results: TextbookCard[] = await Promise.all(
          entries.map(async ([textbookKey, deckId]) => {
            const textbookName = TEXTBOOK_DISPLAY[textbookKey] ?? textbookKey.replace(/_/g, ' ')
            const deckName = deckById.get(deckId) ?? `Deck #${deckId}`

            let stats: DeckStats | null = null
            try {
              const [totalRows, dueRows, newRows] = await Promise.all([
                service.storage.query<{ count: number }>(
                  `SELECT COUNT(*) AS count FROM cards WHERE deck_id = ?`,
                  [deckId]
                ),
                service.storage.query<{ count: number }>(
                  `SELECT COUNT(*) AS count FROM card_states cs
                   JOIN cards c ON c.id = cs.card_id
                   WHERE c.deck_id = ? AND cs.user_id = ?
                     AND cs.due <= datetime('now') AND cs.state != 'new' AND cs.is_leech = 0`,
                  [deckId, userId]
                ),
                service.storage.query<{ count: number }>(
                  `SELECT COUNT(*) AS count FROM card_states cs
                   JOIN cards c ON c.id = cs.card_id
                   WHERE c.deck_id = ? AND cs.user_id = ? AND cs.state = 'new'`,
                  [deckId, userId]
                ),
              ])
              stats = {
                total: totalRows[0]?.count ?? 0,
                due: dueRows[0]?.count ?? 0,
                newCards: newRows[0]?.count ?? 0,
              }
            } catch {
              // stats unavailable
            }

            return { textbookKey, textbookName, deckId, deckName, stats }
          })
        )

        setCards(results)
      } finally {
        setIsLoading(false)
      }
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  if (isLoading) {
    return (
      <div className="flex gap-3 overflow-x-auto pb-2">
        {[1, 2].map(i => (
          <div key={i} className="flex-shrink-0 w-56 h-36 bg-gray-100 rounded-2xl animate-pulse" />
        ))}
      </div>
    )
  }

  if (cards.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-6 py-8 text-center">
        <p className="text-sm text-gray-500">
          No linked textbooks. Go to{' '}
          <button
            onClick={() => navigate('/my-content')}
            className="text-indigo-600 underline underline-offset-2 hover:text-indigo-700"
          >
            Upload Content
          </button>{' '}
          to link a textbook to a deck and track your progress here.
        </p>
      </div>
    )
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1">
      {cards.map(card => (
        <div
          key={card.textbookKey}
          className="flex-shrink-0 w-60 bg-white border border-gray-200 rounded-2xl p-5 shadow-sm flex flex-col gap-3"
        >
          <div>
            <p className="text-xs text-indigo-600 font-semibold uppercase tracking-wide">{card.textbookName}</p>
            <p className="text-sm font-bold text-gray-900 mt-0.5 truncate">{card.deckName}</p>
          </div>

          {card.stats ? (
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-gray-50 rounded-lg p-2">
                <p className="text-lg font-bold text-gray-900">{card.stats.total}</p>
                <p className="text-[10px] text-gray-500 font-medium">Total</p>
              </div>
              <div className={`rounded-lg p-2 ${card.stats.due > 0 ? 'bg-orange-50' : 'bg-gray-50'}`}>
                <p className={`text-lg font-bold ${card.stats.due > 0 ? 'text-orange-700' : 'text-gray-900'}`}>
                  {card.stats.due}
                </p>
                <p className="text-[10px] text-gray-500 font-medium">Due</p>
              </div>
              <div className={`rounded-lg p-2 ${card.stats.newCards > 0 ? 'bg-green-50' : 'bg-gray-50'}`}>
                <p className={`text-lg font-bold ${card.stats.newCards > 0 ? 'text-green-700' : 'text-gray-900'}`}>
                  {card.stats.newCards}
                </p>
                <p className="text-[10px] text-gray-500 font-medium">New</p>
              </div>
            </div>
          ) : (
            <p className="text-xs text-gray-400 italic">Stats unavailable</p>
          )}

          <div className="flex flex-col gap-2 mt-auto">
            <button
              onClick={() => {
                setActiveDeckId(card.deckId)
                navigate('/study/review')
              }}
              className="w-full px-3 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Study Now
            </button>
            <button
              onClick={() => {
                setActiveDeckId(card.deckId)
                navigate('/study/browser')
              }}
              className="w-full px-3 py-2 border border-gray-200 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-50 transition-colors"
            >
              Browse Cards
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
