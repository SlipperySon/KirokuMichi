/** Client for Express `/api/tts` (Sarashina / ElevenLabs / future providers). */

export interface CloudTtsStatus {
  provider: 'sarashina' | 'elevenlabs' | 'none'
  configured: boolean
  ready: boolean
  message: string
}

const memoryCache = new Map<string, string>()
let statusCache: { at: number; value: CloudTtsStatus } | null = null
let activeObjectUrl: string | null = null
let activeAudio: HTMLAudioElement | null = null

export async function fetchCloudTtsStatus(force = false): Promise<CloudTtsStatus> {
  const now = Date.now()
  if (!force && statusCache && now - statusCache.at < 30_000) return statusCache.value

  const response = await fetch('/api/tts/status', { credentials: 'include' })
  if (!response.ok) {
    throw new Error('Could not load TTS status')
  }
  const value = await response.json() as CloudTtsStatus
  statusCache = { at: now, value }
  return value
}

export async function fetchCloudTtsAudio(
  text: string,
  options?: { voice?: string; language?: string },
): Promise<string> {
  const trimmed = text.replace(/\s+/g, ' ').trim()
  if (!trimmed) throw new Error('No text to speak')

  const cacheKey = `${options?.language ?? 'ja'}|${options?.voice ?? ''}|${trimmed}`
  const hit = memoryCache.get(cacheKey)
  if (hit) return hit

  const response = await fetch('/api/tts', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: trimmed,
      voice: options?.voice,
      language: options?.language ?? 'ja',
    }),
  })

  if (!response.ok) {
    let detail = ''
    try {
      const body = await response.json() as { error?: string }
      detail = body.error ?? ''
    } catch {
      detail = await response.text().catch(() => '')
    }
    throw new Error(detail || `TTS request failed (${response.status})`)
  }

  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  memoryCache.set(cacheKey, url)
  return url
}

export async function playCloudTts(
  text: string,
  options?: { voice?: string; language?: string },
): Promise<void> {
  const url = await fetchCloudTtsAudio(text, options)
  stopCloudTts()
  activeObjectUrl = url
  const audio = new Audio(url)
  activeAudio = audio
  await new Promise<void>((resolve, reject) => {
    audio.onended = () => resolve()
    audio.onerror = () => reject(new Error('Could not play cloud TTS audio.'))
    void audio.play().catch(reject)
  })
}

export function stopCloudTts(): void {
  if (activeAudio) {
    activeAudio.pause()
    activeAudio = null
  }
}
