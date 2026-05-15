/**
 * Interactive Lesson Study Mode
 *
 * Three-phase teaching flow:
 *   1. TEACH — Walk through each vocab/grammar item with full explanation
 *      shown upfront (no hiding). User reads and presses "Next" to continue.
 *   2. QUIZ — Multiple-choice questions testing recall of what was just taught.
 *      Immediate feedback after each answer.
 *   3. SUMMARY — Score breakdown, option to retry quiz or mark complete.
 */

import { useState, useCallback, useEffect, useMemo } from 'react'
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

type Phase = 'teach' | 'quiz' | 'summary'

interface QuizQuestion {
  type: 'vocab' | 'grammar'
  prompt: string
  promptLabel: string
  correctAnswer: string
  options: string[]
}

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Build quiz questions from vocab and grammar items */
function buildQuiz(vocab: VocabItem[], grammar: GrammarItem[]): QuizQuestion[] {
  const questions: QuizQuestion[] = []

  // Vocab: show English → pick correct Japanese
  for (const v of vocab) {
    if (!v.surface || !v.english) continue
    const distractors = vocab
      .filter(d => d.id !== v.id && d.surface)
      .map(d => d.surface)
    if (distractors.length < 2) continue // need at least 2 wrong answers
    const wrongAnswers = shuffleArray(distractors).slice(0, 3)
    const options = shuffleArray([v.surface, ...wrongAnswers])
    questions.push({
      type: 'vocab',
      prompt: v.english,
      promptLabel: 'What is the Japanese for:',
      correctAnswer: v.surface,
      options,
    })
  }

  // Vocab reverse: show Japanese → pick correct English
  for (const v of vocab) {
    if (!v.surface || !v.english) continue
    const distractors = vocab
      .filter(d => d.id !== v.id && d.english)
      .map(d => d.english)
    if (distractors.length < 2) continue
    const wrongAnswers = shuffleArray(distractors).slice(0, 3)
    const options = shuffleArray([v.english, ...wrongAnswers])
    questions.push({
      type: 'vocab',
      prompt: v.surface,
      promptLabel: 'What does this mean?',
      correctAnswer: v.english,
      options,
    })
  }

  // Grammar: show pattern → pick correct meaning
  for (const g of grammar) {
    if (!g.pattern || !g.meaning || g.meaning.length > 120) continue
    const distractors = grammar
      .filter(d => d.id !== g.id && d.meaning && d.meaning.length <= 120)
      .map(d => d.meaning)
    if (distractors.length < 2) continue
    const wrongAnswers = shuffleArray(distractors).slice(0, 3)
    const options = shuffleArray([g.meaning, ...wrongAnswers])
    questions.push({
      type: 'grammar',
      prompt: g.pattern,
      promptLabel: 'What does this grammar pattern mean?',
      correctAnswer: g.meaning,
      options,
    })
  }

  return shuffleArray(questions).slice(0, Math.min(questions.length, 15))
}

export function LessonStudy() {
  const navigate = useNavigate()
  const { state } = useLocation() as { state: LessonStudyState }
  const markComplete = useAppStore(s => s.markLessonComplete)

  const [phase, setPhase] = useState<Phase>('teach')
  const [teachIndex, setTeachIndex] = useState(0)

  // Quiz state
  const quizQuestions = useMemo(() => buildQuiz(state.vocab, state.grammar), [state.vocab, state.grammar])
  const [quizIndex, setQuizIndex] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null)
  const [quizScore, setQuizScore] = useState(0)
  const [answeredCount, setAnsweredCount] = useState(0)

  // Combined teach items: vocab first, then grammar
  const teachItems = useMemo(() => {
    const items: Array<{ type: 'vocab'; item: VocabItem } | { type: 'grammar'; item: GrammarItem }> = []
    for (const v of state.vocab) items.push({ type: 'vocab', item: v })
    for (const g of state.grammar) items.push({ type: 'grammar', item: g })
    return items
  }, [state.vocab, state.grammar])

  const currentTeach = teachItems[teachIndex] ?? null
  const currentQuiz = quizQuestions[quizIndex] ?? null
  const hasQuiz = quizQuestions.length >= 3 // only show quiz if we have enough questions

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (phase === 'teach') {
        if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowRight') {
          e.preventDefault()
          handleTeachNext()
        }
        if (e.key === 'ArrowLeft') {
          e.preventDefault()
          handleTeachPrev()
        }
      }
      if (phase === 'quiz' && selectedAnswer !== null) {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault()
          handleQuizNext()
        }
      }
      if (phase === 'quiz' && selectedAnswer === null) {
        const num = parseInt(e.key)
        if (num >= 1 && num <= 4 && currentQuiz && num <= currentQuiz.options.length) {
          e.preventDefault()
          handleAnswer(currentQuiz.options[num - 1])
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const handleTeachNext = useCallback(() => {
    if (teachIndex + 1 >= teachItems.length) {
      if (hasQuiz) {
        setPhase('quiz')
      } else {
        setPhase('summary')
      }
    } else {
      setTeachIndex(prev => prev + 1)
    }
  }, [teachIndex, teachItems.length, hasQuiz])

  const handleTeachPrev = useCallback(() => {
    if (teachIndex > 0) setTeachIndex(prev => prev - 1)
  }, [teachIndex])

  const handleAnswer = useCallback((answer: string) => {
    if (selectedAnswer !== null) return // already answered
    setSelectedAnswer(answer)
    if (answer === currentQuiz?.correctAnswer) {
      setQuizScore(prev => prev + 1)
    }
    setAnsweredCount(prev => prev + 1)
  }, [selectedAnswer, currentQuiz])

  const handleQuizNext = useCallback(() => {
    if (quizIndex + 1 >= quizQuestions.length) {
      setPhase('summary')
    } else {
      setQuizIndex(prev => prev + 1)
      setSelectedAnswer(null)
    }
  }, [quizIndex, quizQuestions.length])

  // ─── TEACH PHASE ─────────────────────────────────────────────

  if (phase === 'teach') {
    const teachProgress = teachItems.length > 0 ? ((teachIndex + 1) / teachItems.length) * 100 : 0
    const sectionLabel = teachIndex < state.vocab.length ? 'Vocabulary' : 'Grammar'
    const sectionNum = teachIndex < state.vocab.length
      ? teachIndex + 1
      : teachIndex - state.vocab.length + 1
    const sectionTotal = teachIndex < state.vocab.length ? state.vocab.length : state.grammar.length

    return (
      <div className="flex flex-col min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="max-w-xl mx-auto flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-gray-900">{state.lessonTitle}</h1>
              <p className="text-sm text-gray-500">
                Learning: {sectionLabel} {sectionNum}/{sectionTotal}
              </p>
            </div>
            <button
              onClick={() => {
                if (window.confirm('Exit lesson?')) navigate(-1)
              }}
              className="text-sm text-gray-500 hover:text-gray-600 px-3 py-1 rounded-lg hover:bg-gray-50"
            >
              Exit
            </button>
          </div>
        </div>

        {/* Progress */}
        <div className="w-full bg-gray-200 h-1.5">
          <div className="bg-indigo-500 h-1.5 transition-all duration-300" style={{ width: `${teachProgress}%` }} />
        </div>

        {/* Teaching Card */}
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-lg">
            {currentTeach?.type === 'vocab' ? (
              <VocabTeachCard item={currentTeach.item} index={teachIndex} total={teachItems.length} />
            ) : currentTeach?.type === 'grammar' ? (
              <GrammarTeachCard item={currentTeach.item} index={teachIndex} total={teachItems.length} />
            ) : null}

            {/* Navigation */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleTeachPrev}
                disabled={teachIndex === 0}
                className="flex-1 rounded-lg border border-gray-200 px-4 py-3 font-semibold text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                ← Back
              </button>
              <button
                onClick={handleTeachNext}
                className="flex-1 rounded-lg bg-indigo-600 px-4 py-3 font-semibold text-white hover:bg-indigo-700 transition-colors"
              >
                {teachIndex + 1 >= teachItems.length
                  ? (hasQuiz ? 'Start Quiz →' : 'Finish →')
                  : 'Next →'}
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center pb-4 text-xs text-gray-500">
          <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-gray-600">←</kbd> Back ·{' '}
          <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-gray-600">→</kbd> Next
        </div>
      </div>
    )
  }

  // ─── QUIZ PHASE ──────────────────────────────────────────────

  if (phase === 'quiz' && currentQuiz) {
    const quizProgress = quizQuestions.length > 0 ? ((quizIndex + 1) / quizQuestions.length) * 100 : 0
    const isCorrect = selectedAnswer === currentQuiz.correctAnswer
    const hasAnswered = selectedAnswer !== null

    return (
      <div className="flex flex-col min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="max-w-xl mx-auto flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-gray-900">{state.lessonTitle}</h1>
              <p className="text-sm text-gray-500">
                Quiz: {quizIndex + 1}/{quizQuestions.length} · Score: {quizScore}/{answeredCount}
              </p>
            </div>
            <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-1 rounded">
              {currentQuiz.type === 'vocab' ? 'Vocabulary' : 'Grammar'}
            </span>
          </div>
        </div>

        {/* Progress */}
        <div className="w-full bg-gray-200 h-1.5">
          <div className="bg-green-500 h-1.5 transition-all duration-300" style={{ width: `${quizProgress}%` }} />
        </div>

        {/* Question */}
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-lg">
            <div className="bg-white rounded-2xl shadow-lg p-8 space-y-6">
              {/* Question */}
              <div className="text-center">
                <p className="text-sm text-gray-500 mb-2">{currentQuiz.promptLabel}</p>
                <p className="text-3xl font-bold text-gray-900" lang="ja">{currentQuiz.prompt}</p>
              </div>

              {/* Options */}
              <div className="space-y-3">
                {currentQuiz.options.map((option, idx) => {
                  let btnClass = 'w-full text-left px-4 py-3 rounded-lg border-2 font-medium transition-all '
                  if (!hasAnswered) {
                    btnClass += 'border-gray-200 text-gray-900 hover:border-indigo-400 hover:bg-indigo-50 cursor-pointer'
                  } else if (option === currentQuiz.correctAnswer) {
                    btnClass += 'border-green-500 bg-green-50 text-green-800'
                  } else if (option === selectedAnswer) {
                    btnClass += 'border-red-500 bg-red-50 text-red-800'
                  } else {
                    btnClass += 'border-gray-200 text-gray-500 opacity-50'
                  }

                  return (
                    <button
                      key={idx}
                      onClick={() => handleAnswer(option)}
                      disabled={hasAnswered}
                      className={btnClass}
                    >
                      <span className="text-xs text-gray-500 mr-2">{idx + 1}.</span>
                      {option}
                    </button>
                  )
                })}
              </div>

              {/* Feedback */}
              {hasAnswered && (
                <div className={`rounded-lg p-4 text-center ${
                  isCorrect ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
                }`}>
                  <p className="font-bold text-lg">{isCorrect ? 'Correct!' : 'Not quite'}</p>
                  {!isCorrect && (
                    <p className="text-sm mt-1">
                      The answer is: <strong>{currentQuiz.correctAnswer}</strong>
                    </p>
                  )}
                </div>
              )}

              {/* Continue */}
              {hasAnswered && (
                <button
                  onClick={handleQuizNext}
                  className="w-full rounded-lg bg-indigo-600 px-4 py-3 font-semibold text-white hover:bg-indigo-700 transition-colors"
                >
                  {quizIndex + 1 >= quizQuestions.length ? 'See Results →' : 'Next Question →'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        {!hasAnswered && (
          <div className="text-center pb-4 text-xs text-gray-500">
            Press <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-gray-600">1</kbd>–
            <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-gray-600">4</kbd> to answer
          </div>
        )}
        {hasAnswered && (
          <div className="text-center pb-4 text-xs text-gray-500">
            Press <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-gray-600">Space</kbd> to continue
          </div>
        )}
      </div>
    )
  }

  // ─── SUMMARY PHASE ───────────────────────────────────────────

  const percentage = answeredCount > 0 ? Math.round((quizScore / answeredCount) * 100) : 100

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg text-center space-y-6">
        <div className="text-5xl">{percentage >= 80 ? '🎉' : percentage >= 50 ? '👍' : '📚'}</div>
        <h1 className="text-2xl font-bold text-gray-900">Lesson Complete!</h1>
        <p className="text-gray-600">{state.lessonTitle}</p>

        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="rounded-lg bg-blue-50 p-3">
            <div className="text-2xl font-bold text-blue-700">{state.vocab.length}</div>
            <div className="text-xs text-blue-600">Vocab Learned</div>
          </div>
          <div className="rounded-lg bg-purple-50 p-3">
            <div className="text-2xl font-bold text-purple-700">{state.grammar.length}</div>
            <div className="text-xs text-purple-600">Grammar Learned</div>
          </div>
          <div className="rounded-lg bg-green-50 p-3">
            <div className="text-2xl font-bold text-green-700">
              {hasQuiz ? `${percentage}%` : '✓'}
            </div>
            <div className="text-xs text-green-600">
              {hasQuiz ? 'Quiz Score' : 'Studied'}
            </div>
          </div>
        </div>

        {hasQuiz && (
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all ${percentage >= 80 ? 'bg-green-500' : percentage >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
              style={{ width: `${percentage}%` }}
            />
          </div>
        )}

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
          {hasQuiz && percentage < 80 && (
            <button
              onClick={() => {
                setPhase('quiz')
                setQuizIndex(0)
                setSelectedAnswer(null)
                setQuizScore(0)
                setAnsweredCount(0)
              }}
              className="w-full rounded-lg border border-gray-200 px-4 py-3 font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Retry Quiz
            </button>
          )}
          <button
            onClick={() => {
              setPhase('teach')
              setTeachIndex(0)
              setQuizIndex(0)
              setSelectedAnswer(null)
              setQuizScore(0)
              setAnsweredCount(0)
            }}
            className="w-full rounded-lg border border-gray-200 px-4 py-3 font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Study Again From Start
          </button>
          <button
            onClick={() => navigate(-1)}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Back to Lesson
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Teaching Cards ──────────────────────────────────────────────

function VocabTeachCard({ item, index, total }: { item: VocabItem; index: number; total: number }) {
  return (
    <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
      <div className="bg-blue-50 px-6 py-3 flex items-center justify-between">
        <span className="text-xs font-bold text-blue-700 uppercase tracking-wider">Vocabulary</span>
        <span className="text-xs text-blue-600">{index + 1} / {total}</span>
      </div>
      <div className="p-8 space-y-4">
        {/* Japanese word — large and prominent */}
        <div className="text-center">
          <div className="text-5xl font-bold text-gray-900 mb-4" lang="ja">
            {item.surface}
          </div>
        </div>

        {/* Meaning — always visible (this is teaching, not testing) */}
        <div className="bg-gray-50 rounded-xl p-4 text-center">
          <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Meaning</div>
          <div className="text-xl font-semibold text-gray-900">{item.english}</div>
        </div>

        {/* Source info */}
        {item.source && (
          <div className="text-center text-xs text-gray-500">
            Source: {item.source.replace(/_/g, ' ')} · page {item.page}
          </div>
        )}
      </div>
    </div>
  )
}

function GrammarTeachCard({ item, index, total }: { item: GrammarItem; index: number; total: number }) {
  return (
    <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
      <div className="bg-purple-50 px-6 py-3 flex items-center justify-between">
        <span className="text-xs font-bold text-purple-700 uppercase tracking-wider">Grammar</span>
        <span className="text-xs text-purple-600">{index + 1} / {total}</span>
      </div>
      <div className="p-8 space-y-4">
        {/* Pattern — large */}
        <div className="text-center">
          <div className="text-3xl font-bold text-gray-900 mb-4 font-mono" lang="ja">
            {item.pattern}
          </div>
        </div>

        {/* Explanation — always visible */}
        <div className="bg-gray-50 rounded-xl p-4">
          <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Meaning & Usage</div>
          <div className="text-base text-gray-900 leading-relaxed">{item.meaning}</div>
        </div>

        {/* Source info */}
        {item.source && (
          <div className="text-center text-xs text-gray-500">
            Source: {item.source.replace(/_/g, ' ')} · page {item.page}
          </div>
        )}
      </div>
    </div>
  )
}
