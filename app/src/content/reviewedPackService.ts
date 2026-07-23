/**
 * Prefer curated / published learner packs under /data/generated/reviewed/
 * over heuristic comprehensive extracts when available.
 *
 * Gold: corrections-backed packs (Genki I L1, Quartet I L1, …)
 * Draft: quality-filtered comprehensive slices for other lessons
 */
import type { GrammarItem, VocabItem } from './curriculumService'

export interface ReviewedLessonOverlay {
  lessonId: string
  packId: string
  title: string
  tier: 'gold' | 'draft' | 'unknown'
  vocabulary: VocabItem[]
  grammar: GrammarItem[]
  exerciseCount: number
  contentBlockCount: number
}

interface IndexEntry {
  lessonId: string
  packId: string
  tier: 'gold' | 'draft'
  url: string
  vocabulary: number
  grammar: number
  contentBlocks: number
  exercises: number
  title?: string
}

interface PackVocab {
  id?: string
  surface?: string
  reading?: string | null
  meaning?: string | null
  sourceRef?: { pageNumber?: number; sourceId?: string }
}

interface PackGrammar {
  id?: string
  pattern?: string
  meaning?: string | null
  explanation?: string | null
  examples?: Array<{ japanese?: string; reading?: string; english?: string }>
  maynardRef?: GrammarItem['maynardRef']
  sourceRef?: { pageNumber?: number; sourceId?: string }
}

interface ReviewedPackJson {
  lessons?: Array<{
    id?: string
    appLessonId?: string
    title?: string
    qualityTier?: string
    vocabulary?: PackVocab[]
    grammar?: PackGrammar[]
    contentBlocks?: unknown[]
    exercises?: unknown[]
  }>
}

const INDEX_URL = '/data/generated/reviewed/index.json'

/** Fallback when index is missing (bootstrapped gold packs). */
const FALLBACK_URLS: Record<string, string> = Object.fromEntries([
  ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => [`genki_1_${n}`, `/data/generated/reviewed/genki_1_${n}.json`]),
  ...[1, 2, 3, 4, 5, 6].map((n) => [`quartet_1_${n}`, `/data/generated/reviewed/quartet_1_${n}.json`]),
  ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].flatMap((appIdx) => {
    const sourceLesson = appIdx + 12
    return [
      [`genki_2_${appIdx}`, `/data/generated/reviewed/genki_2_${appIdx}.json`],
      [`genki_2_${sourceLesson}`, `/data/generated/reviewed/genki_2_${sourceLesson}.json`],
    ]
  }),
  ...[1, 2, 3, 4, 5, 6].flatMap((appIdx) => {
    const sourceLesson = appIdx + 6
    return [
      [`quartet_2_${appIdx}`, `/data/generated/reviewed/quartet_2_${appIdx}.json`],
      [`quartet_2_${sourceLesson}`, `/data/generated/reviewed/quartet_2_${sourceLesson}.json`],
    ]
  }),
  ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16].map((n) => [
    `marugoto_a1_${n}`,
    `/data/generated/reviewed/marugoto_a1_${n}.json`,
  ]),
  ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18].map((n) => [
    `marugoto_a2_${n}`,
    `/data/generated/reviewed/marugoto_a2_${n}.json`,
  ]),
  ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17].map((n) => [
    `marugoto_b1_${n}`,
    `/data/generated/reviewed/marugoto_b1_${n}.json`,
  ]),
  ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].flatMap((n) => [
    [`tobira_textbook_${n}`, `/data/generated/reviewed/tobira_textbook_${n}.json`],
    [`tobira_${n}`, `/data/generated/reviewed/tobira_${n}.json`],
  ]),
])

const overlayCache = new Map<string, ReviewedLessonOverlay | null>()
let indexCache: IndexEntry[] | null = null
let indexLoaded = false

async function loadIndex(): Promise<IndexEntry[]> {
  if (indexLoaded) return indexCache ?? []
  indexLoaded = true
  try {
    const res = await fetch(INDEX_URL)
    if (!res.ok) {
      indexCache = []
      return []
    }
    const data = (await res.json()) as { packs?: IndexEntry[] }
    indexCache = data.packs ?? []
    return indexCache
  } catch {
    indexCache = []
    return []
  }
}

export async function reviewedPackUrlForLesson(lessonId: string): Promise<string | null> {
  const index = await loadIndex()
  const hit = index.find(e => e.lessonId === lessonId)
  if (hit) return hit.url
  return FALLBACK_URLS[lessonId] ?? null
}

/** Sync helper for tests / callers that only need the known gold map. */
export function reviewedPackUrlForLessonSync(lessonId: string): string | null {
  if (indexCache) {
    const hit = indexCache.find(e => e.lessonId === lessonId)
    if (hit) return hit.url
  }
  return FALLBACK_URLS[lessonId] ?? null
}

export async function getReviewedLessonOverlay(lessonId: string): Promise<ReviewedLessonOverlay | null> {
  if (overlayCache.has(lessonId)) return overlayCache.get(lessonId) ?? null

  const index = await loadIndex()
  const meta = index.find(e => e.lessonId === lessonId)
  const url = meta?.url ?? FALLBACK_URLS[lessonId]
  if (!url) {
    overlayCache.set(lessonId, null)
    return null
  }

  try {
    const res = await fetch(url)
    if (!res.ok) {
      overlayCache.set(lessonId, null)
      return null
    }
    const pack = (await res.json()) as ReviewedPackJson
    const lesson = pack.lessons?.[0]
    if (!lesson) {
      overlayCache.set(lessonId, null)
      return null
    }

    const tier: ReviewedLessonOverlay['tier'] =
      meta?.tier
      ?? (lesson.qualityTier === 'gold' || lesson.qualityTier === 'draft' ? lesson.qualityTier : 'unknown')

    const overlay: ReviewedLessonOverlay = {
      lessonId,
      packId: lesson.id ?? lessonId,
      title: lesson.title ?? meta?.title ?? lessonId,
      tier,
      vocabulary: (lesson.vocabulary ?? [])
        .filter(v => v.surface && v.meaning)
        .map((v, i) => ({
          id: v.id ?? `${lessonId}_rv_${i}`,
          surface: v.surface!,
          english: v.meaning!,
          lesson: lessonId,
          source: v.sourceRef?.sourceId ?? 'reviewed_pack',
          page: v.sourceRef?.pageNumber ?? 0,
        })),
      grammar: (lesson.grammar ?? [])
        .filter(g => g.pattern && g.meaning)
        .map((g, i) => ({
          id: g.id ?? `${lessonId}_rg_${i}`,
          pattern: g.pattern!,
          meaning: g.meaning!,
          explanation: g.explanation ?? undefined,
          examples: (g.examples ?? [])
            .filter(e => e.japanese && e.english)
            .map(e => ({
              japanese: e.japanese!,
              reading: e.reading,
              english: e.english!,
            })),
          maynardRef: g.maynardRef,
          lesson: lessonId,
          source: g.sourceRef?.sourceId ?? 'reviewed_pack',
          page: g.sourceRef?.pageNumber ?? 0,
        })),
      exerciseCount: lesson.exercises?.length ?? 0,
      contentBlockCount: lesson.contentBlocks?.length ?? 0,
    }

    // Empty overlays are useless — fall through to comprehensive.
    if (overlay.vocabulary.length === 0 && overlay.grammar.length === 0) {
      overlayCache.set(lessonId, null)
      return null
    }

    overlayCache.set(lessonId, overlay)
    return overlay
  } catch {
    overlayCache.set(lessonId, null)
    return null
  }
}

export function clearReviewedPackCache(): void {
  overlayCache.clear()
  indexCache = null
  indexLoaded = false
}
