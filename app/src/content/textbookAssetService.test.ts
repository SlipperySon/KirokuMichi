import { afterEach, describe, expect, it, vi } from 'vitest'
import { textbookAssetService } from './textbookAssetService'

describe('textbookAssetService', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    textbookAssetService.clearCache()
  })

  it('returns an empty manifest when textbook image assets have not been generated yet', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false })))

    await expect(textbookAssetService.getAssetsForLesson('genki_1_textbook', 'genki_1_1')).resolves.toEqual([])
  })

  it('filters and sorts lesson/page assets from the manifest', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({
        generatedAt: '2026-05-18T00:00:00.000Z',
        assets: [
          {
            id: 'late',
            textbookKey: 'genki_1_textbook',
            lessonId: 'genki_1_1',
            page: 24,
            kind: 'photo',
            src: '/data/assets/photo.jpg',
            alt: 'A photo',
          },
          {
            id: 'early',
            textbookKey: 'genki_1_textbook',
            lessonId: 'genki_1_1',
            page: 20,
            kind: 'page',
            src: '/data/assets/page.jpg',
            alt: 'A page',
          },
          {
            id: 'other',
            textbookKey: 'genki_2_textbook',
            lessonId: 'genki_2_1',
            page: 20,
            kind: 'page',
            src: '/data/assets/other.jpg',
            alt: 'Other page',
          },
        ],
      }),
    })))

    const lessonAssets = await textbookAssetService.getAssetsForLesson('genki_1_textbook', 'genki_1_1')
    const pageAssets = await textbookAssetService.getAssetsForPage('genki_1_textbook', 20)

    expect(lessonAssets.map(asset => asset.id)).toEqual(['early', 'late'])
    expect(pageAssets.map(asset => asset.id)).toEqual(['early'])
  })

  it('can load assets across the base textbook and supplemental source keys for a lesson', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({
        generatedAt: '2026-05-18T00:00:00.000Z',
        assets: [
          {
            id: 'textbook',
            textbookKey: 'genki_1_textbook',
            lessonId: 'genki_1_1',
            page: 45,
            kind: 'photo',
            src: '/data/generated/assets/textbook/textbook.jpg',
            alt: 'Textbook photo',
          },
          {
            id: 'workbook',
            textbookKey: 'genki_1_workbook',
            lessonId: 'genki_1_1',
            page: 14,
            kind: 'exercise',
            src: '/data/generated/assets/textbook/workbook.jpg',
            alt: 'Workbook exercise',
          },
          {
            id: 'wrong-lesson',
            textbookKey: 'genki_1_workbook',
            lessonId: 'genki_1_2',
            page: 22,
            kind: 'exercise',
            src: '/data/generated/assets/textbook/other.jpg',
            alt: 'Other workbook exercise',
          },
        ],
      }),
    })))

    const assets = await textbookAssetService.getAssetsForLessonSources(
      ['genki_1_textbook', 'genki_1_workbook'],
      'genki_1_1'
    )

    expect(assets.map(asset => asset.id)).toEqual(['workbook', 'textbook'])
  })
})
