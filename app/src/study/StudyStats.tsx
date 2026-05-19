import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store'
import { SQLiteStorage } from '../db/sqlite'
import { FSRSScheduler, SM2Scheduler } from '../core/scheduler'
import { SRSService } from '../srs/srsService'
import { Navigation } from '../components/Navigation'
import { SkeletonCard } from '../components/Skeleton'

interface StudyStatsData {
  dailyReviews: { day: string; total: number; correct: number }[]
  cardStateCounts: { new: number; learning: number; review: number; suspended: number }
  retention7d: number
  retention30d: number
  stabilityBuckets: { label: string; count: number }[]
}

type StatsWindow = 7 | 30 | 0

function BarChart({ data, windowDays }: { data: { day: string; total: number; correct: number }[]; windowDays: StatsWindow }) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-24 text-sm text-gray-400">
        No review data for this window
      </div>
    )
  }

  const displayDays = windowDays === 0 ? Math.max(30, data.length) : windowDays
  const days: { day: string; total: number; correct: number }[] = []
  const now = new Date()
  const dataMap = new Map(data.map(d => [d.day, d]))
  for (let i = displayDays - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const key = d.toISOString().split('T')[0]
    days.push(dataMap.get(key) ?? { day: key, total: 0, correct: 0 })
  }

  const maxTotal = Math.max(...days.map(d => d.total), 1)
  const MAX_HEIGHT = 80

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-end gap-0.5 h-20" role="img" aria-label="Reviews per day bar chart">
        {days.map(d => {
          const height = d.total > 0 ? Math.max(4, Math.round((d.total / maxTotal) * MAX_HEIGHT)) : 2
          const correctHeight = d.total > 0 ? Math.round((d.correct / d.total) * height) : 0
          const wrongHeight = height - correctHeight
          return (
            <div
              key={d.day}
              className="flex-1 flex flex-col justify-end cursor-default"
              title={`${d.day}: ${d.total} reviews (${d.correct} correct)`}
            >
              <div
                className="w-full bg-red-300 rounded-t"
                style={{ height: wrongHeight }}
              />
              <div
                className="w-full bg-indigo-500 rounded-t"
                style={{ height: correctHeight }}
              />
              {d.total === 0 && (
                <div className="w-full bg-gray-100 rounded" style={{ height: 2 }} />
              )}
            </div>
          )
        })}
      </div>
      <div className="flex justify-between text-xs text-gray-400">
        <span>{windowDays === 0 ? `${displayDays} days ago` : `${windowDays} days ago`}</span>
        <span>Today</span>
      </div>
      <div className="flex gap-3 text-xs">
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded bg-indigo-500" />
          Correct
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded bg-red-300" />
          Again
        </span>
      </div>
    </div>
  )
}

function StabilityBar({ buckets }: { buckets: { label: string; count: number }[] }) {
  const total = buckets.reduce((sum, b) => sum + b.count, 0)
  if (total === 0) return (
    <div className="text-sm text-gray-400">No cards in review yet</div>
  )

  const colours = ['bg-red-300', 'bg-amber-300', 'bg-yellow-400', 'bg-green-400', 'bg-emerald-600']

  return (
    <div className="flex flex-col gap-2">
      <div className="flex h-6 rounded-lg overflow-hidden gap-px">
        {buckets.map((b, i) => {
          const pct = Math.round((b.count / total) * 100)
          if (pct === 0) return null
          return (
            <div
              key={b.label}
              className={`${colours[i]} flex items-center justify-center text-xs text-white font-semibold`}
              style={{ width: `${pct}%` }}
              title={`${b.label}: ${b.count} cards (${pct}%)`}
            >
              {pct >= 10 ? `${pct}%` : ''}
            </div>
          )
        })}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {buckets.map((b, i) => (
          <span key={b.label} className="flex items-center gap-1">
            <span className={`inline-block w-3 h-3 rounded ${colours[i]}`} />
            <span className="text-gray-600">{b.label}</span>
            <span className="text-gray-400 font-mono">{b.count}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

export function StudyStats() {
  const navigate = useNavigate()
  const settings = useAppStore(s => s.settings)
  const activeUserId = useAppStore(s => s.activeUserId)

  const [storage] = useState(() => new SQLiteStorage())
  const scheduler = settings.schedulerAlgorithm === 'fsrs' ? new FSRSScheduler() : new SM2Scheduler()
  const [service] = useState(() => new SRSService(storage, scheduler))

  const [statsData, setStatsData] = useState<StudyStatsData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [windowDays, setWindowDays] = useState<StatsWindow>(30)

  useEffect(() => {
    if (!activeUserId) return
    void (async () => {
      const data = await service.getStudyStats(activeUserId)
      setStatsData(data)
      setIsLoading(false)
    })()
  }, [activeUserId, service])

  const totalCards = statsData
    ? statsData.cardStateCounts.new + statsData.cardStateCounts.learning + statsData.cardStateCounts.review + statsData.cardStateCounts.suspended
    : 0
  const windowedDailyReviews = useMemo(() => {
    if (!statsData || windowDays === 0) return statsData?.dailyReviews ?? []
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - (windowDays - 1))
    const cutoffKey = cutoff.toISOString().split('T')[0]
    return statsData.dailyReviews.filter(day => day.day >= cutoffKey)
  }, [statsData, windowDays])

  return (
    <div className="flex flex-col min-h-screen">
      <Navigation />
      <main className="flex flex-col gap-6 px-4 py-6 sm:p-6 max-w-2xl mx-auto w-full">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/study')}
            className="text-sm text-gray-400 hover:text-gray-600"
          >
            ← Back
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Study Statistics</h1>
        </div>
        <div className="flex w-fit rounded-xl bg-gray-100 p-1 text-sm">
          {[
            { label: '7 days', value: 7 as const },
            { label: '30 days', value: 30 as const },
            { label: 'All time', value: 0 as const },
          ].map(option => (
            <button
              key={option.label}
              onClick={() => setWindowDays(option.value)}
              className={`rounded-lg px-3 py-1.5 font-semibold transition-colors ${windowDays === option.value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex flex-col gap-4">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : statsData ? (
          <>
            {/* Retention rates */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
                <div className="text-3xl font-bold text-indigo-700">{statsData.retention7d}%</div>
                <div className="text-sm text-gray-600 mt-1">Retention (7 days)</div>
              </div>
              <div className="bg-purple-50 border border-purple-100 rounded-xl p-4">
                <div className="text-3xl font-bold text-purple-700">{statsData.retention30d}%</div>
                <div className="text-sm text-gray-600 mt-1">Retention (30 days)</div>
              </div>
            </div>

            {/* Card state counts */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h2 className="font-semibold text-gray-900 mb-4">Card Distribution</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="flex flex-col items-center bg-green-50 rounded-lg px-3 py-3">
                  <span className="text-2xl font-bold text-green-700">{statsData.cardStateCounts.new}</span>
                  <span className="text-xs text-gray-500 mt-1">New</span>
                </div>
                <div className="flex flex-col items-center bg-amber-50 rounded-lg px-3 py-3">
                  <span className="text-2xl font-bold text-amber-700">{statsData.cardStateCounts.learning}</span>
                  <span className="text-xs text-gray-500 mt-1">Learning</span>
                </div>
                <div className="flex flex-col items-center bg-blue-50 rounded-lg px-3 py-3">
                  <span className="text-2xl font-bold text-blue-700">{statsData.cardStateCounts.review}</span>
                  <span className="text-xs text-gray-500 mt-1">Review</span>
                </div>
                <div className="flex flex-col items-center bg-gray-50 rounded-lg px-3 py-3">
                  <span className="text-2xl font-bold text-gray-500">{statsData.cardStateCounts.suspended}</span>
                  <span className="text-xs text-gray-500 mt-1">Suspended</span>
                </div>
              </div>
              {totalCards > 0 && (
                <p className="text-xs text-gray-400 mt-3 text-center">{totalCards} total cards</p>
              )}
            </div>

            {/* Reviews per day */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h2 className="font-semibold text-gray-900 mb-4">
                Reviews Per Day ({windowDays === 0 ? 'All Time' : `Last ${windowDays} Days`})
              </h2>
              <BarChart data={windowedDailyReviews} windowDays={windowDays} />
            </div>

            {/* Stability distribution */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h2 className="font-semibold text-gray-900 mb-4">Card Maturity (by Stability)</h2>
              <StabilityBar buckets={statsData.stabilityBuckets} />
            </div>
          </>
        ) : (
          <div className="text-center text-gray-400 py-12">No statistics available</div>
        )}
      </main>
    </div>
  )
}
