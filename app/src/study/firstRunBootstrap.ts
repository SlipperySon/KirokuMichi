import type { LearningPath, AssignedLesson } from '../store'
import type { StorageProvider } from '../core/providers'
import { importBundledGenkiTestDeck, type BundledGenkiImportResult } from '../srs/bundledGenkiImport'
import { assignLessonsToWeeks } from './lessonSequencer'
import { lessonRouteFromId } from './studyPathPlanner'

export type PlacementCefr = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'

type SequencerCefr = 'Beginner' | 'A1' | 'A2' | 'B1' | 'B2' | 'C1'

/** First textbook lesson for a placement result. */
export function starterLessonIdFromCefr(cefr: PlacementCefr | string): string {
  switch (cefr) {
    case 'A2':
      return 'genki_2_1'
    case 'B1':
      return 'quartet_1_1'
    case 'B2':
    case 'C1':
    case 'C2':
      return 'quartet_2_1'
    case 'A1':
    default:
      return 'genki_1_1'
  }
}

function pathRange(cefr: PlacementCefr): [SequencerCefr, SequencerCefr] {
  switch (cefr) {
    case 'A1':
      return ['Beginner', 'A1']
    case 'A2':
      return ['A1', 'A2']
    case 'B1':
      return ['A2', 'B1']
    case 'B2':
      return ['B1', 'B2']
    default:
      return ['B2', 'C1']
  }
}

function seriesLabel(lessonId: string): string {
  if (lessonId.startsWith('genki_1_')) return 'Genki I'
  if (lessonId.startsWith('genki_2_')) return 'Genki II'
  if (lessonId.startsWith('quartet_1_')) return 'Quartet 1'
  if (lessonId.startsWith('quartet_2_')) return 'Quartet 2'
  return 'Textbook'
}

function lessonNumberFromId(lessonId: string): number {
  const match = lessonId.match(/_(\d+)$/)
  return match ? Number(match[1]) : 1
}

/** Canonical curriculum order for caught-up continuation beyond a 4-week path window. */
export function curriculumLessonOrder(): string[] {
  const order: string[] = []
  for (let n = 1; n <= 12; n++) order.push(`genki_1_${n}`)
  for (let n = 1; n <= 12; n++) order.push(`genki_2_${n}`)
  for (let n = 1; n <= 6; n++) order.push(`quartet_1_${n}`)
  for (let n = 1; n <= 6; n++) order.push(`quartet_2_${n}`)
  return order
}

export function nextCurriculumLessonId(completed: string[]): string | null {
  const done = new Set(completed)
  return curriculumLessonOrder().find(id => !done.has(id)) ?? null
}

function fallbackLessons(startLessonId: string): AssignedLesson[][] {
  const order = curriculumLessonOrder()
  const startIdx = Math.max(0, order.indexOf(startLessonId))
  const slice = order.slice(startIdx, startIdx + 16)
  const buckets: AssignedLesson[][] = Array.from({ length: 4 }, () => [])
  slice.forEach((id, i) => {
    buckets[Math.floor(i / 4)].push({
      id,
      series: seriesLabel(id),
      lessonNumber: lessonNumberFromId(id),
    })
  })
  return buckets
}

/** Seed a 4-week path with textbook lessons (no AI required). */
export async function buildStarterLearningPath(
  cefr: PlacementCefr,
  completedLessons: string[] = [],
): Promise<LearningPath> {
  const startId = starterLessonIdFromCefr(cefr)
  const [from, to] = pathRange(cefr)
  let weekly: AssignedLesson[][]
  try {
    weekly = await assignLessonsToWeeks(from, to, completedLessons)
    if (!weekly.some(week => week.length > 0)) {
      weekly = fallbackLessons(startId)
    }
  } catch {
    weekly = fallbackLessons(startId)
  }

  // Ensure week 1 always leads with the placement starter lesson when possible.
  if (weekly[0] && !weekly[0].some(l => l.id === startId) && !completedLessons.includes(startId)) {
    weekly[0] = [
      { id: startId, series: seriesLabel(startId), lessonNumber: lessonNumberFromId(startId) },
      ...weekly[0].filter(l => l.id !== startId),
    ].slice(0, 4)
  }

  const weeks = weekly.map((lessons, i) => ({
    week: i + 1,
    focus: i === 0 ? 'First lessons from your placement level' : `Week ${i + 1} textbook progress`,
    dailyGoal: 20,
    activities: [
      'Finish the next textbook lesson rail (Intro → Speak)',
      'Clear due Anki cards before adding new ones',
      'Produce one short sentence from today’s targets',
    ],
    milestone: lessons[0] ? `${lessons[0].series} Lesson ${lessons[0].lessonNumber}` : `Week ${i + 1}`,
    lessons,
  }))

  return {
    weeks,
    generatedAt: new Date().toISOString(),
  }
}

export async function countUserCardStates(storage: StorageProvider, userId: number): Promise<number> {
  const rows = await storage.query<{ count: number }>(
    `SELECT COUNT(*) AS count FROM card_states WHERE user_id = ?`,
    [userId],
  )
  return rows[0]?.count ?? 0
}

/** Import bundled Genki starter deck when the learner has no card states yet. */
export async function ensureStarterDeckIfEmpty(
  storage: StorageProvider,
  userId: number,
): Promise<BundledGenkiImportResult | null> {
  const count = await countUserCardStates(storage, userId)
  if (count > 0) return null
  return importBundledGenkiTestDeck(storage, userId)
}

export function firstLessonAutostartRoute(cefr: PlacementCefr): string {
  return lessonRouteFromId(starterLessonIdFromCefr(cefr), { autostart: true })
}
