export const BETA_ACCESS_KEY = 'kiroku-beta-access'

function canUseLocalStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function cookieValue() {
  if (typeof document === 'undefined') return null
  return document.cookie
    .split('; ')
    .find(row => row.startsWith(`${BETA_ACCESS_KEY}=`))
    ?.split('=')
    .slice(1)
    .join('=') || null
}

export function getBetaAccess() {
  if (canUseLocalStorage()) {
    const stored = window.localStorage.getItem(BETA_ACCESS_KEY)
    if (stored) return stored
  }
  return cookieValue()
}

export function setBetaAccess(value: 'granted' | 'open') {
  if (canUseLocalStorage()) {
    window.localStorage.setItem(BETA_ACCESS_KEY, value)
  }
  if (typeof document !== 'undefined') {
    document.cookie = `${BETA_ACCESS_KEY}=${value}; Max-Age=2592000; Path=/; SameSite=Lax`
  }
}
