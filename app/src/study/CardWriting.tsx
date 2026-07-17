import { useState } from 'react'
import { useIntl } from 'react-intl'
import type { Rating } from '../core/providers'
import type { ReviewCard, IntervalPreview } from './types'
import { RatingButtons } from './RatingButtons'
import { playRecordedAudio } from './useCardAudio'

interface Props {
  card: ReviewCard
  phase: 'front' | 'back'
  intervalPreviews: IntervalPreview | null
  onReveal: () => void
  onRate: (rating: Rating) => void
}

export function CardWriting({ card, phase, intervalPreviews, onReveal, onRate }: Props) {
  const intl = useIntl()
  const [attempt, setAttempt] = useState('')

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-md mx-auto">
      <p className="text-gray-600 text-sm">{intl.formatMessage({ id: 'study.card.write_prompt' })}</p>
      <p className="text-lg font-semibold text-gray-900">{card.back}</p>

      {card.audioUrl && (
        <button
          type="button"
          onClick={() => { void playRecordedAudio(card.audioUrl).catch(() => {}) }}
          className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <span>▶</span>
          {intl.formatMessage({ id: 'study.card.replay_audio' })}
        </button>
      )}

      {card.exampleSentence && (
        <p className="text-sm text-gray-500" lang="ja">Example: {card.exampleSentence}</p>
      )}

      {phase === 'front' ? (
        <>
          <textarea
            value={attempt}
            onChange={event => setAttempt(event.target.value)}
            placeholder="Type the reading or word…"
            className="min-h-24 w-full resize-y rounded-xl border border-gray-200 px-3 py-2 text-lg text-gray-900 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            lang="ja"
          />
          <button
            type="button"
            onClick={onReveal}
            className="w-full px-8 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors"
          >
            {intl.formatMessage({ id: 'study.card.show_answer' })}
          </button>
        </>
      ) : (
        <>
          <div className="flex flex-col items-center gap-2">
            <div className="text-5xl font-bold" lang="ja">{card.front}</div>
            {card.reading && <div className="text-xl text-indigo-600" lang="ja">{card.reading}</div>}
            <div className="text-gray-600">{card.back}</div>
            {attempt.trim() && (
              <p className="text-sm text-gray-500">Your attempt: <span lang="ja">{attempt}</span></p>
            )}
          </div>
          <RatingButtons previews={intervalPreviews} onRate={onRate} />
        </>
      )}
    </div>
  )
}
