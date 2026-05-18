import { useState } from 'react'
import { ChevronRight, ChevronDown, Plus, Pencil, Trash2 } from 'lucide-react'
import { useAppStore } from '../store'
import { toast } from './toastStore'
import type { SRSService } from '../srs/srsService'

interface DeckRow {
  id: number
  name: string
  parentId: number | null
  cardCount: number
}

interface DeckNode extends DeckRow {
  children: DeckNode[]
}

function buildTree(decks: DeckRow[]): DeckNode[] {
  const byId = new Map<number, DeckNode>()
  for (const d of decks) byId.set(d.id, { ...d, children: [] })
  const roots: DeckNode[] = []
  for (const node of byId.values()) {
    if (node.parentId == null) {
      roots.push(node)
    } else {
      const parent = byId.get(node.parentId)
      if (parent) parent.children.push(node)
      else roots.push(node)
    }
  }
  return roots
}

interface DeckNodeViewProps {
  node: DeckNode
  activeDeckId: number | null
  depth: number
  onSelect: (id: number | null) => void
  onAddChild: (parentId: number) => void
  onRename: (node: DeckNode) => void
  onDelete: (node: DeckNode) => void
}

function DeckNodeView({
  node, activeDeckId, depth, onSelect, onAddChild, onRename, onDelete,
}: DeckNodeViewProps) {
  const [expanded, setExpanded] = useState(true)
  const [showMenu, setShowMenu] = useState(false)
  const isActive = activeDeckId === node.id

  return (
    <div>
      <div
        className={`flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm cursor-pointer select-none transition-colors group
          ${isActive ? 'bg-indigo-100 text-indigo-900' : 'text-gray-700 hover:bg-gray-100'}`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        {node.children.length > 0 ? (
          <button
            onClick={() => setExpanded(v => !v)}
            className="p-0.5 text-gray-400 hover:text-gray-600 flex-shrink-0"
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded
              ? <ChevronDown className="h-3.5 w-3.5" />
              : <ChevronRight className="h-3.5 w-3.5" />
            }
          </button>
        ) : (
          <span className="w-5 flex-shrink-0" />
        )}

        <button
          className="flex-1 text-left truncate"
          onClick={() => onSelect(isActive ? null : node.id)}
        >
          {node.name}
          <span className="ml-1.5 text-xs text-gray-400">{node.cardCount}</span>
        </button>

        {/* Card options */}
        <div className="relative flex-shrink-0">
          <button
            onClick={() => setShowMenu(v => !v)}
            className="opacity-0 group-hover:opacity-100 p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition-opacity"
            aria-label="Deck options"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>

        <button
          onClick={() => onAddChild(node.id)}
          className="opacity-0 group-hover:opacity-100 p-1 rounded text-gray-400 hover:text-indigo-600 transition-opacity"
          aria-label="Add sub-deck"
          title="Add sub-deck"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>

        <button
          onClick={() => onRename(node)}
          className="opacity-0 group-hover:opacity-100 p-1 rounded text-gray-400 hover:text-amber-600 transition-opacity"
          aria-label="Rename deck"
          title="Rename"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>

        <button
          onClick={() => onDelete(node)}
          className="opacity-0 group-hover:opacity-100 p-1 rounded text-gray-400 hover:text-red-600 transition-opacity"
          aria-label="Delete deck"
          title="Delete"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {expanded && node.children.map(child => (
        <DeckNodeView
          key={child.id}
          node={child}
          activeDeckId={activeDeckId}
          depth={depth + 1}
          onSelect={onSelect}
          onAddChild={onAddChild}
          onRename={onRename}
          onDelete={onDelete}
        />
      ))}
    </div>
  )
}

interface DeckTreeProps {
  decks: DeckRow[]
  service: SRSService
  userId: number
  onDecksChanged: () => void
}

export function DeckTree({ decks, service, userId, onDecksChanged }: DeckTreeProps) {
  const activeDeckId = useAppStore(s => s.activeDeckId)
  const setActiveDeckId = useAppStore(s => s.setActiveDeckId)

  const [newDeckName, setNewDeckName] = useState('')
  const [newDeckParentId, setNewDeckParentId] = useState<number | null>(null)
  const [showNewDeckForm, setShowNewDeckForm] = useState(false)
  const [renamingDeck, setRenamingDeck] = useState<DeckRow | null>(null)
  const [renameValue, setRenameValue] = useState('')

  const tree = buildTree(decks)

  async function handleAddChild(parentId: number) {
    setNewDeckParentId(parentId)
    setShowNewDeckForm(true)
    setNewDeckName('')
  }

  async function handleCreateDeck() {
    const name = newDeckName.trim()
    if (!name) return
    await service.createDeck(userId, name, newDeckParentId ?? undefined)
    setShowNewDeckForm(false)
    setNewDeckName('')
    setNewDeckParentId(null)
    onDecksChanged()
    toast.success(`Deck "${name}" created`)
  }

  async function handleRename(node: DeckRow) {
    setRenamingDeck(node)
    setRenameValue(node.name)
  }

  async function handleRenameSubmit() {
    if (!renamingDeck) return
    const name = renameValue.trim()
    if (!name) return
    await service.renameDeck(renamingDeck.id, name)
    setRenamingDeck(null)
    onDecksChanged()
    toast.success(`Renamed to "${name}"`)
  }

  async function handleDelete(node: DeckRow) {
    if (node.name === 'Default') {
      toast.error('Cannot delete the Default deck')
      return
    }
    if (!window.confirm(`Delete deck "${node.name}"? Cards will be moved to Default.`)) return
    await service.deleteDeck(node.id, userId)
    if (activeDeckId === node.id) setActiveDeckId(null)
    onDecksChanged()
    toast.success(`Deck "${node.name}" deleted`)
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">Decks</h3>
        <button
          onClick={() => { setNewDeckParentId(null); setShowNewDeckForm(true); setNewDeckName('') }}
          className="p-1 rounded text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
          title="New deck"
          aria-label="Create new deck"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {/* All decks option */}
      <button
        onClick={() => setActiveDeckId(null)}
        className={`text-left px-2 py-1.5 rounded-lg text-sm transition-colors ${
          activeDeckId === null ? 'bg-indigo-100 text-indigo-900 font-semibold' : 'text-gray-700 hover:bg-gray-100'
        }`}
      >
        All decks
        <span className="ml-1.5 text-xs text-gray-400">{decks.reduce((sum, d) => sum + d.cardCount, 0)}</span>
      </button>

      {tree.map(node => (
        <DeckNodeView
          key={node.id}
          node={node}
          activeDeckId={activeDeckId}
          depth={0}
          onSelect={setActiveDeckId}
          onAddChild={handleAddChild}
          onRename={handleRename}
          onDelete={handleDelete}
        />
      ))}

      {/* New deck form */}
      {showNewDeckForm && (
        <div className="flex gap-2 mt-1">
          <input
            autoFocus
            type="text"
            value={newDeckName}
            onChange={e => setNewDeckName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') void handleCreateDeck(); if (e.key === 'Escape') setShowNewDeckForm(false) }}
            placeholder={newDeckParentId ? 'Sub-deck name…' : 'New deck name…'}
            className="flex-1 min-w-0 px-2 py-1 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400"
          />
          <button
            onClick={() => void handleCreateDeck()}
            className="px-3 py-1 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700"
          >
            Create
          </button>
          <button
            onClick={() => setShowNewDeckForm(false)}
            className="px-2 py-1 text-gray-500 text-sm hover:text-gray-700"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Rename form */}
      {renamingDeck && (
        <div className="flex gap-2 mt-1">
          <input
            autoFocus
            type="text"
            value={renameValue}
            onChange={e => setRenameValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') void handleRenameSubmit(); if (e.key === 'Escape') setRenamingDeck(null) }}
            className="flex-1 min-w-0 px-2 py-1 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400"
          />
          <button onClick={() => void handleRenameSubmit()} className="px-3 py-1 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700">
            Save
          </button>
          <button onClick={() => setRenamingDeck(null)} className="px-2 py-1 text-gray-500 text-sm">
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}
