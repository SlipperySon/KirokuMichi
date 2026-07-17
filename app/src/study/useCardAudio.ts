import { useEffect, useRef } from 'react'
import { loadAudio } from '../srs/audioStore'

export async function playRecordedAudio(audioUrl: string | null | undefined): Promise<HTMLAudioElement | null> {
  if (!audioUrl) return null
  const resolvedUrl = audioUrl.startsWith('idb:')
    ? await loadAudio(audioUrl.slice(4))
    : audioUrl
  if (!resolvedUrl) return null

  const audio = new Audio(resolvedUrl)
  await audio.play()
  return audio
}

export function useCardAudio(audioUrl: string | null | undefined, phase: 'front' | 'back') {
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    if (phase !== 'back') return

    let cancelled = false

    async function play() {
      audioRef.current?.pause()
      const audio = await playRecordedAudio(audioUrl).catch(() => null)
      if (cancelled) {
        audio?.pause()
      } else {
        audioRef.current = audio
      }
    }

    void play()

    return () => {
      cancelled = true
      audioRef.current?.pause()
    }
  }, [phase, audioUrl])
}
