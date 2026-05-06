export interface ImmersionBlock {
  index: number
  type: 'study' | 'break'
  durationMinutes: number
  startMinuteOfDay: number
}

export interface DailySchedule {
  blocks: ImmersionBlock[]
  totalStudyMinutes: number
  totalBreakMinutes: number
  firstStartMinute: number
  lastEndMinute: number
}

export interface AccuracySnapshot {
  sessionIndex: number
  correct: number
  total: number
  accuracyPercent: number
  takenAt: string
}

export function buildDailySchedule(
  sessionsPerDay: number,
  sessionMinutes: number,
  breakMinutes: number,
  startHour = 9
): DailySchedule {
  const blocks: ImmersionBlock[] = []
  let cursor = startHour * 60

  for (let i = 0; i < sessionsPerDay; i++) {
    blocks.push({
      index: i,
      type: 'study',
      durationMinutes: sessionMinutes,
      startMinuteOfDay: cursor,
    })
    cursor += sessionMinutes

    if (i < sessionsPerDay - 1) {
      blocks.push({
        index: i,
        type: 'break',
        durationMinutes: breakMinutes,
        startMinuteOfDay: cursor,
      })
      cursor += breakMinutes
    }
  }

  const studyBlocks = blocks.filter(b => b.type === 'study')
  const breakBlocks = blocks.filter(b => b.type === 'break')

  return {
    blocks,
    totalStudyMinutes: studyBlocks.reduce((s, b) => s + b.durationMinutes, 0),
    totalBreakMinutes: breakBlocks.reduce((s, b) => s + b.durationMinutes, 0),
    firstStartMinute: blocks[0]?.startMinuteOfDay ?? 0,
    lastEndMinute: cursor,
  }
}

export function currentMinuteOfDay(now = new Date()): number {
  return now.getHours() * 60 + now.getMinutes()
}

export function findCurrentBlock(schedule: DailySchedule, now = new Date()): ImmersionBlock | null {
  const minute = currentMinuteOfDay(now)
  for (const block of schedule.blocks) {
    const end = block.startMinuteOfDay + block.durationMinutes
    if (minute >= block.startMinuteOfDay && minute < end) return block
  }
  return null
}

export function findNextBlock(schedule: DailySchedule, now = new Date()): ImmersionBlock | null {
  const minute = currentMinuteOfDay(now)
  return schedule.blocks.find(b => b.startMinuteOfDay > minute) ?? null
}

export function minutesUntilBlock(block: ImmersionBlock, now = new Date()): number {
  return Math.max(0, block.startMinuteOfDay - currentMinuteOfDay(now))
}

export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}m`
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

export function formatMinuteOfDay(minuteOfDay: number): string {
  const h = Math.floor(minuteOfDay / 60)
  const m = minuteOfDay % 60
  const period = h < 12 ? 'am' : 'pm'
  const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${displayH}:${String(m).padStart(2, '0')}${period}`
}

export function accuracyRating(percent: number): { label: string; color: string } {
  if (percent >= 90) return { label: 'Excellent', color: 'text-green-600' }
  if (percent >= 75) return { label: 'Good', color: 'text-indigo-600' }
  if (percent >= 60) return { label: 'Fair', color: 'text-yellow-600' }
  return { label: 'Needs work', color: 'text-red-600' }
}
