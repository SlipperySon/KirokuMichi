import { useSearchParams } from 'react-router-dom'

interface LevelPickerProps {
  counts?: { N5: number; N4: number; N3: number }
}

export function LevelPicker({ counts = { N5: 0, N4: 0, N3: 0 } }: LevelPickerProps) {
  const [, setSearchParams] = useSearchParams()

  const handleLevelChange = (level: 'N5' | 'N4' | 'N3') => {
    setSearchParams({ level })
  }

  const currentLevel = new URLSearchParams(window.location.search).get('level') || 'N5'

  const levels: Array<{ code: 'N5' | 'N4' | 'N3'; label: string; color: string }> = [
    { code: 'N5', label: 'N5 (Beginner)', color: 'from-green-400 to-green-500' },
    { code: 'N4', label: 'N4 (Elementary)', color: 'from-blue-400 to-blue-500' },
    { code: 'N3', label: 'N3 (Intermediate)', color: 'from-orange-400 to-orange-500' },
  ]

  return (
    <div className="flex gap-2 mb-6 border-b border-gray-200 pb-4">
      {levels.map(level => (
        <button
          key={level.code}
          onClick={() => handleLevelChange(level.code)}
          className={`px-4 py-2 rounded-lg font-semibold transition-all ${
            currentLevel === level.code
              ? `bg-gradient-to-r ${level.color} text-white shadow-md`
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          {level.label}
          <span className="ml-2 text-sm">({counts[level.code]})</span>
        </button>
      ))}
    </div>
  )
}
