/**
 * Session auth is HttpOnly-cookie based (`kiroku-session`).
 * Zustand only stores a non-secret readiness marker so UI/AI code knows a
 * cookie was minted — never the raw token (XSS must not be able to exfiltrate it).
 */
export const SESSION_COOKIE_READY = 'cookie'

export function markSessionReady(
  setSessionToken: (token: string) => void,
): typeof SESSION_COOKIE_READY {
  setSessionToken(SESSION_COOKIE_READY)
  return SESSION_COOKIE_READY
}

export async function ensureSessionCookie(
  setSessionToken: (token: string) => void,
): Promise<boolean> {
  const response = await fetch('/api/session', { method: 'POST', credentials: 'include' })
  if (!response.ok) return false
  markSessionReady(setSessionToken)
  return true
}
