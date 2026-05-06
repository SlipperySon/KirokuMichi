import { useEffect, useRef } from 'react'
import { loadAudio } from '../srs/audioStore'

export function useCardAudio(audioUrl: string | null | undefined, text: string, phase: 'front' | 'back') {
  const audioRef = useRef<HTMLAudioElement | null>(null)

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
      }
      // No TTS fallback — cards without audio are silent
    }

    void play()

    return () => {
      cancelled = true
      audioRef.current?.pause()
    }
  }, [phase, audioUrl, text])
}
