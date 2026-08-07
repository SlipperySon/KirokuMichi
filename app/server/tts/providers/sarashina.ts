import type { TtsProvider, TtsSynthesizeRequest } from '../types'

/**
 * Proxies to a local Sarashina2.2-TTS sidecar (see app/tts-sidecar/).
 * Sarashina is non-commercial — keep TTS_PROVIDER=sarashina only while that license fits.
 */
export function createSarashinaProvider(): TtsProvider {
  return {
    id: 'sarashina',
    isConfigured() {
      return Boolean(sidecarBaseUrl())
    },
    async synthesize(request: TtsSynthesizeRequest) {
      const base = sidecarBaseUrl()
      if (!base) {
        throw new Error('Sarashina TTS is not configured (set SARASHINA_TTS_URL)')
      }

      const response = await fetch(`${base}/synthesize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'audio/wav' },
        body: JSON.stringify({
          text: request.text,
          language: request.language ?? 'ja',
          voice: request.voice,
        }),
        signal: AbortSignal.timeout(Number(process.env.SARASHINA_TTS_TIMEOUT_MS || 120_000)),
      })

      if (!response.ok) {
        const detail = await response.text().catch(() => '')
        throw new Error(
          `Sarashina sidecar error ${response.status}${detail ? `: ${detail.slice(0, 200)}` : ''}`,
        )
      }

      const audio = Buffer.from(await response.arrayBuffer())
      const contentType = response.headers.get('content-type') || 'audio/wav'
      return { audio, contentType }
    },
  }
}

function sidecarBaseUrl(): string | null {
  const raw = process.env.SARASHINA_TTS_URL?.trim()
  if (!raw) return null
  return raw.replace(/\/$/, '')
}
