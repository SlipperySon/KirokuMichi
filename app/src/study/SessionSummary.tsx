import { useState } from 'react'
import { useIntl } from 'react-intl'
import type { SessionStats } from './types'

interface Props {
  stats: SessionStats
  totalCards?: number
  onDone: () => void
  onExportAnki: () => void
  onImportAnki: (file: File) => void
}

function formatTime(ms: number): string {
  const s = Math.round(ms / 1000)
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}

export function SessionSummary({ stats, onDone, onExportAnki, onImportAnki }: Props) {
  const intl = useIntl()
  const [copied, setCopied] = useState(false)

  const accuracy = stats.cardsReviewed > 0
    ? Math.round((stats.correctCount / stats.cardsReviewed) * 100)
    : 0
  const elapsed = Date.now() - stats.startedAt

  function buildShareText(): string {
    const mins = Math.floor(elapsed / 60000)
    const date = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    return [
      `📚 KirokuMichi — ${date}`,
      `✅ ${stats.cardsReviewed} cards reviewed`,
      `🎯 ${accuracy}% accuracy`,
      `⏱ ${mins}m`,
      '#Japanese #JLPT #KirokuMichi',
    ].join('\n')
  }

  async function handleShare() {
    const text = buildShareText()
    if (navigator.share) {
      await navigator.share({ text }).catch(() => {})
    } else {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-8 p-8 max-w-md mx-auto text-center">
      <h2 className="text-2xl font-bold">{intl.formatMessage({ id: 'study.summary.title' })}</h2>

      <div className="grid grid-cols-3 gap-4 w-full">
        {[
          { label: intl.formatMessage({ id: 'study.summary.reviewed' }), value: stats.cardsReviewed },
          { label: intl.formatMessage({ id: 'study.summary.accuracy' }), value: `${accuracy}%` },
          { label: intl.formatMessage({ id: 'study.summary.time' }), value: formatTime(elapsed) },
        ].map(({ label, value }) => (
          <div key={label} className="bg-gray-50 rounded-xl p-4">
            <div className="text-2xl font-bold text-indigo-600">{value}</div>
            <div className="text-xs text-gray-500 mt-1">{label}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 w-full">
        <button
          onClick={onDone}
          className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors"
        >
          {intl.formatMessage({ id: 'study.summary.done' })}
        </button>

        <button
          onClick={handleShare}
          className="px-8 py-3 border-2 border-indigo-200 text-indigo-700 rounded-xl font-medium hover:bg-indigo-50 transition-colors text-sm"
          aria-live="polite"
        >
          {copied ? '✓ Copied to clipboard' : '📤 Share results'}
        </button>
        <button
          onClick={onExportAnki}
          className="px-8 py-3 border-2 border-gray-200 rounded-xl font-medium hover:bg-gray-50 transition-colors text-sm"
        >
          {intl.formatMessage({ id: 'study.summary.export_anki' })}
        </button>
        <label className="px-8 py-3 border-2 border-gray-200 rounded-xl font-medium hover:bg-gray-50 transition-colors text-sm cursor-pointer">
          {intl.formatMessage({ id: 'study.summary.import_anki' })}
          <input
            type="file"
            accept=".apkg"
            className="hidden"
            onChange={e => { if (e.target.files?.[0]) onImportAnki(e.target.files[0]) }}
          />
        </label>
      </div>
    </div>
  )
}
