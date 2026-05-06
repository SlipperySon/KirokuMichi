import type { SessionRecoveryPayload } from '../study/types'

const RECOVERY_KEY = 'kiroku_michi_recovery'
const STALE_MS = 24 * 60 * 60 * 1000

export const SessionRecovery = {
  save(payload: SessionRecoveryPayload): void {
    localStorage.setItem(RECOVERY_KEY, JSON.stringify({ ...payload, savedAt: Date.now() }))
  },

  load(): SessionRecoveryPayload | null {
    const raw = localStorage.getItem(RECOVERY_KEY)
    if (!raw) return null
    try {
      return JSON.parse(raw) as SessionRecoveryPayload
    } catch {
      return null
    }
  },

  clear(): void {
    localStorage.removeItem(RECOVERY_KEY)
  },

  isStale(payload: SessionRecoveryPayload): boolean {
    return Date.now() - payload.savedAt > STALE_MS
  },
}
