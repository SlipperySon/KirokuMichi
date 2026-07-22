/**
 * Build Marugoto + Tobira gold learner packs.
 *
 * Tobira: OCR 単語表 pages + comprehensive CEFR grammar/dialogues/exercises.
 * Marugoto A1/A2/B1: comprehensive CEFR grammar (+ dialogues/exercises when tagged);
 *   OCR vocab lists are not present in Katsudoo books (activity-first), so packs are
 *   grammar-forward gold comparable on grammar/dialogue richness, thinner on vocab.
 *
 * Usage (from app/):
 *   npx tsx tools/textbook-pack/build-marugoto-tobira-gold.ts
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import {
  dedupeVocab,
  parseTobiraVocabTable,
  qualityTobiraVocab,
  type ParsedVocab,
} from './parse-tobira-ocr-vocab.ts'

const appRoot = process.cwd()
const grouped = (book: string, page: number) =>
  path.join(appRoot, `tools/textbook-pack/out/grouped/${book}/pages/page-${String(page).padStart(4, '0')}.json`)
const reviewedDir = path.join(appRoot, 'tools/textbook-pack/out/reviewed-packs')
const correctionsDir = path.join(appRoot, 'tools/textbook-pack/corrections')
const textbooksDir = path.join(appRoot, 'data/generated/textbooks')
const manifestPath = path.join(appRoot, 'tools/textbook-pack/out/source-manifest.json')

interface GroupedPage {
  pageNumber?: number
  sourceId?: string
  blocks?: Array<{ text?: string }>
}

/** Tobira lesson starts from TOC (print pages ≈ PDF page numbers in OCR dump). */
const TOBIRA_LESSONS: Array<{ lesson: number; start: number; title: string }> = [
  { lesson: 1, start: 5, title: '日本の地理' },
  { lesson: 2, start: 25, title: '日本語のスピーチスタイル' },
  { lesson: 3, start: 53, title: '日本のテクノロジー' },
  { lesson: 4, start: 77, title: '日本のスポーツ' },
  { lesson: 5, start: 99, title: '日本の食べ物' },
  { lesson: 6, start: 127, title: '日本人と宗教' },
  { lesson: 7, start: 151, title: '日本のポップカルチャー' },
  { lesson: 8, start: 177, title: '日本の伝統芸能' },
  { lesson: 9, start: 199, title: '日本の教育' },
  { lesson: 10, start: 223, title: '日本の便利な店' },
  { lesson: 11, start: 243, title: '日本の歴史' },
  { lesson: 12, start: 267, title: '日本の伝統工芸' },
  { lesson: 13, start: 289, title: '日本人と自然' },
  { lesson: 14, start: 315, title: '日本の政治' },
  { lesson: 15, start: 339, title: '世界と私の国の未来' },
]

const MARUGOTO_SPECS = [
  {
    textbookKey: 'marugoto_a1' as const,
    sourceId: 'marugoto_a1_textbook',
    levelRange: 'A1',
    title: 'Marugoto A1: Katsudoo (Starter)',
    lessons: 17,
  },
  {
    textbookKey: 'marugoto_a2' as const,
    sourceId: 'marugoto_a2_textbook',
    levelRange: 'A2',
    title: 'Marugoto A2: Katsudoo (Elementary 2)',
    lessons: 18,
  },
  {
    textbookKey: 'marugoto_b1' as const,
    sourceId: 'marugoto_b1_textbook',
    levelRange: 'B1',
    title: 'Marugoto B1: Intermediate 1',
    lessons: 17,
  },
]

function reviewStamp(notes: string) {
  return {
    action: 'approved' as const,
    reviewedAt: new Date().toISOString(),
    reviewer: 'marugoto_tobira_gold_enrich',
    notes,
  }
}

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, 'utf8')) as T
}

async function readPage(book: string, page: number): Promise<{ pageNumber: number; text: string } | null> {
  try {
    const data = JSON.parse(await readFile(grouped(book, page), 'utf8')) as GroupedPage
    const text = (data.blocks ?? []).map((b) => b.text ?? '').join('\n')
    return { pageNumber: data.pageNumber ?? page, text }
  } catch {
    return null
  }
}

function lessonTagsFor(series: string, lesson: number): string[] {
  if (series === 'tobira') {
    return [`tobira_${lesson}`, `tobira_textbook_${lesson}`, `textbook_tobira_textbook_${lesson}`]
  }
  // marugoto_a1 / marugoto_a2 / marugoto_b1
  const short = series.replace('marugoto_', '') // a1 | a2 | b1
  return [
    `${series}_${lesson}`,
    `${short}_textbook_${series}_${lesson}`,
  ]
}

function matchesLesson(itemLesson: string, tags: string[]): boolean {
  if (tags.includes(itemLesson)) return true
  // Boundary-safe suffix only (never bare endsWith(tag) — marugoto_a1_10 ends with marugoto_a1_1).
  return tags.some((tag) => itemLesson.endsWith(`_${tag}`))
}

async function loadSources(sourceIds: string[]) {
  try {
    const manifest = await readJson<{
      entries: Array<{ id: string; role: string; fingerprint: { sha256: string; bytes: number } }>
    }>(manifestPath)
    return sourceIds.map((id) => {
      const entry = manifest.entries.find((e) => e.id === id)
      if (!entry) return { sourceId: id, role: 'textbook' as const }
      return { sourceId: entry.id, role: entry.role, fingerprint: entry.fingerprint }
    })
  } catch {
    return sourceIds.map((id) => ({ sourceId: id, role: 'textbook' as const }))
  }
}

async function loadCurriculumExtras(
  textbookFile: string,
  lessonTags: string[],
  lessonNumber: number,
  sourceId: string,
  idPrefix: string,
) {
  const curriculum = await readJson<{
    vocabulary?: Array<Record<string, unknown>>
    grammar?: Array<Record<string, unknown>>
    dialogues?: Array<Record<string, unknown>>
    exercises?: Array<Record<string, unknown>>
  }>(path.join(textbooksDir, textbookFile))

  const review = reviewStamp('from comprehensive curriculum')

  const vocabulary = (curriculum.vocabulary ?? [])
    .filter((v) => matchesLesson(String(v.lesson ?? ''), lessonTags))
    .map((v, i) => {
      const surface = String(v.surface ?? v.japanese ?? '')
      const meaning = String(v.english ?? v.meaning ?? '')
      return {
        id: `${idPrefix}_comp_vocab_${i + 1}`,
        surface,
        reading: (v.reading as string | null) ?? null,
        meaning,
        lessonNumber,
        sourceRef: { sourceId, pageNumber: Math.max(1, Number(v.page ?? 0) || 1) },
        tags: ['gold_comprehensive'],
        review,
      }
    })
    .filter((v) => /[\u3040-\u30ff\u4e00-\u9fff]/.test(v.surface) && /[A-Za-z]/.test(v.meaning) && v.surface.length <= 24)
    .slice(0, 40)

  const grammar = (curriculum.grammar ?? [])
    .filter((g) => matchesLesson(String(g.lesson ?? ''), lessonTags))
    .map((g, i) => ({
      id: `${idPrefix}_grammar_${i + 1}`,
      pattern: String(g.pattern ?? g.title ?? ''),
      meaning: String(g.meaning ?? ''),
      explanation: g.explanation,
      examples: Array.isArray(g.examples) ? g.examples : [],
      lessonNumber,
      sourceRef: {
        sourceId,
        pageNumber: Math.max(1, Number(g.page ?? 0) || 1),
      },
      review,
    }))
    .filter((g) => g.pattern.trim().length >= 1)
    .slice(0, 24)

  const contentBlocks = (curriculum.dialogues ?? [])
    .filter((d) => matchesLesson(String(d.lesson ?? ''), lessonTags))
    .slice(0, 12)
    .map((d, i) => {
      const lines = Array.isArray(d.lines) ? (d.lines as Array<{ speaker?: string; japanese?: string }>) : []
      const text = lines
        .map((line) => `${line.speaker ? `${line.speaker}: ` : ''}${line.japanese ?? ''}`.trim())
        .filter(Boolean)
        .join('\n')
      return {
        id: `${idPrefix}_dialogue_${i + 1}`,
        type: 'dialogue',
        title: String(d.title ?? `Dialogue ${i + 1}`),
        text,
        sourceRef: {
          sourceId: String(d.source ?? sourceId),
          pageNumber: Math.max(1, Number(d.page ?? 0) || 1),
        },
        review,
      }
    })
    .filter((b) => /[\u3040-\u30ff\u4e00-\u9fff]/.test(b.text))

  const exercises = (curriculum.exercises ?? [])
    .filter((e) => matchesLesson(String(e.lesson ?? ''), lessonTags))
    .slice(0, 20)
    .map((e, i) => ({
      id: String(e.id ?? `${idPrefix}_ex_${i + 1}`),
      label: String(e.type ?? 'exercise'),
      prompt: String(e.question ?? ''),
      sourceRef: {
        sourceId: String(e.source ?? sourceId),
        pageNumber: Math.max(1, Number(e.page ?? 0) || 1),
      },
      review,
    }))
    .filter((e) => e.prompt.trim().length >= 2)

  return { vocabulary, grammar, contentBlocks, exercises }
}

function toOcrVocabEntries(items: ParsedVocab[], idPrefix: string, lessonNumber: number, sourceId: string, notes: string) {
  return items.map((item, i) => ({
    id: `${idPrefix}_vocab_${i + 1}`,
    surface: item.surface,
    reading: item.reading,
    meaning: item.meaning,
    lessonNumber,
    sourceRef: { sourceId, pageNumber: item.pageNumber },
    tags: ['gold_ocr'],
    review: reviewStamp(notes),
  }))
}

/**
 * PDF page numbers for Tobira 単語表 lists (verified against grouped OCR).
 * TOC print-page ranges drift; do not derive these from start/end alone.
 */
const TOBIRA_VOCAB_PAGES: Record<number, number[]> = {
  1: [28, 29, 33],
  2: [54, 55, 60],
  3: [81, 82, 85],
  4: [103, 104, 107],
  5: [126, 134],
  6: [153, 156, 160],
  7: [177, 184, 187],
  8: [204, 208],
  9: [227, 231],
  10: [249, 253],
  11: [269, 274],
  12: [294, 299, 302],
  13: [315, 319, 323],
  14: [341, 346],
  15: [365, 368, 371, 375],
}

async function resolveTobiraVocabPages(lesson: number): Promise<number[]> {
  const candidates = TOBIRA_VOCAB_PAGES[lesson] ?? []
  const hits: number[] = []
  for (const page of candidates) {
    const data = await readPage('tobira_textbook', page)
    if (!data) continue
    if (!/単語表/.test(data.text)) continue
    const parsed = qualityTobiraVocab(parseTobiraVocabTable(data.text, page))
    if (parsed.length >= 3) hits.push(page)
  }
  return hits
}

async function writeGoldPack(opts: {
  packId: string
  textbookKey: string
  title: string
  levelRange: string
  lessonNumber: number
  lessonTitle: string
  vocabulary: Array<Record<string, unknown>>
  grammar: Array<Record<string, unknown>>
  contentBlocks: Array<Record<string, unknown>>
  exercises: Array<Record<string, unknown>>
  sources: Array<Record<string, unknown>>
  writeCorrections?: boolean
}) {
  await mkdir(reviewedDir, { recursive: true })
  const pack = {
    schemaVersion: 1,
    textbookKey: opts.textbookKey,
    title: opts.title,
    edition: 'learner-gold',
    levelRange: opts.levelRange,
    sources: opts.sources,
    lessons: [
      {
        id: opts.packId,
        unitType: 'lesson',
        lessonNumber: opts.lessonNumber,
        title: opts.lessonTitle,
        level: opts.levelRange,
        modes: ['conversation_grammar'],
        vocabulary: opts.vocabulary,
        grammar: opts.grammar,
        contentBlocks: opts.contentBlocks,
        exercises: opts.exercises,
        qualityTier: 'gold',
      },
    ],
  }
  const outFile = path.join(reviewedDir, `${opts.packId}.json`)
  await writeFile(outFile, `${JSON.stringify(pack, null, 2)}\n`, 'utf8')

  if (opts.writeCorrections) {
    await mkdir(correctionsDir, { recursive: true })
    const corrections = {
      schemaVersion: 1,
      packId: opts.packId,
      basedOnProof: `../out/canonical-proofs/${opts.packId}.json`,
      generatedAt: new Date().toISOString(),
      corrections: [] as Array<Record<string, unknown>>,
      additions: {
        vocabulary: opts.vocabulary,
        grammar: opts.grammar,
        contentBlocks: opts.contentBlocks,
        exercises: opts.exercises,
      },
    }
    await writeFile(
      path.join(correctionsDir, `${opts.packId}.corrections.json`),
      `${JSON.stringify(corrections, null, 2)}\n`,
      'utf8',
    )
  }

  return {
    packId: opts.packId,
    vocabulary: opts.vocabulary.length,
    grammar: opts.grammar.length,
    contentBlocks: opts.contentBlocks.length,
    exercises: opts.exercises.length,
    outFile: path.relative(appRoot, outFile),
  }
}

async function buildTobiraLesson(lesson: number, title: string) {
  const vocabPages = await resolveTobiraVocabPages(lesson)
  const parsed: ParsedVocab[] = []
  for (const page of vocabPages) {
    const data = await readPage('tobira_textbook', page)
    if (!data) continue
    parsed.push(...parseTobiraVocabTable(data.text, page))
  }
  const ocrVocab = qualityTobiraVocab(dedupeVocab(parsed))
  const tags = lessonTagsFor('tobira', lesson)
  const extras = await loadCurriculumExtras(
    'tobira_textbook-comprehensive.json',
    tags,
    lesson,
    'tobira_textbook',
    `tobira_l${lesson}`,
  )

  // Prefer OCR vocab; fall back to thin comprehensive scraps
  const vocabulary =
    ocrVocab.length >= 8
      ? toOcrVocabEntries(
          ocrVocab,
          `tobira_l${lesson}`,
          lesson,
          'tobira_textbook',
          `Tobira OCR 単語表 pages ${vocabPages.join(', ')}`,
        )
      : extras.vocabulary

  if (vocabulary.length < 8 && extras.grammar.length < 3) {
    return {
      packId: `tobira_lesson_${lesson}`,
      skipped: true,
      reason: `thin v${vocabulary.length} g${extras.grammar.length}`,
      vocabPages,
    }
  }

  const sources = await loadSources(['tobira_textbook'])
  const result = await writeGoldPack({
    packId: `tobira_lesson_${lesson}`,
    textbookKey: 'tobira',
    title: 'Tobira: Gateway to Advanced Japanese',
    levelRange: 'B2',
    lessonNumber: lesson,
    lessonTitle: `第${lesson}課 ${title}`,
    vocabulary,
    grammar: extras.grammar,
    contentBlocks: extras.contentBlocks,
    exercises: extras.exercises,
    sources,
    writeCorrections: true,
  })
  return { ...result, vocabPages, skipped: false }
}

async function buildMarugotoLesson(spec: (typeof MARUGOTO_SPECS)[number], lesson: number) {
  const tags = lessonTagsFor(spec.textbookKey, lesson)
  const extras = await loadCurriculumExtras(
    `${spec.sourceId}-comprehensive.json`,
    tags,
    lesson,
    spec.sourceId,
    `${spec.textbookKey}_l${lesson}`,
  )

  if (extras.grammar.length < 3 && extras.vocabulary.length < 8) {
    return {
      packId: `${spec.textbookKey}_lesson_${lesson}`,
      skipped: true,
      reason: `thin v${extras.vocabulary.length} g${extras.grammar.length}`,
    }
  }

  const sources = await loadSources([spec.sourceId])
  const result = await writeGoldPack({
    packId: `${spec.textbookKey}_lesson_${lesson}`,
    textbookKey: spec.textbookKey,
    title: spec.title,
    levelRange: spec.levelRange,
    lessonNumber: lesson,
    lessonTitle: `${spec.title} — Lesson ${lesson}`,
    vocabulary: extras.vocabulary,
    grammar: extras.grammar,
    contentBlocks: extras.contentBlocks,
    exercises: extras.exercises,
    sources,
    writeCorrections: lesson <= 3,
  })
  return { ...result, skipped: false }
}

const results: Record<string, unknown> = {}

for (const cur of TOBIRA_LESSONS) {
  results[`tobira_lesson_${cur.lesson}`] = await buildTobiraLesson(cur.lesson, cur.title)
}

for (const spec of MARUGOTO_SPECS) {
  for (let lesson = 1; lesson <= spec.lessons; lesson += 1) {
    results[`${spec.textbookKey}_lesson_${lesson}`] = await buildMarugotoLesson(spec, lesson)
  }
}

const packResults = Object.entries(results)
const built = packResults.filter(([, r]) => r && typeof r === 'object' && !(r as { skipped?: boolean }).skipped)
const skipped = packResults.filter(([, r]) => r && typeof r === 'object' && (r as { skipped?: boolean }).skipped)

console.log(
  JSON.stringify(
    {
      built: built.length,
      skipped: skipped.length,
      results: Object.fromEntries(packResults),
    },
    null,
    2,
  ),
)
