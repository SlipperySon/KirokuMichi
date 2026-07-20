/**
 * Build Genki II / Quartet II opener gold packs (same learner shape as Genki I / Quartet I L1).
 *
 * OCR proofs for these lessons are weak; we synthesize from quality-filtered
 * comprehensive curriculum + dialogues, then publish via textbook:learner:publish.
 *
 * Usage (from app/): npx tsx tools/textbook-pack/build-book2-gold-packs.ts
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const appRoot = process.cwd()
const textbooksDir = path.join(appRoot, 'data/generated/textbooks')
const outDir = path.join(appRoot, 'tools/textbook-pack/out/reviewed-packs')

interface Spec {
  textbookKey: string
  packId: string
  title: string
  levelRange: string
  /** Curriculum lesson tags that belong to this opener */
  lessonTags: string[]
  textbookSourceId: string
  workbookSourceId?: string
}

const SPECS: Spec[] = [
  {
    textbookKey: 'genki_2',
    packId: 'genki_2_lesson_13',
    title: 'Genki II Lesson 13',
    levelRange: 'N4',
    lessonTags: ['genki_2_1', 'genki_2_13'],
    textbookSourceId: 'genki_2_textbook',
    workbookSourceId: 'genki_2_workbook',
  },
  {
    textbookKey: 'quartet_2',
    packId: 'quartet_2_lesson_7',
    title: 'Quartet II Lesson 7',
    levelRange: 'B2',
    lessonTags: ['quartet_2_1', 'quartet_2_7'],
    textbookSourceId: 'quartet_2_textbook',
    workbookSourceId: 'quartet_2_workbook',
  },
]

function hasJapanese(text: string | undefined | null): boolean {
  return /[\u3040-\u30ff\u4e00-\u9fff]/.test(text ?? '')
}

function decentEnglish(text: string | undefined | null): boolean {
  if (!text) return false
  const t = text.trim()
  if (t.length < 2) return false
  if (/extracted from table/i.test(t)) return false
  if (/^unknown$/i.test(t)) return false
  // Drop obvious OCR-mangled surfaces masquerading as glosses that are too long/noisy
  if (t.length > 180) return false
  return /[A-Za-z]/.test(t)
}

function matchLesson(itemLesson: string, tags: string[]): boolean {
  if (tags.includes(itemLesson)) return true
  return tags.some(tag => itemLesson === tag || itemLesson.endsWith(`_${tag}`))
}

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, 'utf8')) as T
}

async function buildPack(spec: Spec) {
  const curriculum = await readJson<{
    vocabulary?: Array<Record<string, unknown>>
    grammar?: Array<Record<string, unknown>>
    exercises?: Array<Record<string, unknown>>
    dialogues?: Array<Record<string, unknown>>
  }>(path.join(textbooksDir, `${spec.textbookSourceId}-comprehensive.json`))

  const now = new Date().toISOString()
  const review = {
    action: 'approved' as const,
    reviewedAt: now,
    reviewer: 'book2_gold_synth',
    notes: 'Synthesized gold opener from comprehensive + dialogues (OCR proof too weak).',
  }

  const vocabulary = (curriculum.vocabulary ?? [])
    .filter(v => matchLesson(String(v.lesson ?? ''), spec.lessonTags))
    .map((v, i) => {
      const surface = String(v.surface ?? v.japanese ?? '')
      const meaning = String(v.english ?? v.meaning ?? '')
      return {
        id: String(v.id ?? `${spec.packId}_vocab_${i + 1}`),
        surface,
        reading: v.reading ?? null,
        meaning,
        lessonNumber: Number(String(spec.packId).match(/(\d+)$/)?.[1] ?? 0),
        sourceRef: {
          sourceId: String(v.source ?? spec.textbookSourceId),
          pageNumber: Number(v.page ?? 0) || 0,
        },
        tags: ['gold_opener'],
        review,
      }
    })
    .filter(v => hasJapanese(v.surface) && decentEnglish(v.meaning))
    // Prefer shorter textbook-like surfaces (drop long prose OCR scars)
    .filter(v => v.surface.length <= 24)

  const grammar = (curriculum.grammar ?? [])
    .filter(g => matchLesson(String(g.lesson ?? ''), spec.lessonTags))
    .map((g, i) => ({
      id: String(g.id ?? `${spec.packId}_grammar_${i + 1}`),
      pattern: String(g.pattern ?? g.title ?? ''),
      meaning: String(g.meaning ?? ''),
      explanation: g.explanation ?? undefined,
      examples: Array.isArray(g.examples) ? g.examples : undefined,
      maynardRef: g.maynardRef,
      lessonNumber: Number(String(spec.packId).match(/(\d+)$/)?.[1] ?? 0),
      sourceRef: {
        sourceId: String(g.source ?? spec.textbookSourceId),
        pageNumber: Number(g.page ?? 0) || 0,
      },
      review,
    }))
    .filter(g => g.pattern.trim().length >= 1 && (decentEnglish(g.meaning) || String(g.explanation ?? '').length > 8))

  const dialogues = (curriculum.dialogues ?? []).filter(d =>
    matchLesson(String(d.lesson ?? ''), spec.lessonTags),
  )

  const contentBlocks = dialogues.slice(0, 12).map((d, i) => {
    const lines = Array.isArray(d.lines) ? d.lines as Array<{ speaker?: string; japanese?: string }> : []
    const text = lines
      .map(line => `${line.speaker ? `${line.speaker}: ` : ''}${line.japanese ?? ''}`.trim())
      .filter(Boolean)
      .join('\n')
    return {
      id: `${spec.packId}_dialogue_${i + 1}`,
      type: 'dialogue',
      title: String(d.title ?? `Dialogue ${i + 1}`),
      text,
      sourceRef: {
        sourceId: String(d.source ?? spec.textbookSourceId),
        pageNumber: Number(d.page ?? 0) || 0,
      },
      review,
    }
  }).filter(b => hasJapanese(b.text))

  const exercises = (curriculum.exercises ?? [])
    .filter(e => matchLesson(String(e.lesson ?? ''), spec.lessonTags))
    .slice(0, 20)
    .map((e, i) => ({
      id: String(e.id ?? `${spec.packId}_ex_${i + 1}`),
      label: String(e.type ?? 'exercise'),
      prompt: String(e.question ?? ''),
      sourceRef: {
        sourceId: String(e.source ?? spec.workbookSourceId ?? spec.textbookSourceId),
        pageNumber: Number(e.page ?? 0) || 0,
      },
      review,
    }))
    .filter(e => e.prompt.trim().length >= 2)

  if (vocabulary.length < 3 && grammar.length < 3) {
    throw new Error(`${spec.packId}: insufficient gold content (v${vocabulary.length} g${grammar.length})`)
  }

  const pack = {
    schemaVersion: 1,
    textbookKey: spec.textbookKey,
    title: spec.title,
    edition: 'learner-gold',
    levelRange: spec.levelRange,
    sources: [
      { sourceId: spec.textbookSourceId, role: 'textbook' },
      ...(spec.workbookSourceId ? [{ sourceId: spec.workbookSourceId, role: 'workbook' }] : []),
    ],
    lessons: [{
      id: spec.packId,
      unitType: 'lesson',
      lessonNumber: Number(String(spec.packId).match(/(\d+)$/)?.[1] ?? 0),
      title: spec.title,
      level: spec.levelRange,
      modes: ['conversation_grammar'],
      vocabulary,
      grammar,
      contentBlocks,
      exercises,
      qualityTier: 'gold',
    }],
  }

  const outFile = path.join(outDir, `${spec.packId}.json`)
  await mkdir(outDir, { recursive: true })
  await writeFile(outFile, `${JSON.stringify(pack, null, 2)}\n`, 'utf8')
  return {
    packId: spec.packId,
    outFile: path.relative(appRoot, outFile),
    vocabulary: vocabulary.length,
    grammar: grammar.length,
    contentBlocks: contentBlocks.length,
    exercises: exercises.length,
  }
}

const results = []
for (const spec of SPECS) {
  results.push(await buildPack(spec))
}
console.log(JSON.stringify({ built: results }, null, 2))
