import { useState } from 'react'
import type { JlptLevel } from '../content/contentTypes'

interface TestBuilderProps {
  level: JlptLevel
  availableQuestions: number
  onStart: (size: 20 | 30) => void
  onCancel: () => void
}

export function TestBuilder({ level, availableQuestions, onStart, onCancel }: TestBuilderProps) {
  const [size, setSize] = useState<20 | 30>(20)

  const canStart = availableQuestions >= size

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Start a Practice Test</h1>
        <p className="text-gray-600 mb-6">JLPT {level}</p>

        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Test Size</label>
            <div className="flex gap-2">
              {[20, 30].map(option => (
                <button
                  key={option}
                  onClick={() => setSize(option as 20 | 30)}
                  className={`flex-1 py-3 rounded-lg font-semibold transition-colors ${
                    size === option
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {option} Questions
                </button>
              ))}
            </div>
          </div>

          <div className="bg-blue-50 rounded-lg p-4 text-sm">
            <p className="text-blue-900">
              Available questions: <span className="font-semibold">{availableQuestions}</span>
            </p>
            {!canStart && (
              <p className="text-red-600 mt-2 font-semibold">
                Not enough questions available for {size}-question test
              </p>
            )}
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onStart(size)}
            disabled={!canStart}
            className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Start Test
          </button>
        </div>
      </div>
    </div>
  )
}
