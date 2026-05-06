import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { QuizItem } from '../content/contentTypes'
import { QuizQuestion } from './QuizQuestion'

interface QuizModeProps {
  questions: QuizItem[]
  onComplete: (responses: Array<{ questionId: number; answer: string | null; correct: boolean }>) => void
  onCancel: () => void
}

export function QuizMode({ questions, onComplete, onCancel }: QuizModeProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<number, string>>({})

  const current = questions[currentIndex]
  const answered = answers[current.id]

  const handleAnswer = (answer: string) => {
    setAnswers(prev => ({ ...prev, [current.id]: answer }))
  }

  const handlePrevious = () => {
    if (currentIndex > 0) setCurrentIndex(currentIndex - 1)
  }

  const handleNext = () => {
    if (currentIndex < questions.length - 1) setCurrentIndex(currentIndex + 1)
  }

  const handleFinish = () => {
    const responses = questions.map(q => ({
      questionId: q.id,
      answer: answers[q.id] || null,
      correct: answers[q.id] === q.answer,
    }))
    onComplete(responses)
  }

  const correctCount = Object.entries(answers).filter(
    ([qId, answer]) => answer === questions.find(q => q.id === parseInt(qId))?.answer
  ).length

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Practice Test</h1>
          <p className="text-sm text-gray-600">
            Question {currentIndex + 1} of {questions.length}
          </p>
        </div>
        <div className="text-right">
          <div className="text-sm text-gray-600">Score</div>
          <div className="text-2xl font-bold text-indigo-600">
            {correctCount}/{questions.length}
          </div>
        </div>
      </div>

      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className="bg-indigo-600 h-2 rounded-full transition-all"
          style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
        />
      </div>

      <QuizQuestion question={current} userAnswer={answered || null} onAnswerChange={handleAnswer} />

      <div className="flex gap-3 justify-between">
        <button
          onClick={onCancel}
          className="px-4 py-2 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
        >
          Exit Test
        </button>

        <div className="flex gap-2">
          <button
            onClick={handlePrevious}
            disabled={currentIndex === 0}
            className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
            Previous
          </button>

          {currentIndex < questions.length - 1 ? (
            <button
              onClick={handleNext}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors"
            >
              Next
              <ChevronRight className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={handleFinish}
              className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors"
            >
              Finish Test
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
