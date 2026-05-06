import { useState } from 'react'
import { useIntl } from 'react-intl'
import type { Rating } from '../core/providers'
import type { GrammarQuestion, IntervalPreview } from './types'
import { RatingButtons } from './RatingButtons'

interface Props {
  question: GrammarQuestion
  phase: 'front' | 'back'
  intervalPreviews: IntervalPreview | null
  onAnswer: (isCorrect: boolean) => void
  onRate: (rating: Rating) => void
}

function renderPrompt(prompt: string, answer: string | null) {
  const parts = prompt.split('[___]')
  return (
    <span lang="ja">
      {parts.map((part, i) => (
        <span key={i}>
          {part}
          {i < parts.length - 1 && (
            <span className={`inline-block min-w-16 border-b-2 text-center mx-1 font-semibold ${answer ? 'border-green-500 text-green-700' : 'border-gray-400'}`}>
              {answer ?? '＿＿'}
            </span>
          )}
        </span>
      ))}
    </span>
  )
}

export function CardGrammar({ question, phase, intervalPreviews, onAnswer, onRate }: Props) {
  const intl = useIntl()
  const [selected, setSelected] = useState<string | null>(null)
  const [answered, setAnswered] = useState(false)

  function handleSelect(opt: string) {
    if (answered) return
    setSelected(opt)
    setAnswered(true)
    onAnswer(opt === question.answer)
  }

  const isCorrect = selected === question.answer

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-xl mx-auto">
      <p className="text-gray-500 text-sm">{intl.formatMessage({ id: 'study.grammar.choose' })}</p>

      <div className="w-full bg-gray-50 rounded-2xl p-6 text-center text-lg leading-relaxed">
        {renderPrompt(question.prompt, phase === 'back' ? question.answer : null)}
      </div>

      <div className="grid grid-cols-2 gap-3 w-full">
        {question.options.map(opt => {
          const isThisCorrect = opt === question.answer
          const isThisSelected = opt === selected
          let cls = 'px-4 py-3 rounded-xl border-2 font-medium transition-colors text-left '
          if (!answered) {
            cls += 'border-gray-200 hover:border-indigo-400 hover:bg-indigo-50 cursor-pointer'
          } else if (isThisCorrect) {
            cls += 'border-green-500 bg-green-50 text-green-700'
          } else if (isThisSelected) {
            cls += 'border-red-400 bg-red-50 text-red-600'
          } else {
            cls += 'border-gray-100 text-gray-400'
          }
          return (
            <button key={opt} className={cls} onClick={() => handleSelect(opt)} lang="ja">
              {opt}
            </button>
          )
        })}
      </div>

      {phase === 'back' && (
        <div className="flex flex-col gap-4 w-full">
          {question.explanation && (
            <p className={`text-sm px-4 py-3 rounded-lg ${isCorrect ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {question.explanation}
            </p>
          )}
          <RatingButtons previews={intervalPreviews} onRate={onRate} />
        </div>
      )}
    </div>
  )
}
