import { describe, expect, it } from 'vitest'
import {
  assertModelAllowed,
  checkRateBucket,
  clampMaxTokens,
  inviteCodeMatches,
  isDataPathAllowed,
  resolveCustomProviderAuth,
  sanitizeReportMetadata,
  sanitizeUpstreamError,
} from './securityGuards'

describe('clampMaxTokens', () => {
  it('caps oversized values', () => {
    expect(clampMaxTokens(99999)).toBe(4096)
  })

  it('returns undefined for invalid input', () => {
    expect(clampMaxTokens('nope')).toBeUndefined()
    expect(clampMaxTokens(-1)).toBeUndefined()
  })
})

describe('assertModelAllowed', () => {
  it('allows default client models', () => {
    expect(assertModelAllowed('claude-haiku-4-5-20251001', '')).toBeNull()
    expect(assertModelAllowed('gpt-4', '')).toBeNull()
    expect(assertModelAllowed('deepseek-v4-flash', '')).toBeNull()
    expect(assertModelAllowed('anthropic/claude-3-sonnet', '')).toBeNull()
  })

  it('rejects odd models unless env allowlists them', () => {
    expect(assertModelAllowed('totally-custom-billable', '')).toMatch(/not allowed/)
    expect(assertModelAllowed('totally-custom-billable', 'totally-custom-billable')).toBeNull()
  })
})

describe('resolveCustomProviderAuth', () => {
  it('rejects non-allowlisted endpoints when allowlist is set', () => {
    expect(() =>
      resolveCustomProviderAuth({
        requestEndpoint: 'https://evil.example/v1/chat/completions',
        requestApiKey: 'client-key',
        envEndpoint: 'https://trusted.example/v1/chat/completions',
        envApiKey: 'server-secret',
        envEndpointsAllowlist: 'https://trusted.example/v1/chat/completions',
      }),
    ).toThrow(/allowlist/)
  })

  it('uses the server key only for the configured endpoint', () => {
    const resolved = resolveCustomProviderAuth({
      requestEndpoint: 'https://trusted.example/v1/chat/completions',
      requestApiKey: 'client-key',
      envEndpoint: 'https://trusted.example/v1/chat/completions',
      envApiKey: 'server-secret',
    })
    expect(resolved.apiKey).toBe('server-secret')
    expect(resolved.usesServerKey).toBe(true)
  })

  it('requires a client key when the URL is not trusted', () => {
    expect(() =>
      resolveCustomProviderAuth({
        requestEndpoint: 'https://other.example/v1/chat/completions',
        envApiKey: 'server-secret',
      }),
    ).toThrow(/client API key/)
  })

  it('allows a client URL with a client key when no explicit allowlist is set', () => {
    const resolved = resolveCustomProviderAuth({
      requestEndpoint: 'https://other.example/v1/chat/completions',
      requestApiKey: 'client-key',
      envEndpoint: 'https://trusted.example/v1/chat/completions',
      envApiKey: 'server-secret',
    })
    expect(resolved.apiKey).toBe('client-key')
    expect(resolved.usesServerKey).toBe(false)
  })
})

describe('checkRateBucket', () => {
  it('blocks after the max within the window', () => {
    const buckets = new Map()
    const now = 1_000_000
    expect(checkRateBucket(buckets, 'ip', 60_000, 2, now).ok).toBe(true)
    expect(checkRateBucket(buckets, 'ip', 60_000, 2, now + 1).ok).toBe(true)
    const blocked = checkRateBucket(buckets, 'ip', 60_000, 2, now + 2)
    expect(blocked.ok).toBe(false)
    if (!blocked.ok) expect(blocked.retryAfterSec).toBeGreaterThan(0)
  })
})

describe('sanitizeReportMetadata', () => {
  it('keeps only shallow primitive-ish values', () => {
    expect(
      sanitizeReportMetadata({
        route: '/study',
        nested: { a: 1 },
        n: 3,
        ok: true,
      }),
    ).toEqual({
      route: '/study',
      nested: '[object Object]',
      n: 3,
      ok: true,
    })
  })
})

describe('isDataPathAllowed', () => {
  it('blocks packaging artifacts in production', () => {
    expect(isDataPathAllowed('/Kaishi.apkg', true)).toBe(false)
    expect(isDataPathAllowed('/generated/import.sql', true)).toBe(false)
    expect(isDataPathAllowed('/generated/lesson-structure.json', true)).toBe(true)
  })

  it('blocks OCR dumps, traversal, and source maps always', () => {
    expect(isDataPathAllowed('/generated/import.sql', false)).toBe(false)
    expect(isDataPathAllowed('/ocr/raw/page-0001.json', true)).toBe(false)
    expect(isDataPathAllowed('/generated/reviewed/../import.sql', true)).toBe(false)
    expect(isDataPathAllowed('/assets/app.js.map', true)).toBe(false)
    expect(isDataPathAllowed('/generated/reviewed/genki_1_1.json', true)).toBe(true)
  })
})

describe('inviteCodeMatches', () => {
  it('accepts only configured codes', () => {
    expect(inviteCodeMatches('alpha-123', ['alpha-123', 'beta-456'])).toBe(true)
    expect(inviteCodeMatches('nope', ['alpha-123'])).toBe(false)
    expect(inviteCodeMatches(' alpha-123 ', ['alpha-123'])).toBe(true)
  })
})

describe('sanitizeUpstreamError', () => {
  it('redacts provider bodies in production', () => {
    expect(sanitizeUpstreamError(401, 'invalid api key sk-secret', true)).toBe(
      'AI provider rejected the request',
    )
    expect(sanitizeUpstreamError(500, 'stack trace', true)).toBe('AI provider is unavailable')
  })

  it('keeps truncated detail outside production', () => {
    expect(sanitizeUpstreamError(400, 'model missing', false)).toBe('model missing')
  })
})
