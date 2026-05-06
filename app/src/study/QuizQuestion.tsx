import type { QuizItem } from '../content/contentTypes'

interface QuizQuestionProps {
  question: QuizItem
  userAnswer: string | null
  onAnswerChange: (answer: string) => void
  disabled?: boolean
}

export function QuizQuestion({ question, userAnswer, onAnswerChange, disabled = false }: QuizQuestionProps) {
  return (
    <div className="bg-white rounded-lg p-6 border border-gray-200">
      <h2 className="text-xl font-bold text-gray-900 mb-6">{question.prompt}</h2>

      <div className="space-y-3">
        {question.options.map((option, idx) => (
          <label
            key={idx}
            className={`flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all ${
              userAnswer === option
                ? 'border-indigo-600 bg-indigo-50'
                : 'border-gray-200 hover:border-gray-300'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <input
              type="radio"
              name="answer"
              value={option}
              checked={userAnswer === option}
              onChange={e => onAnswerChange(e.target.value)}
              disabled={disabled}
              className="w-5 h-5 text-indigo-600"
            />
            <span className="text-gray-700 font-medium">{option}</span>
          </label>
        ))}
      </div>
    </div>
  )
}
