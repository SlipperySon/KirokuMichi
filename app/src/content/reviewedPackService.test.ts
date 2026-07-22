import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearReviewedPackCache,
  getReviewedLessonOverlay,
  reviewedPackUrlForLesson,
  reviewedPackUrlForLessonSync,
} from './reviewedPackService'

describe('reviewedPackService', () => {
  beforeEach(() => {
    clearReviewedPackCache()
    vi.restoreAllMocks()
  })

  it('falls back to gold URLs without an index', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))
    expect(await reviewedPackUrlForLesson('genki_1_1')).toBe('/data/generated/reviewed/genki_1_1.json')
    expect(await reviewedPackUrlForLesson('genki_1_2')).toBe('/data/generated/reviewed/genki_1_2.json')
    expect(await reviewedPackUrlForLesson('quartet_1_1')).toBe('/data/generated/reviewed/quartet_1_1.json')
    expect(await reviewedPackUrlForLesson('quartet_1_2')).toBe('/data/generated/reviewed/quartet_1_2.json')
    expect(await reviewedPackUrlForLesson('genki_2_1')).toBe('/data/generated/reviewed/genki_2_1.json')
    expect(await reviewedPackUrlForLesson('genki_2_13')).toBe('/data/generated/reviewed/genki_2_13.json')
    expect(await reviewedPackUrlForLesson('quartet_2_1')).toBe('/data/generated/reviewed/quartet_2_1.json')
    expect(await reviewedPackUrlForLesson('quartet_2_7')).toBe('/data/generated/reviewed/quartet_2_7.json')
    expect(await reviewedPackUrlForLesson('marugoto_a1_1')).toBe('/data/generated/reviewed/marugoto_a1_1.json')
    expect(await reviewedPackUrlForLesson('tobira_textbook_1')).toBe('/data/generated/reviewed/tobira_textbook_1.json')
    expect(await reviewedPackUrlForLesson('tobira_1')).toBe('/data/generated/reviewed/tobira_1.json')
    expect(await reviewedPackUrlForLesson('genki_1_99')).toBeNull()
    expect(reviewedPackUrlForLessonSync('genki_1_1')).toBe('/data/generated/reviewed/genki_1_1.json')
    expect(reviewedPackUrlForLessonSync('genki_2_1')).toBe('/data/generated/reviewed/genki_2_1.json')
  })

  it('uses index.json when present', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('index.json')) {
          return {
            ok: true,
            json: async () => ({
              packs: [{
                lessonId: 'genki_1_2',
                packId: 'genki_1_2_draft',
                tier: 'draft',
                url: '/data/generated/reviewed/genki_1_2.json',
                vocabulary: 5,
                grammar: 2,
                contentBlocks: 0,
                exercises: 0,
              }],
            }),
          }
        }
        return { ok: false }
      }),
    )
    expect(await reviewedPackUrlForLesson('genki_1_2')).toBe('/data/generated/reviewed/genki_1_2.json')
  })

  it('maps pack vocab/grammar onto curriculum shapes', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('index.json')) {
          return { ok: true, json: async () => ({ packs: [] }) }
        }
        return {
          ok: true,
          json: async () => ({
            lessons: [{
              id: 'genki_1_lesson_1',
              title: 'New Friends',
              qualityTier: 'gold',
              vocabulary: [
                { id: 'v1', surface: 'だいがく', meaning: 'university', sourceRef: { pageNumber: 47, sourceId: 'genki_1_textbook' } },
              ],
              grammar: [
                { id: 'g1', pattern: 'XはYです', meaning: 'X is Y', sourceRef: { pageNumber: 50 } },
              ],
              contentBlocks: [{}, {}],
              exercises: [{}],
            }],
          }),
        }
      }),
    )

    const overlay = await getReviewedLessonOverlay('genki_1_1')
    expect(overlay?.vocabulary).toHaveLength(1)
    expect(overlay?.vocabulary[0]).toMatchObject({
      surface: 'だいがく',
      english: 'university',
      lesson: 'genki_1_1',
    })
    expect(overlay?.grammar[0]?.pattern).toBe('XはYです')
    expect(overlay?.exerciseCount).toBe(1)
    expect(overlay?.contentBlockCount).toBe(2)
    expect(overlay?.tier).toBe('gold')
  })
})
