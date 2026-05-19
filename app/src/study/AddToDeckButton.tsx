import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '../store'
import { SQLiteStorage } from '../db/sqlite'
import { FSRSScheduler, SM2Scheduler } from '../core/scheduler'
import { SRSService } from '../srs/srsService'
import { toast } from '../components/toastStore'

interface AddToDeckButtonProps {
  front: string
  back: string
  reading?: string
}

/**
 * "Add to deck" button for vocab items.
 * Shows a popover with deck list on click.
 * Automatically checks if the card already exists in a deck.
 */
export function AddToDeckButton({ front, back, reading }: AddToDeckButtonProps) {
  const settings = useAppStore(s => s.settings)
  const activeUserId = useAppStore(s => s.activeUserId)
  const userId = activeUserId ?? 1

  const [storage] = useState(() => new SQLiteStorage())
  const scheduler = settings.schedulerAlgorithm === 'fsrs' ? new FSRSScheduler() : new SM2Scheduler()
  const [service] = useState(() => new SRSService(storage, scheduler))

  const [decks, setDecks] = useState<{ id: number; name: string }[]>([])
  const [addedDeckName, setAddedDeckName] = useState<string | null>(null)
  const [showPopover, setShowPopover] = useState(false)
  const [isChecking, setIsChecking] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)

  // Check if card already exists and load decks
  useEffect(() => {
    void (async () => {
      try {
        const [deckRows, existingRows] = await Promise.all([
          service.getDecks(userId),
          service.storage.query<{ id: number; deckName: string | null }>(
            `SELECT c.id, d.name AS deckName FROM cards c
             LEFT JOIN decks d ON d.id = c.deck_id
             WHERE c.front = ? LIMIT 1`,
            [front]
          ),
        ])
        setDecks(deckRows)
        if (existingRows[0]) {
          setAddedDeckName(existingRows[0].deckName ?? 'deck')
        }
      } finally {
        setIsChecking(false)
      }
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [front, userId])

  // Close popover on outside click
  useEffect(() => {
    if (!showPopover) return
    function handleClick(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setShowPopover(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showPopover])

  async function handleAddToDeck(deckId: number, deckName: string) {
    setIsSaving(true)
    setShowPopover(false)
    try {
      await service.createUserCard(userId, { front, back, reading: reading ?? null, deckId })
      setAddedDeckName(deckName)
      toast.success(`Added to "${deckName}"`)
    } catch (err) {
      toast.error('Failed to add card')
      console.error(err)
    } finally {
      setIsSaving(false)
    }
  }

  if (isChecking) return null

  if (addedDeckName) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-green-50 border border-green-200 text-xs font-semibold text-green-700">
        ✓ In {addedDeckName}
      </span>
    )
  }

  return (
    <div className="relative" ref={popoverRef}>
      <button
        type="button"
        onClick={() => setShowPopover(v => !v)}
        disabled={isSaving}
        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-50 transition-colors"
      >
        {isSaving ? 'Adding…' : '＋ Add to deck'}
      </button>
      {showPopover && (
        <div className="absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-30 min-w-44 py-1">
          <p className="px-3 py-1.5 text-xs text-gray-400 font-semibold">Add to which deck?</p>
          {decks.length === 0 ? (
            <p className="px-4 py-2 text-xs text-gray-500">No decks yet. Create one in Study first.</p>
          ) : (
            decks.map(d => (
              <button
                key={d.id}
                onClick={() => void handleAddToDeck(d.id, d.name)}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                {d.name}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
