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

export function OnboardingFlow() {
  const navigate = useNavigate()
  const { updateSettings, setOnboardingComplete } = useAppStore()
  const [step, setStep] = useState<OnboardingStep>('welcome')
  const [placementLevel, setPlacementLevel] = useState<JlptLevel>('N5')
  const [needsKanaLearning, setNeedsKanaLearning] = useState(false)

  function finish() {
    setOnboardingComplete(true)
    navigate('/study', { replace: true })
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
          <div className="text-6xl">📚</div>
          <h2 className="text-2xl font-bold">Kana Learning Section</h2>
          <p className="text-gray-600">
            This section is coming soon! For now, you can move on to learn vocabulary and grammar.
          </p>
          <button
            onClick={() => {
              setNeedsKanaLearning(false)
              setStep('placement')
            }}
            className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors"
          >
            Continue to Next Step
          </button>
        </div>
      )

    case 'placement':
      return (
        <StepPlacement
          onDone={(jlptLevel, _cefrLevel) => {
            setPlacementLevel(jlptLevel)
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
      return <StepIME onDone={finish} />

    default:
      return null
  }
}
