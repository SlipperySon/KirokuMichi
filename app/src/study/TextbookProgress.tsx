import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store'
import { SQLiteStorage } from '../db/sqlite'
import { FSRSScheduler, SM2Scheduler } from '../core/scheduler'
import { SRSService } from '../srs/srsService'
import { toast } from '../components/toastStore'
import type { ReviewCard } from './types'

/** Keys stored in localStorage['kiroku-textbook-links'] */
interface TextbookLinks {
  [textbookKey: string]: number // deckId
}

const TEXTBOOK_DISPLAY: Record<string, string> = {
  genki_1: 'Genki I',
  genki_2: 'Genki II',
  quartet_1: 'Quartet 1',
  quartet_2: 'Quartet 2',
  tobira: 'Tobira',
  marugoto_a1: 'Marugoto A1',
  marugoto_a2: 'Marugoto A2',
  marugoto_b1: 'Marugoto B1',
  marugoto: 'Marugoto',
}

const TEXTBOOK_LESSON_TOTALS: Record<string, number> = {
  genki_1: 12,
  genki_2: 12,
  quartet_1: 6,
  quartet_2: 6,
  tobira: 8,
  marugoto_a1: 7,
  marugoto_a2: 6,
  marugoto_b1: 7,
}

interface DeckStats {
  total: number
  due: number
  newCards: number
}

interface TextbookCard {
  textbookKey: string
  textbookName: string
  deckId: number  // -1 = no linked deck
  deckName: string | null
  completedLessons: number
  lessonTotal: number | null
  stats: DeckStats | null
}

export function TextbookProgress() {
  const navigate = useNavigate()
  const settings = useAppStore(s => s.settings)
  const activeUserId = useAppStore(s => s.activeUserId)
  const setActiveDeckId = useAppStore(s => s.setActiveDeckId)
  const lessonsCompleted = useAppStore(s => s.lessonsCompleted)

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
        // --- 1. Explicit links from localStorage (set when uploading a PDF) ---
        let links: TextbookLinks = {}
        try {
          const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem('kiroku-textbook-links')
          if (raw) links = JSON.parse(raw) as TextbookLinks
        } catch { /* ignore */ }

        // --- 2. Auto-detect from lessonsCompleted (covers APKG imports and
        //        learners who go through lessons without linking a deck) ---
        const autoDetected = new Set<string>()
        for (const lessonId of lessonsCompleted) {
          for (const key of Object.keys(TEXTBOOK_DISPLAY)) {
            if (lessonId.startsWith(`${key}_`)) {
              autoDetected.add(key)
              break
            }
          }
          // marugoto sub-keys
          if (lessonId.startsWith('marugoto_')) autoDetected.add('marugoto')
        }

        // --- 3. Auto-detect textbooks from imported lesson_vocabulary cards ---
        //        This covers users who imported an APKG but haven't done any lessons yet
        try {
          const lessonRows = await service.storage.query<{ lesson_id: string }>(
            `SELECT DISTINCT cs.lesson_id FROM card_states cs
             WHERE cs.user_id = ? AND cs.lesson_id IS NOT NULL LIMIT 200`,
            [userId]
          )
          for (const { lesson_id } of lessonRows) {
            for (const key of Object.keys(TEXTBOOK_DISPLAY)) {
              if (lesson_id.startsWith(`${key}_`)) {
                autoDetected.add(key)
                break
              }
            }
          }
        } catch { /* DB may not be ready */ }

        // Merge: explicit links take priority; auto-detected keys with no link get deckId=-1 (no deck)
        const allKeys = new Set([...Object.keys(links), ...autoDetected])
        if (allKeys.size === 0) { setCards([]); return }

        const allDecks = await service.getDecks(userId)
        const deckById = new Map(allDecks.map(d => [d.id, d.name]))

        const results: TextbookCard[] = await Promise.all(
          [...allKeys].map(async (textbookKey) => {
            const deckId = links[textbookKey] ?? null
            const textbookName = TEXTBOOK_DISPLAY[textbookKey] ?? textbookKey.replace(/_/g, ' ')
            const deckName = deckId ? (deckById.get(deckId) ?? `Deck #${deckId}`) : null

            let stats: DeckStats | null = null
            if (deckId) {
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
              } catch { /* stats unavailable */ }
            } else {
              // No linked deck — count lesson_vocabulary cards for this textbook instead
              try {
                const prefix = textbookKey === 'marugoto'
                  ? `marugoto_`
                  : `${textbookKey}_`
                const rows = await service.storage.query<{ count: number }>(
                  `SELECT COUNT(DISTINCT lv.card_id) AS count FROM lesson_vocabulary lv
                   WHERE lv.user_id = ? AND lv.lesson_id LIKE ?`,
                  [userId, `${prefix}%`]
                )
                const total = rows[0]?.count ?? 0
                if (total > 0) stats = { total, due: 0, newCards: total }
              } catch { /* ignore */ }
            }

            const lessonTotal = TEXTBOOK_LESSON_TOTALS[textbookKey] ?? null
            const completedLessons = countCompletedLessons(textbookKey, lessonsCompleted)

            return { textbookKey, textbookName, deckId: deckId ?? -1, deckName, completedLessons, lessonTotal, stats }
          })
        )

        // Sort: textbooks with completed lessons first, then alphabetically
        results.sort((a, b) => b.completedLessons - a.completedLessons || a.textbookName.localeCompare(b.textbookName))
        setCards(results)
      } finally {
        setIsLoading(false)
      }
    })()
  }, [userId, lessonsCompleted, service])

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
          Start a lesson above to see your textbook progress here, or{' '}
          <button
            onClick={() => navigate('/my-content')}
            className="text-indigo-600 underline underline-offset-2 hover:text-indigo-700"
          >
            import your deck
          </button>{' '}
          to link a textbook.
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

          {card.lessonTotal && (
            <div>
              <div className="flex items-center justify-between text-xs font-medium text-gray-600">
                <span>Lessons</span>
                <span>{card.completedLessons}/{card.lessonTotal}</span>
              </div>
              <div className="mt-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-indigo-500"
                  style={{ width: `${Math.min(100, Math.round((card.completedLessons / card.lessonTotal) * 100))}%` }}
                />
              </div>
            </div>
          )}

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
            {card.deckId !== -1 ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    void startDeckReview({
                      service,
                      userId,
                      deckId: card.deckId,
                      limit: settings.dailyCardLimit || 20,
                      setActiveDeckId,
                      navigate,
                    })
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
              </>
            ) : (
              <button
                onClick={() => navigate('/my-content')}
                className="w-full px-3 py-2 border border-dashed border-indigo-300 text-indigo-600 text-xs font-medium rounded-lg hover:bg-indigo-50 transition-colors"
              >
                Link a deck →
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

function countCompletedLessons(textbookKey: string, lessonsCompleted: string[]): number {
  const prefixes = lessonPrefixesForTextbook(textbookKey)
  if (prefixes.length === 0) return 0
  return lessonsCompleted.filter(lessonId => prefixes.some(prefix => lessonId.startsWith(prefix))).length
}

function lessonPrefixesForTextbook(textbookKey: string): string[] {
  if (textbookKey === 'marugoto') return ['marugoto_a1_', 'marugoto_a2_', 'marugoto_b1_']
  return [`${textbookKey}_`]
}

async function loadDeckReviewQueue(
  service: SRSService,
  userId: number,
  deckId: number,
  limit: number,
): Promise<ReviewCard[]> {
  const due = await service.getDueCards(userId, limit, deckId)
  if (due.length >= limit) return due.slice(0, limit)

  const extras = await service.storage.query<ReviewCard>(
    `SELECT
      cs.id AS cardStateId, cs.card_id AS cardId, cs.state, cs.lapses,
      cs.stability, cs.difficulty, cs.due, c.type, c.front, c.back, c.reading,
      c.audio_url AS audioUrl, c.jlpt_level AS jlptLevel, c.user_note AS userNote,
      c.example_sentence AS exampleSentence, c.example_translation AS exampleTranslation
     FROM card_states cs
     JOIN cards c ON c.id = cs.card_id
     WHERE cs.user_id = ?
       AND c.deck_id = ?
       AND cs.is_leech = 0
       AND cs.suspended_at IS NULL
       AND (cs.buried_until IS NULL OR cs.buried_until <= datetime('now'))
     ORDER BY CASE cs.state WHEN 'new' THEN 0 WHEN 'learning' THEN 1 WHEN 'relearning' THEN 1 ELSE 2 END, cs.due ASC
     LIMIT ?`,
    [userId, deckId, limit],
  )

  const seen = new Set(due.map(card => card.cardStateId))
  const queue = [...due]
  for (const card of extras) {
    if (seen.has(card.cardStateId)) continue
    queue.push(card)
    if (queue.length >= limit) break
  }
  return queue
}

async function startDeckReview(input: {
  service: SRSService
  userId: number
  deckId: number
  limit: number
  setActiveDeckId: (id: number | null) => void
  navigate: ReturnType<typeof useNavigate>
}) {
  input.setActiveDeckId(input.deckId)
  const queue = await loadDeckReviewQueue(input.service, input.userId, input.deckId, input.limit)
  if (queue.length === 0) {
    toast.info('No cards available in this textbook deck yet.')
    return
  }
  const sessionId = await input.service.startSession(input.userId, 'vocab')
  input.navigate('/study/review', {
    state: {
      queue,
      grammarEntries: [],
      sessionId,
      userId: input.userId,
      markCompleteOnFinish: false,
    },
  })
}
