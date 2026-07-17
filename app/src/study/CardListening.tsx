import { useEffect, useState } from 'react'
import { useIntl } from 'react-intl'
import type { Rating } from '../core/providers'
import type { ReviewCard, IntervalPreview } from './types'
import { RatingButtons } from './RatingButtons'
import { gradeTypedRecall } from './typedRecall'
import { playCardListeningAudio, stopCardListeningAudio } from './cardAudioPlayback'

interface Props {
  card: ReviewCard
  phase: 'front' | 'back'
  intervalPreviews: IntervalPreview | null
  onReveal: () => void
  onRate: (rating: Rating) => void
}

export function CardListening({ card, phase, intervalPreviews, onReveal, onRate }: Props) {
  const intl = useIntl()
  const [attempt, setAttempt] = useState('')
  const [isPlaying, setIsPlaying] = useState(false)
  const [playError, setPlayError] = useState<string | null>(null)
  const [hasPlayed, setHasPlayed] = useState(false)

  useEffect(() => {
    if (phase !== 'front') return
    let cancelled = false

    async function autoPlay() {
      setPlayError(null)
      setIsPlaying(true)
      try {
        await playCardListeningAudio(card.front, card.audioUrl)
        if (!cancelled) setHasPlayed(true)
      } catch {
        if (!cancelled) setPlayError('Could not play audio — try again or reveal to check.')
      } finally {
        if (!cancelled) setIsPlaying(false)
      }
    }

    void autoPlay()
    return () => {
      cancelled = true
      stopCardListeningAudio()
    }
  }, [card.cardStateId, card.audioUrl, card.front, phase])

  async function handlePlay() {
    setPlayError(null)
    setIsPlaying(true)
    try {
      await playCardListeningAudio(card.front, card.audioUrl)
      setHasPlayed(true)
    } catch {
      setPlayError('Could not play audio — try again or reveal to check.')
    } finally {
      setIsPlaying(false)
    }
  }

  const matched = gradeTypedRecall(attempt, card.front)

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-md mx-auto">
      <p className="text-sm text-gray-600">{intl.formatMessage({ id: 'study.card.listen_prompt', defaultMessage: 'Listen, then type what you heard.' })}</p>

      <div className="w-full rounded-2xl bg-gray-50 p-8 text-center">
        <button
          type="button"
          onClick={() => { void handlePlay() }}
          disabled={isPlaying}
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {isPlaying ? 'Playing…' : hasPlayed ? 'Replay audio' : 'Play audio'}
        </button>
        {playError && <p className="mt-3 text-sm text-red-700">{playError}</p>}
        {!hasPlayed && !playError && (
          <p className="mt-3 text-xs text-gray-500">Sentence hidden until you check your answer.</p>
        )}
      </div>

      {phase === 'front' ? (
        <>
          <textarea
            value={attempt}
            onChange={event => setAttempt(event.target.value)}
            placeholder="Type the sentence you heard…"
            className="min-h-28 w-full resize-y rounded-xl border border-gray-200 px-3 py-2 text-lg text-gray-900 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            lang="ja"
          />
          <button
            type="button"
            onClick={onReveal}
            disabled={attempt.trim().length === 0}
            className="w-full rounded-xl bg-indigo-600 px-8 py-3 font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {intl.formatMessage({ id: 'study.card.show_answer' })}
          </button>
        </>
      ) : (
        <>
          <div className="flex w-full flex-col items-center gap-2 rounded-2xl bg-gray-50 p-6 text-center">
            <div className="text-2xl font-bold text-gray-900" lang="ja">{card.front}</div>
            {card.reading && <div className="text-lg text-indigo-600" lang="ja">{card.reading}</div>}
            {card.back && <div className="text-gray-600">{card.back}</div>}
            {attempt.trim() && (
              <p className={`mt-2 text-sm ${matched ? 'text-green-700' : 'text-amber-800'}`}>
                Your attempt: <span lang="ja">{attempt}</span>
                {matched ? ' — close match' : ' — compare and adjust'}
              </p>
            )}
          </div>
          <RatingButtons previews={intervalPreviews} onRate={onRate} />
        </>
      )}
    </div>
  )
}
