import type { JlptLevel } from '../content/contentTypes'
import type { LevelProgress } from './types'

interface Props {
  selected: JlptLevel
  progress: LevelProgress[]
  onSelect: (level: JlptLevel) => void
}

const LEVELS: JlptLevel[] = ['N5', 'N4', 'N3', 'N2', 'N1']

const LEVEL_LABELS: Record<JlptLevel, string> = {
  N5: 'Beginner',
  N4: 'Elementary',
  N3: 'Intermediate',
  N2: 'Upper Intermediate',
  N1: 'Advanced',
}

export function LevelPicker({ selected, progress, onSelect }: Props) {
  const progressMap = new Map(progress.map(p => [p.level, p]))

  return (
    <div className="flex gap-2 flex-wrap">
      {LEVELS.map(level => {
        const p = progressMap.get(level)
        const pct = p && p.grammarTotal + p.vocabTotal > 0
          ? Math.round((p.learnedCount / (p.grammarTotal + p.vocabTotal)) * 100)
          : 0
        const isSelected = level === selected

        return (
          <button
            key={level}
            onClick={() => onSelect(level)}
            className={`flex flex-col items-center px-5 py-3 rounded-xl border-2 transition-colors min-w-[80px] ${
              isSelected
                ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                : 'border-gray-200 hover:border-gray-300 text-gray-700'
            }`}
          >
            <span className="text-lg font-bold">{level}</span>
            <span className="text-xs text-gray-500 mt-0.5">{LEVEL_LABELS[level]}</span>
            {p && p.grammarTotal + p.vocabTotal > 0 && (
              <div className="mt-2 w-full h-1 rounded-full bg-gray-200">
                <div
                  className="h-1 rounded-full bg-indigo-400 transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            )}
          </button>
        )
      })}
    </div>
  )
}
