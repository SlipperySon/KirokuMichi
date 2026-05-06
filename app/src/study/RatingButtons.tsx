import { useEffect } from 'react'
import { useIntl } from 'react-intl'
import type { Rating } from '../core/providers'
import type { IntervalPreview } from './types'

interface Props {
  previews: IntervalPreview | null
  onRate: (rating: Rating) => void
  disabled?: boolean
}

const RATINGS: { rating: Rating; key: string; color: string; shortcut: string }[] = [
  { rating: 'again', key: 'srs.again', color: 'border-red-300 hover:bg-red-50 text-red-700', shortcut: '1' },
  { rating: 'hard',  key: 'srs.hard',  color: 'border-orange-300 hover:bg-orange-50 text-orange-700', shortcut: '2' },
  { rating: 'good',  key: 'srs.good',  color: 'border-green-300 hover:bg-green-50 text-green-700', shortcut: '3' },
  { rating: 'easy',  key: 'srs.easy',  color: 'border-blue-300 hover:bg-blue-50 text-blue-700', shortcut: '4' },
]

export function RatingButtons({ previews, onRate, disabled = false }: Props) {
  const intl = useIntl()

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (disabled || e.metaKey || e.ctrlKey || e.altKey) return
      const r = RATINGS.find(r => r.shortcut === e.key)
      if (r) onRate(r.rating)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [disabled, onRate])

  return (
    <div className="grid grid-cols-4 gap-2 w-full" role="group" aria-label="Rate this card">
      {RATINGS.map(({ rating, key, color, shortcut }) => (
        <button
          key={rating}
          onClick={() => onRate(rating)}
          disabled={disabled}
          aria-label={`${intl.formatMessage({ id: key })} (keyboard shortcut: ${shortcut})`}
          className={`flex flex-col items-center py-3 px-2 rounded-xl border-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${color}`}
        >
          <span className="font-semibold text-sm">{intl.formatMessage({ id: key })}</span>
          {previews && (
            <span className="text-xs text-gray-400 mt-0.5">{previews[rating]}</span>
          )}
          <span className="text-xs text-gray-300 mt-0.5">[{shortcut}]</span>
        </button>
      ))}
    </div>
  )
}
