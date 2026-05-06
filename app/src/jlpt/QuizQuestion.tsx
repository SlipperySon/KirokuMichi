import type { QuizItem } from '../content/contentTypes'

interface Props {
  item: QuizItem
  selected: string | null
  confirmed: boolean
  onSelect: (opt: string) => void
  index: number
  total: number
}

export function QuizQuestion({ item, selected, confirmed, onSelect, index, total }: Props) {
  const isCorrect = selected === item.answer

  return (
    <div className="flex flex-col gap-4 w-full">
      <div className="flex items-center justify-between text-sm text-gray-400">
        <span>Question {index + 1} / {total}</span>
        <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600">{item.jlptLevel}</span>
      </div>

      <div className="bg-gray-50 rounded-xl p-6 text-center">
        <p className="text-xl leading-loose" lang="ja">{item.prompt}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {item.options.map(opt => {
          const isOpt = opt === selected
          const isAns = opt === item.answer
          let cls = 'px-4 py-3 rounded-xl font-medium border-2 transition-colors text-left '
          if (!confirmed) {
            cls += 'border-gray-200 hover:border-indigo-400 hover:bg-indigo-50 cursor-pointer'
          } else if (isAns) {
            cls += 'border-green-500 bg-green-50 text-green-700'
          } else if (isOpt) {
            cls += 'border-red-400 bg-red-50 text-red-600'
          } else {
            cls += 'border-gray-100 text-gray-400'
          }
          return (
            <button key={opt} className={cls} onClick={() => onSelect(opt)} lang="ja">
              {opt}
            </button>
          )
        })}
      </div>

      {confirmed && (
        <div className="flex flex-col gap-1">
          <p className={`text-sm font-semibold ${isCorrect ? 'text-green-600' : 'text-red-600'}`}>
            {isCorrect ? '✓ Correct!' : `✗ Answer: ${item.answer}`}
          </p>
          {item.explanation && (
            <p className="text-sm text-gray-500">{item.explanation}</p>
          )}
        </div>
      )}
    </div>
  )
}
