import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { importBundledGenkiTestDeck } from './bundledGenkiImport'
import type { StorageProvider } from '../core/providers'

function makeStorage(): StorageProvider & { execute: ReturnType<typeof vi.fn>, query: ReturnType<typeof vi.fn> } {
  let nextId = 100
  const storage = {
    execute: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    query: vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('COUNT(*) AS cards')) return Promise.resolve([{ cards: 2 }])
      if (sql.includes('COUNT(*) AS linked')) return Promise.resolve([{ linked: 2 }])
      if (sql.includes('SELECT id FROM cards')) {
        if (sql.includes('ORDER BY id DESC')) return Promise.resolve([{ id: nextId++ }])
        return Promise.resolve([])
      }
      return Promise.resolve([])
    }),
  }
  return storage
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('importBundledGenkiTestDeck', () => {
  it('keeps every bundled Genki card linked to the expected lesson counts', () => {
    const pack = JSON.parse(readFileSync(resolve(__dirname, '../../public/test-data/genki-official-test-cards.json'), 'utf8')) as {
      notes: Array<{
        front: string
        sentence: string | null
        sentenceMeaning: string | null
        sourceLessonId: string | null
      }>
    }
    const seenFronts = new Set<string>()
    const counts = new Map<string, { rawNotes: number; vocabCards: number; sentenceCards: number; totalCards: number }>()

    for (const note of pack.notes) {
      expect(note.sourceLessonId).toBeTruthy()
      const lessonId = note.sourceLessonId!
      const row = counts.get(lessonId) ?? { rawNotes: 0, vocabCards: 0, sentenceCards: 0, totalCards: 0 }
      row.rawNotes += 1

      if (!seenFronts.has(note.front)) {
        seenFronts.add(note.front)
        row.vocabCards += 1
        row.totalCards += 1
      }
      if (note.sentence && note.sentenceMeaning) {
        row.sentenceCards += 1
        row.totalCards += 1
      }
      counts.set(lessonId, row)
    }

    expect(pack.notes).toHaveLength(1241)
    expect(seenFronts.size).toBe(1219)
    expect([...counts.values()].reduce((sum, row) => sum + row.sentenceCards, 0)).toBe(1235)
    expect([...counts.values()].reduce((sum, row) => sum + row.totalCards, 0)).toBe(2454)
    expect([...counts.keys()].sort()).toEqual([
      'genki_1_1', 'genki_1_10', 'genki_1_11', 'genki_1_12', 'genki_1_2', 'genki_1_3',
      'genki_1_4', 'genki_1_5', 'genki_1_6', 'genki_1_7', 'genki_1_8', 'genki_1_9',
      'genki_2_1', 'genki_2_10', 'genki_2_11', 'genki_2_2', 'genki_2_3', 'genki_2_4',
      'genki_2_5', 'genki_2_6', 'genki_2_7', 'genki_2_8', 'genki_2_9',
    ])
    expect(Object.fromEntries([...counts.entries()].map(([id, row]) => [id, row.totalCards]))).toEqual({
      genki_1_1: 106,
      genki_1_2: 111,
      genki_1_3: 111,
      genki_1_4: 124,
      genki_1_5: 102,
      genki_1_6: 92,
      genki_1_7: 112,
      genki_1_8: 111,
      genki_1_9: 110,
      genki_1_10: 111,
      genki_1_11: 96,
      genki_1_12: 106,
      genki_2_1: 112,
      genki_2_2: 102,
      genki_2_3: 105,
      genki_2_4: 104,
      genki_2_5: 113,
      genki_2_6: 109,
      genki_2_7: 99,
      genki_2_8: 106,
      genki_2_9: 108,
      genki_2_10: 110,
      genki_2_11: 94,
    })
  })

  it('links bundled vocabulary and sentence cards to normalized Genki lesson ids', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({
        version: 1,
        source: 'test',
        media: 'omitted',
        notes: [{
          front: '遅れる',
          back: 'to be late',
          reading: 'おくれる',
          sentence: '授業に遅れました。',
          sentenceMeaning: 'I was late to class.',
          sourceLessonId: 'genki_2_1',
        }],
      }),
    })))
    const storage = makeStorage()

    const result = await importBundledGenkiTestDeck(storage, 7)

    expect(result).toEqual({ imported: 1, skipped: 0, cards: 2, linked: 2 })
    expect(storage.execute).toHaveBeenCalledWith(
      expect.stringContaining('INSERT OR IGNORE INTO lesson_vocabulary'),
      [7, 'genki_2_1', 100, 100]
    )
    expect(storage.execute).toHaveBeenCalledWith(
      expect.stringContaining('INSERT OR IGNORE INTO lesson_vocabulary'),
      [7, 'genki_2_1', 101, 101]
    )
  })
})
