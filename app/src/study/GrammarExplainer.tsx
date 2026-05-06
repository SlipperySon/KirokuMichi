import { useState } from 'react'
import { X } from 'lucide-react'
import { useAppStore } from '../store'
import { ClientAIProvider } from '../ai/aiProvider'
import { EXPLAIN_SYSTEM_PROMPT } from '../ai/systemPrompts'
import type { GrammarPoint } from '../content/contentTypes'

interface GrammarExplainerProps {
  point: GrammarPoint
  onClose: () => void
}

export function GrammarExplainer({ point, onClose }: GrammarExplainerProps) {
  const { settings } = useAppStore()
  const [explanation, setExplanation] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleExplain = async () => {
    setLoading(true)
    setError(null)

    try {
      const aiProvider = new ClientAIProvider(settings.sessionToken)
      const prompt = `Please explain this Japanese grammar pattern in a clear, accessible way:

Title: ${point.title}
Pattern: ${point.pattern}
Meaning: ${point.meaning}

Current explanation: ${point.explanation}

Provide a clearer or different explanation with 2-3 examples.`

      const response = await aiProvider.completeWithMessages(
        [{ role: 'user', content: prompt }],
        EXPLAIN_SYSTEM_PROMPT,
        'fast'
      )

      setExplanation(response)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Explanation failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto m-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-900">{point.title}</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="space-y-4 mb-6">
          <div>
            <p className="text-sm font-semibold text-gray-700">Pattern</p>
            <p className="text-base font-mono text-gray-900 bg-gray-50 p-2 rounded mt-1">
              {point.pattern}
            </p>
          </div>

          <div>
            <p className="text-sm font-semibold text-gray-700">Meaning</p>
            <p className="text-base text-gray-900 mt-1">{point.meaning}</p>
          </div>

          <div>
            <p className="text-sm font-semibold text-gray-700">Explanation</p>
            <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">
              {point.explanation}
            </p>
          </div>

          {point.examples && point.examples.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-gray-700">Examples</p>
              <div className="space-y-2 mt-1">
                {point.examples.map((ex, i) => (
                  <div key={i} className="bg-gray-50 p-3 rounded">
                    <p className="font-mono text-sm text-gray-900">{ex.japanese}</p>
                    <p className="text-xs text-gray-600 mt-1">{ex.reading}</p>
                    <p className="text-sm text-gray-700 mt-1">{ex.english}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {!explanation && (
          <button
            onClick={handleExplain}
            disabled={loading}
            className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-semibold"
          >
            {loading ? 'Explaining differently…' : 'Explain Differently'}
          </button>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            <p className="text-sm">{error}</p>
          </div>
        )}

        {explanation && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm font-semibold text-blue-900 mb-2">Alternative Explanation</p>
              <p className="text-sm text-blue-800 whitespace-pre-wrap">{explanation}</p>
            </div>

            <button
              onClick={() => setExplanation(null)}
              className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-semibold"
            >
              Try Another Explanation
            </button>

            <button
              onClick={onClose}
              className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-semibold"
            >
              Got it, close
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
