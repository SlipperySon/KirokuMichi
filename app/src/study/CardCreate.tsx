import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store'
import { SQLiteStorage } from '../db/sqlite'
import { FSRSScheduler, SM2Scheduler } from '../core/scheduler'
import { SRSService } from '../srs/srsService'
import { saveAudio } from '../srs/audioStore'
import { Navigation } from '../components/Navigation'
import { toast } from '../components/toastStore'

interface CardCreateProps {
  /** If provided, pre-populates the form for editing an existing card */
  editCardId?: number
  editInitial?: {
    front: string
    back: string
    reading: string
    deckId: number | null
    tags: string
    note: string
    audioUrl: string | null
  }
  onSaved?: () => void
}

export function CardCreate({ editCardId, editInitial, onSaved }: CardCreateProps) {
  const navigate = useNavigate()
  const settings = useAppStore(s => s.settings)
  const activeUserId = useAppStore(s => s.activeUserId)
  const activeDeckId = useAppStore(s => s.activeDeckId)

  const [storage] = useState(() => new SQLiteStorage())
  const scheduler = settings.schedulerAlgorithm === 'fsrs' ? new FSRSScheduler() : new SM2Scheduler()
  const [service] = useState(() => new SRSService(storage, scheduler))

  const userId = activeUserId ?? 1

  const [decks, setDecks] = useState<{ id: number; name: string }[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isInitialising, setIsInitialising] = useState(true)

  // Form state
  const [front, setFront] = useState(editInitial?.front ?? '')
  const [back, setBack] = useState(editInitial?.back ?? '')
  const [reading, setReading] = useState(editInitial?.reading ?? '')
  const [deckId, setDeckId] = useState<number | null>(editInitial?.deckId ?? activeDeckId)
  const [tags, setTags] = useState(editInitial?.tags ?? '')
  const [note, setNote] = useState(editInitial?.note ?? '')
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [existingAudioUrl, setExistingAudioUrl] = useState<string | null>(editInitial?.audioUrl ?? null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const isEditing = editCardId != null

  useEffect(() => {
    void (async () => {
      try {
        const deckRows = await service.getDecks(userId)
        setDecks(deckRows)
        // If no deck set yet, default to active deck or first available
        if (deckId == null) {
          if (activeDeckId != null) {
            setDeckId(activeDeckId)
          } else if (deckRows.length > 0) {
            const defaultDeck = deckRows.find(d => d.name === 'Default') ?? deckRows[0]
            setDeckId(defaultDeck.id)
          } else {
            // Ensure Default deck exists
            const defaultId = await service.ensureDefaultDeck(userId)
            setDeckId(defaultId)
            const refreshed = await service.getDecks(userId)
            setDecks(refreshed)
          }
        }
      } finally {
        setIsInitialising(false)
      }
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!front.trim() || !back.trim()) {
      toast.error('Front and Back fields are required')
      return
    }

    setIsLoading(true)
    try {
      let resolvedDeckId = deckId
      if (resolvedDeckId == null) {
        resolvedDeckId = await service.ensureDefaultDeck(userId)
      }

      let audioUrl: string | null = existingAudioUrl ?? null

      // Handle audio upload
      if (audioFile) {
        const buf = await audioFile.arrayBuffer()
        const uint8 = new Uint8Array(buf)
        const filename = `user_${userId}_${Date.now()}_${audioFile.name}`
        await saveAudio(filename, uint8)
        audioUrl = `idb:${filename}`
      }

      if (isEditing && editCardId != null) {
        // Update existing card
        await service.updateCard(editCardId, {
          front: front.trim(),
          back: back.trim(),
          reading: reading.trim() || null,
        })
        toast.success('Card updated')
        onSaved?.()
      } else {
        // INSERT new card
        await service.createUserCard(userId, {
          front: front.trim(),
          back: back.trim(),
          reading: reading.trim() || null,
          deckId: resolvedDeckId,
          audioUrl,
        })
        toast.success('Card created')
        // Reset form
        setFront('')
        setBack('')
        setReading('')
        setTags('')
        setNote('')
        setAudioFile(null)
        setExistingAudioUrl(null)
        if (fileInputRef.current) fileInputRef.current.value = ''
      }
    } catch (err) {
      toast.error('Failed to save card')
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  if (isInitialising) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <div className="max-w-2xl mx-auto px-4 py-10 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  const formContent = (
    <form onSubmit={e => void handleSubmit(e)} className="flex flex-col gap-5">
      {/* Front */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="cc-front" className="text-sm font-semibold text-gray-700">
          Front <span className="text-red-500">*</span>
        </label>
        <input
          id="cc-front"
          type="text"
          value={front}
          onChange={e => setFront(e.target.value)}
          required
          lang="ja"
          placeholder="Japanese word or phrase"
          className="px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
        />
      </div>

      {/* Back */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="cc-back" className="text-sm font-semibold text-gray-700">
          Back (meaning) <span className="text-red-500">*</span>
        </label>
        <textarea
          id="cc-back"
          value={back}
          onChange={e => setBack(e.target.value)}
          required
          rows={3}
          placeholder="English meaning / definition"
          className="px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white resize-none"
        />
      </div>

      {/* Reading */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="cc-reading" className="text-sm font-medium text-gray-600">
          Reading <span className="text-gray-400 text-xs">(optional — kana)</span>
        </label>
        <input
          id="cc-reading"
          type="text"
          value={reading}
          onChange={e => setReading(e.target.value)}
          lang="ja"
          placeholder="ふりがな"
          className="px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
        />
      </div>

      {/* Deck */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="cc-deck" className="text-sm font-medium text-gray-600">
          Deck
        </label>
        {decks.length === 0 ? (
          <p className="text-sm text-gray-400 italic">No decks yet — will be added to Default deck</p>
        ) : (
          <select
            id="cc-deck"
            value={deckId ?? ''}
            onChange={e => setDeckId(e.target.value ? Number(e.target.value) : null)}
            className="px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
          >
            {decks.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* Tags */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="cc-tags" className="text-sm font-medium text-gray-600">
          Tags <span className="text-gray-400 text-xs">(optional, comma-separated)</span>
        </label>
        <input
          id="cc-tags"
          type="text"
          value={tags}
          onChange={e => setTags(e.target.value)}
          placeholder="N5, verbs, jlpt"
          className="px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
        />
      </div>

      {/* Personal note */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="cc-note" className="text-sm font-medium text-gray-600">
          Personal note <span className="text-gray-400 text-xs">(optional)</span>
        </label>
        <textarea
          id="cc-note"
          value={note}
          onChange={e => setNote(e.target.value)}
          rows={2}
          placeholder="Mnemonic, context, memory hook…"
          className="px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white resize-none"
        />
      </div>

      {/* Audio */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="cc-audio" className="text-sm font-medium text-gray-600">
          Audio <span className="text-gray-400 text-xs">(optional — mp3, m4a, wav)</span>
        </label>
        {existingAudioUrl && !audioFile && (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span>Existing audio attached</span>
            <button
              type="button"
              onClick={() => setExistingAudioUrl(null)}
              className="text-red-500 hover:text-red-700"
            >
              Remove
            </button>
          </div>
        )}
        <input
          id="cc-audio"
          ref={fileInputRef}
          type="file"
          accept="audio/mp3,audio/mpeg,audio/m4a,audio/wav,audio/*"
          onChange={e => setAudioFile(e.target.files?.[0] ?? null)}
          className="text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
        />
        {audioFile && (
          <p className="text-xs text-green-600">{audioFile.name} selected</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        {!isEditing && (
          <button
            type="button"
            onClick={() => navigate('/study/browser')}
            className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Browse Cards
          </button>
        )}
        <button
          type="submit"
          disabled={isLoading}
          className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? 'Saving…' : isEditing ? 'Save Changes' : 'Create Card'}
        </button>
      </div>
    </form>
  )

  // If used as inline edit form (from CardBrowser), skip nav/page wrapper
  if (isEditing && onSaved) {
    return (
      <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
        <p className="text-sm font-semibold text-gray-700 mb-4">Edit Card</p>
        {formContent}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Create Card</h1>
          <p className="text-sm text-gray-500 mt-1">Add a new flashcard to your collection</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          {formContent}
        </div>
      </div>
    </div>
  )
}
