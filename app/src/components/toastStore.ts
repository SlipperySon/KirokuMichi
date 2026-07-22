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
  for (const listener of listeners) listener(toasts)
}

function push(kind: ToastKind, message: string, duration = 2800) {
  const id = nextId++
  toasts = [...toasts, { id, kind, message, duration }]
  emit()
  if (typeof window === 'undefined') return
  window.setTimeout(() => {
    toasts = toasts.filter(toast => toast.id !== id)
    emit()
  }, duration)
}

export const toast = {
  success: (message: string, duration?: number) => push('success', message, duration),
  error: (message: string, duration?: number) => push('error', message, duration ?? 4500),
  info: (message: string, duration?: number) => push('info', message, duration),
}

export function getToasts() {
  return toasts
}

export function subscribeToasts(listener: Listener) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
