/**
 * Keyboard Shortcuts Manager
 * Handles keyboard bindings for review and navigation
 */

export type ShortcutAction =
  | 'show-answer'
  | 'again'
  | 'hard'
  | 'good'
  | 'easy'
  | 'undo'
  | 'suspend'
  | 'bury'
  | 'delete'
  | 'search'
  | 'settings'
  | 'browse'
  | 'deck-switch'
  | 'next-card'
  | 'prev-card'

export interface KeyboardShortcut {
  action: ShortcutAction
  keys: string[]
  description: string
  category: 'review' | 'navigation' | 'management'
}

/**
 * Default keyboard shortcuts (Anki-compatible)
 */
export const DEFAULT_SHORTCUTS: KeyboardShortcut[] = [
  // Review actions
  {
    action: 'show-answer',
    keys: ['Space'],
    description: 'Show answer / Move to next card',
    category: 'review',
  },
  {
    action: 'again',
    keys: ['1'],
    description: 'Again (1 day)',
    category: 'review',
  },
  {
    action: 'hard',
    keys: ['2'],
    description: 'Hard',
    category: 'review',
  },
  {
    action: 'good',
    keys: ['3'],
    description: 'Good (default)',
    category: 'review',
  },
  {
    action: 'easy',
    keys: ['4'],
    description: 'Easy',
    category: 'review',
  },
  {
    action: 'undo',
    keys: ['Ctrl+Z', 'Cmd+Z'],
    description: 'Undo',
    category: 'review',
  },

  // Card management
  {
    action: 'suspend',
    keys: ['Ctrl+J', 'Cmd+J'],
    description: 'Suspend card',
    category: 'management',
  },
  {
    action: 'bury',
    keys: ['Ctrl+L', 'Cmd+L'],
    description: 'Bury card',
    category: 'management',
  },
  {
    action: 'delete',
    keys: ['Ctrl+Delete'],
    description: 'Delete card',
    category: 'management',
  },

  // Navigation
  {
    action: 'search',
    keys: ['Ctrl+F', 'Cmd+F'],
    description: 'Search',
    category: 'navigation',
  },
  {
    action: 'browse',
    keys: ['Ctrl+B', 'Cmd+B'],
    description: 'Open card browser',
    category: 'navigation',
  },
  {
    action: 'settings',
    keys: ['Ctrl+,', 'Cmd+,'],
    description: 'Open settings',
    category: 'navigation',
  },
  {
    action: 'deck-switch',
    keys: ['Ctrl+D', 'Cmd+D'],
    description: 'Switch deck',
    category: 'navigation',
  },
]

/**
 * Keyboard shortcut manager
 */
export class KeyboardShortcutManager {
  private shortcuts: Map<string, ShortcutAction> = new Map()
  private listeners: Map<ShortcutAction, Set<() => void>> = new Map()
  private customShortcuts: Map<ShortcutAction, string[]> = new Map()

  constructor(customShortcuts?: Partial<Record<ShortcutAction, string[]>>) {
    this.initializeShortcuts()

    if (customShortcuts) {
      this.customShortcuts = new Map(Object.entries(customShortcuts))
    }

    this.setupListeners()
  }

  /**
   * Initialize shortcuts map
   */
  private initializeShortcuts() {
    for (const shortcut of DEFAULT_SHORTCUTS) {
      for (const key of shortcut.keys) {
        this.shortcuts.set(key.toLowerCase(), shortcut.action)
      }
    }
  }

  /**
   * Setup global keyboard listeners
   */
  private setupListeners() {
    document.addEventListener('keydown', (e) => this.handleKeyDown(e))
  }

  /**
   * Handle keydown event
   */
  private handleKeyDown(e: KeyboardEvent) {
    const key = this.getKeyString(e)

    // Check custom shortcuts first
    for (const [action, keys] of this.customShortcuts) {
      if (keys.some((k) => k.toLowerCase() === key)) {
        this.triggerAction(action)
        e.preventDefault()
        return
      }
    }

    // Check default shortcuts
    const action = this.shortcuts.get(key)
    if (action) {
      this.triggerAction(action)
      e.preventDefault()
    }
  }

  /**
   * Convert keyboard event to key string
   */
  private getKeyString(e: KeyboardEvent): string {
    const parts: string[] = []

    if (e.ctrlKey) parts.push('ctrl')
    if (e.shiftKey) parts.push('shift')
    if (e.altKey) parts.push('alt')
    if (e.metaKey) parts.push('cmd')

    // Map special keys
    let key = e.key.toLowerCase()
    switch (key) {
      case ' ':
        key = 'space'
        break
      case 'enter':
        key = 'enter'
        break
      case 'backspace':
        key = 'backspace'
        break
      case 'delete':
        key = 'delete'
        break
      case 'arrowup':
        key = 'up'
        break
      case 'arrowdown':
        key = 'down'
        break
      case 'arrowleft':
        key = 'left'
        break
      case 'arrowright':
        key = 'right'
        break
    }

    // Single key shortcuts
    if (parts.length === 0) {
      return key
    }

    parts.push(key)
    return parts.join('+')
  }

  /**
   * Register action listener
   */
  public on(action: ShortcutAction, callback: () => void) {
    if (!this.listeners.has(action)) {
      this.listeners.set(action, new Set())
    }
    this.listeners.get(action)!.add(callback)

    return () => {
      this.listeners.get(action)!.delete(callback)
    }
  }

  /**
   * Trigger action
   */
  private triggerAction(action: ShortcutAction) {
    const callbacks = this.listeners.get(action)
    if (callbacks) {
      callbacks.forEach((callback) => callback())
    }
  }

  /**
   * Set custom shortcut
   */
  public setShortcut(action: ShortcutAction, keys: string[]) {
    this.customShortcuts.set(action, keys)

    // Update shortcuts map
    for (const key of keys) {
      this.shortcuts.set(key.toLowerCase(), action)
    }
  }

  /**
   * Get shortcut for action
   */
  public getShortcut(action: ShortcutAction): string[] {
    if (this.customShortcuts.has(action)) {
      return this.customShortcuts.get(action)!
    }

    const default_ = DEFAULT_SHORTCUTS.find((s) => s.action === action)
    return default_?.keys || []
  }

  /**
   * Get all shortcuts
   */
  public getAllShortcuts(): KeyboardShortcut[] {
    return DEFAULT_SHORTCUTS.map((shortcut) => ({
      ...shortcut,
      keys: this.getShortcut(shortcut.action),
    }))
  }

  /**
   * Reset to defaults
   */
  public resetToDefaults() {
    this.customShortcuts.clear()
    this.shortcuts.clear()
    this.initializeShortcuts()
  }
}

/**
 * Global keyboard shortcut manager instance
 */
let globalManager: KeyboardShortcutManager | null = null

export function getKeyboardShortcutManager(): KeyboardShortcutManager {
  if (!globalManager) {
    globalManager = new KeyboardShortcutManager()
  }
  return globalManager
}

/**
 * React hook for keyboard shortcuts
 */
export function useKeyboardShortcut(action: ShortcutAction, callback: () => void) {
  const manager = getKeyboardShortcutManager()

  React.useEffect(() => {
    const unsubscribe = manager.on(action, callback)
    return unsubscribe
  }, [action, callback, manager])

  return manager.getShortcut(action)
}

// Import React for the hook
import React from 'react'
