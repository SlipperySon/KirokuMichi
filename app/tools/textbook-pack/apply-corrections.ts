import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type {
  CanonicalLesson,
  CanonicalTextbookPack,
  ContentBlock,
  CorrectableItemKind,
  ExerciseEntry,
  GrammarEntry,
  ReviewAction,
  TextbookPackCorrection,
  TextbookPackCorrections,
  VocabEntry,
} from './schema.ts'

interface CliOptions {
  proofPath: string
  correctionsPath: string
  outFile: string | null
  reviewer: string
}

type CorrectableItem = VocabEntry | GrammarEntry | ContentBlock | ExerciseEntry

const options = parseArgs(process.argv.slice(2))
const proof = await readJson<CanonicalTextbookPack>(resolveAppPath(options.proofPath))
const corrections = await readJson<TextbookPackCorrections>(resolveAppPath(options.correctionsPath))
const reviewedAt = new Date().toISOString()
const reviewed = applyCorrections(proof, corrections, reviewedAt)
const lesson = reviewed.lessons[0]
if (!lesson) throw new Error('Proof pack does not contain a lesson')

const outFile = resolveAppPath(options.outFile ?? path.join('app/tools/textbook-pack/out/reviewed-packs', `${lesson.id}.json`))
await writeJson(outFile, reviewed)

const summary = summarize(lesson, corrections)
console.log(`wrote ${path.relative(process.cwd(), outFile)}`)
console.log(JSON.stringify(summary, null, 2))

function applyCorrections(pack: CanonicalTextbookPack, corrections: TextbookPackCorrections, reviewedAt: string): CanonicalTextbookPack {
  const next: CanonicalTextbookPack = structuredClone(pack)
  const lesson = next.lessons[0]
  if (!lesson) throw new Error('Proof pack does not contain a lesson')
  if (corrections.packId !== lesson.id) throw new Error(`Correction packId ${corrections.packId} does not match proof lesson ${lesson.id}`)

  const correctionMap = new Map<string, TextbookPackCorrection>()
  for (const correction of corrections.corrections) {
    const key = correctionKey(correction.kind, correction.id)
    if (correctionMap.has(key)) throw new Error(`Duplicate correction for ${key}`)
    correctionMap.set(key, correction)
  }

  lesson.vocabulary = applyList('vocabulary', lesson.vocabulary, correctionMap, reviewedAt)
  lesson.grammar = applyList('grammar', lesson.grammar, correctionMap, reviewedAt)
  lesson.contentBlocks = applyList('contentBlocks', lesson.contentBlocks, correctionMap, reviewedAt)
  lesson.exercises = applyList('exercises', lesson.exercises, correctionMap, reviewedAt)

  if (corrections.additions?.vocabulary?.length) lesson.vocabulary.push(...markAdditions(corrections.additions.vocabulary, 'fixed', reviewedAt))
  if (corrections.additions?.grammar?.length) lesson.grammar.push(...markAdditions(corrections.additions.grammar, 'fixed', reviewedAt))
  if (corrections.additions?.contentBlocks?.length) lesson.contentBlocks.push(...markAdditions(corrections.additions.contentBlocks, 'fixed', reviewedAt))
  if (corrections.additions?.exercises?.length) lesson.exercises.push(...markAdditions(corrections.additions.exercises, 'fixed', reviewedAt))

  return next
}

function applyList<T extends CorrectableItem>(
  kind: CorrectableItemKind,
  items: T[],
  correctionMap: Map<string, TextbookPackCorrection>,
  reviewedAt: string,
): T[] {
  const output: T[] = []
  for (const item of items) {
    const correction = correctionMap.get(correctionKey(kind, item.id))
    if (!correction) {
      output.push(withReview(item, 'pending', reviewedAt))
      continue
    }
    if (correction.action === 'ignored') continue
    const replacement = sanitizeReplacement(correction.replacement ?? {})
    output.push(
      withReview(
        {
          ...item,
          ...replacement,
          id: item.id,
        } as T,
        correction.action,
        reviewedAt,
        correction.notes,
      ),
    )
  }
  return output
}

function markAdditions<T extends CorrectableItem>(items: T[], action: ReviewAction, reviewedAt: string): T[] {
  return items.map((item) => withReview(item, action, reviewedAt, 'manual_addition'))
}

function withReview<T extends CorrectableItem>(item: T, action: ReviewAction, reviewedAt: string, notes?: string): T {
  if (action === 'pending') {
    return {
      ...item,
      review: {
        action,
        notes: notes || undefined,
      },
    }
  }
  return {
    ...item,
    review: {
      action,
      reviewedAt,
      reviewer: options.reviewer,
      notes: notes || undefined,
    },
  }
}

function sanitizeReplacement(replacement: Partial<CorrectableItem>): Partial<CorrectableItem> {
  const { id: _id, review: _review, ...safeReplacement } = replacement
  return safeReplacement
}

function correctionKey(kind: CorrectableItemKind, id: string): string {
  return `${kind}:${id}`
}

function summarize(lesson: CanonicalLesson, corrections: TextbookPackCorrections): Record<string, unknown> {
  const allItems: CorrectableItem[] = [
    ...lesson.vocabulary,
    ...lesson.grammar,
    ...lesson.contentBlocks,
    ...lesson.exercises,
  ]
  const counts = new Map<ReviewAction, number>([
    ['pending', 0],
    ['approved', 0],
    ['fixed', 0],
    ['ignored', 0],
  ])
  for (const item of allItems) {
    const action = item.review?.action ?? 'pending'
    counts.set(action, (counts.get(action) ?? 0) + 1)
  }
  counts.set('ignored', corrections.corrections.filter((correction) => correction.action === 'ignored').length)

  return {
    unit: lesson.id,
    vocabulary: lesson.vocabulary.length,
    grammar: lesson.grammar.length,
    contentBlocks: lesson.contentBlocks.length,
    exercises: lesson.exercises.length,
    review: Object.fromEntries(counts),
  }
}

function parseArgs(rawArgs: string[]): CliOptions {
  const options: CliOptions = {
    proofPath: 'app/tools/textbook-pack/out/canonical-proofs/genki_1_lesson_1.json',
    correctionsPath: 'tools/textbook-pack/corrections/genki_1_lesson_1.corrections.json',
    outFile: null,
    reviewer: 'manual_review',
  }

  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index]
    if (arg === '--proof') options.proofPath = rawArgs[++index] ?? options.proofPath
    if (arg === '--corrections') options.correctionsPath = rawArgs[++index] ?? options.correctionsPath
    if (arg === '--out') options.outFile = rawArgs[++index] ?? options.outFile
    if (arg === '--reviewer') options.reviewer = rawArgs[++index] ?? options.reviewer
  }

  return options
}

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, 'utf8')) as T
}

async function writeJson(filePath: string, payload: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
}

function resolveAppPath(filePath: string): string {
  if (path.isAbsolute(filePath)) return filePath
  return path.resolve(process.cwd(), filePath)
}
