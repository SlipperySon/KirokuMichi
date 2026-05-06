import { useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import type { GrammarPoint } from '../content/contentTypes'
import { GrammarExplainer } from './GrammarExplainer'

interface GrammarLessonProps {
  grammar: GrammarPoint
  onBack: () => void
}

export function GrammarLesson({ grammar, onBack }: GrammarLessonProps) {
  const [showExplainer, setShowExplainer] = useState(false)

  return (
    <>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-indigo-600 hover:text-indigo-700 mb-4 font-semibold"
        >
          <ChevronLeft className="w-5 h-5" />
          Back to Grammar
        </button>

        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{grammar.title}</h1>
          <p className="text-lg font-mono text-gray-600 mb-3">{grammar.pattern}</p>
          <p className="text-lg text-indigo-600 font-semibold">{grammar.meaning}</p>
        </div>

        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-gray-900">Explanation</h2>
            <button
              onClick={() => setShowExplainer(true)}
              className="text-sm text-indigo-600 hover:text-indigo-700 font-semibold"
            >
              Explain differently
            </button>
          </div>
          <p className="text-gray-700 leading-relaxed">{grammar.explanation}</p>
        </div>

        <div className="mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Examples</h2>
          <div className="space-y-4">
            {grammar.examples.map((ex, idx) => (
              <div key={idx} className="border-l-4 border-indigo-500 bg-indigo-50 p-4 rounded">
                <p className="text-lg font-semibold text-gray-900 mb-1">{ex.japanese}</p>
                <p className="text-sm text-gray-600 mb-2">{ex.reading}</p>
                <p className="text-gray-700">{ex.english}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-2 text-sm text-gray-500">
          {grammar.category && (
            <span className="bg-gray-200 rounded-full px-3 py-1">{grammar.category}</span>
          )}
          {grammar.isKeigo && <span className="bg-purple-200 text-purple-700 rounded-full px-3 py-1">敬語 (Keigo)</span>}
        </div>
      </div>
    </div>

    {showExplainer && (
      <GrammarExplainer
        point={grammar}
        onClose={() => setShowExplainer(false)}
      />
    )}
    </>
  )
}
