import { useState, useEffect, useCallback } from 'react'
import type { VocabItem, JlptLevel } from '../content/contentTypes'
import type { VocabService } from '../content/vocabService'

interface Props {
  service: VocabService
  level: JlptLevel
  userId: number
}

export function VocabBrowser({ service, level, userId }: Props) {
  const [items, setItems] = useState<VocabItem[]>([])
  const [query, setQuery] = useState('')
  const [offset, setOffset] = useState(0)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [addedIds, setAddedIds] = useState<Set<number>>(new Set())
  const PAGE = 50

  const load = useCallback(async () => {
    setLoading(true)
    if (query.trim()) {
      const results = await service.search(query.trim(), userId, level)
      setItems(results)
    } else {
      const [results, count] = await Promise.all([
        service.getByLevel(level, userId, offset, PAGE),
        service.getCountByLevel(level),
      ])
      setItems(results)
      setTotal(count)
    }
    setLoading(false)
  }, [level, userId, query, offset, service])

  useEffect(() => { setOffset(0) }, [level, query])
  useEffect(() => { load() }, [load])

  async function handleAddToSrs(item: VocabItem) {
    await service.addToSrs(item.id, userId)
    setAddedIds(prev => new Set([...prev, item.id]))
  }

  if (loading) {
    return <div className="p-8 text-center text-gray-400">Loading vocabulary…</div>
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 p-12 text-center text-gray-400">
        <div className="text-4xl">📖</div>
        <p className="font-medium">No vocabulary yet for {level}</p>
        <p className="text-sm max-w-xs">Vocabulary content will be added in the content generation phase.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <input
        type="search"
        placeholder="Search vocabulary…"
        value={query}
        onChange={e => setQuery(e.target.value)}
        className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-300 text-sm"
      />
      <div className="text-xs text-gray-400">
        {query.trim() ? `${items.length} results` : `${total} words`}
      </div>

      <div className="flex flex-col gap-2">
        {items.map(item => {
          const inSrs = item.isLearned || addedIds.has(item.id)
          return (
            <div
              key={item.id}
              className="flex items-center gap-3 p-3 rounded-xl border border-gray-200"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-lg font-semibold" lang="ja">{item.front}</span>
                  {item.reading && (
                    <span className="text-sm text-gray-400" lang="ja">{item.reading}</span>
                  )}
                </div>
                <p className="text-sm text-gray-600 truncate">{item.back}</p>
              </div>
              <button
                onClick={() => !inSrs && handleAddToSrs(item)}
                className={`shrink-0 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  inSrs
                    ? 'bg-green-50 text-green-600 cursor-default'
                    : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
                }`}
              >
                {inSrs ? '✓ Added' : '+ SRS'}
              </button>
            </div>
          )
        })}
      </div>

      {!query.trim() && total > PAGE && (
        <div className="flex gap-2 justify-center mt-2">
          <button
            onClick={() => setOffset(Math.max(0, offset - PAGE))}
            disabled={offset === 0}
            className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 disabled:opacity-40"
          >
            ← Prev
          </button>
          <span className="px-3 py-1.5 text-sm text-gray-500">
            {offset + 1}–{Math.min(offset + PAGE, total)} of {total}
          </span>
          <button
            onClick={() => setOffset(offset + PAGE)}
            disabled={offset + PAGE >= total}
            className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 disabled:opacity-40"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  )
}
