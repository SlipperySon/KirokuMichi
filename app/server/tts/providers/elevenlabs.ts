import type { TtsProvider, TtsSynthesizeRequest } from '../types'

/**
 * ElevenLabs cloud TTS — ready when you go commercial.
 * Set TTS_PROVIDER=elevenlabs and ELEVENLABS_API_KEY (+ optional voice/model).
 */
export function createElevenLabsProvider(): TtsProvider {
  return {
    id: 'elevenlabs',
    isConfigured() {
      return Boolean(process.env.ELEVENLABS_API_KEY?.trim() && voiceId())
    },
    async synthesize(request: TtsSynthesizeRequest) {
      const apiKey = process.env.ELEVENLABS_API_KEY?.trim()
      const voice = request.voice?.trim() || voiceId()
      if (!apiKey || !voice) {
        throw new Error('ElevenLabs TTS is not configured (ELEVENLABS_API_KEY / ELEVENLABS_VOICE_ID)')
      }

      const modelId = process.env.ELEVENLABS_MODEL_ID?.trim() || 'eleven_v3'
      const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}`
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
        },
        body: JSON.stringify({
          text: request.text,
          model_id: modelId,
          // Helps Japanese pronunciation; increases latency.
          apply_language_text_normalization: true,
        }),
        signal: AbortSignal.timeout(Number(process.env.ELEVENLABS_TIMEOUT_MS || 60_000)),
      })

      if (!response.ok) {
        const detail = await response.text().catch(() => '')
        throw new Error(
          `ElevenLabs error ${response.status}${detail ? `: ${detail.slice(0, 200)}` : ''}`,
        )
      }

      return {
        audio: Buffer.from(await response.arrayBuffer()),
        contentType: response.headers.get('content-type') || 'audio/mpeg',
      }
    },
  }
}

function voiceId(): string | null {
  const id = process.env.ELEVENLABS_VOICE_ID?.trim()
  return id || null
}
