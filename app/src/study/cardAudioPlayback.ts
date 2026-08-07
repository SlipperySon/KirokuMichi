import { playCloudTts, stopCloudTts } from '../audio/cloudTts'
import { playRecordedAudio } from './useCardAudio'

/**
 * Play card audio: bundled recording → cloud TTS (Sarashina/ElevenLabs).
 * Never uses browser speechSynthesis — if cloud TTS is unavailable, audio is disabled.
 */
export async function playCardListeningAudio(
  text: string,
  audioUrl: string | null | undefined,
): Promise<void> {
  const recorded = await playRecordedAudio(audioUrl).catch(() => null)
  if (recorded) return

  await playCloudTts(text, { language: 'ja' })
}

export function stopCardListeningAudio(): void {
  stopCloudTts()
}
