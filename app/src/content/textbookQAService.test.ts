import { afterEach, describe, expect, it, vi } from 'vitest'
import { clearSupplementalScenarioCache } from './supplementalScenarioService'
import { curriculumService } from './curriculumService'
import { textbookAssetService } from './textbookAssetService'
import { getTextbookQARows } from './textbookQAService'

describe('textbookQAService', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    clearSupplementalScenarioCache()
    curriculumService.clearCache()
    textbookAssetService.clearCache()
  })

  it('reports workbook, asset, and Maynard coverage fields for every lesson row', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => {
      const url = String(input)
      if (url.includes('textbook-assets.json')) {
        return {
          ok: true,
          json: async () => ({
            generatedAt: '2026-05-18T00:00:00.000Z',
            assets: [
              {
                id: 'asset-1',
                textbookKey: 'genki_1_textbook',
                lessonId: 'genki_1_1',
                page: 32,
                kind: 'photo',
                src: '/data/assets/asset-1.jpg',
                alt: 'Lesson photo',
              },
            ],
          }),
        }
      }

      if (url.includes('/scenarios/')) {
        return {
          ok: true,
          json: async () => [
            {
              id: 'scenario-1',
              title: 'Self Introduction',
              titleJa: '自己紹介',
              description: 'Practice introductions.',
              textbook: 'Genki 1 Workbook',
              textbookKey: 'genki_1_workbook',
              level: 'A1',
              lessonId: 'genki_1_1',
              coreLessonId: 'genki_1_1',
              page: 12,
              sourceKind: 'curated',
              canDo: 'Can introduce yourself.',
              participants: ['A', 'B'],
              sampleDialogue: 'はじめまして。',
              lines: [{ speaker: 'A', text: 'はじめまして。' }],
              practicePrompts: ['Introduce yourself and ask one question.'],
            },
          ],
        }
      }

      if (url.includes('/textbooks/')) {
        const isGenki1 = url.includes('genki_1_textbook')
        const isWorkbook = url.includes('workbook')
        return {
          ok: true,
          json: async () => ({
            textbook: url,
            generatedAt: '2026-05-18T00:00:00.000Z',
            statistics: { vocab: 1, grammar: 1, dialogues: 0, exercises: 1 },
            vocabulary: isGenki1 ? [
              { id: 'v1', surface: '学生', english: 'student', lesson: 'genki_1_1', source: 'genki_1_textbook', page: 32 },
            ] : [],
            grammar: isGenki1 ? [
              {
                id: 'g1',
                pattern: 'です',
                meaning: 'polite to be',
                lesson: 'genki_1_1',
                source: 'genki_1_textbook',
                page: 32,
                maynardRef: { topicId: 'm1', title: 'Copula', excerpt: '...', examples: [] },
              },
            ] : [],
            dialogues: [],
            exercises: isWorkbook ? [
              { id: 'e1', lesson: 'genki_1_1', type: 'short_answer', question: '自己紹介をしてください。', source: 'genki_1_workbook', page: 12 },
            ] : [],
          }),
        }
      }

      return { ok: false, json: async () => ({}) }
    }))

    const rows = await getTextbookQARows()

    expect(rows.length).toBeGreaterThan(0)
    expect(rows.every(row => Number.isInteger(row.workbookTaskCount))).toBe(true)
    expect(rows.every(row => Number.isInteger(row.assetCount))).toBe(true)
    expect(rows.every(row => row.maynardCoveragePct >= 0 && row.maynardCoveragePct <= 100)).toBe(true)
    expect(rows.find(row => row.lessonId === 'genki_1_1')).toMatchObject({
      assetCount: 1,
      maynardDirectCount: 0,
      maynardCuratedCount: 0,
      maynardCoveragePct: 100,
    })
  })
})
