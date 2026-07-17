/**
 * lessonSequencer.ts
 * Maps CEFR level ranges to textbook lesson queues and distributes them across weeks.
 */

import type { AssignedLesson } from '../store'

interface LessonEntry {
  normalized_id: string
  series: string
  lesson_number: number
}

interface LessonStructure {
  lessons: LessonEntry[]
}

type CefrLevel = 'Beginner' | 'A1' | 'A2' | 'B1' | 'B2' | 'C1'

// Which textbook series map to each level transition
const LEVEL_SERIES: Record<string, string[]> = {
  'Beginner→A1': ['Genki I'],
  'A1→A1':       ['Genki I'],
  'Beginner→A2': ['Genki I', 'Genki II'],
  'A1→A2':       ['Genki II', 'Marugoto A2'],
  'A2→B1':       ['Quartet 1', 'Marugoto B1'],
  'B1→B2':       ['Quartet 2', 'Tobira'],
  'B2→C1':       ['Tobira'],
}

function seriesForRange(from: CefrLevel, to: CefrLevel): string[] {
  const key = `${from}→${to}`
  if (LEVEL_SERIES[key]) return LEVEL_SERIES[key]

  // Multi-step: collect all series in order
  const STAGE_ORDER: CefrLevel[] = ['Beginner', 'A1', 'A2', 'B1', 'B2', 'C1']
  const fromIdx = STAGE_ORDER.indexOf(from)
  const toIdx = STAGE_ORDER.indexOf(to)
  if (toIdx <= fromIdx) return []

  const series: string[] = []
  for (let i = fromIdx; i < toIdx; i++) {
    const stepKey = `${STAGE_ORDER[i]}→${STAGE_ORDER[i + 1]}`
    const stepSeries = LEVEL_SERIES[stepKey] ?? []
    for (const s of stepSeries) {
      if (!series.includes(s)) series.push(s)
    }
  }
  return series
}

let cachedStructure: LessonStructure | null = null

async function fetchLessonStructure(): Promise<LessonStructure> {
  if (cachedStructure) return cachedStructure
  const res = await fetch('/data/generated/lesson-structure.json')
  if (!res.ok) throw new Error('Failed to load lesson structure')
  cachedStructure = await res.json() as LessonStructure
  return cachedStructure
}

/**
 * Returns 4 arrays of AssignedLesson (one per week) for the given level range,
 * excluding already-completed lessons and prioritising earlier lessons first.
 */
export async function assignLessonsToWeeks(
  from: CefrLevel,
  to: CefrLevel,
  completedLessons: string[],
  totalWeeks = 4,
): Promise<AssignedLesson[][]> {
  const structure = await fetchLessonStructure()
  const completedSet = new Set(completedLessons)
  const targetSeries = seriesForRange(from, to)

  if (targetSeries.length === 0) return Array.from({ length: totalWeeks }, () => [])

  // Filter and sort lessons
  const candidates = structure.lessons
    .filter(l => targetSeries.includes(l.series) && !completedSet.has(l.normalized_id))
    .sort((a, b) => {
      const ai = targetSeries.indexOf(a.series)
      const bi = targetSeries.indexOf(b.series)
      if (ai !== bi) return ai - bi
      return a.lesson_number - b.lesson_number
    })

  // Distribute into totalWeeks buckets (up to 4 lessons per week)
  const LESSONS_PER_WEEK = 4
  const buckets: AssignedLesson[][] = Array.from({ length: totalWeeks }, () => [])
  for (let i = 0; i < Math.min(candidates.length, totalWeeks * LESSONS_PER_WEEK); i++) {
    const week = Math.floor(i / LESSONS_PER_WEEK)
    const entry = candidates[i]
    buckets[week].push({
      id: entry.normalized_id,
      series: entry.series,
      lessonNumber: entry.lesson_number,
    })
  }

  return buckets
}
