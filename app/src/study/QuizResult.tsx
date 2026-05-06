import { CheckCircle2, XCircle } from 'lucide-react'
import type { QuizItem } from '../content/contentTypes'

interface QuizResultProps {
  questions: QuizItem[]
  responses: Array<{ questionId: number; answer: string | null; correct: boolean }>
  duration: number
  onBack: () => void
  onRetake: () => void
}

export function QuizResult({ questions, responses, duration, onBack, onRetake }: QuizResultProps) {
  const correctCount = responses.filter(r => r.correct).length
  const scorePercent = Math.round((correctCount / questions.length) * 100)
  const minutes = Math.round(duration / 60)

  const getScoreColor = (percent: number) => {
    if (percent >= 90) return 'text-green-600'
    if (percent >= 75) return 'text-blue-600'
    if (percent >= 50) return 'text-orange-600'
    return 'text-red-600'
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto">
      <div className="text-center py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Test Complete!</h1>
        <div className={`text-5xl font-bold ${getScoreColor(scorePercent)} mb-2`}>{scorePercent}%</div>
        <p className="text-lg text-gray-600">
          {correctCount} correct out of {questions.length} questions
        </p>
        <p className="text-sm text-gray-500">Completed in {minutes} minute{minutes !== 1 ? 's' : ''}</p>
      </div>

      <div className="bg-gradient-to-r from-indigo-50 to-blue-50 rounded-lg p-6 mb-4">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Review Your Answers</h2>
        <div className="space-y-4">
          {questions.map((q, idx) => {
            const response = responses[idx]
            return (
              <div key={q.id} className="bg-white rounded-lg p-4 border-l-4" style={{
                borderColor: response.correct ? '#10b981' : '#ef4444'
              }}>
                <div className="flex items-start gap-3 mb-2">
                  {response.correct ? (
                    <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900">{q.prompt}</p>
                    <div className="mt-2 space-y-1 text-sm">
                      <p className="text-gray-600">
                        Your answer: <span className="font-mono font-semibold">{response.answer || '(no answer)'}</span>
                      </p>
                      {!response.correct && (
                        <p className="text-green-600">
                          Correct: <span className="font-mono font-semibold">{q.answer}</span>
                        </p>
                      )}
                      {q.explanation && (
                        <p className="text-gray-600 italic mt-2">{q.explanation}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="flex-1 px-4 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
        >
          Back to Tests
        </button>
        <button
          onClick={onRetake}
          className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors"
        >
          Retake Test
        </button>
      </div>
    </div>
  )
}
