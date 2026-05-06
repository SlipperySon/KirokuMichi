import { useState } from 'react'
import { useIntl } from 'react-intl'
import type { JlptLevel } from './types'

interface Props {
  currentLevel: JlptLevel
  onDone: (goalLevel: JlptLevel, goalDate: string | null) => void
}

const LEVELS: JlptLevel[] = ['N5', 'N4', 'N3', 'N2', 'N1']

// Approximate new items per level to reach passing score
const ITEMS_TO_LEVEL: Record<JlptLevel, number> = {
  N5: 800,
  N4: 1500,
  N3: 3000,
  N2: 6000,
  N1: 10000,
}

function feasibility(currentLevel: JlptLevel, goalLevel: JlptLevel, goalDate: string | null, dailyCards: number) {
  if (!goalDate) return null
  const daysLeft = Math.max(1, Math.round((new Date(goalDate).getTime() - Date.now()) / 86400000))
  const currentIdx = LEVELS.indexOf(currentLevel)
  const goalIdx = LEVELS.indexOf(goalLevel)
  if (goalIdx <= currentIdx) return null

  let totalItems = 0
  for (let i = currentIdx + 1; i <= goalIdx; i++) {
    totalItems += ITEMS_TO_LEVEL[LEVELS[i]]
  }
  const needed = Math.ceil(totalItems / daysLeft)
  if (needed <= dailyCards) return { status: 'ok' as const, needed }
  if (needed <= dailyCards * 1.5) return { status: 'stretch' as const, needed }
  return { status: 'unrealistic' as const, needed }
}

export function StepGoal({ currentLevel, onDone }: Props) {
  const intl = useIntl()
  const levelIdx = LEVELS.indexOf(currentLevel)
  const defaultGoal = LEVELS[Math.min(levelIdx + 1, LEVELS.length - 1)] as JlptLevel
  const [goalLevel, setGoalLevel] = useState<JlptLevel>(defaultGoal)
  const [goalDate, setGoalDate] = useState<string>('')
  const [dailyCards] = useState(20)

  const feas = feasibility(currentLevel, goalLevel, goalDate || null, dailyCards)

  const minDate = new Date()
  minDate.setMonth(minDate.getMonth() + 1)
  const minDateStr = minDate.toISOString().split('T')[0]

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-8 p-8 max-w-lg mx-auto">
      <h2 className="text-2xl font-bold">{intl.formatMessage({ id: 'onboarding.goal.title' })}</h2>

      <div className="flex flex-col gap-6 w-full">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {intl.formatMessage({ id: 'onboarding.goal.target_level' })}
          </label>
          <div className="flex gap-2">
            {LEVELS.map(l => (
              <button
                key={l}
                onClick={() => setGoalLevel(l)}
                className={`flex-1 py-2 rounded-lg border-2 font-medium transition-colors text-sm ${
                  l === goalLevel
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {intl.formatMessage({ id: 'onboarding.goal.target_date' })}
          </label>
          <input
            type="date"
            value={goalDate}
            min={minDateStr}
            onChange={e => setGoalDate(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>

        {feas && (
          <div className={`px-4 py-3 rounded-lg text-sm font-medium ${
            feas.status === 'ok' ? 'bg-green-50 text-green-700' :
            feas.status === 'stretch' ? 'bg-yellow-50 text-yellow-700' :
            'bg-red-50 text-red-600'
          }`}>
            {intl.formatMessage(
              { id: `onboarding.goal.feasibility_${feas.status}` },
              { cards: feas.needed }
            )}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 w-full">
        <button
          onClick={() => onDone(goalLevel, goalDate || null)}
          className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors"
        >
          {intl.formatMessage({ id: 'onboarding.goal.continue' })}
        </button>
        <button
          onClick={() => onDone(goalLevel, null)}
          className="text-gray-500 hover:text-gray-700 text-sm"
        >
          {intl.formatMessage({ id: 'onboarding.goal.skip' })}
        </button>
      </div>
    </div>
  )
}
