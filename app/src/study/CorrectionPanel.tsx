import { useState } from 'react'
import { CheckCircle } from 'lucide-react'
import { useAppStore } from '../store'
import { ClientAIProvider } from '../ai/aiProvider'
import { CORRECTION_SYSTEM_PROMPT } from '../ai/systemPrompts'

interface CorrectionResult {
  corrected: string
  explanation: string
  alternatives?: string[]
}

export function CorrectionPanel() {
  const { settings } = useAppStore()
  const [input, setInput] = useState('')
  const [result, setResult] = useState<CorrectionResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (!input.trim() || loading) return

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const aiProvider = new ClientAIProvider(settings.sessionToken)
      const response = await aiProvider.completeWithMessages(
        [{ role: 'user', content: `Please correct this Japanese: ${input}` }],
        CORRECTION_SYSTEM_PROMPT,
        'fast'
      )

      // Simple parsing: expect format like "Corrected: ... Explanation: ..."
      const lines = response.split('\n')
      const corrected = lines[0] || ''
      const explanation = lines.slice(1).join('\n')

      setResult({
        corrected,
        explanation,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Correction failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Sentence Correction</h2>
        <p className="text-sm text-gray-600">Type a Japanese sentence and get feedback</p>
      </div>

      <div className="space-y-2">
        <label htmlFor="correction-input" className="sr-only">Japanese sentence to correct</label>
        <textarea
          id="correction-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Type Japanese here…"
          disabled={loading}
          rows={3}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
        />
        <button
          onClick={handleSubmit}
          disabled={!input.trim() || loading}
          className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-semibold"
        >
          {loading ? 'Analyzing…' : 'Check'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          <p className="text-sm">{error}</p>
        </div>
      )}

      {result && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-3" role="region" aria-label="Correction result" aria-live="polite">
          <div className="flex items-center gap-2 text-green-700 font-semibold">
            <CheckCircle className="w-5 h-5" />
            Correction Feedback
          </div>

          <div className="space-y-2">
            <div>
              <p className="text-sm font-semibold text-gray-700">Suggested correction:</p>
              <p className="text-base text-gray-900 bg-white px-3 py-2 rounded mt-1">
                {result.corrected}
              </p>
            </div>

            <div>
              <p className="text-sm font-semibold text-gray-700">Why:</p>
              <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">{result.explanation}</p>
            </div>

            {result.alternatives && result.alternatives.length > 0 && (
              <div>
                <p className="text-sm font-semibold text-gray-700">Other natural ways to say this:</p>
                <ul className="mt-1 space-y-1">
                  {result.alternatives.map((alt, i) => (
                    <li key={i} className="text-sm text-gray-700">• {alt}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <button
            onClick={() => {
              setResult(null)
              setInput('')
            }}
            className="text-sm text-indigo-600 hover:text-indigo-700 font-semibold"
          >
            Try another sentence
          </button>
        </div>
      )}
    </div>
  )
}
