import { useIntl } from 'react-intl'
import type { ReviewCard } from './types'

interface Props {
  card: ReviewCard
  onSuspend: () => void
  onDismiss: () => void
}

export function LeechWarning({ card, onSuspend, onDismiss }: Props) {
  const intl = useIntl()
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 flex flex-col gap-4">
        <div className="text-center">
          <div className="text-4xl mb-2">⚠️</div>
          <h2 className="text-xl font-bold">{intl.formatMessage({ id: 'study.leech.title' })}</h2>
        </div>
        <p className="text-center text-gray-600 text-sm" lang="ja">{card.front}</p>
        <p className="text-center text-gray-500 text-sm">
          {intl.formatMessage({ id: 'study.leech.body' }, { lapses: card.lapses })}
        </p>
        <div className="flex flex-col gap-2">
          <button
            onClick={onSuspend}
            className="px-4 py-2 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition-colors"
          >
            {intl.formatMessage({ id: 'study.leech.suspend' })}
          </button>
          <button
            onClick={onDismiss}
            className="px-4 py-2 border-2 border-gray-200 rounded-xl font-medium hover:bg-gray-50 transition-colors"
          >
            {intl.formatMessage({ id: 'study.leech.dismiss' })}
          </button>
        </div>
      </div>
    </div>
  )
}
