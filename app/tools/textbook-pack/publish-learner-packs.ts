/**
 * Publish learner-facing lesson packs under data/generated/reviewed/.
 *
 * Tier gold: corrections-backed reviewed packs (Genki I L1, Quartet I L1, …).
 * Tier draft: quality-filtered slices from comprehensive textbook JSON for every
 * other lesson that has usable vocab/grammar — not OCR bulk dumps.
 *
 * Usage (from app/): npx tsx tools/textbook-pack/publish-learner-packs.ts
 */
import { copyFile, mkdir, readFile, writeFile, readdir } from 'node:fs/promises'
import path from 'node:path'

const appRoot = process.cwd()
const reviewedOut = path.join(appRoot, 'tools/textbook-pack/out/reviewed-packs')
const servedDir = path.join(appRoot, 'data/generated/reviewed')
const textbooksDir = path.join(appRoot, 'data/generated/textbooks')
const lessonStructurePath = path.join(appRoot, 'data/generated/lesson-structure.json')
const assetsDir = path.join(appRoot, 'data/generated/assets/textbook')

/** Gold pack file → app lesson id (dual app/source ids for Genki II / Quartet II). */
const GOLD_PACKS: Array<{ packFile: string; lessonId: string; assetCopies?: Array<{ from: string; to: string }> }> = [
  {
    packFile: 'genki_1_lesson_1.json',
    lessonId: 'genki_1_1',
    assetCopies: [{
      from: 'genki_1_lesson_1/assets/workbook_listening_a_picture_choices.png',
      to: 'genki_1_workbook/genki_1_lesson_1/genki_1_workbook_genki_1_lesson_1_workbook_listening_a_picture_choices.png',
    }],
  },
  ...[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => ({
    packFile: `genki_1_lesson_${n}.json`,
    lessonId: `genki_1_${n}`,
  })),
  {
    packFile: 'quartet_1_lesson_1.json',
    lessonId: 'quartet_1_1',
    assetCopies: [{
      from: 'quartet_1_lesson_1/assets/textbook_reading_1_miyazaki_photo.png',
      to: 'quartet_1_textbook/quartet_1_lesson_1/quartet_1_textbook_quartet_1_lesson_1_textbook_reading_1_miyazaki_photo.png',
    }],
  },
  ...[2, 3, 4, 5, 6].map((n) => ({
    packFile: `quartet_1_lesson_${n}.json`,
    lessonId: `quartet_1_${n}`,
  })),
  // Genki II source L13–23 ↔ app genki_2_1–11 and genki_2_13–23
  ...[13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23].flatMap((sourceLesson) => {
    const appIdx = sourceLesson - 12
    return [
      { packFile: `genki_2_lesson_${sourceLesson}.json`, lessonId: `genki_2_${appIdx}` },
      { packFile: `genki_2_lesson_${sourceLesson}.json`, lessonId: `genki_2_${sourceLesson}` },
    ]
  }),
  // Quartet II source L7–12 ↔ app quartet_2_1–6 and quartet_2_7–12
  ...[7, 8, 9, 10, 11, 12].flatMap((sourceLesson) => {
    const appIdx = sourceLesson - 6
    return [
      { packFile: `quartet_2_lesson_${sourceLesson}.json`, lessonId: `quartet_2_${appIdx}` },
      { packFile: `quartet_2_lesson_${sourceLesson}.json`, lessonId: `quartet_2_${sourceLesson}` },
    ]
  }),
]

const TEXTBOOK_FOR_SERIES: Record<string, string> = {
  genki_1: 'genki_1_textbook',
  genki_2: 'genki_2_textbook',
  quartet_1: 'quartet_1_textbook',
  quartet_2: 'quartet_2_textbook',
  marugoto_a1: 'marugoto_a1_textbook',
  marugoto_a2: 'marugoto_a2_textbook',
  marugoto_b1: 'marugoto_b1_textbook',
  tobira_textbook: 'tobira_textbook',
  tobira: 'tobira_textbook',
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

interface PackLesson {
  id?: string
  title?: string
  vocabulary?: Array<Record<string, unknown>>
  grammar?: Array<Record<string, unknown>>
  contentBlocks?: unknown[]
  exercises?: Array<Record<string, unknown>>
}

function hasJapanese(text: string | undefined | null): boolean {
  return /[\u3040-\u30ff\u4e00-\u9fff]/.test(text ?? '')
}

function decentEnglish(text: string | undefined | null): boolean {
  if (!text) return false
  const t = text.trim()
  if (t.length < 2) return false
  if (/^extracted from table$/i.test(t)) return false
  if (/^unknown$/i.test(t)) return false
  // Prefer meanings that include Latin letters (English gloss).
  return /[A-Za-z]/.test(t)
}

function lessonNumberFromId(lessonId: string): number | null {
  const matches = [...lessonId.matchAll(/_(\d+)/g)]
  const last = matches.at(-1)?.[1]
  if (!last) return null
  const n = Number(last)
  return Number.isFinite(n) ? n : null
}

function seriesKeyFromLessonId(lessonId: string): string | null {
  if (lessonId.startsWith('tobira_textbook_')) return 'tobira_textbook'
  if (lessonId.startsWith('tobira_')) return 'tobira'
  const m = lessonId.match(/^(genki_[12]|quartet_[12]|marugoto_a[12]|marugoto_b1)/)
  return m?.[1] ?? null
}

function lessonAliases(lessonId: string): Set<string> {
  const aliases = new Set<string>([lessonId])
  const num = lessonNumberFromId(lessonId)
  if (num != null) aliases.add(String(num))

  if (lessonId.startsWith('genki_2_') && num != null && num <= 11) {
    aliases.add(`genki_2_${num + 12}`)
  }
  if (lessonId.startsWith('genki_2_') && num != null && num >= 13) {
    aliases.add(`genki_2_${num - 12}`)
  }
  if (lessonId.startsWith('quartet_2_') && num != null && num <= 6) {
    aliases.add(`quartet_2_${num + 6}`)
  }
  if (lessonId.startsWith('quartet_2_') && num != null && num >= 7) {
    aliases.add(`quartet_2_${num - 6}`)
  }
  if (lessonId.startsWith('tobira_textbook_') && num != null) {
    aliases.add(`tobira_${num}`)
  }
  if (lessonId.startsWith('tobira_') && !lessonId.startsWith('tobira_textbook_') && num != null) {
    aliases.add(`tobira_textbook_${num}`)
  }
  return aliases
}

function matchesLesson(itemLesson: string, aliases: Set<string>): boolean {
  if (aliases.has(itemLesson)) return true
  // Prefer exact / suffix match with a boundary — never bare includes()
  // (otherwise marugoto_a1_1 matches marugoto_a1_10 / marugoto_a1_11…).
  return [...aliases]
    .filter(a => !/^\d+$/.test(a))
    .some(alias => itemLesson === alias || itemLesson.endsWith(`_${alias}`))
}

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, 'utf8')) as T
}

async function writeJson(filePath: string, data: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
}

async function publishGold(index: IndexEntry[]): Promise<void> {
  for (const gold of GOLD_PACKS) {
    const src = path.join(reviewedOut, gold.packFile)
    let pack: { lessons?: PackLesson[]; title?: string }
    try {
      pack = await readJson(src)
    } catch {
      console.warn(`gold  skip missing pack file ${gold.packFile} (for ${gold.lessonId})`)
      continue
    }
    const lesson = pack.lessons?.[0]
    if (!lesson) {
      console.warn(`gold  skip empty lesson in ${gold.packFile}`)
      continue
    }
    // Skip unpublished OCR drafts that never reached gold enrich (0 vocab).
    if ((lesson.vocabulary?.length ?? 0) < 8 && (lesson.grammar?.length ?? 0) < 3) {
      console.warn(
        `gold  skip thin pack ${gold.packFile} for ${gold.lessonId} (v${lesson.vocabulary?.length ?? 0} g${lesson.grammar?.length ?? 0})`,
      )
      continue
    }

    const destName = `${gold.lessonId}.json`
    const dest = path.join(servedDir, destName)

    // Normalize pack lesson id metadata for the app overlay loader.
    const normalized = {
      ...pack,
      lessons: [{
        ...lesson,
        id: lesson.id ?? gold.packFile.replace(/\.json$/, ''),
        appLessonId: gold.lessonId,
        qualityTier: 'gold',
      }],
    }
    await writeJson(dest, normalized)

    for (const asset of gold.assetCopies ?? []) {
      const from = path.join(reviewedOut, asset.from)
      const to = path.join(assetsDir, asset.to)
      try {
        await mkdir(path.dirname(to), { recursive: true })
        await copyFile(from, to)
      } catch {
        console.warn(`  skip asset ${asset.from}`)
      }
    }

    index.push({
      lessonId: gold.lessonId,
      packId: String(lesson.id ?? gold.packFile),
      tier: 'gold',
      url: `/data/generated/reviewed/${destName}`,
      vocabulary: lesson.vocabulary?.length ?? 0,
      grammar: lesson.grammar?.length ?? 0,
      contentBlocks: lesson.contentBlocks?.length ?? 0,
      exercises: lesson.exercises?.length ?? 0,
      title: lesson.title,
    })
    console.log(`gold  ${gold.lessonId} ← ${gold.packFile} (v${lesson.vocabulary?.length ?? 0} g${lesson.grammar?.length ?? 0})`)
  }
}

async function loadCurriculum(textbookKey: string): Promise<{
  vocabulary: Array<Record<string, unknown>>
  grammar: Array<Record<string, unknown>>
  exercises: Array<Record<string, unknown>>
  dialogues: Array<Record<string, unknown>>
} | null> {
  const file = path.join(textbooksDir, `${textbookKey}-comprehensive.json`)
  try {
    const data = await readJson<{
      vocabulary?: Array<Record<string, unknown>>
      vocab?: Array<Record<string, unknown>>
      grammar?: Array<Record<string, unknown>>
      exercises?: Array<Record<string, unknown>>
      dialogues?: Array<Record<string, unknown>>
    }>(file)
    return {
      vocabulary: data.vocabulary ?? data.vocab ?? [],
      grammar: data.grammar ?? [],
      exercises: data.exercises ?? [],
      dialogues: data.dialogues ?? [],
    }
  } catch {
    return null
  }
}

function filterVocab(items: Array<Record<string, unknown>>, aliases: Set<string>, lessonId: string) {
  return items
    .filter(v => matchesLesson(String(v.lesson ?? ''), aliases))
    .map((v, i) => {
      const surface = String(v.surface ?? v.japanese ?? '')
      const meaning = String(v.english ?? v.meaning ?? '')
      return {
        id: String(v.id ?? `${lessonId}_vocab_${i}`),
        surface,
        reading: v.reading ?? null,
        meaning,
        sourceRef: {
          sourceId: String(v.source ?? 'comprehensive'),
          pageNumber: Number(v.page ?? 0) || 0,
        },
      }
    })
    .filter(v => hasJapanese(v.surface) && decentEnglish(v.meaning))
}

function filterGrammar(items: Array<Record<string, unknown>>, aliases: Set<string>, lessonId: string) {
  return items
    .filter(g => matchesLesson(String(g.lesson ?? ''), aliases))
    .map((g, i) => {
      const pattern = String(g.pattern ?? g.title ?? '')
      const meaning = String(g.meaning ?? '')
      return {
        id: String(g.id ?? `${lessonId}_grammar_${i}`),
        pattern,
        meaning,
        explanation: g.explanation ?? undefined,
        examples: Array.isArray(g.examples) ? g.examples : undefined,
        maynardRef: g.maynardRef,
        sourceRef: {
          sourceId: String(g.source ?? 'comprehensive'),
          pageNumber: Number(g.page ?? 0) || 0,
        },
      }
    })
    .filter(g => g.pattern.trim().length >= 1 && (decentEnglish(g.meaning) || String(g.explanation ?? '').length > 8))
}

async function publishDrafts(index: IndexEntry[]): Promise<void> {
  const goldIds = new Set(index.map(e => e.lessonId))
  const structure = await readJson<{ lessons?: Array<{ normalized_id?: string; id?: string; title?: string }> }>(
    lessonStructurePath,
  )
  const lessonIds = (structure.lessons ?? [])
    .map(l => l.normalized_id ?? l.id)
    .filter((id): id is string => Boolean(id) && !id.startsWith('unknown'))

  const curriculumCache = new Map<string, Awaited<ReturnType<typeof loadCurriculum>>>()

  for (const lessonId of lessonIds) {
    if (goldIds.has(lessonId)) continue
    const series = seriesKeyFromLessonId(lessonId)
    if (!series) continue
    const textbookKey = TEXTBOOK_FOR_SERIES[series]
    if (!textbookKey) continue

    if (!curriculumCache.has(textbookKey)) {
      curriculumCache.set(textbookKey, await loadCurriculum(textbookKey))
    }
    const curriculum = curriculumCache.get(textbookKey)
    if (!curriculum) continue

    const aliases = lessonAliases(lessonId)
    const vocabulary = filterVocab(curriculum.vocabulary, aliases, lessonId)
    const grammar = filterGrammar(curriculum.grammar, aliases, lessonId)
    if (vocabulary.length === 0 && grammar.length === 0) continue

    const exercises = curriculum.exercises
      .filter(e => matchesLesson(String(e.lesson ?? ''), aliases))
      .slice(0, 40)
      .map((e, i) => ({
        id: String(e.id ?? `${lessonId}_ex_${i}`),
        label: String(e.type ?? 'exercise'),
        prompt: String(e.question ?? ''),
        sourceRef: {
          sourceId: String(e.source ?? textbookKey),
          pageNumber: Number(e.page ?? 0) || 0,
        },
      }))

    // Genki II / Quartet II drafts get dialogue blocks so they match book-1 richness.
    const contentBlocks = (curriculum.dialogues ?? [])
      .filter(d => matchesLesson(String(d.lesson ?? ''), aliases))
      .slice(0, 8)
      .map((d, i) => {
        const lines = Array.isArray(d.lines) ? d.lines as Array<{ speaker?: string; japanese?: string }> : []
        const text = lines
          .map(line => `${line.speaker ? `${line.speaker}: ` : ''}${line.japanese ?? ''}`.trim())
          .filter(Boolean)
          .join('\n')
        return {
          id: `${lessonId}_dialogue_${i}`,
          type: 'dialogue',
          title: String(d.title ?? `Dialogue ${i + 1}`),
          text,
          sourceRef: {
            sourceId: String(d.source ?? textbookKey),
            pageNumber: Number(d.page ?? 0) || 0,
          },
        }
      })
      .filter(b => /[\u3040-\u30ff\u4e00-\u9fff]/.test(b.text))

    const pack = {
      schemaVersion: 'learner-draft-1',
      textbookKey,
      title: `${textbookKey} / ${lessonId}`,
      qualityTier: 'draft',
      lessons: [{
        id: `${lessonId}_draft`,
        appLessonId: lessonId,
        title: lessonId.replace(/_/g, ' '),
        qualityTier: 'draft',
        vocabulary,
        grammar,
        contentBlocks,
        exercises,
      }],
    }

    const destName = `${lessonId}.json`
    await writeJson(path.join(servedDir, destName), pack)
    index.push({
      lessonId,
      packId: `${lessonId}_draft`,
      tier: 'draft',
      url: `/data/generated/reviewed/${destName}`,
      vocabulary: vocabulary.length,
      grammar: grammar.length,
      contentBlocks: contentBlocks.length,
      exercises: exercises.length,
      title: lessonId,
    })
    console.log(`draft ${lessonId} (v${vocabulary.length} g${grammar.length} b${contentBlocks.length} e${exercises.length})`)
  }
}

async function main() {
  await mkdir(servedDir, { recursive: true })

  // Remove previous draft packs but keep directory
  for (const name of await readdir(servedDir)) {
    if (name.endsWith('.json')) {
      // rewritten below
    }
  }

  const index: IndexEntry[] = []
  await publishGold(index)
  await publishDrafts(index)

  index.sort((a, b) => a.lessonId.localeCompare(b.lessonId))
  await writeJson(path.join(servedDir, 'index.json'), {
    generatedAt: new Date().toISOString(),
    packs: index,
    summary: {
      total: index.length,
      gold: index.filter(e => e.tier === 'gold').length,
      draft: index.filter(e => e.tier === 'draft').length,
    },
  })

  console.log(JSON.stringify({
    published: index.length,
    gold: index.filter(e => e.tier === 'gold').length,
    draft: index.filter(e => e.tier === 'draft').length,
    index: 'data/generated/reviewed/index.json',
  }, null, 2))
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
