import type { TestResult } from './types'

interface Props {
  result: TestResult
  onRetry: () => void
  onDone: () => void
}

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`
}

export function TestSummary({ result, onRetry, onDone }: Props) {
  const pct = Math.round((result.correct / result.total) * 100)
  const passed = pct >= 60

  return (
    <div className="flex flex-col items-center gap-6 py-8 text-center">
      <div className="text-5xl">{pct >= 80 ? '🎉' : pct >= 60 ? '👍' : '📚'}</div>

      <div>
        <div className={`text-5xl font-bold ${passed ? 'text-green-600' : 'text-red-500'}`}>{pct}%</div>
        <div className="text-gray-500 text-sm mt-1">
          {result.correct} / {result.total} correct · {formatDuration(result.durationMs)}
        </div>
      </div>

      <div className="flex items-center gap-6 text-sm text-gray-600">
        <div className="flex flex-col items-center">
          <span className="text-2xl font-bold text-green-600">{result.correct}</span>
          <span>Correct</span>
        </div>
        <div className="w-px h-10 bg-gray-200" />
        <div className="flex flex-col items-center">
          <span className="text-2xl font-bold text-red-500">{result.total - result.correct}</span>
          <span>Wrong</span>
        </div>
        <div className="w-px h-10 bg-gray-200" />
        <div className="flex flex-col items-center">
          <span className="text-2xl font-bold text-indigo-600">{result.level}</span>
          <span>{result.mode === 'simulated' ? 'Simulated' : 'Practice'}</span>
        </div>
      </div>

      {!passed && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-sm text-orange-800 max-w-sm">
          Keep studying! A score of 60% or higher indicates readiness for the next level.
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={onRetry}
          className="px-6 py-2.5 rounded-xl border-2 border-indigo-200 text-indigo-600 font-semibold hover:bg-indigo-50 transition-colors"
        >
          Try Again
        </button>
        <button
          onClick={onDone}
          className="px-6 py-2.5 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-colors"
        >
          Done
        </button>
      </div>
    </div>
  )
}
