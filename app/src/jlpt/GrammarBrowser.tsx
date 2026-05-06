import { useState, useEffect } from 'react'
import type { GrammarPoint, JlptLevel } from '../content/contentTypes'
import type { GrammarService } from '../content/grammarService'

interface Props {
  service: GrammarService
  level: JlptLevel
  onSelect: (point: GrammarPoint) => void
}

export function GrammarBrowser({ service, level, onSelect }: Props) {
  const [points, setPoints] = useState<GrammarPoint[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const load = async () => {
      const results = query.trim()
        ? await service.search(query.trim(), level)
        : await service.getByLevel(level)
      setPoints(results)
      setLoading(false)
    }
    load()
  }, [level, query, service])

  if (loading) {
    return <div className="p-8 text-center text-gray-400">Loading grammar points…</div>
  }

  if (points.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 p-12 text-center text-gray-400">
        <div className="text-4xl">📚</div>
        <p className="font-medium">No grammar points yet for {level}</p>
        <p className="text-sm max-w-xs">Grammar content will be added in the content generation phase.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <input
        type="search"
        placeholder="Search grammar…"
        value={query}
        onChange={e => setQuery(e.target.value)}
        className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-300 text-sm"
      />
      <div className="text-xs text-gray-400">{points.length} point{points.length !== 1 ? 's' : ''}</div>
      <div className="flex flex-col gap-2">
        {points.map(pt => (
          <button
            key={pt.id}
            onClick={() => onSelect(pt)}
            className="flex flex-col gap-1 p-4 rounded-xl border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 text-left transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="font-semibold text-base" lang="ja">{pt.title}</span>
              {pt.isKeigo && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">keigo</span>
              )}
              {pt.category && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">{pt.category}</span>
              )}
            </div>
            <p className="text-sm text-gray-600">{pt.meaning}</p>
            <p className="text-xs text-gray-400 font-mono" lang="ja">{pt.pattern}</p>
          </button>
        ))}
      </div>
    </div>
  )
}
