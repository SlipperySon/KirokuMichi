import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store'
import { StepWelcome } from './StepWelcome'
import { StepAI } from './StepAI'
import { StepPrefs } from './StepPrefs'
import { StepKana } from './StepKana'
import { StepPlacement } from './StepPlacement'
import { StepGoal } from './StepGoal'
import { StepIME } from './StepIME'
import type { OnboardingStep, JlptLevel } from './types'
import type { CEFRLevel } from './placement-data'
import { SQLiteStorage } from '../db/sqlite'
import {
  buildStarterLearningPath,
  ensureStarterDeckIfEmpty,
  firstLessonAutostartRoute,
  starterLessonIdFromCefr,
  type PlacementCefr,
} from '../study/firstRunBootstrap'
import { toast } from '../components/toastStore'

export function OnboardingFlow() {
  const navigate = useNavigate()
  const updateSettings = useAppStore(s => s.updateSettings)
  const setOnboardingComplete = useAppStore(s => s.setOnboardingComplete)
  const setCurrentLesson = useAppStore(s => s.setCurrentLesson)
  const setLearningPath = useAppStore(s => s.setLearningPath)
  const activeUserId = useAppStore(s => s.activeUserId)
  const setActiveUserId = useAppStore(s => s.setActiveUserId)
  const [step, setStep] = useState<OnboardingStep>('welcome')
  const [placementLevel, setPlacementLevel] = useState<JlptLevel>('N5')
  const [placementCefr, setPlacementCefr] = useState<PlacementCefr>('A1')
  const [needsKanaLearning, setNeedsKanaLearning] = useState(false)
  const [finishing, setFinishing] = useState(false)

  async function finish() {
    if (finishing) return
    setFinishing(true)
    try {
      updateSettings({ includeTextbookLessons: true })

      const storage = new SQLiteStorage()
      let userId = activeUserId
      if (!userId) {
        await storage.execute(
          `INSERT INTO users (jlpt_level, study_mode, hover_delay_ms, hiragana_complete, onboarding_complete)
           VALUES (?, 'standard', 2000, 0, 1)`,
          [placementLevel],
        )
        const rows = await storage.query<{ id: number }>(`SELECT id FROM users ORDER BY id DESC LIMIT 1`)
        userId = rows[0]?.id ?? 1
        setActiveUserId(userId)
      }

      const path = await buildStarterLearningPath(placementCefr)
      setLearningPath(path)

      const firstLessonId = starterLessonIdFromCefr(placementCefr)
      setCurrentLesson(firstLessonId)

      try {
        const imported = await ensureStarterDeckIfEmpty(storage, userId)
        if (imported && imported.imported > 0) {
          toast.success(`Imported ${imported.imported} starter cards for Anki reviews`)
        }
      } catch {
        toast.info('You can import Genki starter cards from Today or the lesson page.')
      }

      setOnboardingComplete(true)
      navigate(firstLessonAutostartRoute(placementCefr), { replace: true })
    } catch (error) {
      toast.error(`Could not finish setup: ${String(error)}`)
      setOnboardingComplete(true)
      navigate('/study', { replace: true })
    } finally {
      setFinishing(false)
    }
  }

  switch (step) {
    case 'welcome':
      return <StepWelcome onNext={() => setStep('ai')} />

    case 'ai':
      return <StepAI onNext={() => setStep('hiragana')} />

    case 'hiragana':
      return (
        <StepKana
          key="hiragana"
          script="hiragana"
          onPass={() => setStep('katakana')}
          onSkip={() => setStep('katakana')}
          onLearn={() => {
            setNeedsKanaLearning(true)
            setStep('katakana')
          }}
        />
      )

    case 'katakana':
      return (
        <StepKana
          key="katakana"
          script="katakana"
          onPass={() => needsKanaLearning ? setStep('learning') : setStep('placement')}
          onSkip={() => needsKanaLearning ? setStep('learning') : setStep('placement')}
          onLearn={() => {
            setNeedsKanaLearning(true)
            setStep('learning')
          }}
        />
      )

    case 'learning':
      return (
        <div className="flex flex-col items-center justify-center min-h-screen gap-8 p-8 max-w-lg mx-auto text-center">
          <div className="text-7xl">🈶</div>
          <h2 className="text-2xl font-bold text-gray-900">Let's get you started with kana</h2>
          <p className="text-gray-600 leading-relaxed">
            No problem — kana takes a bit of practice. You'll build familiarity naturally as you
            work through your first lessons. Each word is shown with furigana readings so you can
            follow along right away.
          </p>
          <p className="text-sm text-gray-500">
            You can also toggle furigana on/off any time in Settings as your reading improves.
          </p>
          <button
            onClick={() => {
              setNeedsKanaLearning(false)
              setStep('placement')
            }}
            className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors"
          >
            Continue →
          </button>
        </div>
      )

    case 'placement':
      return (
        <StepPlacement
          onDone={(jlptLevel, cefrLevel: CEFRLevel) => {
            setPlacementLevel(jlptLevel)
            setPlacementCefr(cefrLevel)
            updateSettings({ jlptTarget: jlptLevel })
            setStep('prefs')
          }}
        />
      )

    case 'prefs':
      return <StepPrefs onNext={() => setStep('goal')} />

    case 'goal':
      return (
        <StepGoal
          currentLevel={placementLevel}
          onDone={(goalLevel, goalDate) => {
            updateSettings({ jlptTarget: goalLevel, goalDate })
            setStep('ime')
          }}
        />
      )

    case 'ime':
      return (
        <StepIME
          onDone={() => { void finish() }}
          busy={finishing}
        />
      )

    default:
      return null
  }
}
