/**
 * Toast notification system
 *
 * Lightweight global toast manager — no external deps. Use `useToast()` to
 * push toasts from anywhere; render `<ToastContainer />` once near the root.
 *
 * Usage:
 *   const toast = useToast()
 *   toast.success('Settings saved')
 *   toast.error('Could not connect to AI')
 *   toast.info('Card added to drill queue')
 */

import { useEffect, useState } from 'react'

export type ToastKind = 'success' | 'error' | 'info'

export interface Toast {
  id: number
  kind: ToastKind
  message: string
  duration: number
}

type Listener = (toasts: Toast[]) => void

const listeners = new Set<Listener>()
let toasts: Toast[] = []
let nextId = 1

function emit() {
  for (const l of listeners) l(toasts)
}

function push(kind: ToastKind, message: string, duration = 2800) {
  const id = nextId++
  toasts = [...toasts, { id, kind, message, duration }]
  emit()
  window.setTimeout(() => {
    toasts = toasts.filter(t => t.id !== id)
    emit()
  }, duration)
}

export const toast = {
  success: (message: string, duration?: number) => push('success', message, duration),
  error: (message: string, duration?: number) => push('error', message, duration ?? 4500),
  info: (message: string, duration?: number) => push('info', message, duration),
}

export function useToast() {
  return toast
}

const KIND_STYLES: Record<ToastKind, { ring: string; bg: string; icon: string; iconLabel: string }> = {
  success: {
    ring: 'ring-green-200',
    bg: 'bg-white text-gray-900',
    icon: '✓',
    iconLabel: 'bg-green-100 text-green-700',
  },
  error: {
    ring: 'ring-red-200',
    bg: 'bg-white text-gray-900',
    icon: '!',
    iconLabel: 'bg-red-100 text-red-700',
  },
  info: {
    ring: 'ring-indigo-200',
    bg: 'bg-white text-gray-900',
    icon: 'i',
    iconLabel: 'bg-indigo-100 text-indigo-700',
  },
}

export function ToastContainer() {
  const [items, setItems] = useState<Toast[]>(toasts)

  useEffect(() => {
    const listener: Listener = next => setItems([...next])
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }, [])

  if (items.length === 0) return null

  return (
    <div
      className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 pointer-events-none"
      role="status"
      aria-live="polite"
      aria-atomic="false"
    >
      {items.map(t => {
        const s = KIND_STYLES[t.kind]
        return (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg ring-1 ${s.ring} ${s.bg} max-w-sm animate-[slideUp_180ms_ease-out]`}
          >
            <span
              aria-hidden
              className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ${s.iconLabel}`}
            >
              {s.icon}
            </span>
            <p className="text-sm">{t.message}</p>
          </div>
        )
      })}
    </div>
  )
}
