import { useState, useEffect } from 'react'
import { useAppStore } from '../store'
import { SQLiteStorage } from '../db/sqlite'
import { getCachedWeakPoints, computeAndCacheWeakPoints } from '../ai/weakPointSummary'
import type { WeakPointSummary } from '../core/weakPointScorer'

interface Props {
  className?: string
}

export function WeakPointPanel({ className = '' }: Props) {
  const { activeUserId } = useAppStore()
  const [storage] = useState(() => new SQLiteStorage())
  const [summary, setSummary] = useState<WeakPointSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    const userId = activeUserId ?? 1
    getCachedWeakPoints(storage, userId)
      .then(setSummary)
      .finally(() => setLoading(false))
  }, [activeUserId, storage])

  async function handleRefresh() {
    setRefreshing(true)
    const userId = activeUserId ?? 1
    const fresh = await computeAndCacheWeakPoints(storage, userId)
    setSummary(fresh)
    setRefreshing(false)
  }

  if (loading) {
    return <div className={`text-gray-400 text-sm ${className}`}>Loading analysis…</div>
  }

  if (!summary) {
    return (
      <div className={`bg-white border border-gray-200 rounded-xl p-4 ${className}`}>
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-gray-900">Improvement Analysis</h3>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="text-xs text-indigo-600 hover:text-indigo-700 disabled:opacity-50"
          >
            {refreshing ? 'Analysing…' : 'Analyse Now'}
          </button>
        </div>
        <p className="text-sm text-gray-500">
          Complete some reviews to see your weak-point analysis.
        </p>
      </div>
    )
  }

  return (
    <div className={`bg-white border border-gray-200 rounded-xl p-4 space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">Improvement Analysis</h3>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="text-xs text-indigo-600 hover:text-indigo-700 disabled:opacity-50"
        >
          {refreshing ? 'Analysing…' : 'Refresh'}
        </button>
      </div>

      {/* Mastery meter */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-gray-500">Overall mastery</span>
          <span className="text-sm font-semibold text-gray-900">{summary.overallMasteryPercent}%</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-500 rounded-full transition-all"
            style={{ width: `${summary.overallMasteryPercent}%` }}
          />
        </div>
      </div>

      {/* Weak cards */}
      {summary.topWeakCards.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Needs review</p>
          <ul className="space-y-1">
            {summary.topWeakCards.slice(0, 5).map((c, i) => (
              <li key={i} className="flex items-center justify-between text-sm">
                <span className="text-gray-800 truncate">{c.label}</span>
                <span className="ml-2 flex-shrink-0 text-xs text-gray-400">{c.jlptLevel}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Weak grammar */}
      {summary.topWeakGrammar.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Grammar gaps</p>
          <ul className="space-y-1">
            {summary.topWeakGrammar.slice(0, 3).map((g, i) => (
              <li key={i} className="text-sm text-gray-800">{g.label}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Recommended focus */}
      {summary.recommendedFocus.length > 0 && (
        <div className="bg-indigo-50 rounded-lg p-3">
          <p className="text-xs font-medium text-indigo-700 mb-1">Recommended focus</p>
          <ul className="space-y-1">
            {summary.recommendedFocus.map((f, i) => (
              <li key={i} className="text-xs text-indigo-800">{f}</li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-xs text-gray-400">
        Last computed: {new Date(summary.computedAt).toLocaleDateString()}
      </p>
    </div>
  )
}
