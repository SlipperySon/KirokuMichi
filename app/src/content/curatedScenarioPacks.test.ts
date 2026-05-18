import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

type CuratedScenario = {
  id?: string
  title?: string
  textbook?: string
  textbookKey?: string
  level?: string
  lessonId?: string
  coreLessonId?: string
  sourceKind?: string
  canDo?: string
  sampleDialogue?: string
  page?: number
  lines?: Array<{ speaker?: string; text?: string; japanese?: string; translation?: string }>
  practicePrompts?: string[]
}

const PACKS = [
  { file: 'genki_1_scenarios.json', level: 'A1', lessons: 12, minCount: 21 },
  { file: 'genki_2_scenarios.json', level: 'A2', lessons: 11, minCount: 22 },
  { file: 'marugoto_a1_scenarios.json', level: 'A1', lessons: 9, minCount: 18 },
  { file: 'marugoto_a2_scenarios.json', level: 'A2', lessons: 9, minCount: 18 },
  { file: 'quartet_1_scenarios.json', level: 'B1', lessons: 6, minCount: 12 },
  { file: 'quartet_2_scenarios.json', level: 'B2', lessons: 6, minCount: 12 },
]

function readPack(file: string): CuratedScenario[] {
  return JSON.parse(readFileSync(resolve(process.cwd(), 'data/generated/scenarios', file), 'utf8'))
}

describe('curated scenario packs', () => {
  for (const pack of PACKS) {
    it(`${pack.file} has expected lesson coverage and usable scenario metadata`, () => {
      const scenarios = readPack(pack.file)
      const lessonIds = new Set(scenarios.map(scenario => scenario.coreLessonId))

      expect(scenarios.length).toBeGreaterThanOrEqual(pack.minCount)
      expect(lessonIds.size).toBe(pack.lessons)
      expect(scenarios.every(scenario => scenario.level === pack.level)).toBe(true)
      expect(scenarios.every(scenario => scenario.sourceKind === 'curated')).toBe(true)
      expect(scenarios.every(scenario => scenario.id && scenario.title && scenario.textbook && scenario.textbookKey)).toBe(true)
      expect(scenarios.every(scenario => scenario.lessonId && scenario.coreLessonId && scenario.canDo)).toBe(true)
      expect(scenarios.every(scenario => scenario.sampleDialogue && scenario.practicePrompts && scenario.practicePrompts.length >= 2)).toBe(true)
      expect(scenarios.every(scenario => typeof scenario.page === 'number')).toBe(true)
      expect(scenarios.every(scenario => scenario.lines && scenario.lines.length >= 2)).toBe(true)
      expect(scenarios.every(scenario => scenario.lines?.every(line => line.speaker && (line.text || line.japanese)))).toBe(true)
    })
  }
})
