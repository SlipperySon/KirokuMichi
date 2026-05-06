import { useState, useEffect } from 'react'
import type { QuizItem, JlptLevel } from '../content/contentTypes'
import type { GrammarService } from '../content/grammarService'
import type { TestResult } from './types'
import { QuizQuestion } from './QuizQuestion'
import { TestSummary } from './TestSummary'

interface Props {
  service: GrammarService
  level: JlptLevel
  questionCount?: number
  onDone: () => void
}

export function PracticeTest({ service, level, questionCount = 10, onDone }: Props) {
  const [items, setItems] = useState<QuizItem[]>([])
  const [index, setIndex] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [wrongIds, setWrongIds] = useState<number[]>([])
  const [startMs, setStartMs] = useState(0)
  const [result, setResult] = useState<TestResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [noContent, setNoContent] = useState(false)

  async function loadQuestions() {
    setLoading(true)
    setResult(null)
    setIndex(0)
    setSelected(null)
    setConfirmed(false)
    setWrongIds([])
    const qs = await service.getQuizItems(level, questionCount)
    if (qs.length === 0) { setNoContent(true); setLoading(false); return }
    setItems(qs)
    setStartMs(Date.now())
    setLoading(false)
  }

  useEffect(() => { loadQuestions() }, [level])

  function handleSelect(opt: string) {
    if (confirmed) return
    setSelected(opt)
    setConfirmed(true)
  }

  function handleNext() {
    const item = items[index]
    if (selected !== item.answer) {
      setWrongIds(prev => [...prev, item.id])
    }
    const nextIndex = index + 1
    if (nextIndex >= items.length) {
      const correct = items.length - wrongIds.length - (selected !== item.answer ? 1 : 0)
      setResult({
        total: items.length,
        correct,
        wrongIds,
        durationMs: Date.now() - startMs,
        level,
        mode: 'practice',
      })
      return
    }
    setIndex(nextIndex)
    setSelected(null)
    setConfirmed(false)
  }

  if (loading) return <div className="p-8 text-center text-gray-400">Loading questions…</div>

  if (noContent) {
    return (
      <div className="flex flex-col items-center gap-4 p-12 text-center text-gray-400">
        <div className="text-4xl">📝</div>
        <p className="font-medium">No practice questions yet for {level}</p>
        <p className="text-sm max-w-xs">Questions will be available after the content generation phase.</p>
        <button onClick={onDone} className="mt-2 px-6 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700">
          Back
        </button>
      </div>
    )
  }

  if (result) {
    return <TestSummary result={result} onRetry={loadQuestions} onDone={onDone} />
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <button onClick={onDone} className="text-sm text-indigo-600 hover:text-indigo-800">← Exit</button>
        <span className="text-sm font-semibold text-indigo-600">{level} Practice</span>
      </div>

      <QuizQuestion
        item={items[index]}
        selected={selected}
        confirmed={confirmed}
        onSelect={handleSelect}
        index={index}
        total={items.length}
      />

      {confirmed && (
        <button
          onClick={handleNext}
          className="w-full px-6 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors"
        >
          {index + 1 >= items.length ? 'See Results' : 'Next →'}
        </button>
      )}
    </div>
  )
}
