import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { normalizeTtsText, resolveTtsProviderId, getTtsStatus } from './service'
import { ttsCacheKey } from './cache'

const KEYS = ['TTS_PROVIDER', 'SARASHINA_TTS_URL', 'ELEVENLABS_API_KEY', 'ELEVENLABS_VOICE_ID'] as const
let saved: Partial<Record<(typeof KEYS)[number], string | undefined>> = {}

beforeEach(() => {
  saved = {}
  for (const key of KEYS) saved[key] = process.env[key]
})

afterEach(() => {
  for (const key of KEYS) {
    if (saved[key] === undefined) delete process.env[key]
    else process.env[key] = saved[key]
  }
})

describe('tts service', () => {
  it('defaults provider to sarashina', () => {
    delete process.env.TTS_PROVIDER
    expect(resolveTtsProviderId()).toBe('sarashina')
  })

  it('accepts elevenlabs and none providers', () => {
    process.env.TTS_PROVIDER = 'elevenlabs'
    expect(resolveTtsProviderId()).toBe('elevenlabs')
    process.env.TTS_PROVIDER = 'none'
    expect(resolveTtsProviderId()).toBe('none')
  })

  it('reports sarashina unconfigured without sidecar URL', () => {
    process.env.TTS_PROVIDER = 'sarashina'
    delete process.env.SARASHINA_TTS_URL
    const status = getTtsStatus()
    expect(status.provider).toBe('sarashina')
    expect(status.configured).toBe(false)
    expect(status.ready).toBe(false)
  })

  it('reports sarashina ready when sidecar URL is set', () => {
    process.env.TTS_PROVIDER = 'sarashina'
    process.env.SARASHINA_TTS_URL = 'http://127.0.0.1:7861'
    const status = getTtsStatus()
    expect(status.configured).toBe(true)
    expect(status.ready).toBe(true)
  })

  it('normalizes whitespace in TTS text', () => {
    expect(normalizeTtsText('  こんにちは\n世界  ')).toBe('こんにちは 世界')
  })

  it('builds stable cache keys', () => {
    const a = ttsCacheKey({ provider: 'sarashina', text: 'こんにちは', language: 'ja' })
    const b = ttsCacheKey({ provider: 'sarashina', text: 'こんにちは', language: 'ja' })
    const c = ttsCacheKey({ provider: 'elevenlabs', text: 'こんにちは', language: 'ja' })
    expect(a).toBe(b)
    expect(a).not.toBe(c)
  })
})
