import { useState, useEffect } from 'react'
import { Plus, Trash2, Play } from 'lucide-react'
import { toast } from './toastStore'
import type { SRSService } from '../srs/srsService'

interface FilteredDeckRow {
  id: number
  name: string
  query: string
  cardLimit: number
}

interface FilteredDeckPanelProps {
  service: SRSService
  userId: number
  onStartCram: (cardIds: number[], deckName: string) => void
}

export function FilteredDeckPanel({ service, userId, onStartCram }: FilteredDeckPanelProps) {
  const [filteredDecks, setFilteredDecks] = useState<FilteredDeckRow[]>([])
  const [showNewForm, setShowNewForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newQuery, setNewQuery] = useState('')
  const [newLimit, setNewLimit] = useState(50)
  const [resolving, setResolving] = useState<number | null>(null)

  async function loadFilteredDecks() {
    const rows = await service.getFilteredDecks(userId)
    setFilteredDecks(rows)
  }

  useEffect(() => { void loadFilteredDecks() }, [userId])

  async function handleCreate() {
    const name = newName.trim()
    const query = newQuery.trim()
    if (!name || !query) { toast.error('Name and query are required'); return }
    await service.createFilteredDeck(userId, name, query, newLimit)
    setShowNewForm(false)
    setNewName('')
    setNewQuery('')
    setNewLimit(50)
    void loadFilteredDecks()
    toast.success(`Filtered deck "${name}" created`)
  }

  async function handleDelete(deck: FilteredDeckRow) {
    if (!window.confirm(`Delete filtered deck "${deck.name}"?`)) return
    await service.deleteFilteredDeck(deck.id)
    void loadFilteredDecks()
    toast.success(`Deleted "${deck.name}"`)
  }

  async function handleCram(deck: FilteredDeckRow) {
    setResolving(deck.id)
    try {
      const cards = await service.resolveFilteredDeck(deck.id, userId)
      if (cards.length === 0) {
        toast.info('No cards match this query right now')
        return
      }
      onStartCram(cards.map(c => c.cardStateId), deck.name)
    } finally {
      setResolving(null)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">Filtered Decks</h3>
        <button
          onClick={() => setShowNewForm(v => !v)}
          className="p-1 rounded text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
          title="New filtered deck"
          aria-label="Create new filtered deck"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {filteredDecks.length === 0 && !showNewForm && (
        <p className="text-xs text-gray-400 italic px-2">No filtered decks yet. Create one to save a search query.</p>
      )}

      {filteredDecks.map(deck => (
        <div
          key={deck.id}
          className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-100 group"
        >
          <span className="flex-1 truncate" title={`Query: ${deck.query}`}>
            {deck.name}
            <span className="ml-1 text-xs text-gray-400">≤{deck.cardLimit}</span>
          </span>
          <button
            onClick={() => void handleCram(deck)}
            disabled={resolving === deck.id}
            className="opacity-0 group-hover:opacity-100 p-1 rounded text-gray-400 hover:text-indigo-600 transition-opacity"
            title="Cram this filtered deck"
            aria-label="Cram filtered deck"
          >
            {resolving === deck.id
              ? <span className="h-3.5 w-3.5 inline-block border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
              : <Play className="h-3.5 w-3.5" />
            }
          </button>
          <button
            onClick={() => void handleDelete(deck)}
            className="opacity-0 group-hover:opacity-100 p-1 rounded text-gray-400 hover:text-red-600 transition-opacity"
            title="Delete filtered deck"
            aria-label="Delete filtered deck"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}

      {showNewForm && (
        <div className="border border-gray-200 rounded-xl p-3 flex flex-col gap-2 bg-gray-50">
          <input
            autoFocus
            type="text"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="Deck name"
            className="px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400"
          />
          <input
            type="text"
            value={newQuery}
            onChange={e => setNewQuery(e.target.value)}
            placeholder="Query, e.g.: is:due deck:Genki"
            className="px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400 font-mono"
          />
          <p className="text-xs text-gray-400">Tokens: <code>is:new</code> <code>is:due</code> <code>is:suspended</code> <code>deck:Name</code> free text (AND logic)</p>
          <label className="flex items-center gap-2 text-xs text-gray-600">
            Limit:
            <input
              type="range"
              min={10}
              max={200}
              step={10}
              value={newLimit}
              onChange={e => setNewLimit(Number(e.target.value))}
              className="flex-1 accent-indigo-600"
            />
            <span className="font-mono w-8 text-right">{newLimit}</span>
          </label>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowNewForm(false)} className="px-3 py-1 text-xs text-gray-500 hover:text-gray-700">Cancel</button>
            <button
              onClick={() => void handleCreate()}
              className="px-3 py-1 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              Create
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
