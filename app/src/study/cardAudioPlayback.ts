import { playRecordedAudio } from './useCardAudio'

/** Play bundled card audio or fall back to browser TTS for listen-then-type cards. */
export async function playCardListeningAudio(
  text: string,
  audioUrl: string | null | undefined,
): Promise<void> {
  const recorded = await playRecordedAudio(audioUrl).catch(() => null)
  if (recorded) return

  if (typeof speechSynthesis === 'undefined') {
    throw new Error('No audio available for this card.')
  }

  await new Promise<void>((resolve, reject) => {
    speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'ja-JP'
    utterance.rate = 0.92
    utterance.onend = () => resolve()
    utterance.onerror = () => reject(new Error('Could not play audio for this card.'))
    speechSynthesis.speak(utterance)
  })
}

export function stopCardListeningAudio(): void {
  if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel()
}
