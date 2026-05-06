import type { GrammarPoint } from '../content/contentTypes'

interface Props {
  point: GrammarPoint
  onBack: () => void
}

export function GrammarLesson({ point, onBack }: Props) {
  return (
    <div className="flex flex-col gap-6">
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800 self-start"
      >
        ← Back
      </button>

      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-2xl font-bold" lang="ja">{point.title}</h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">{point.jlptLevel}</span>
          {point.isKeigo && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">keigo</span>
          )}
          {point.category && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{point.category}</span>
          )}
        </div>
        <p className="text-gray-600 text-base">{point.meaning}</p>
      </div>

      <div className="bg-gray-50 rounded-xl p-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Pattern</p>
        <p className="font-mono text-base" lang="ja">{point.pattern}</p>
      </div>

      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Explanation</p>
        <p className="text-sm text-gray-700 leading-relaxed">{point.explanation}</p>
      </div>

      {point.examples.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Examples</p>
          <div className="flex flex-col gap-3">
            {point.examples.map((ex, i) => (
              <div key={i} className="border-l-2 border-indigo-200 pl-4">
                <p className="text-base leading-loose" lang="ja">{ex.japanese}</p>
                {ex.reading && (
                  <p className="text-sm text-gray-500" lang="ja">{ex.reading}</p>
                )}
                <p className="text-sm text-gray-600 mt-0.5">{ex.english}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
