/**
 * Quartet gold enrich from Bessatsu proof vocab + comprehensive grammar/dialogues.
 *
 * Builds Quartet I lessons 2–6 and Quartet II lessons 7–12 when proofs exist.
 *
 * Prerequisites (from app/):
 *   npm run textbook:proof:quartet -- --textbook-key quartet_1 --lesson N
 *   npm run textbook:proof:quartet -- --textbook-key quartet_2 --lesson N
 *
 * Usage:
 *   npx tsx tools/textbook-pack/build-quartet-l2-and-enrich-l7.ts
 */
import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const appRoot = process.cwd()
const proofsDir = path.join(appRoot, 'tools/textbook-pack/out/canonical-proofs')
const reviewedDir = path.join(appRoot, 'tools/textbook-pack/out/reviewed-packs')
const correctionsDir = path.join(appRoot, 'tools/textbook-pack/corrections')
const textbooksDir = path.join(appRoot, 'data/generated/textbooks')

interface VocabEntry {
  id: string
  surface: string
  reading?: string | null
  meaning: string
  lessonNumber: number
  sourceRef: { sourceId: string; pageNumber: number; coordinates?: number[] }
  tags?: string[]
  review?: Record<string, unknown>
}

interface ProofPack {
  schemaVersion: number
  textbookKey: string
  title: string
  levelRange?: string
  sources: Array<{ sourceId: string; role: string; fingerprint?: { sha256: string; bytes: number } }>
  lessons: Array<{
    id: string
    title?: string
    lessonNumber: number
    vocabulary?: VocabEntry[]
    grammar?: Array<Record<string, unknown>>
    contentBlocks?: Array<Record<string, unknown>>
    exercises?: Array<Record<string, unknown>>
  }>
}

function reviewStamp(notes: string) {
  return {
    action: 'approved' as const,
    reviewedAt: new Date().toISOString(),
    reviewer: 'quartet_bessatsu_enrich',
    notes,
  }
}

function hasJapanese(text: string): boolean {
  return /[\u3040-\u30ff\u4e00-\u9fff]/.test(text)
}

function decentMeaning(text: string): boolean {
  const t = text.trim()
  if (t.length < 2) return false
  if (/extracted from table|^unknown$/i.test(t)) return false
  if (t.length > 180) return false
  return /[A-Za-z]/.test(t)
}

function cleanReading(reading: string | null | undefined): string | null {
  if (!reading) return null
  return reading
    .replace(/じよう/g, 'じょう')
    .replace(/しや/g, 'しゃ')
    .replace(/ちよ/g, 'ちょ')
    .replace(/しゆ/g, 'シュ')
    .trim()
}

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, 'utf8')) as T
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}

function qualityVocab(items: VocabEntry[], lessonNumber: number): VocabEntry[] {
  const seen = new Set<string>()
  const out: VocabEntry[] = []
  for (const item of items) {
    const surface = item.surface?.trim()
    const meaning = item.meaning?.trim()
    if (!surface || !hasJapanese(surface) || surface.length > 28) continue
    if (!decentMeaning(meaning)) continue
    if (/^(単語|読み|意味|漢行|新出)$/.test(surface)) continue
    if (seen.has(surface)) continue
    seen.add(surface)
    out.push({
      ...item,
      surface,
      reading: cleanReading(item.reading),
      meaning,
      lessonNumber,
      tags: ['gold_bessatsu'],
      review: reviewStamp('Bessatsu vocab list OCR'),
    })
  }
  return out
}

async function loadCurriculumGrammar(
  textbookKey: string,
  lessonTags: string[],
  lessonNumber: number,
  sourceId: string,
) {
  const curriculum = await readJson<{
    grammar?: Array<Record<string, unknown>>
    dialogues?: Array<Record<string, unknown>>
    exercises?: Array<Record<string, unknown>>
  }>(path.join(textbooksDir, `${textbookKey}_textbook-comprehensive.json`))

  const match = (lesson: string) =>
    lessonTags.includes(lesson) || lessonTags.some((t) => lesson === t || lesson.endsWith(`_${t}`))

  const grammar = (curriculum.grammar ?? [])
    .filter((g) => match(String(g.lesson ?? '')))
    .map((g, i) => ({
      id: `${textbookKey}_l${lessonNumber}_grammar_${i + 1}`,
      pattern: String(g.pattern ?? g.title ?? ''),
      meaning: String(g.meaning ?? ''),
      explanation: g.explanation,
      examples: Array.isArray(g.examples) ? g.examples : [],
      lessonNumber,
      sourceRef: {
        sourceId,
        pageNumber: Math.max(1, Number(g.page ?? 0) || 1),
      },
      review: reviewStamp('comprehensive grammar; source remapped'),
    }))
    .filter((g) => g.pattern.trim().length >= 1 && (decentMeaning(g.meaning) || String(g.explanation ?? '').length > 8))
    .slice(0, 24)

  const contentBlocks = (curriculum.dialogues ?? [])
    .filter((d) => match(String(d.lesson ?? '')))
    .slice(0, 12)
    .map((d, i) => {
      const lines = Array.isArray(d.lines) ? (d.lines as Array<{ speaker?: string; japanese?: string }>) : []
      const text = lines
        .map((line) => `${line.speaker ? `${line.speaker}: ` : ''}${line.japanese ?? ''}`.trim())
        .filter(Boolean)
        .join('\n')
      return {
        id: `${textbookKey}_l${lessonNumber}_dialogue_${i + 1}`,
        type: 'dialogue' as const,
        title: String(d.title ?? `Dialogue ${i + 1}`),
        text,
        sourceRef: {
          sourceId,
          pageNumber: Math.max(1, Number(d.page ?? 0) || 1),
        },
        review: reviewStamp('dialogue from comprehensive'),
      }
    })
    .filter((b) => hasJapanese(b.text))

  const exercises = (curriculum.exercises ?? [])
    .filter((e) => match(String(e.lesson ?? '')))
    .slice(0, 20)
    .map((e, i) => ({
      id: `${textbookKey}_l${lessonNumber}_ex_${i + 1}`,
      label: String(e.type ?? 'exercise'),
      prompt: String(e.question ?? ''),
      sourceRef: {
        sourceId: String(e.source ?? '').includes('workbook') ? `${textbookKey}_workbook` : sourceId,
        pageNumber: Math.max(1, Number(e.page ?? 0) || 1),
      },
      review: reviewStamp('exercise from comprehensive'),
    }))
    .filter((e) => e.prompt.trim().length >= 2)

  return { grammar, contentBlocks, exercises }
}

async function buildFromProof(opts: {
  proofFile: string
  packId: string
  appLessonTags: string[]
  textbookKey: string
  lessonNumber: number
  title: string
  levelRange: string
}) {
  const proofPath = path.join(proofsDir, opts.proofFile)
  if (!(await exists(proofPath))) {
    return { packId: opts.packId, skipped: true, reason: `missing proof ${opts.proofFile}` }
  }

  const proof = await readJson<ProofPack>(proofPath)
  const lesson = proof.lessons[0]
  if (!lesson) throw new Error(`No lesson in ${opts.proofFile}`)

  const vocabulary = qualityVocab(lesson.vocabulary ?? [], opts.lessonNumber)
  if (vocabulary.length < 20) {
    return {
      packId: opts.packId,
      skipped: true,
      reason: `only ${vocabulary.length} quality vocab — regenerate Bessatsu proof`,
    }
  }

  const { grammar, contentBlocks, exercises } = await loadCurriculumGrammar(
    opts.textbookKey,
    opts.appLessonTags,
    opts.lessonNumber,
    `${opts.textbookKey}_textbook`,
  )

  const proofGrammar = (lesson.grammar ?? [])
    .filter((g) => String(g.pattern ?? '').trim().length >= 1)
    .map((g, i) => ({
      id: String(g.id ?? `${opts.packId}_grammar_${i + 1}`),
      pattern: String(g.pattern ?? ''),
      meaning: String(g.meaning ?? ''),
      explanation: g.explanation,
      examples: Array.isArray(g.examples) ? g.examples : [],
      lessonNumber: opts.lessonNumber,
      sourceRef: {
        sourceId: String((g.sourceRef as { sourceId?: string } | undefined)?.sourceId ?? `${opts.textbookKey}_textbook`),
        pageNumber: Math.max(1, Number((g.sourceRef as { pageNumber?: number } | undefined)?.pageNumber ?? 1)),
      },
      review: reviewStamp('from proof pattern match'),
    }))

  const pack = {
    schemaVersion: 1,
    textbookKey: opts.textbookKey,
    title: opts.title,
    edition: 'learner-gold',
    levelRange: opts.levelRange,
    sources: proof.sources,
    lessons: [
      {
        id: opts.packId,
        unitType: 'lesson',
        lessonNumber: opts.lessonNumber,
        title: lesson.title ?? opts.title,
        level: opts.levelRange,
        modes: ['reading', 'conversation_grammar', 'workbook'],
        vocabulary,
        grammar: proofGrammar.length >= 3 ? proofGrammar : grammar,
        contentBlocks,
        exercises,
        qualityTier: 'gold',
      },
    ],
  }

  await mkdir(reviewedDir, { recursive: true })
  await mkdir(correctionsDir, { recursive: true })
  const outFile = path.join(reviewedDir, `${opts.packId}.json`)
  await writeFile(outFile, `${JSON.stringify(pack, null, 2)}\n`, 'utf8')

  const corrections = {
    schemaVersion: 1,
    packId: opts.packId,
    basedOnProof: `../out/canonical-proofs/${opts.proofFile}`,
    generatedAt: new Date().toISOString(),
    corrections: [
      ...(lesson.vocabulary ?? []).map((item) => ({
        id: item.id,
        kind: 'vocabulary',
        action: vocabulary.some((v) => v.id === item.id) ? 'approved' : 'ignored',
        current: { surface: item.surface, reading: item.reading, meaning: item.meaning },
        replacement: {},
        notes: 'Bessatsu quality gate',
      })),
      ...(lesson.grammar ?? []).map((item) => ({
        id: String(item.id),
        kind: 'grammar',
        action: 'ignored',
        current: {},
        replacement: {},
        notes: 'Replaced by curated/comprehensive grammar in gold pack',
      })),
      ...(lesson.contentBlocks ?? []).map((item) => ({
        id: String(item.id),
        kind: 'contentBlocks',
        action: 'ignored',
        current: {},
        replacement: {},
        notes: 'Bulk OCR ignored',
      })),
      ...(lesson.exercises ?? []).map((item) => ({
        id: String(item.id),
        kind: 'exercises',
        action: 'ignored',
        current: {},
        replacement: {},
        notes: 'Bulk OCR ignored',
      })),
    ],
    additions: {
      vocabulary: vocabulary.filter((v) => !(lesson.vocabulary ?? []).some((p) => p.id === v.id)),
      grammar: pack.lessons[0].grammar,
      contentBlocks,
      exercises,
    },
  }
  const corrFile = path.join(correctionsDir, `${opts.packId}.corrections.json`)
  await writeFile(corrFile, `${JSON.stringify(corrections, null, 2)}\n`, 'utf8')

  return {
    packId: opts.packId,
    vocabulary: vocabulary.length,
    grammar: pack.lessons[0].grammar.length,
    contentBlocks: contentBlocks.length,
    exercises: exercises.length,
    outFile: path.relative(appRoot, outFile),
    corrections: path.relative(appRoot, corrFile),
    skipped: false,
  }
}

function appTagsForQuartet2(sourceLesson: number): string[] {
  const appIdx = sourceLesson - 6
  return [`quartet_2_${appIdx}`, `quartet_2_${sourceLesson}`]
}

const SPECS: Array<{
  proofFile: string
  packId: string
  appLessonTags: string[]
  textbookKey: string
  lessonNumber: number
  title: string
  levelRange: string
}> = [
  ...[2, 3, 4, 5, 6].map((n) => ({
    proofFile: `quartet_1_lesson_${n}.json`,
    packId: `quartet_1_lesson_${n}`,
    appLessonTags: [`quartet_1_${n}`],
    textbookKey: 'quartet_1',
    lessonNumber: n,
    title: `Quartet I Lesson ${n}`,
    levelRange: 'N3',
  })),
  ...[7, 8, 9, 10, 11, 12].map((n) => ({
    proofFile: `quartet_2_lesson_${n}.json`,
    packId: `quartet_2_lesson_${n}`,
    appLessonTags: appTagsForQuartet2(n),
    textbookKey: 'quartet_2',
    lessonNumber: n,
    title: `Quartet II Lesson ${n}`,
    levelRange: 'N2',
  })),
]

const results: Record<string, unknown> = {}
for (const spec of SPECS) {
  results[spec.packId] = await buildFromProof(spec)
}
console.log(JSON.stringify(results, null, 2))
