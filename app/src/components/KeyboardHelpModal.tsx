/**
 * KeyboardHelpModal
 *
 * Press ? anywhere to open this overlay showing every registered keyboard
 * shortcut grouped by category. Mounted once near the app root.
 */

import { useEffect, useMemo, useState } from 'react'
import {
  getKeyboardShortcutManager,
  type KeyboardShortcut,
} from '../utils/keyboard-shortcuts'

const CATEGORY_ORDER: Array<KeyboardShortcut['category']> = [
  'review',
  'navigation',
  'management',
]

const CATEGORY_LABELS: Record<KeyboardShortcut['category'], string> = {
  review: 'Review',
  navigation: 'Navigation',
  management: 'Card management',
}

function formatKey(key: string): string {
  return key
    .replace('Ctrl+', '⌃ ')
    .replace('Cmd+', '⌘ ')
    .replace('Shift+', '⇧ ')
    .replace('Alt+', '⌥ ')
    .replace('Space', '␣')
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    target.isContentEditable
  )
}

export function KeyboardHelpModal() {
  const [open, setOpen] = useState(false)

  const shortcuts = useMemo(() => {
    if (!open) return [] as KeyboardShortcut[]
    return getKeyboardShortcutManager().getAllShortcuts()
  }, [open])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === '?' && !isTypingTarget(e.target)) {
        e.preventDefault()
        setOpen(prev => !prev)
        return
      }
      if (e.key === 'Escape' && open) {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (!open) return null

  const grouped = CATEGORY_ORDER.map(cat => ({
    cat,
    items: shortcuts.filter(s => s.category === cat),
  })).filter(g => g.items.length > 0)

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="keyboard-help-title"
      onClick={() => setOpen(false)}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-lg w-full max-h-[80vh] overflow-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
          <h2 id="keyboard-help-title" className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Keyboard shortcuts
          </h2>
          <button
            onClick={() => setOpen(false)}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-2xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="px-6 py-4 space-y-6">
          {grouped.map(({ cat, items }) => (
            <section key={cat}>
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                {CATEGORY_LABELS[cat]}
              </h3>
              <ul className="space-y-1">
                {items.map(s => (
                  <li
                    key={s.action}
                    className="flex items-center justify-between gap-4 py-2 px-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <span className="text-sm text-gray-700 dark:text-gray-200">{s.description}</span>
                    <span className="flex gap-1 flex-shrink-0">
                      {s.keys.map(k => (
                        <kbd
                          key={k}
                          className="px-2 py-1 text-xs font-mono bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded shadow-sm text-gray-700 dark:text-gray-200"
                        >
                          {formatKey(k)}
                        </kbd>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}

          <p className="text-xs text-gray-400 pt-2 border-t border-gray-100 dark:border-gray-800">
            Press <kbd className="px-1.5 py-0.5 font-mono bg-gray-100 dark:bg-gray-800 rounded border border-gray-300 dark:border-gray-600">?</kbd> any time to open this · <kbd className="px-1.5 py-0.5 font-mono bg-gray-100 dark:bg-gray-800 rounded border border-gray-300 dark:border-gray-600">Esc</kbd> to close · Rebind in Settings
          </p>
        </div>
      </div>
    </div>
  )
}
