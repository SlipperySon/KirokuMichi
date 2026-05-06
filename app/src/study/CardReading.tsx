import { useIntl } from 'react-intl'
import type { Rating } from '../core/providers'
import type { ReviewCard, IntervalPreview } from './types'
import { RatingButtons } from './RatingButtons'
import { useCardAudio } from './useCardAudio'

interface Props {
  card: ReviewCard
  phase: 'front' | 'back'
  intervalPreviews: IntervalPreview | null
  onReveal: () => void
  onRate: (rating: Rating) => void
}

export function CardReading({ card, phase, intervalPreviews, onReveal, onRate }: Props) {
  const intl = useIntl()
  useCardAudio(card.audioUrl, card.front, phase)
  return (
    <div className="flex flex-col items-center gap-8 w-full max-w-md mx-auto">
      <div className="w-full min-h-48 bg-gray-50 rounded-2xl flex flex-col items-center justify-center gap-4 p-8">
        <div className="text-7xl font-bold" lang="ja">{card.front}</div>
        {phase === 'back' && (
          <>
            {card.reading && (
              <div className="text-2xl text-indigo-600" lang="ja">{card.reading}</div>
            )}
            {card.back && (
              <div className="text-lg text-gray-600 mt-1">{card.back}</div>
            )}
          </>
        )}
      </div>

      {phase === 'front' ? (
        <button
          onClick={onReveal}
          className="w-full px-8 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors"
        >
          {intl.formatMessage({ id: 'study.card.show_reading' })}
        </button>
      ) : (
        <RatingButtons previews={intervalPreviews} onRate={onRate} />
      )}
    </div>
  )
}
