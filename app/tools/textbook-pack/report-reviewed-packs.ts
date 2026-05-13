import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import type { CanonicalTextbookPack, ExerciseEntry } from './schema.ts'

interface CliOptions {
  packsRoot: string
}

const options = parseArgs(process.argv.slice(2))
const packs = await readPacks()

const report = packs.map(({ file, pack }) => {
  const lesson = pack.lessons[0]
  const exercises = lesson?.exercises ?? []
  const imageItems = lesson ? [...lesson.contentBlocks, ...lesson.exercises].filter((item) => 'imageFile' in item && item.imageFile) : []
  const answerMapped = exercises.filter((exercise) => exercise.answerKeyRef || exercise.answerKeyRefs?.length)
  const answerPayloads = exercises.filter((exercise) => exercise.answerKey)
  const listeningMapped = exercises.filter((exercise) => exercise.listeningScriptRef)
  return {
    file: path.relative(process.cwd(), file),
    textbookKey: pack.textbookKey,
    lessonId: lesson?.id ?? null,
    counts: {
      vocabulary: lesson?.vocabulary.length ?? 0,
      grammar: lesson?.grammar.length ?? 0,
      contentBlocks: lesson?.contentBlocks.length ?? 0,
      exercises: exercises.length,
    },
    review: lesson ? summarizeReview(lesson) : {},
    assets: imageItems.length,
    answerMapped: answerMapped.length,
    answerPayloads: answerPayloads.length,
    listeningMapped: listeningMapped.length,
    gradingModes: summarizeGradingModes(answerPayloads),
    ready: isReady(lesson),
  }
})

console.log(JSON.stringify({ packs: report.length, report }, null, 2))

async function readPacks(): Promise<Array<{ file: string; pack: CanonicalTextbookPack }>> {
  const root = resolveAppPath(options.packsRoot)
  const entries = await readdir(root, { withFileTypes: true })
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json') && entry.name !== 'fingerprints.json')
    .map((entry) => path.join(root, entry.name))
    .sort()
  const packs: Array<{ file: string; pack: CanonicalTextbookPack }> = []
  for (const file of files) {
    packs.push({ file, pack: await readJson<CanonicalTextbookPack>(file) })
  }
  return packs
}

function summarizeReview(lesson: NonNullable<CanonicalTextbookPack['lessons'][number]>) {
  const counts: Record<string, number> = {}
  for (const section of [lesson.vocabulary, lesson.grammar, lesson.contentBlocks, lesson.exercises]) {
    for (const item of section) counts[item.review?.action ?? 'missing'] = (counts[item.review?.action ?? 'missing'] ?? 0) + 1
  }
  return counts
}

function summarizeGradingModes(exercises: ExerciseEntry[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const exercise of exercises) counts[exercise.answerKey?.gradingMode ?? 'missing'] = (counts[exercise.answerKey?.gradingMode ?? 'missing'] ?? 0) + 1
  return counts
}

function isReady(lesson: CanonicalTextbookPack['lessons'][number] | undefined): boolean {
  if (!lesson) return false
  const review = summarizeReview(lesson)
  if ((review.pending ?? 0) > 0 || (review.missing ?? 0) > 0 || (review.ignored ?? 0) > 0) return false
  return lesson.exercises.every((exercise) => {
    const hasAnswerRef = Boolean(exercise.answerKeyRef || exercise.answerKeyRefs?.length)
    return !hasAnswerRef || Boolean(exercise.answerKey)
  })
}

function parseArgs(rawArgs: string[]): CliOptions {
  const options: CliOptions = {
    packsRoot: 'tools/textbook-pack/out/reviewed-packs',
  }

  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index]
    if (arg === '--packs-root') options.packsRoot = rawArgs[++index] ?? options.packsRoot
  }

  return options
}

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, 'utf8')) as T
}

function resolveAppPath(filePath: string): string {
  if (path.isAbsolute(filePath)) return filePath
  return path.resolve(process.cwd(), filePath)
}
