/**
 * DailyGoalRing — circular SVG progress ring showing today's cards reviewed
 * against the user's configured `dailyGoal`.
 */

interface DailyGoalRingProps {
  reviewed: number
  goal: number
  size?: number
  strokeWidth?: number
  label?: string
}

export function DailyGoalRing({
  reviewed,
  goal,
  size = 56,
  strokeWidth = 6,
  label,
}: DailyGoalRingProps) {
  const pct = goal > 0 ? Math.min(100, Math.round((reviewed / goal) * 100)) : 0
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference - (pct / 100) * circumference
  const done = goal > 0 && reviewed >= goal

  return (
    <div
      className="inline-flex flex-col items-center"
      role="img"
      aria-label={`${reviewed} of ${goal} daily cards reviewed (${pct}%)`}
    >
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="currentColor"
            strokeWidth={strokeWidth}
            fill="none"
            className="text-gray-200"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="currentColor"
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            className={done ? 'text-green-500 transition-all' : 'text-indigo-500 transition-all'}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className={`text-sm font-bold ${done ? 'text-green-700' : 'text-gray-800'}`}>
            {done ? '✓' : `${pct}%`}
          </span>
        </div>
      </div>
      {label && <span className="text-xs text-gray-500 mt-1">{label}</span>}
    </div>
  )
}
