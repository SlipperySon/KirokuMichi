import { playCloudTts, stopCloudTts } from '../audio/cloudTts'
import { playRecordedAudio } from './useCardAudio'

/**
 * Play card audio: bundled recording → cloud TTS (Sarashina/ElevenLabs) → browser TTS.
 */
export async function playCardListeningAudio(
  text: string,
  audioUrl: string | null | undefined,
): Promise<void> {
  const recorded = await playRecordedAudio(audioUrl).catch(() => null)
  if (recorded) return

  try {
    await playCloudTts(text, { language: 'ja' })
    return
  } catch {
    // Fall through to device TTS when cloud provider is offline / unconfigured.
  }

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
  stopCloudTts()
  if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel()
}
