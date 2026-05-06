import { useState, useEffect } from 'react'
import type { GrammarPoint, JlptLevel } from '../content/contentTypes'
import type { GrammarService } from '../content/grammarService'
import { GrammarLesson } from './GrammarLesson'

interface Props {
  service: GrammarService
  level: JlptLevel
}

const KEIGO_INTRO = `Keigo (敬語) is the system of honorific speech in Japanese. It conveys respect and social relationships through vocabulary and grammatical structures. The three main types are: Sonkeigo (尊敬語 — respectful, elevates the listener's actions), Kenjōgo (謙譲語 — humble, lowers your own actions), and Teineigo (丁寧語 — polite, general formal register).`

export function KeigoBrowser({ service, level }: Props) {
  const [points, setPoints] = useState<GrammarPoint[]>([])
  const [selected, setSelected] = useState<GrammarPoint | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    service.getKeigo(level).then(results => {
      setPoints(results)
      setLoading(false)
    })
  }, [level, service])

  if (selected) {
    return <GrammarLesson point={selected} onBack={() => setSelected(null)} />
  }

  if (loading) {
    return <div className="p-8 text-center text-gray-400">Loading keigo…</div>
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-900">
        <p className="font-semibold mb-1">About Keigo 敬語</p>
        <p className="leading-relaxed">{KEIGO_INTRO}</p>
      </div>

      {points.length === 0 ? (
        <div className="flex flex-col items-center gap-4 p-12 text-center text-gray-400">
          <div className="text-4xl">🎌</div>
          <p className="font-medium">No keigo points yet for {level}</p>
          <p className="text-sm max-w-xs">Keigo content will be added in the content generation phase.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="text-xs text-gray-400">{points.length} keigo pattern{points.length !== 1 ? 's' : ''}</div>
          {points.map(pt => (
            <button
              key={pt.id}
              onClick={() => setSelected(pt)}
              className="flex flex-col gap-1 p-4 rounded-xl border border-amber-200 hover:border-amber-400 hover:bg-amber-50 text-left transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="font-semibold text-base" lang="ja">{pt.title}</span>
                <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">keigo</span>
                {pt.category && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">{pt.category}</span>
                )}
              </div>
              <p className="text-sm text-gray-600">{pt.meaning}</p>
              <p className="text-xs text-gray-400 font-mono" lang="ja">{pt.pattern}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
