import { useState, useEffect, useMemo, useCallback } from 'react'
import { ChevronUp, ChevronDown, Search, X, ExternalLink } from 'lucide-react'
import { useAppStore } from '../store'
import { SQLiteStorage } from '../db/sqlite'
import { FSRSScheduler, SM2Scheduler } from '../core/scheduler'
import { SRSService } from '../srs/srsService'
import { Navigation } from '../components/Navigation'
import { toast } from '../components/toastStore'

type CardRow = {
  cardId: number
  cardStateId: number | null
  front: string
  back: string
  reading: string | null
  deckId: number | null
  deckName: string | null
  state: string | null
  due: string | null
  stability: number | null
  reps: number | null
  suspended: boolean | number
  tags: string | null
  userNote: string | null
  originType: string | null
  originRef: string | null
}

type SortKey = 'front' | 'back' | 'deckName' | 'state' | 'due' | 'stability' | 'reps'
type SortDir = 'asc' | 'desc'

const PAGE_SIZE = 50

function stateLabel(row: CardRow): string {
  if (row.suspended) return 'Suspended'
  return row.state ?? 'New'
}

function stateBadge(row: CardRow): string {
  if (row.suspended) return 'bg-gray-100 text-gray-500'
  switch (row.state) {
    case 'new': return 'bg-green-100 text-green-700'
    case 'learning': return 'bg-amber-100 text-amber-700'
    case 'review': return 'bg-blue-100 text-blue-700'
    case 'relearning': return 'bg-orange-100 text-orange-700'
    default: return 'bg-gray-100 text-gray-600'
  }
}

function formatDue(due: string | null): string {
  if (!due) return '—'
  const d = new Date(due)
  const now = new Date()
  const diffDays = Math.round((d.getTime() - now.getTime()) / 86400000)
  if (diffDays < 0) return `${-diffDays}d ago`
  if (diffDays === 0) return 'Today'
  return `in ${diffDays}d`
}

function formatOrigin(row: CardRow): string {
  const type = row.originType?.replace(/_/g, ' ') ?? 'unknown'
  return row.originRef ? `${type}: ${row.originRef}` : type
}

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (col !== sortKey) return <ChevronDown className="h-3 w-3 text-gray-300" />
  return sortDir === 'asc'
    ? <ChevronUp className="h-3.5 w-3.5 text-indigo-500" />
    : <ChevronDown className="h-3.5 w-3.5 text-indigo-500" />
}

interface EditFormProps {
  card: CardRow
  onSave: (fields: { front: string; back: string; reading: string; tags: string; userNote: string }) => Promise<void>
  onCancel: () => void
}

function EditForm({ card, onSave, onCancel }: EditFormProps) {
  const [front, setFront] = useState(card.front)
  const [back, setBack] = useState(card.back)
  const [reading, setReading] = useState(card.reading ?? '')
  const [tags, setTags] = useState(card.tags ?? '')
  const [userNote, setUserNote] = useState(card.userNote ?? '')

  return (
    <div className="flex flex-col gap-3 p-4 bg-gray-50 rounded-xl border border-gray-200">
      <p className="text-sm font-semibold text-gray-700">Edit card</p>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-gray-500">Front</span>
        <input
          value={front}
          onChange={e => setFront(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400"
          lang="ja"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-gray-500">Back (meaning)</span>
        <input
          value={back}
          onChange={e => setBack(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-gray-500">Reading</span>
        <input
          value={reading}
          onChange={e => setReading(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400"
          lang="ja"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-gray-500">Tags</span>
        <input
          value={tags}
          onChange={e => setTags(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-gray-500">Personal note</span>
        <textarea
          value={userNote}
          onChange={e => setUserNote(e.target.value)}
          rows={2}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400 resize-none"
        />
      </label>
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
        <button
          onClick={() => void onSave({ front, back, reading, tags, userNote })}
          className="px-4 py-1.5 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700"
        >
          Save
        </button>
      </div>
    </div>
  )
}

export function CardBrowser() {
  const settings = useAppStore(s => s.settings)
  const activeUserId = useAppStore(s => s.activeUserId)
  const activeDeckId = useAppStore(s => s.activeDeckId)

  const [storage] = useState(() => new SQLiteStorage())
  const scheduler = settings.schedulerAlgorithm === 'fsrs' ? new FSRSScheduler() : new SM2Scheduler()
  const [service] = useState(() => new SRSService(storage, scheduler))

  const [allCards, setAllCards] = useState<CardRow[]>([])
  const [decks, setDecks] = useState<{ id: number; name: string }[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const [searchText, setSearchText] = useState('')
  const [deckFilter, setDeckFilter] = useState<number | null>(activeDeckId)
  const [stateFilter, setStateFilter] = useState<string>('all')
  const [sortKey, setSortKey] = useState<SortKey>('front')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [page, setPage] = useState(0)

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [selectedCard, setSelectedCard] = useState<CardRow | null>(null)
  const [editingCard, setEditingCard] = useState<CardRow | null>(null)
  const [bulkDeckTarget, setBulkDeckTarget] = useState<number | null>(null)
  const [showBulkMoveDropdown, setShowBulkMoveDropdown] = useState(false)

  const userId = activeUserId ?? 1

  const loadCards = useCallback(async () => {
    setIsLoading(true)
    const [cards, deckRows] = await Promise.all([
      service.getAllCards(userId),
      service.getDecks(userId),
    ])
    setAllCards(cards as CardRow[])
    setDecks(deckRows)
    setIsLoading(false)
  }, [service, userId])

  useEffect(() => { void loadCards() }, [loadCards])

  const filtered = useMemo(() => {
    let rows = allCards
    if (searchText.trim()) {
      const q = searchText.trim().toLowerCase()
      rows = rows.filter(r => r.front.toLowerCase().includes(q) || r.back.toLowerCase().includes(q))
    }
    if (deckFilter != null) {
      rows = rows.filter(r => r.deckId === deckFilter)
    }
    if (stateFilter !== 'all') {
      if (stateFilter === 'suspended') {
        rows = rows.filter(r => r.suspended)
      } else {
        rows = rows.filter(r => !r.suspended && r.state === stateFilter)
      }
    }
    return rows
  }, [allCards, searchText, deckFilter, stateFilter])

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let av: string | number | null = null
      let bv: string | number | null = null
      switch (sortKey) {
        case 'front': av = a.front; bv = b.front; break
        case 'back': av = a.back; bv = b.back; break
        case 'deckName': av = a.deckName ?? ''; bv = b.deckName ?? ''; break
        case 'state': av = stateLabel(a); bv = stateLabel(b); break
        case 'due': av = a.due ?? ''; bv = b.due ?? ''; break
        case 'stability': av = a.stability ?? -1; bv = b.stability ?? -1; break
        case 'reps': av = a.reps ?? 0; bv = b.reps ?? 0; break
      }
      const cmp = typeof av === 'number' && typeof bv === 'number'
        ? av - bv
        : String(av ?? '').localeCompare(String(bv ?? ''))
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [filtered, sortKey, sortDir])

  const pageCount = Math.ceil(sorted.length / PAGE_SIZE)
  const pageRows = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
    setPage(0)
  }

  function toggleSelect(id: number) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (selectedIds.size === pageRows.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(pageRows.map(r => r.cardId)))
    }
  }

  async function handleSuspendSelected() {
    if (selectedIds.size === 0) return
    for (const row of allCards.filter(r => selectedIds.has(r.cardId))) {
      if (row.cardStateId != null) await service.suspendCard(userId, row.cardStateId)
    }
    toast.success(`Suspended ${selectedIds.size} card${selectedIds.size === 1 ? '' : 's'}`)
    setSelectedIds(new Set())
    void loadCards()
  }

  async function handleBurySelected() {
    if (selectedIds.size === 0) return
    for (const row of allCards.filter(r => selectedIds.has(r.cardId))) {
      if (row.cardStateId != null) await service.buryCard(userId, row.cardStateId)
    }
    toast.success(`Buried ${selectedIds.size} card${selectedIds.size === 1 ? '' : 's'} until tomorrow`)
    setSelectedIds(new Set())
    void loadCards()
  }

  async function handleMoveSelected(targetDeckId: number) {
    if (selectedIds.size === 0) return
    await service.moveToDeck([...selectedIds], targetDeckId)
    const deckName = decks.find(d => d.id === targetDeckId)?.name ?? 'deck'
    toast.success(`Moved ${selectedIds.size} card${selectedIds.size === 1 ? '' : 's'} to "${deckName}"`)
    setSelectedIds(new Set())
    setShowBulkMoveDropdown(false)
    void loadCards()
  }

  async function handleDeleteSelected() {
    if (selectedIds.size === 0) return
    if (!window.confirm(`Delete ${selectedIds.size} card${selectedIds.size === 1 ? '' : 's'}? This cannot be undone.`)) return
    await service.deleteCards([...selectedIds])
    toast.success(`Deleted ${selectedIds.size} card${selectedIds.size === 1 ? '' : 's'}`)
    setSelectedIds(new Set())
    setSelectedCard(null)
    void loadCards()
  }

  async function handleSaveEdit(fields: { front: string; back: string; reading: string; tags: string; userNote: string }) {
    if (!editingCard) return
    await service.updateCard(editingCard.cardId, {
      front: fields.front,
      back: fields.back,
      reading: fields.reading || null,
      tags: fields.tags || null,
      userNote: fields.userNote || null,
    })
    toast.success('Card updated')
    setEditingCard(null)
    void loadCards()
  }

  const colHeader = (key: SortKey, label: string) => (
    <button
      onClick={() => toggleSort(key)}
      className="flex items-center gap-1 text-xs font-semibold text-gray-500 uppercase tracking-wide hover:text-gray-800 transition-colors"
    >
      {label}
      <SortIcon col={key} sortKey={sortKey} sortDir={sortDir} />
    </button>
  )

  return (
    <div className="flex flex-col min-h-screen">
      <Navigation />
      <main className="flex flex-col gap-4 px-4 py-6 sm:p-6 max-w-6xl mx-auto w-full flex-1">
        <h1 className="text-2xl font-bold text-gray-900">Card Browser</h1>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-end">
          <div className="relative flex-1 min-w-40">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            <input
              type="search"
              value={searchText}
              onChange={e => { setSearchText(e.target.value); setPage(0) }}
              placeholder="Search front/back…"
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
          </div>
          <select
            value={deckFilter ?? ''}
            onChange={e => { setDeckFilter(e.target.value ? Number(e.target.value) : null); setPage(0) }}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-200"
          >
            <option value="">All decks</option>
            {decks.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <select
            value={stateFilter}
            onChange={e => { setStateFilter(e.target.value); setPage(0) }}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-200"
          >
            <option value="all">All states</option>
            <option value="new">New</option>
            <option value="learning">Learning</option>
            <option value="review">Review</option>
            <option value="suspended">Suspended</option>
          </select>
          <span className="text-sm text-gray-400">{sorted.length} cards</span>
        </div>

        {/* Bulk actions */}
        {selectedIds.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-2">
            <span className="text-sm font-semibold text-indigo-800">{selectedIds.size} selected</span>
            <button onClick={() => void handleSuspendSelected()} className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">Suspend</button>
            <button onClick={() => void handleBurySelected()} className="px-3 py-1 text-xs bg-amber-100 text-amber-800 rounded-lg hover:bg-amber-200">Bury</button>
            <div className="relative">
              <button
                onClick={() => setShowBulkMoveDropdown(v => !v)}
                className="px-3 py-1 text-xs bg-blue-100 text-blue-800 rounded-lg hover:bg-blue-200"
              >
                Move to deck ▾
              </button>
              {showBulkMoveDropdown && (
                <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20 min-w-40 py-1">
                  {decks.map(d => (
                    <button
                      key={d.id}
                      onClick={() => void handleMoveSelected(d.id)}
                      className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50"
                    >
                      {d.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button onClick={() => void handleDeleteSelected()} className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded-lg hover:bg-red-200">Delete</button>
            <button onClick={() => setSelectedIds(new Set())} className="ml-auto text-xs text-gray-400 hover:text-gray-600">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <div className="flex gap-4">
          {/* Table */}
          <div className="flex-1 min-w-0 overflow-x-auto">
            {isLoading ? (
              <div className="text-center py-12 text-gray-400">Loading…</div>
            ) : sorted.length === 0 ? (
              <div className="text-center py-12 text-gray-400">No cards match your filters</div>
            ) : (
              <>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="pb-2 pr-3 text-left w-8">
                        <input
                          type="checkbox"
                          checked={selectedIds.size === pageRows.length && pageRows.length > 0}
                          onChange={toggleSelectAll}
                          className="accent-indigo-600"
                        />
                      </th>
                      <th className="pb-2 pr-3 text-left">{colHeader('front', 'Front')}</th>
                      <th className="pb-2 pr-3 text-left hidden sm:table-cell">{colHeader('back', 'Back')}</th>
                      <th className="pb-2 pr-3 text-left hidden md:table-cell">{colHeader('deckName', 'Deck')}</th>
                      <th className="pb-2 pr-3 text-left">{colHeader('state', 'State')}</th>
                      <th className="pb-2 pr-3 text-left hidden lg:table-cell">{colHeader('due', 'Due')}</th>
                      <th className="pb-2 text-left hidden lg:table-cell">{colHeader('stability', 'Interval')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map(row => (
                      <tr
                        key={row.cardId}
                        onClick={() => setSelectedCard(row === selectedCard ? null : row)}
                        className={`border-b border-gray-100 cursor-pointer transition-colors ${
                          selectedCard?.cardId === row.cardId ? 'bg-indigo-50' : 'hover:bg-gray-50'
                        }`}
                      >
                        <td className="py-2 pr-3" onClick={e => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedIds.has(row.cardId)}
                            onChange={() => toggleSelect(row.cardId)}
                            className="accent-indigo-600"
                          />
                        </td>
                        <td className="py-2 pr-3 font-medium text-gray-900 truncate max-w-32" lang="ja">{row.front}</td>
                        <td className="py-2 pr-3 text-gray-600 truncate max-w-40 hidden sm:table-cell">{row.back}</td>
                        <td className="py-2 pr-3 text-gray-500 text-xs truncate hidden md:table-cell">{row.deckName ?? '—'}</td>
                        <td className="py-2 pr-3">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${stateBadge(row)}`}>
                            {stateLabel(row)}
                          </span>
                        </td>
                        <td className="py-2 pr-3 text-gray-500 text-xs hidden lg:table-cell">{formatDue(row.due)}</td>
                        <td className="py-2 text-gray-500 text-xs hidden lg:table-cell">
                          {row.stability != null ? `${Math.round(row.stability)}d` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Pagination */}
                {pageCount > 1 && (
                  <div className="flex items-center gap-2 mt-4 justify-center">
                    <button
                      onClick={() => setPage(p => Math.max(0, p - 1))}
                      disabled={page === 0}
                      className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50"
                    >
                      ← Prev
                    </button>
                    <span className="text-sm text-gray-500">
                      Page {page + 1} of {pageCount}
                    </span>
                    <button
                      onClick={() => setPage(p => Math.min(pageCount - 1, p + 1))}
                      disabled={page >= pageCount - 1}
                      className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50"
                    >
                      Next →
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Preview pane */}
          {selectedCard && (
            <div className="w-72 flex-shrink-0 bg-white border border-gray-200 rounded-xl p-4 flex flex-col gap-3 self-start sticky top-4">
              <div className="flex items-start justify-between">
                <p className="text-sm font-semibold text-gray-700">Card detail</p>
                <button onClick={() => setSelectedCard(null)} className="text-gray-400 hover:text-gray-600">
                  <X className="h-4 w-4" />
                </button>
              </div>

              {editingCard?.cardId === selectedCard.cardId ? (
                <EditForm
                  card={selectedCard}
                  onSave={handleSaveEdit}
                  onCancel={() => setEditingCard(null)}
                />
              ) : (
                <>
                  <div className="space-y-2">
                    <div>
                      <p className="text-xs text-gray-400">Front</p>
                      <p className="text-lg font-bold text-gray-900" lang="ja">{selectedCard.front}</p>
                    </div>
                    {selectedCard.reading && (
                      <div>
                        <p className="text-xs text-gray-400">Reading</p>
                        <p className="text-sm text-indigo-600" lang="ja">{selectedCard.reading}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-xs text-gray-400">Back</p>
                      <p className="text-sm text-gray-700">{selectedCard.back}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Deck</p>
                      <p className="text-sm text-gray-600">{selectedCard.deckName ?? '—'}</p>
                    </div>
                    {(selectedCard.originType || selectedCard.originRef) && (
                      <div>
                        <p className="text-xs text-gray-400">Origin</p>
                        <p className="text-sm text-gray-600">{formatOrigin(selectedCard)}</p>
                      </div>
                    )}
                    {selectedCard.tags && (
                      <div>
                        <p className="text-xs text-gray-400">Tags</p>
                        <p className="text-sm text-gray-600">{selectedCard.tags}</p>
                      </div>
                    )}
                    {selectedCard.userNote && (
                      <div>
                        <p className="text-xs text-gray-400">Personal note</p>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedCard.userNote}</p>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-xs text-gray-400">State</p>
                        <span className={`inline-block mt-0.5 px-2 py-0.5 rounded-full text-xs font-medium ${stateBadge(selectedCard)}`}>
                          {stateLabel(selectedCard)}
                        </span>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">Due</p>
                        <p className="text-sm text-gray-600 mt-0.5">{formatDue(selectedCard.due)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">Interval</p>
                        <p className="text-sm text-gray-600 mt-0.5">
                          {selectedCard.stability != null ? `${Math.round(selectedCard.stability)}d` : '—'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">Reviews</p>
                        <p className="text-sm text-gray-600 mt-0.5">{selectedCard.reps ?? 0}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditingCard(selectedCard)}
                      className="flex-1 px-3 py-2 text-sm bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 font-medium transition-colors"
                    >
                      Edit card
                    </button>
                    <a
                      href={`https://jisho.org/search/${encodeURIComponent(selectedCard.front)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Look up in Jisho"
                      className="inline-flex items-center justify-center px-3 py-2 text-sm bg-gray-50 text-gray-600 rounded-lg hover:bg-gray-100 border border-gray-200 transition-colors"
                    >
                      <ExternalLink className="h-4 w-4" aria-hidden />
                    </a>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
