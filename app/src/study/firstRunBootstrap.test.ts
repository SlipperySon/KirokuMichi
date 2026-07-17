import { describe, expect, it } from 'vitest'
import {
  buildStarterLearningPath,
  curriculumLessonOrder,
  firstLessonAutostartRoute,
  nextCurriculumLessonId,
  starterLessonIdFromCefr,
} from './firstRunBootstrap'
import { interleaveDueAndNew } from './reviewInterleave'
import type { ReviewCard } from './types'

function card(id: number, front: string): ReviewCard {
  return {
    cardStateId: id,
    cardId: id,
    type: 'vocabulary',
    front,
    back: front,
    reading: null,
    audioUrl: null,
    jlptLevel: null,
    userNote: null,
    exampleSentence: null,
    exampleTranslation: null,
    state: 'new',
    due: new Date().toISOString(),
    stability: 0,
    difficulty: 0,
    lapses: 0,
  }
}

describe('firstRunBootstrap', () => {
  it('maps placement CEFR to a starter textbook lesson', () => {
    expect(starterLessonIdFromCefr('A1')).toBe('genki_1_1')
    expect(starterLessonIdFromCefr('A2')).toBe('genki_2_1')
    expect(starterLessonIdFromCefr('B1')).toBe('quartet_1_1')
    expect(starterLessonIdFromCefr('B2')).toBe('quartet_2_1')
  })

  it('builds an autostart route into the first lesson', () => {
    expect(firstLessonAutostartRoute('A1')).toBe('/learn/lessons/a1/1?autostart=1')
  })

  it('continues curriculum after completed lessons', () => {
    expect(nextCurriculumLessonId([])).toBe('genki_1_1')
    expect(nextCurriculumLessonId(['genki_1_1', 'genki_1_2'])).toBe('genki_1_3')
    expect(nextCurriculumLessonId(curriculumLessonOrder())).toBeNull()
  })

  it('seeds a starter learning path with textbook lessons', async () => {
    const path = await buildStarterLearningPath('A1')
    expect(path.weeks).toHaveLength(4)
    const week1 = path.weeks[0].lessons ?? []
    expect(week1.some(lesson => lesson.id === 'genki_1_1')).toBe(true)
    expect(path.weeks.some(week => (week.lessons?.length ?? 0) > 0)).toBe(true)
  })
})

describe('interleaveDueAndNew', () => {
  it('inserts at most 1 new after every 5 due cards', () => {
    const due = Array.from({ length: 10 }, (_, i) => card(i + 1, `due${i}`))
    const news = Array.from({ length: 4 }, (_, i) => card(100 + i, `new${i}`))
    const queue = interleaveDueAndNew(due, news, 12)
    expect(queue.map(c => c.front)).toEqual([
      'due0', 'due1', 'due2', 'due3', 'due4', 'new0',
      'due5', 'due6', 'due7', 'due8', 'due9', 'new1',
    ])
  })

  it('fills with new cards when dues run out', () => {
    const due = [card(1, 'due0')]
    const news = [card(2, 'new0'), card(3, 'new1')]
    expect(interleaveDueAndNew(due, news, 3).map(c => c.front)).toEqual(['due0', 'new0', 'new1'])
  })
})
