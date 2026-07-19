/**
 * Staging security helpers — quotas, model allowlist, custom-provider key policy.
 */

export const AI_MAX_TOKENS_CAP = 4096
export const AI_QUOTA_WINDOW_MS = 60 * 60 * 1000
export const AI_QUOTA_MAX = 40
export const PDF_QUOTA_WINDOW_MS = 60 * 60 * 1000
export const PDF_QUOTA_MAX = 6
export const PDF_MAX_PAGES = 20
export const PDF_MAX_FILES = 3
export const REPORT_QUOTA_WINDOW_MS = 60 * 60 * 1000
export const REPORT_QUOTA_MAX = 10
export const BETA_LOGIN_WINDOW_MS = 15 * 60 * 1000
export const BETA_LOGIN_MAX_ATTEMPTS = 8

/** Default models the client ships with, plus common OpenRouter-style prefixes. */
const DEFAULT_MODEL_ALLOW =
  /^(claude-[\w.-]+|gpt-[\w.-]+|o[1-9][\w.-]*|deepseek-[\w.-]+|mistralai\/[\w./-]+|anthropic\/[\w./-]+|openai\/[\w./-]+|meta-llama\/[\w./-]+|google\/[\w./-]+|qwen[\w./-]*|llama[\w./-]*|gemma[\w./-]*|your-model-name)$/i

export type RateBucket = { count: number; resetAt: number }

export function checkRateBucket(
  buckets: Map<string, RateBucket>,
  key: string,
  windowMs: number,
  maxRequests: number,
  now = Date.now(),
): { ok: true } | { ok: false; retryAfterSec: number } {
  const bucket = buckets.get(key)
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true }
  }
  bucket.count += 1
  if (bucket.count > maxRequests) {
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) }
  }
  return { ok: true }
}

export function clampMaxTokens(value: unknown, cap = AI_MAX_TOKENS_CAP): number | undefined {
  if (value == null || value === '') return undefined
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return undefined
  return Math.min(Math.floor(n), cap)
}

export function parseAllowlist(raw: string | undefined): string[] {
  return (raw || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
}

/** Returns null when allowed; otherwise an error message. */
export function assertModelAllowed(
  model: string,
  envAllowlist = process.env.AI_MODEL_ALLOWLIST,
): string | null {
  const trimmed = model.trim()
  if (!trimmed || trimmed.length > 128) return 'Model name is invalid'
  if (/[\s<>"'`\\]/.test(trimmed)) return 'Model name is invalid'

  const exact = parseAllowlist(envAllowlist)
  if (exact.length > 0) {
    return exact.includes(trimmed) ? null : `Model not allowed: ${trimmed}`
  }
  return DEFAULT_MODEL_ALLOW.test(trimmed) ? null : `Model not allowed: ${trimmed}`
}

export function normalizeEndpoint(endpoint: string): string {
  const url = new URL(endpoint)
  // Drop trailing slash for comparison; keep path otherwise.
  const path = url.pathname.replace(/\/+$/, '') || ''
  return `${url.protocol}//${url.host}${path}${url.search}`
}

export interface CustomProviderResolution {
  endpoint: string
  apiKey: string | undefined
  usesServerKey: boolean
}

/**
 * Resolve custom provider endpoint + key.
 * Server CUSTOM_PROVIDER_API_KEY is only used when the endpoint is the configured
 * env endpoint (or on the CUSTOM_PROVIDER_ENDPOINTS allowlist). Client-supplied
 * URLs never receive the server key — caller must provide apiKey.
 */
export function resolveCustomProviderAuth(options: {
  requestEndpoint?: string
  requestApiKey?: string
  envEndpoint?: string
  envEndpointsAllowlist?: string
  envApiKey?: string
}): CustomProviderResolution {
  const envEndpoint = options.envEndpoint?.trim() || process.env.CUSTOM_PROVIDER_ENDPOINT?.trim()
  const envKey = options.envApiKey ?? process.env.CUSTOM_PROVIDER_API_KEY
  const explicitAllowlist = parseAllowlist(
    options.envEndpointsAllowlist ?? process.env.CUSTOM_PROVIDER_ENDPOINTS,
  )

  const requestEndpoint = options.requestEndpoint?.trim()
  const endpoint = requestEndpoint || envEndpoint
  if (!endpoint) {
    throw new Error('Custom provider endpoint not configured')
  }

  const normalized = normalizeEndpoint(endpoint)
  const trusted = new Set<string>()
  if (envEndpoint) {
    try {
      trusted.add(normalizeEndpoint(envEndpoint))
    } catch {
      /* ignore malformed env endpoint */
    }
  }
  for (const entry of explicitAllowlist) {
    try {
      trusted.add(normalizeEndpoint(entry))
    } catch {
      /* ignore malformed allowlist entries */
    }
  }

  // Explicit CUSTOM_PROVIDER_ENDPOINTS rejects unknown URLs.
  if (explicitAllowlist.length > 0 && !trusted.has(normalized)) {
    throw new Error('Custom provider endpoint is not on the server allowlist')
  }

  const isTrustedEndpoint = trusted.has(normalized)
  if (isTrustedEndpoint && envKey) {
    return { endpoint, apiKey: envKey, usesServerKey: true }
  }

  // Untrusted / client-only URL: never forward the server custom key.
  const clientKey = options.requestApiKey?.trim()
  if (!clientKey) {
    throw new Error(
      isTrustedEndpoint
        ? 'Custom provider API key not configured'
        : 'Custom provider requires a client API key for non-allowlisted endpoints',
    )
  }
  return { endpoint, apiKey: clientKey, usesServerKey: false }
}

export function sanitizeReportMetadata(input: unknown): Record<string, string | number | boolean | null> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {}
  const out: Record<string, string | number | boolean | null> = {}
  const entries = Object.entries(input as Record<string, unknown>).slice(0, 20)
  for (const [rawKey, value] of entries) {
    const key = String(rawKey).slice(0, 64)
    if (!key) continue
    if (typeof value === 'string') {
      out[key] = value.slice(0, 500)
    } else if (typeof value === 'number' && Number.isFinite(value)) {
      out[key] = value
    } else if (typeof value === 'boolean' || value === null) {
      out[key] = value
    } else {
      out[key] = String(value).slice(0, 200)
    }
  }
  return out
}

export function isDataPathAllowed(requestPath: string, production: boolean): boolean {
  if (requestPath.includes('..')) return false
  if (/\.apkg$/i.test(requestPath)) return false
  if (/\.sql$/i.test(requestPath)) return false
  if (!production) return true
  // Curriculum + assets only in production.
  return /\.(json|png|jpe?g|webp|gif|svg|mp3|m4a|wav|ogg|txt|md)$/i.test(requestPath)
}
