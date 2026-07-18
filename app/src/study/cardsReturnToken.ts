const STORAGE_PREFIX = 'kiroku-cards-return:'
const VERIFIED_PREFIX = 'kiroku-cards-verified:'

function storageKey(lessonId: string): string {
  return `${STORAGE_PREFIX}${lessonId}`
}

function verifiedKey(lessonId: string): string {
  return `${VERIFIED_PREFIX}${lessonId}`
}

/** Issue an opaque one-time token proving Cards review was started for this lesson. */
export function issueCardsReturnToken(lessonId: string, sessionId: number | string): string {
  if (typeof sessionStorage === 'undefined' || !lessonId) return ''
  const token =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`
  try {
    sessionStorage.removeItem(verifiedKey(lessonId))
    sessionStorage.setItem(
      storageKey(lessonId),
      JSON.stringify({ token, sessionId: String(sessionId) }),
    )
  } catch {
    /* quota / private mode */
  }
  return token
}

/**
 * Consume a cards-return token once. Returns true when the token matches
 * (or was already verified this browser session for the lesson). Survives
 * React Strict Mode remounts via a short-lived verified flag.
 */
export function consumeCardsReturnToken(lessonId: string, token: string | null | undefined): boolean {
  if (typeof sessionStorage === 'undefined' || !lessonId) return false
  try {
    if (sessionStorage.getItem(verifiedKey(lessonId)) === '1') return true
    if (!token) return false
    const raw = sessionStorage.getItem(storageKey(lessonId))
    if (!raw) return false
    const parsed = JSON.parse(raw) as { token?: string }
    if (parsed.token !== token) return false
    sessionStorage.removeItem(storageKey(lessonId))
    sessionStorage.setItem(verifiedKey(lessonId), '1')
    return true
  } catch {
    return false
  }
}

/** Clear token + verified flag (e.g. after lesson complete or tests). */
export function clearCardsReturnToken(lessonId: string): void {
  if (typeof sessionStorage === 'undefined' || !lessonId) return
  try {
    sessionStorage.removeItem(storageKey(lessonId))
    sessionStorage.removeItem(verifiedKey(lessonId))
  } catch {
    /* ignore */
  }
}
