/**
 * Toast notification system
 *
 * Lightweight global toast renderer. Toast publishing lives in toastStore.ts
 * so this file only exports React components and keeps fast-refresh happy.
 */

import { useEffect, useState } from 'react'
import { getToasts, subscribeToasts, type Toast, type ToastKind } from './toastStore'

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
  const [items, setItems] = useState<Toast[]>(getToasts())

  useEffect(() => {
    return subscribeToasts(next => setItems([...next]))
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
