import type { HeatmapDay } from './types'

interface Props {
  data: HeatmapDay[]
  currentStreak: number
}

function dayColor(day: HeatmapDay): string {
  const hasVocab = day.vocabReviewed > 0
  const hasGrammar = day.grammarReviewed > 0
  if (hasVocab && hasGrammar) return 'bg-green-500'
  if (hasVocab) return 'bg-blue-400'
  if (hasGrammar) return 'bg-purple-400'
  return 'bg-gray-100'
}

const DAY_HEADERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function Heatmap({ data, currentStreak }: Props) {
  const dayMap = new Map(data.map(d => [d.date, d]))
  const today = new Date()

  // Get start and end dates for 84-day window
  const gridEnd = new Date(today)
  const gridStart = new Date(today)
  gridStart.setDate(gridStart.getDate() - 83)

  // Group days by month
  const monthGroups: { month: string; year: number; weeks: (HeatmapDay | null)[][] }[] = []

  const cursor = new Date(gridStart)
  while (cursor <= gridEnd) {
    const month = cursor.getMonth()
    const year = cursor.getFullYear()
    const monthKey = `${year}-${month}`

    let group = monthGroups.find(g => g.month === monthKey)
    if (!group) {
      group = { month: monthKey, year, weeks: [] }
      monthGroups.push(group)
    }

    // Add padding for first week if needed
    if (group.weeks.length === 0 && cursor.getDay() > 0) {
      const padding = new Array(cursor.getDay()).fill(null)
      group.weeks.push(padding as (HeatmapDay | null)[])
    }

    const dateStr = cursor.toISOString().split('T')[0]
    const count = dayMap.get(dateStr)?.cardsReviewed ?? 0
    const dayData: HeatmapDay = { date: dateStr, cardsReviewed: count, sessionCount: 0 }

    if (group.weeks.length === 0) group.weeks.push([])
    const currentWeek = group.weeks[group.weeks.length - 1]
    currentWeek.push(dayData)

    if (currentWeek.length === 7) {
      group.weeks.push([])
    }

    cursor.setDate(cursor.getDate() + 1)
  }

  // Remove empty last week
  monthGroups.forEach(g => {
    if (g.weeks[g.weeks.length - 1].length === 0) g.weeks.pop()
  })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-600">Study Streak</span>
        <span className="text-sm font-semibold text-green-600">
          {currentStreak > 0 ? `${currentStreak} day${currentStreak !== 1 ? 's' : ''}` : 'Start today!'}
        </span>
      </div>

      <div className="flex items-center gap-3 text-xs text-gray-400">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-blue-400 inline-block" /> Words</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-purple-400 inline-block" /> Grammar</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-green-500 inline-block" /> Both</span>
      </div>

      <div className="overflow-x-auto">
        <div className="flex flex-col gap-8">
          {/* Pair months into rows */}
          {Array.from({ length: Math.ceil(monthGroups.length / 2) }).map((_, rowIdx) => {
            const month1 = monthGroups[rowIdx * 2]
            const month2 = monthGroups[rowIdx * 2 + 1]
            return (
              <div key={`row-${rowIdx}`} className="flex gap-8">
                {/* First month in row */}
                {month1 && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-600 mb-2">
                      {new Date(month1.year, parseInt(month1.month.split('-')[1])).toLocaleString('default', { month: 'long', year: 'numeric' })}
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 24px)', gap: '3px' }}>
                      {/* Day headers */}
                      {DAY_HEADERS.map(day => (
                        <div key={day} className="text-xs text-gray-400 font-medium text-center h-5 flex items-center justify-center">
                          {day}
                        </div>
                      ))}
                      {/* Cells */}
                      {month1.weeks.map((week, wIdx) => (
                        week.map((dayData, dIdx) => (
                          <div
                            key={`${wIdx}-${dIdx}`}
                            className={`rounded-sm h-6 w-6 ${dayData ? dayColor(dayData) : 'bg-transparent'}`}
                            title={dayData && dayData.cardsReviewed > 0 ? `${dayData.date}: ${dayData.vocabReviewed} words · ${dayData.grammarReviewed} grammar` : dayData?.date ?? ''}
                          />
                        ))
                      ))}
                    </div>
                  </div>
                )}

                {/* Second month in row */}
                {month2 && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-600 mb-2">
                      {new Date(month2.year, parseInt(month2.month.split('-')[1])).toLocaleString('default', { month: 'long', year: 'numeric' })}
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 24px)', gap: '3px' }}>
                      {/* Day headers */}
                      {DAY_HEADERS.map(day => (
                        <div key={day} className="text-xs text-gray-400 font-medium text-center h-5 flex items-center justify-center">
                          {day}
                        </div>
                      ))}
                      {/* Cells */}
                      {month2.weeks.map((week, wIdx) => (
                        week.map((dayData, dIdx) => (
                          <div
                            key={`${wIdx}-${dIdx}`}
                            className={`rounded-sm h-6 w-6 ${dayData ? dayColor(dayData) : 'bg-transparent'}`}
                            title={dayData && dayData.cardsReviewed > 0 ? `${dayData.date}: ${dayData.vocabReviewed} words · ${dayData.grammarReviewed} grammar` : dayData?.date ?? ''}
                          />
                        ))
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
