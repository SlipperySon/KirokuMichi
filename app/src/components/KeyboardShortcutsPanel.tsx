/**
 * KeyboardShortcutsPanel
 *
 * Lists every action exposed by the keyboard shortcut manager and lets the
 * user rebind any of them. Each row has a "Rebind" button — clicking it
 * captures the next keydown (modifiers + key) and saves the binding via the
 * manager's `setShortcut`, which also persists to localStorage.
 */

import { useEffect, useMemo, useState } from 'react'
import {
  getKeyboardShortcutManager,
  type KeyboardShortcut,
  type ShortcutAction,
} from '../utils/keyboard-shortcuts'

const CATEGORY_LABELS: Record<KeyboardShortcut['category'], string> = {
  review: 'Review',
  management: 'Card management',
  navigation: 'Navigation',
}

function eventToKeyString(e: KeyboardEvent): string | null {
  // Allow Escape to cancel the rebind flow
  if (e.key === 'Escape') return null

  const parts: string[] = []
  if (e.ctrlKey) parts.push('Ctrl')
  if (e.shiftKey) parts.push('Shift')
  if (e.altKey) parts.push('Alt')
  if (e.metaKey) parts.push('Cmd')

  let key = e.key
  if (key === ' ') key = 'Space'
  else if (key.length === 1) key = key.toLowerCase()
  // Don't allow bare modifier keys
  if (['Control', 'Shift', 'Alt', 'Meta'].includes(key)) return null

  parts.push(key)
  return parts.join('+')
}

export function KeyboardShortcutsPanel() {
  // Force re-render when bindings change
  const [version, setVersion] = useState(0)
  const [listeningFor, setListeningFor] = useState<ShortcutAction | null>(null)

  const manager = useMemo(() => getKeyboardShortcutManager(), [])
  const shortcuts = manager.getAllShortcuts()

  useEffect(() => {
    if (!listeningFor) return
    const onKey = (e: KeyboardEvent) => {
      // Intercept BEFORE the manager's own handler; we don't want the
      // captured combo to fire its existing action while we're capturing.
      e.preventDefault()
      e.stopPropagation()

      const captured = eventToKeyString(e)
      if (captured === null) {
        // Escape or bare-modifier — cancel
        setListeningFor(null)
        return
      }
      manager.setShortcut(listeningFor, [captured])
      setListeningFor(null)
      setVersion(v => v + 1)
    }
    // Capture phase so we run before the global manager listener.
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [listeningFor, manager])

  const grouped = useMemo(() => {
    const map = new Map<KeyboardShortcut['category'], KeyboardShortcut[]>()
    for (const s of shortcuts) {
      const arr = map.get(s.category) ?? []
      arr.push(s)
      map.set(s.category, arr)
    }
    return Array.from(map.entries())
    // version dependency tracked separately
  }, [shortcuts, version])

  const handleReset = () => {
    manager.resetToDefaults()
    setVersion(v => v + 1)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-100">Keyboard Shortcuts</h3>
        <button
          onClick={handleReset}
          className="text-xs text-gray-400 hover:text-red-400 transition-colors"
        >
          Reset to defaults
        </button>
      </div>

      {listeningFor && (
        <div className="bg-indigo-900/40 border border-indigo-500 rounded-lg p-3 text-sm text-indigo-100">
          Press a key combination for <strong>{listeningFor}</strong>…
          <span className="text-xs text-indigo-300 ml-2">(Esc to cancel)</span>
        </div>
      )}

      {grouped.map(([category, items]) => (
        <div key={category}>
          <p className="text-xs uppercase tracking-wide text-gray-400 font-semibold mb-2">
            {CATEGORY_LABELS[category]}
          </p>
          <div className="space-y-1">
            {items.map(shortcut => (
              <div
                key={shortcut.action}
                className="flex items-center justify-between gap-3 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-100 truncate">{shortcut.description}</p>
                  <p className="text-xs text-gray-500">{shortcut.action}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <code className="px-2 py-1 bg-gray-900 border border-gray-700 rounded text-xs text-gray-200 font-mono">
                    {shortcut.keys.join(' / ') || '(none)'}
                  </code>
                  <button
                    onClick={() =>
                      setListeningFor(prev => (prev === shortcut.action ? null : shortcut.action))
                    }
                    className={`text-xs font-medium px-3 py-1 rounded-lg transition-colors ${
                      listeningFor === shortcut.action
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                    }`}
                  >
                    {listeningFor === shortcut.action ? 'Listening…' : 'Rebind'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
