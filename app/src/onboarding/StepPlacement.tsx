import { useState, useMemo } from 'react'
import {
  CEFR_TIERS, getQuestionsForTier, pickRandom, cefrToJlpt,
  type CEFRLevel, type PlacementQuestion,
} from './placement-data'
import type { JlptLevel } from './types'

interface Props {
  onDone: (jlptLevel: JlptLevel, cefrLevel: CEFRLevel) => void
}

type Phase = 'intro' | 'quiz' | 'result'

const CORRECT_TO_ADVANCE = 3
const WRONG_TO_STOP = 2
const QUESTIONS_PER_TIER = 5
// Show reading hint (furigana above kanji) for A1 and A2 levels
const SHOW_READING_LEVELS: CEFRLevel[] = ['A1', 'A2']

const CEFR_LABELS: Record<CEFRLevel, string> = {
  A1: 'A1 — Beginner',
  A2: 'A2 — Elementary',
  B1: 'B1 — Intermediate',
  B2: 'B2 — Upper Intermediate',
  C1: 'C1 — Advanced',
  C2: 'C2 — Mastery',
}

export function StepPlacement({ onDone }: Props) {
  const [phase, setPhase] = useState<Phase>('intro')
  const [tierIndex, setTierIndex] = useState(0)
  const [tierQuestions, setTierQuestions] = useState<PlacementQuestion[]>([])
  const [questionIndex, setQuestionIndex] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [streakCorrect, setStreakCorrect] = useState(0)
  const [wrongCount, setWrongCount] = useState(0)
  const [resultLevel, setResultLevel] = useState<CEFRLevel>('A1')

  const currentTier = CEFR_TIERS[tierIndex]
  const q = tierQuestions[questionIndex]
  const showReading = currentTier && SHOW_READING_LEVELS.includes(currentTier.level)

  // Shuffle options per question (stable per q.id, changes with each new question)
  const shuffledOptions = useMemo(() => {
    if (!q) return []
    const opts = [...q.options]
    // Fisher-Yates using q.id as seed
    let seed = q.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
    const rand = () => { seed = (seed * 1664525 + 1013904223) & 0xffffffff; return (seed >>> 0) / 0xffffffff }
    for (let i = opts.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [opts[i], opts[j]] = [opts[j], opts[i]]
    }
    return opts
  }, [q?.id])

  const tierLabel = useMemo(() => {
    if (!currentTier) return ''
    const sub = currentTier.sublevel === 'early' ? '▸' : currentTier.sublevel === 'mid' ? '▸▸' : '▸▸▸'
    return `${currentTier.level} ${sub}`
  }, [currentTier])

  function loadTier(index: number) {
    const tier = CEFR_TIERS[index]
    const pool = getQuestionsForTier(tier.level, tier.sublevel)
    const picked = pickRandom(pool, Math.min(QUESTIONS_PER_TIER, pool.length))
    setTierQuestions(picked)
    setQuestionIndex(0)
    setSelected(null)
    setConfirmed(false)
  }

  function startQuiz() {
    setTierIndex(0)
    setStreakCorrect(0)
    setWrongCount(0)
    loadTier(0)
    setPhase('quiz')
  }

  function handleSelect(opt: string) {
    if (confirmed) return
    setSelected(opt)
    setConfirmed(true)
  }

  function handleNext() {
    const isCorrect = selected === q.answer
    const newStreak = isCorrect ? streakCorrect + 1 : 0
    const newWrong = isCorrect ? wrongCount : wrongCount + 1

    // Advance tier if 3 correct in a row
    if (newStreak >= CORRECT_TO_ADVANCE) {
      const nextIndex = tierIndex + 1
      if (nextIndex >= CEFR_TIERS.length) {
        // Passed all tiers
        setResultLevel('C2')
        setPhase('result')
        return
      }
      setTierIndex(nextIndex)
      setStreakCorrect(0)
      setWrongCount(0)
      loadTier(nextIndex)
      return
    }

    // Stop if 2 wrong at current tier
    if (newWrong >= WRONG_TO_STOP) {
      const prevTier = CEFR_TIERS[Math.max(0, tierIndex - 1)]
      setResultLevel(prevTier.level)
      setPhase('result')
      return
    }

    setStreakCorrect(newStreak)
    setWrongCount(newWrong)

    // Advance within tier questions, cycling back if needed
    const nextQ = questionIndex + 1
    if (nextQ >= tierQuestions.length) {
      const pool = getQuestionsForTier(currentTier.level, currentTier.sublevel)
      const picked = pickRandom(pool, Math.min(QUESTIONS_PER_TIER, pool.length))
      setTierQuestions(picked)
      setQuestionIndex(0)
    } else {
      setQuestionIndex(nextQ)
    }
    setSelected(null)
    setConfirmed(false)
  }

  if (phase === 'intro') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-8 p-8 max-w-lg mx-auto text-center">
        <h2 className="text-2xl font-bold">Japanese Level Quiz</h2>
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 text-sm text-indigo-800 text-left">
          <p className="font-semibold mb-1">Note on this quiz</p>
          <p>
            This is a <strong>useful Japanese gauge</strong> that differs slightly from strict JLPT.
            It uses the European CEFR scale (A1–C2) and focuses on practical, conversational Japanese.
            You'll see where you fit on both scales in the study section.
          </p>
        </div>
        <p className="text-gray-600">
          The quiz adapts to your level — answer questions and it will find your range automatically.
          Answer honestly; you can always adjust later.
        </p>
        <button
          onClick={startQuiz}
          className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors"
        >
          Start Quiz
        </button>
        <button
          onClick={() => onDone('N5', 'A1')}
          className="text-gray-500 hover:text-gray-700 text-sm"
        >
          Skip — start at beginner level
        </button>
      </div>
    )
  }

  if (phase === 'result') {
    const jlpt = cefrToJlpt(resultLevel)
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-6 p-8 max-w-lg mx-auto text-center">
        <div className="text-6xl">🎯</div>
        <h2 className="text-2xl font-bold">Your Level</h2>
        <div className="bg-indigo-50 border-2 border-indigo-300 rounded-2xl px-8 py-6">
          <div className="text-4xl font-bold text-indigo-700 mb-1">{resultLevel}</div>
          <div className="text-gray-600 text-sm">{CEFR_LABELS[resultLevel]}</div>
          <div className="text-xs text-gray-400 mt-2">≈ JLPT {jlpt}</div>
        </div>
        <p className="text-gray-600 text-sm max-w-sm">
          We'll start your study plan here. You can adjust this anytime in settings.
        </p>
        <button
          onClick={() => onDone(jlpt, resultLevel)}
          className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors"
        >
          Start at {resultLevel}
        </button>
        <div className="mt-2">
          <p className="text-xs text-gray-400 mb-3">Or pick a level manually</p>
          <div className="flex gap-2 justify-center flex-wrap">
            {(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as CEFRLevel[]).map(l => (
              <button
                key={l}
                onClick={() => onDone(cefrToJlpt(l), l)}
                className={`px-4 py-2 rounded-lg border-2 font-medium transition-colors text-sm ${
                  l === resultLevel
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!q) return null

  const isCorrect = selected === q.answer

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-6 p-8 max-w-xl mx-auto">
      {/* Progress indicators */}
      <div className="w-full flex items-center justify-between text-sm text-gray-400">
        <span>{tierLabel}</span>
        <div className="flex gap-1">
          {Array.from({ length: CORRECT_TO_ADVANCE }).map((_, i) => (
            <div
              key={i}
              className={`w-3 h-3 rounded-full border-2 transition-colors ${
                i < streakCorrect
                  ? 'bg-green-500 border-green-500'
                  : 'border-gray-300'
              }`}
            />
          ))}
        </div>
        <div className="flex gap-1">
          {Array.from({ length: WRONG_TO_STOP }).map((_, i) => (
            <div
              key={i}
              className={`w-3 h-3 rounded-full border-2 transition-colors ${
                i < wrongCount
                  ? 'bg-red-400 border-red-400'
                  : 'border-gray-300'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Question */}
      <div className="w-full bg-gray-50 rounded-xl p-8 text-center">
        {showReading && q.reading && (
          <p className="text-base text-gray-500 mb-4 leading-loose" lang="ja">{q.reading}</p>
        )}
        <p className="text-2xl leading-loose" lang="ja">{q.prompt}</p>
      </div>

      {/* Options */}
      <div className="grid grid-cols-2 gap-3 w-full">
        {shuffledOptions.map(opt => {
          const isOpt = opt === selected
          const isAns = opt === q.answer
          let cls = 'px-5 py-4 rounded-xl font-medium border-2 transition-colors text-left text-lg '
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
            <button key={opt} className={cls} onClick={() => handleSelect(opt)} lang="ja">
              {opt}
            </button>
          )
        })}
      </div>

      {confirmed && (
        <div className="flex flex-col items-center gap-3 w-full">
          <div className={`text-sm font-semibold ${isCorrect ? 'text-green-600' : 'text-red-600'}`}>
            {isCorrect ? '✓ Correct!' : `✗ Answer: ${q.answer}`}
          </div>
          <button
            onClick={handleNext}
            className="w-full px-8 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  )
}
