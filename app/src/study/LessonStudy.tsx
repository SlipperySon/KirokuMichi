/**
 * Interactive Lesson Study Mode
 *
 * Presents vocabulary and grammar from a lesson as flashcards.
 * The user reveals each item, then moves to the next.
 * At the end, a summary shows what was covered.
 *
 * This component does NOT use the SRS database — it's a pure
 * "learn new material" flow separate from review/recall.
 */

import { useState, useCallback, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAppStore } from '../store'

interface VocabItem {
  id: string
  surface: string
  english: string
  lesson: string
  source: string
  page: number
}

interface GrammarItem {
  id: string
  pattern: string
  meaning: string
  lesson: string
  source: string
  page: number
}

interface LessonStudyState {
  vocab: VocabItem[]
  grammar: GrammarItem[]
  lessonId: string
  lessonTitle: string
  cefrLevel: string
}

type StudyItem =
  | { type: 'vocab'; item: VocabItem }
  | { type: 'grammar'; item: GrammarItem }

export function LessonStudy() {
  const navigate = useNavigate()
  const { state } = useLocation() as { state: LessonStudyState }
  const markComplete = useAppStore(s => s.markLessonComplete)

  const [items] = useState<StudyItem[]>(() => {
    const all: StudyItem[] = []
    // Interleave vocab and grammar for variety
    for (const v of state.vocab) {
      all.push({ type: 'vocab', item: v })
    }
    for (const g of state.grammar) {
      all.push({ type: 'grammar', item: g })
    }
    return all
  })

  const [currentIndex, setCurrentIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [knewIt, setKnewIt] = useState<boolean[]>([])
  const [isComplete, setIsComplete] = useState(false)

  const current = items[currentIndex] ?? null
  const progress = items.length > 0 ? ((currentIndex) / items.length) * 100 : 0

  const handleReveal = useCallback(() => {
    setRevealed(true)
  }, [])

  const handleNext = useCallback((knew: boolean) => {
    setKnewIt(prev => [...prev, knew])
    if (currentIndex + 1 >= items.length) {
      setIsComplete(true)
    } else {
      setCurrentIndex(prev => prev + 1)
      setRevealed(false)
    }
  }, [currentIndex, items.length])

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        if (!revealed) {
          handleReveal()
        }
      }
      if (revealed) {
        if (e.key === '1' || e.key === 'ArrowRight') {
          handleNext(true)
        } else if (e.key === '2' || e.key === 'ArrowLeft') {
          handleNext(false)
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [revealed, handleReveal, handleNext])

  if (isComplete) {
    const knewCount = knewIt.filter(Boolean).length
    const total = items.length
    const vocabCount = state.vocab.length
    const grammarCount = state.grammar.length
    const percentage = total > 0 ? Math.round((knewCount / total) * 100) : 0

    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg text-center space-y-6">
          <div className="text-5xl">{percentage >= 80 ? '🎉' : percentage >= 50 ? '👍' : '📚'}</div>
          <h1 className="text-2xl font-bold text-slate-900">Lesson Complete!</h1>
          <p className="text-slate-600">{state.lessonTitle}</p>

          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="rounded-lg bg-blue-50 p-3">
              <div className="text-2xl font-bold text-blue-700">{vocabCount}</div>
              <div className="text-xs text-blue-600">Vocab</div>
            </div>
            <div className="rounded-lg bg-purple-50 p-3">
              <div className="text-2xl font-bold text-purple-700">{grammarCount}</div>
              <div className="text-xs text-purple-600">Grammar</div>
            </div>
            <div className="rounded-lg bg-green-50 p-3">
              <div className="text-2xl font-bold text-green-700">{percentage}%</div>
              <div className="text-xs text-green-600">Known</div>
            </div>
          </div>

          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className="bg-green-500 h-3 rounded-full transition-all"
              style={{ width: `${percentage}%` }}
            />
          </div>

          <div className="flex flex-col gap-3">
            <button
              onClick={() => {
                markComplete(state.lessonId)
                navigate(`/learn/lessons/${state.cefrLevel}/${state.lessonId.split('_').pop()}`)
              }}
              className="w-full rounded-lg bg-green-500 px-4 py-3 font-semibold text-white hover:bg-green-600 transition-colors"
            >
              Mark Complete & Return
            </button>
            <button
              onClick={() => {
                setCurrentIndex(0)
                setRevealed(false)
                setKnewIt([])
                setIsComplete(false)
              }}
              className="w-full rounded-lg border border-slate-300 px-4 py-3 font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Study Again
            </button>
            <button
              onClick={() => navigate(-1)}
              className="text-sm text-slate-500 hover:text-slate-700"
            >
              Back to Lesson
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!current) return null

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-slate-900">{state.lessonTitle}</h1>
            <p className="text-sm text-slate-500">
              {currentIndex + 1} of {items.length} ·{' '}
              {current.type === 'vocab' ? 'Vocabulary' : 'Grammar'}
            </p>
          </div>
          <button
            onClick={() => {
              if (window.confirm('Exit lesson? Your progress will not be saved.')) {
                navigate(-1)
              }
            }}
            className="text-sm text-slate-400 hover:text-slate-600 px-3 py-1 rounded-lg hover:bg-slate-100"
          >
            Exit
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-slate-200 h-1.5">
        <div
          className="bg-indigo-500 h-1.5 transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Card */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-lg">
          {current.type === 'vocab' ? (
            <VocabCard
              item={current.item}
              revealed={revealed}
              onReveal={handleReveal}
              onNext={handleNext}
            />
          ) : (
            <GrammarCard
              item={current.item}
              revealed={revealed}
              onReveal={handleReveal}
              onNext={handleNext}
            />
          )}
        </div>
      </div>

      {/* Footer hint */}
      <div className="text-center pb-6 text-xs text-slate-400">
        {!revealed ? (
          <span>Press <kbd className="px-1.5 py-0.5 bg-slate-200 rounded text-slate-600">Space</kbd> to reveal</span>
        ) : (
          <span>
            <kbd className="px-1.5 py-0.5 bg-green-100 rounded text-green-700">1</kbd> I knew it ·{' '}
            <kbd className="px-1.5 py-0.5 bg-amber-100 rounded text-amber-700">2</kbd> Still learning
          </span>
        )}
      </div>
    </div>
  )
}

function VocabCard({
  item,
  revealed,
  onReveal,
  onNext,
}: {
  item: VocabItem
  revealed: boolean
  onReveal: () => void
  onNext: (knew: boolean) => void
}) {
  return (
    <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
      {/* Front */}
      <div className="p-8 text-center">
        <div className="text-xs font-medium text-blue-600 uppercase tracking-wider mb-3">
          Vocabulary
        </div>
        <div className="text-4xl font-bold text-slate-900 mb-2" lang="ja">
          {item.surface}
        </div>
      </div>

      {/* Back (revealed) */}
      {revealed ? (
        <div className="border-t border-slate-100 bg-slate-50 p-6 space-y-4">
          <div className="text-center">
            <div className="text-xl text-slate-700">{item.english}</div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => onNext(true)}
              className="flex-1 rounded-lg bg-green-500 px-4 py-3 font-semibold text-white hover:bg-green-600 transition-colors"
            >
              I knew it
            </button>
            <button
              onClick={() => onNext(false)}
              className="flex-1 rounded-lg bg-amber-500 px-4 py-3 font-semibold text-white hover:bg-amber-600 transition-colors"
            >
              Still learning
            </button>
          </div>
        </div>
      ) : (
        <div className="border-t border-slate-100 p-6">
          <button
            onClick={onReveal}
            className="w-full rounded-lg bg-indigo-500 px-4 py-3 font-semibold text-white hover:bg-indigo-600 transition-colors"
          >
            Show Answer
          </button>
        </div>
      )}
    </div>
  )
}

function GrammarCard({
  item,
  revealed,
  onReveal,
  onNext,
}: {
  item: GrammarItem
  revealed: boolean
  onReveal: () => void
  onNext: (knew: boolean) => void
}) {
  return (
    <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
      {/* Front */}
      <div className="p-8 text-center">
        <div className="text-xs font-medium text-purple-600 uppercase tracking-wider mb-3">
          Grammar
        </div>
        <div className="text-2xl font-bold text-slate-900 mb-2 font-mono" lang="ja">
          {item.pattern}
        </div>
      </div>

      {/* Back (revealed) */}
      {revealed ? (
        <div className="border-t border-slate-100 bg-slate-50 p-6 space-y-4">
          <div className="text-center">
            <div className="text-lg text-slate-700">{item.meaning}</div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => onNext(true)}
              className="flex-1 rounded-lg bg-green-500 px-4 py-3 font-semibold text-white hover:bg-green-600 transition-colors"
            >
              I knew it
            </button>
            <button
              onClick={() => onNext(false)}
              className="flex-1 rounded-lg bg-amber-500 px-4 py-3 font-semibold text-white hover:bg-amber-600 transition-colors"
            >
              Still learning
            </button>
          </div>
        </div>
      ) : (
        <div className="border-t border-slate-100 p-6">
          <button
            onClick={onReveal}
            className="w-full rounded-lg bg-indigo-500 px-4 py-3 font-semibold text-white hover:bg-indigo-600 transition-colors"
          >
            Show Meaning
          </button>
        </div>
      )}
    </div>
  )
}
