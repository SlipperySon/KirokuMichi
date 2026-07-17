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

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-md mx-auto">
      <p className="text-gray-600 text-sm">{intl.formatMessage({ id: 'study.card.write_prompt' })}</p>

      {card.audioUrl && (
        <button
          onClick={() => { void playRecordedAudio(card.audioUrl).catch(() => {}) }}
          className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <span>▶</span>
          {intl.formatMessage({ id: 'study.card.replay_audio' })}
        </button>
      )}

      {phase === 'front' ? (
        <>
          <div className="w-48 h-48 border-2 border-dashed border-gray-300 rounded-xl flex items-center justify-center text-gray-300 text-sm">
            Write here
          </div>
          <button
            onClick={onReveal}
            className="w-full px-8 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors"
          >
            {intl.formatMessage({ id: 'study.card.show_answer' })}
          </button>
        </>
      ) : (
        <>
          <div className="flex gap-8 items-center">
            <div className="text-7xl font-bold" lang="ja">{card.front}</div>
            <div className="w-32 h-32 bg-gray-100 rounded-xl flex items-center justify-center text-center text-xs text-gray-400 p-2">
              {intl.formatMessage({ id: 'study.card.stroke_placeholder' })}
            </div>
          </div>
          {card.reading && <div className="text-xl text-indigo-600" lang="ja">{card.reading}</div>}
          <div className="text-gray-600">{card.back}</div>
          <RatingButtons previews={intervalPreviews} onRate={onRate} />
        </>
      )}
    </div>
  )
}
