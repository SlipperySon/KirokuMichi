import { readTtsCache, ttsCacheKey, writeTtsCache } from './cache'
import { createElevenLabsProvider } from './providers/elevenlabs'
import { createSarashinaProvider } from './providers/sarashina'
import type {
  TtsProvider,
  TtsProviderId,
  TtsStatus,
  TtsSynthesizeRequest,
  TtsSynthesizeResult,
} from './types'

const MAX_TEXT_CHARS = 500

export function resolveTtsProviderId(): TtsProviderId {
  const raw = (process.env.TTS_PROVIDER || 'sarashina').trim().toLowerCase()
  if (raw === 'elevenlabs' || raw === 'sarashina' || raw === 'none') return raw
  return 'sarashina'
}

export function getTtsProvider(id: TtsProviderId = resolveTtsProviderId()): TtsProvider | null {
  switch (id) {
    case 'sarashina':
      return createSarashinaProvider()
    case 'elevenlabs':
      return createElevenLabsProvider()
    case 'none':
    default:
      return null
  }
}

export function getTtsStatus(): TtsStatus {
  const providerId = resolveTtsProviderId()
  if (providerId === 'none') {
    return {
      provider: 'none',
      configured: false,
      ready: false,
      message: 'Cloud TTS disabled (TTS_PROVIDER=none). Browser speech fallback only.',
    }
  }

  const provider = getTtsProvider(providerId)
  const configured = Boolean(provider?.isConfigured())
  if (!configured) {
    return {
      provider: providerId,
      configured: false,
      ready: false,
      message: providerId === 'sarashina'
        ? 'Set SARASHINA_TTS_URL to your local Sarashina sidecar (see app/tts-sidecar/).'
        : 'Set ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID, then TTS_PROVIDER=elevenlabs.',
    }
  }

  return {
    provider: providerId,
    configured: true,
    ready: true,
    message: providerId === 'sarashina'
      ? 'Sarashina sidecar configured (non-commercial license — swap TTS_PROVIDER when you go commercial).'
      : 'ElevenLabs configured.',
  }
}

export async function synthesizeSpeech(
  request: TtsSynthesizeRequest,
): Promise<TtsSynthesizeResult> {
  const text = normalizeTtsText(request.text)
  if (!text) throw new Error('Text is required')
  if (text.length > MAX_TEXT_CHARS) {
    throw new Error(`Text too long (max ${MAX_TEXT_CHARS} characters)`)
  }

  const providerId = resolveTtsProviderId()
  const provider = getTtsProvider(providerId)
  if (!provider || !provider.isConfigured()) {
    throw new Error(getTtsStatus().message)
  }

  const modelHint = providerId === 'elevenlabs'
    ? (process.env.ELEVENLABS_MODEL_ID || 'eleven_v3')
    : 'sarashina2.2'
  const cacheKey = ttsCacheKey({
    provider: providerId,
    text,
    voice: request.voice,
    language: request.language ?? 'ja',
    model: modelHint,
  })
  const extension = providerId === 'elevenlabs' ? 'mp3' : 'wav'
  const cached = await readTtsCache(cacheKey, extension)
  if (cached) {
    return {
      audio: cached.audio,
      contentType: cached.contentType,
      provider: providerId,
      cached: true,
    }
  }

  const result = await provider.synthesize({
    ...request,
    text,
    language: request.language ?? 'ja',
  })
  await writeTtsCache(cacheKey, extensionForContentType(result.contentType, extension), result.audio)
  return { ...result, provider: providerId, cached: false }
}

export function normalizeTtsText(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

function extensionForContentType(contentType: string, fallback: string): string {
  if (contentType.includes('mpeg') || contentType.includes('mp3')) return 'mp3'
  if (contentType.includes('ogg')) return 'ogg'
  if (contentType.includes('wav')) return 'wav'
  return fallback
}
