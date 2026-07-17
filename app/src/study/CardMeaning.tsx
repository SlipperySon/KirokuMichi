import { useIntl } from 'react-intl'
import type { Rating } from '../core/providers'
import type { ReviewCard, IntervalPreview } from './types'
import { RatingButtons } from './RatingButtons'
import { useCardAudio } from './useCardAudio'
import { useUsageExample } from './useUsageExample'

interface Props {
  card: ReviewCard
  phase: 'front' | 'back'
  intervalPreviews: IntervalPreview | null
  onReveal: () => void
  onRate: (rating: Rating) => void
}

export function CardMeaning({ card, phase, intervalPreviews, onReveal, onRate }: Props) {
  const intl = useIntl()
  const usageExample = useUsageExample(card)
  useCardAudio(card.audioUrl, phase)
  return (
    <div className="flex flex-col items-center gap-8 w-full max-w-md mx-auto">
      <div className="w-full min-h-48 bg-gray-50 rounded-2xl flex flex-col items-center justify-center gap-4 p-8">
        <div className="text-6xl font-bold" lang="ja">{card.front}</div>
        {usageExample && (
          <div className="w-full rounded-lg border border-indigo-100 bg-white px-4 py-3 text-center">
            <p className="text-xs font-semibold uppercase text-indigo-500">In context</p>
            <p className="mt-1 text-lg text-gray-900" lang="ja">{usageExample.sentence}</p>
            {phase === 'back' && usageExample.translation && (
              <p className="mt-2 text-sm text-gray-500">{usageExample.translation}</p>
            )}
          </div>
        )}
        {phase === 'back' && (
          <>
            <div className="text-xl text-gray-800">{card.back}</div>
            {card.reading && (
              <div className="text-sm text-gray-400" lang="ja">{card.reading}</div>
            )}
          </>
        )}
      </div>

      {phase === 'front' ? (
        <button
          onClick={onReveal}
          className="w-full px-8 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors"
        >
          {intl.formatMessage({ id: 'study.card.show_meaning' })}
        </button>
      ) : (
        <RatingButtons previews={intervalPreviews} onRate={onRate} />
      )}
    </div>
  )
}
