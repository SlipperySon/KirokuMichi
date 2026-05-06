import { useState, useEffect, useRef } from 'react'
import type { QuizItem, JlptLevel } from '../content/contentTypes'
import type { GrammarService } from '../content/grammarService'
import type { TestResult } from './types'
import { QuizQuestion } from './QuizQuestion'
import { TestSummary } from './TestSummary'

interface Props {
  service: GrammarService
  level: JlptLevel
  onDone: () => void
}

const QUESTION_COUNTS: Record<JlptLevel, number> = {
  N5: 30, N4: 35, N3: 40, N2: 45, N1: 50,
}
const TIME_LIMITS_MS: Record<JlptLevel, number> = {
  N5: 25 * 60 * 1000,
  N4: 30 * 60 * 1000,
  N3: 40 * 60 * 1000,
  N2: 50 * 60 * 1000,
  N1: 60 * 60 * 1000,
}

function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}

export function SimulatedTest({ service, level, onDone }: Props) {
  const [phase, setPhase] = useState<'intro' | 'test' | 'result'>('intro')
  const [items, setItems] = useState<QuizItem[]>([])
  const [answers, setAnswers] = useState<(string | null)[]>([])
  const [index, setIndex] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [timeLeft, setTimeLeft] = useState(TIME_LIMITS_MS[level])
  const [result, setResult] = useState<TestResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [noContent, setNoContent] = useState(false)
  const startMsRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  function stopTimer() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
  }

  function finishTest(finalAnswers: (string | null)[]) {
    stopTimer()
    const wrongIds: number[] = []
    let correct = 0
    items.forEach((item, i) => {
      if (finalAnswers[i] === item.answer) correct++
      else wrongIds.push(item.id)
    })
    setResult({
      total: items.length,
      correct,
      wrongIds,
      durationMs: Date.now() - startMsRef.current,
      level,
      mode: 'simulated',
    })
    setPhase('result')
  }

  async function startTest() {
    setLoading(true)
    const qs = await service.getQuizItems(level, QUESTION_COUNTS[level])
    if (qs.length === 0) { setNoContent(true); setLoading(false); return }
    setItems(qs)
    setAnswers(new Array(qs.length).fill(null))
    setIndex(0)
    setSelected(null)
    setConfirmed(false)
    setTimeLeft(TIME_LIMITS_MS[level])
    startMsRef.current = Date.now()
    setPhase('test')
    setLoading(false)
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1000) { finishTest(answers); return 0 }
        return prev - 1000
      })
    }, 1000)
  }

  useEffect(() => () => stopTimer(), [])

  function handleSelect(opt: string) {
    if (confirmed) return
    setSelected(opt)
    setConfirmed(true)
    const next = [...answers]
    next[index] = opt
    setAnswers(next)
  }

  function handleNext() {
    const nextIndex = index + 1
    if (nextIndex >= items.length) {
      finishTest(answers)
      return
    }
    setIndex(nextIndex)
    setSelected(answers[nextIndex])
    setConfirmed(answers[nextIndex] !== null)
  }

  const isLow = timeLeft < 5 * 60 * 1000

  if (phase === 'intro') {
    return (
      <div className="flex flex-col items-center gap-6 py-8 text-center max-w-md mx-auto">
        <div className="text-4xl">🎓</div>
        <div>
          <h3 className="text-xl font-bold">{level} Simulated Test</h3>
          <p className="text-gray-500 text-sm mt-1">
            {QUESTION_COUNTS[level]} questions · {formatTime(TIME_LIMITS_MS[level])} time limit
          </p>
        </div>
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 text-sm text-indigo-800 text-left">
          <p>This test simulates JLPT-style conditions. Answer all questions before time runs out. You can revisit answers by navigating back.</p>
        </div>
        {noContent && (
          <p className="text-red-500 text-sm">No questions available yet for {level}.</p>
        )}
        <div className="flex gap-3">
          <button onClick={onDone} className="px-5 py-2.5 rounded-xl border-2 border-gray-200 text-gray-600 font-medium hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={startTest}
            disabled={loading || noContent}
            className="px-6 py-2.5 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Loading…' : 'Start Test'}
          </button>
        </div>
      </div>
    )
  }

  if (phase === 'result' && result) {
    return <TestSummary result={result} onRetry={startTest} onDone={onDone} />
  }

  if (items.length === 0) return null

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <button onClick={onDone} className="text-sm text-indigo-600 hover:text-indigo-800">← Exit</button>
        <span className={`text-sm font-mono font-bold px-3 py-1 rounded-lg ${isLow ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-700'}`}>
          {formatTime(timeLeft)}
        </span>
      </div>

      <QuizQuestion
        item={items[index]}
        selected={selected}
        confirmed={confirmed}
        onSelect={handleSelect}
        index={index}
        total={items.length}
      />

      <button
        onClick={handleNext}
        disabled={!confirmed}
        className="w-full px-6 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-40 transition-colors"
      >
        {index + 1 >= items.length ? 'Submit Test' : 'Next →'}
      </button>
    </div>
  )
}
