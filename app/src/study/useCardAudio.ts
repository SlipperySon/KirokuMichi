import { useEffect, useRef } from 'react'
import { loadAudio } from '../srs/audioStore'
import { useAppStore } from '../store'

/**
 * Speak Japanese text via Azure Cognitive Services TTS (Nanami Neural).
 * Returns true if audio played successfully, false if unavailable or errored.
 * Called outside React so reads state directly via getState().
 */
export async function speakViaAzure(text: string): Promise<boolean> {
  const { azureTtsKey, azureTtsRegion, sessionToken } = useAppStore.getState().settings
  if (!azureTtsKey || !sessionToken) return false

  try {
    const response = await fetch('/api/tts', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-session-token': sessionToken,
      },
      body: JSON.stringify({
        text,
        voice: 'ja-JP-NanamiNeural',
        azureTtsKey,
        azureTtsRegion: azureTtsRegion || 'eastus',
      }),
    })

    if (!response.ok) return false

    const arrayBuffer = await response.arrayBuffer()
    const audioCtx = new AudioContext()
    const decoded = await audioCtx.decodeAudioData(arrayBuffer)
    const source = audioCtx.createBufferSource()
    source.buffer = decoded
    source.connect(audioCtx.destination)
    source.start(0)
    return true
  } catch {
    return false
  }
}

/** Cache the resolved Japanese voice between calls. */
let cachedJaVoice: SpeechSynthesisVoice | null = null
let voicesPromise: Promise<void> | null = null

function ensureVoices(): Promise<void> {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return Promise.resolve()
  if (cachedJaVoice) return Promise.resolve()
  if (voicesPromise) return voicesPromise

  voicesPromise = new Promise<void>(resolve => {
    const pick = () => {
      const voices = window.speechSynthesis.getVoices()
      const ja = voices.find(v => v.lang.toLowerCase().startsWith('ja')) ?? null
      if (ja) cachedJaVoice = ja
      resolve()
    }
    const initial = window.speechSynthesis.getVoices()
    if (initial.length > 0) {
      pick()
    } else {
      // Chrome populates voices asynchronously; subscribe once.
      const handler = () => {
        window.speechSynthesis.removeEventListener('voiceschanged', handler)
        pick()
      }
      window.speechSynthesis.addEventListener('voiceschanged', handler)
      // Safety timeout — resolve even if voiceschanged never fires.
      setTimeout(() => {
        window.speechSynthesis.removeEventListener('voiceschanged', handler)
        pick()
      }, 1500)
    }
  })
  return voicesPromise
}

function speakViaTTS(text: string, rate: number) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
  if (!text) return

  // Cancel anything currently speaking — we never want overlapping playback.
  window.speechSynthesis.cancel()

  const utter = new SpeechSynthesisUtterance(text)
  utter.lang = 'ja-JP'
  utter.rate = rate
  if (cachedJaVoice) utter.voice = cachedJaVoice
  window.speechSynthesis.speak(utter)
}

export function useCardAudio(audioUrl: string | null | undefined, text: string, phase: 'front' | 'back') {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const ttsEnabled = useAppStore(s => s.settings.ttsEnabled)
  const ttsRate = useAppStore(s => s.settings.ttsRate)
  const azureTtsKey = useAppStore(s => s.settings.azureTtsKey)

  useEffect(() => {
    if (phase !== 'back') return

    let cancelled = false

    async function play() {
      audioRef.current?.pause()

      if (audioUrl) {
        // idb: prefix means the bytes are stored in IndexedDB — fetch a fresh Blob URL
        const resolvedUrl = audioUrl.startsWith('idb:')
          ? await loadAudio(audioUrl.slice(4))
          : audioUrl

        if (cancelled || !resolvedUrl) return
        const audio = new Audio(resolvedUrl)
        audioRef.current = audio
        audio.play().catch(() => {})
        return
      }

      // TTS fallback for cards without recorded audio
      if (ttsEnabled && text) {
        const azureOk = await speakViaAzure(text)
        if (!azureOk) {
          await ensureVoices()
          if (!cancelled) speakViaTTS(text, ttsRate)
        }
      }
    }

    void play()

    return () => {
      cancelled = true
      audioRef.current?.pause()
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }
    }
  }, [phase, audioUrl, text, ttsEnabled, ttsRate, azureTtsKey])
}
