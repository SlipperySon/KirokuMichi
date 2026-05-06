import { useState, useRef } from 'react'
import { useIntl } from 'react-intl'
import { BASE_HIRAGANA, BASE_KATAKANA, DAKUTEN_HIRAGANA, DAKUTEN_KATAKANA, HANDAKUTEN_HIRAGANA, HANDAKUTEN_KATAKANA, type KanaItem } from './kana-data'

type Script = 'hiragana' | 'katakana'
type QuizState = 'self-report' | 'select' | 'quiz' | 'result'
type KnowledgeLevel = 'all' | 'some' | null

interface Props {
  script: Script
  onPass: () => void
  onSkip: () => void
  onLearn?: () => void
}

const PASS_THRESHOLD = 0.8

export function StepKana({ script, onPass, onSkip, onLearn }: Props) {
  const intl = useIntl()
  const baseItems = script === 'hiragana' ? BASE_HIRAGANA : BASE_KATAKANA
  const dakutenItems = script === 'hiragana' ? DAKUTEN_HIRAGANA : DAKUTEN_KATAKANA
  const handakutenItems = script === 'hiragana' ? HANDAKUTEN_HIRAGANA : HANDAKUTEN_KATAKANA

  const [quizState, setQuizState] = useState<QuizState>('self-report')
  const [knowledgeLevel, setKnowledgeLevel] = useState<KnowledgeLevel>(null)
  const [includeDakuten, setIncludeDakuten] = useState(false)
  const [includeHandakuten, setIncludeHandakuten] = useState(false)
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [questions, setQuestions] = useState<KanaItem[]>([])
  const [current, setCurrent] = useState(0)
  const [correct, setCorrect] = useState(0)
  const [userInput, setUserInput] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [showAnswer, setShowAnswer] = useState(false)
  const [incorrectAnswers, setIncorrectAnswers] = useState<Array<{ char: string; correct: string; userAnswer: string }>>([])
  const inputRef = useRef<HTMLInputElement>(null)

  const prefix = `onboarding.${script}`
  const q = questions[current]
  const passed = correct / questions.length >= PASS_THRESHOLD
  const isCorrect = userInput.toLowerCase().trim() === q?.romaji.toLowerCase()

  function startQuizWithKnowledge(level: KnowledgeLevel) {
    setKnowledgeLevel(level)
    if (level === 'all' || level === 'some') {
      setQuizState('select')
    } else if (level === null) {
      onLearn?.()
    } else {
      onSkip()
    }
  }

  function handleSelectCharacters() {
    let items = [...selectedItems].map(char => baseItems.find(k => k.char === char)).filter(Boolean) as KanaItem[]
    if (includeDakuten) items.push(...dakutenItems)
    if (includeHandakuten) items.push(...handakutenItems)

    const shuffled = items.sort(() => Math.random() - 0.5)
    setQuestions(shuffled)
    setCurrent(0)
    setCorrect(0)
    setUserInput('')
    setConfirmed(false)
    setShowAnswer(false)
    setIncorrectAnswers([])
    setQuizState('quiz')
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  function handleReviewAll() {
    let items = [...baseItems]
    if (includeDakuten) items.push(...dakutenItems)
    if (includeHandakuten) items.push(...handakutenItems)

    const shuffled = [...items].sort(() => Math.random() - 0.5)
    setQuestions(shuffled)
    setCurrent(0)
    setCorrect(0)
    setUserInput('')
    setConfirmed(false)
    setShowAnswer(false)
    setIncorrectAnswers([])
    setQuizState('quiz')
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  function handleSubmit() {
    if (confirmed) return
    setConfirmed(true)
    setShowAnswer(true)
    if (isCorrect) {
      setCorrect(c => c + 1)
    } else {
      setIncorrectAnswers(prev => [...prev, {
        char: q!.char,
        correct: q!.romaji,
        userAnswer: userInput.toLowerCase().trim()
      }])
    }
  }

  function handleNext() {
    if (current + 1 < questions.length) {
      setCurrent(c => c + 1)
      setUserInput('')
      setConfirmed(false)
      setShowAnswer(false)
      setTimeout(() => inputRef.current?.focus(), 0)
    } else {
      setQuizState('result')
    }
  }

  function handleKeyPress(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (!confirmed) {
        handleSubmit()
      } else {
        handleNext()
      }
    }
  }

  function toggleCharacter(char: string) {
    const newSet = new Set(selectedItems)
    if (newSet.has(char)) {
      newSet.delete(char)
    } else {
      newSet.add(char)
    }
    setSelectedItems(newSet)
  }

  function toggleRow(rowIndex: number) {
    const itemsPerRow = 6
    const start = rowIndex * itemsPerRow
    const end = start + itemsPerRow
    const rowChars = baseItems.slice(start, end).map(item => item.char)
    const newSet = new Set(selectedItems)
    const allRowSelected = rowChars.every(char => newSet.has(char))

    rowChars.forEach(char => {
      if (allRowSelected) {
        newSet.delete(char)
      } else {
        newSet.add(char)
      }
    })
    setSelectedItems(newSet)
  }

  function getRowSelection(rowIndex: number) {
    const itemsPerRow = 6
    const start = rowIndex * itemsPerRow
    const end = start + itemsPerRow
    const rowChars = baseItems.slice(start, end).map(item => item.char)
    const allSelected = rowChars.every(char => selectedItems.has(char))
    const someSelected = rowChars.some(char => selectedItems.has(char))
    return { allSelected, someSelected }
  }

  if (quizState === 'self-report') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-8 p-8 max-w-lg mx-auto text-center">
        <h2 className="text-2xl font-bold">{intl.formatMessage({ id: `${prefix}.title` })}</h2>
        <p className="text-gray-600">{intl.formatMessage({ id: `${prefix}.description` })}</p>
        <div className="flex flex-col gap-3 w-full">
          <button
            onClick={() => startQuizWithKnowledge('all')}
            className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors"
          >
            {intl.formatMessage({ id: `${prefix}.know` })}
          </button>
          <button
            onClick={() => startQuizWithKnowledge('some')}
            className="px-6 py-3 border-2 border-indigo-300 text-indigo-700 rounded-xl font-semibold hover:bg-indigo-50 transition-colors"
          >
            {intl.formatMessage({ id: `${prefix}.some` })}
          </button>
          <button
            onClick={() => startQuizWithKnowledge(null)}
            className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
          >
            I need to learn {script}
          </button>
          <button
            onClick={onSkip}
            className="text-gray-500 hover:text-gray-700 text-sm mt-2"
          >
            {intl.formatMessage({ id: `${prefix}.none` })}
          </button>
        </div>
      </div>
    )
  }

  if (quizState === 'select') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-6 p-8 max-w-2xl mx-auto">
        <h2 className="text-2xl font-bold">
          {knowledgeLevel === 'all'
            ? `Review ${script}`
            : `Select which ${script} you know`}
        </h2>

        {knowledgeLevel === 'some' && (
          <p className="text-gray-600 text-center">
            Click to select which characters you know
          </p>
        )}

        {knowledgeLevel === 'some' && (
          <div className="w-full">
            {Array.from({ length: Math.ceil(baseItems.length / 6) }, (_, rowIndex) => {
              const { allSelected, someSelected } = getRowSelection(rowIndex)
              const itemsPerRow = 6
              const start = rowIndex * itemsPerRow
              const rowItems = baseItems.slice(start, start + itemsPerRow)

              return (
                <div key={rowIndex} className="flex gap-2 mb-2 items-center justify-start">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => {
                      if (el && someSelected && !allSelected) {
                        (el as HTMLInputElement & { indeterminate: boolean }).indeterminate = true
                      }
                    }}
                    onChange={() => toggleRow(rowIndex)}
                    className="w-5 h-5 rounded border-gray-300 cursor-pointer flex-shrink-0"
                    title={allSelected ? 'Deselect row' : 'Select row'}
                  />
                  <div className="grid gap-2 flex-1" style={{ gridTemplateColumns: `repeat(${rowItems.length}, minmax(0, 1fr))` }}>
                    {rowItems.map(item => {
                      const isSelected = selectedItems.has(item.char)
                      return (
                        <button
                          key={item.char}
                          onClick={() => toggleCharacter(item.char)}
                          className={`p-3 rounded-lg text-2xl font-bold transition-colors ${
                            isSelected
                              ? 'bg-indigo-600 text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                          lang="ja"
                        >
                          {item.char}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <div className="flex flex-col gap-4 w-full max-w-md">
          <div className="flex gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includeDakuten}
                onChange={e => setIncludeDakuten(e.target.checked)}
                className="w-5 h-5 rounded border-gray-300"
              />
              <span className="text-gray-700">Include dakuten (゛) variants</span>
            </label>
          </div>

          <div className="flex gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includeHandakuten}
                onChange={e => setIncludeHandakuten(e.target.checked)}
                className="w-5 h-5 rounded border-gray-300"
              />
              <span className="text-gray-700">Include handakuten (゜) variants</span>
            </label>
          </div>

          <div className="flex gap-3">
            {knowledgeLevel === 'all' ? (
              <>
                <button
                  onClick={handleReviewAll}
                  className="flex-1 px-6 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors"
                >
                  Start Quiz
                </button>
                <button
                  onClick={() => onPass()}
                  className="flex-1 px-6 py-3 border-2 border-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
                >
                  Skip Script
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleSelectCharacters}
                  disabled={selectedItems.size === 0}
                  className="flex-1 px-6 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Quiz Me ({selectedItems.size})
                </button>
                <button
                  onClick={() => onPass()}
                  className="flex-1 px-6 py-3 border-2 border-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
                >
                  Skip Script
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    )
  }

  const shouldShowKana = current < Math.ceil(questions.length * 0.33)

  if (quizState === 'quiz') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-8 p-8 max-w-md mx-auto text-center">
        <div className="text-sm text-gray-400">
          {current + 1} / {questions.length}
        </div>
        <div className="flex flex-col items-center gap-4">
          {shouldShowKana && (
            <div className="text-2xl text-gray-500" lang="ja">
              {q?.romaji}
            </div>
          )}
          <div className="text-8xl font-bold" lang="ja">
            {q?.char}
          </div>
        </div>
        <p className="text-gray-600">{intl.formatMessage({ id: `${prefix}.test_prompt` })}</p>

        <input
          ref={inputRef}
          type="text"
          placeholder="Type romaji..."
          value={userInput}
          onChange={e => setUserInput(e.target.value)}
          onKeyDown={handleKeyPress}
          disabled={confirmed}
          autoFocus
          className="w-full px-4 py-3 text-center text-lg border-2 border-gray-200 rounded-xl focus:outline-none focus:border-indigo-400 disabled:bg-gray-50 disabled:text-gray-600"
        />

        {showAnswer && (
          <div className={`text-lg font-semibold ${isCorrect ? 'text-green-600' : 'text-red-600'}`}>
            {isCorrect ? '✓ Correct!' : `✗ Answer: ${q?.romaji}`}
          </div>
        )}

        {confirmed && (
          <button
            onClick={handleNext}
            className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors"
          >
            {current + 1 < questions.length ? 'Next →' : 'See Results'}
          </button>
        )}

        {!confirmed && (
          <button
            onClick={handleSubmit}
            className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors"
          >
            Check
          </button>
        )}
      </div>
    )
  }

  // result
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-6 p-8 max-w-2xl mx-auto text-center">
      <div className="text-6xl">{passed ? '🎉' : '📚'}</div>
      <h2 className="text-2xl font-bold">
        {correct} / {questions.length}
      </h2>
      <p className="text-gray-600">
        {passed
          ? intl.formatMessage({ id: `${prefix}.pass` })
          : intl.formatMessage({ id: `${prefix}.retry` })}
      </p>

      {incorrectAnswers.length > 0 && (
        <div className="w-full bg-red-50 rounded-lg p-4 mt-4">
          <h3 className="font-semibold text-red-900 mb-3">Incorrect answers:</h3>
          <div className="space-y-3 text-left">
            {incorrectAnswers.map((item, idx) => (
              <div key={idx} className="bg-white rounded p-3 border border-red-200">
                <div className="text-3xl font-bold text-red-600 mb-2" lang="ja">
                  {item.char}
                </div>
                <div className="text-sm text-gray-700">
                  <div>Your answer: <span className="font-mono text-red-600">{item.userAnswer || '(blank)'}</span></div>
                  <div>Correct: <span className="font-mono text-green-600">{item.correct}</span></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={passed ? onPass : onSkip}
        className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors mt-4"
      >
        Continue
      </button>
      {!passed && (
        <button onClick={onSkip} className="text-gray-500 hover:text-gray-700 text-sm">
          {intl.formatMessage({ id: `${prefix}.skip` })}
        </button>
      )}
    </div>
  )
}
