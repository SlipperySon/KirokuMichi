import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type {
  CanonicalTextbookPack,
  ContentBlock,
  CorrectableItemKind,
  ExerciseEntry,
  GrammarEntry,
  TextbookPackCorrection,
  TextbookPackCorrections,
  VocabEntry,
} from './schema.ts'

interface CliOptions {
  proofPath: string
  outFile: string | null
  force: boolean
}

const options = parseArgs(process.argv.slice(2))
const proofPath = resolveAppPath(options.proofPath)
const proof = await readJson<CanonicalTextbookPack>(proofPath)
const lesson = proof.lessons[0]
if (!lesson) throw new Error('Proof pack does not contain a lesson')

const outFile = resolveAppPath(options.outFile ?? path.join('tools/textbook-pack/corrections', `${lesson.id}.corrections.json`))
if (!options.force && (await exists(outFile))) {
  throw new Error(`Correction file already exists: ${outFile}. Use --force to overwrite it.`)
}

const corrections: TextbookPackCorrections = {
  schemaVersion: 1,
  packId: lesson.id,
  basedOnProof: path.relative(path.dirname(outFile), proofPath),
  generatedAt: new Date().toISOString(),
  corrections: [
    ...lesson.vocabulary.map((item) => correction('vocabulary', item.id, summarizeVocab(item))),
    ...lesson.grammar.map((item) => correction('grammar', item.id, summarizeGrammar(item))),
    ...lesson.contentBlocks.map((item) => correction('contentBlocks', item.id, summarizeContentBlock(item))),
    ...lesson.exercises.map((item) => correction('exercises', item.id, summarizeExercise(item))),
  ],
  additions: {},
}

await writeJson(outFile, corrections)
console.log(`wrote ${path.relative(process.cwd(), outFile)}`)
console.log(
  JSON.stringify(
    {
      packId: lesson.id,
      corrections: corrections.corrections.length,
      vocabulary: lesson.vocabulary.length,
      grammar: lesson.grammar.length,
      contentBlocks: lesson.contentBlocks.length,
      exercises: lesson.exercises.length,
    },
    null,
    2,
  ),
)

function correction(kind: CorrectableItemKind, id: string, current: Record<string, unknown>): TextbookPackCorrection {
  return {
    id,
    kind,
    action: 'pending',
    current,
    replacement: {},
    notes: '',
  }
}

function summarizeVocab(item: VocabEntry): Record<string, unknown> {
  return {
    surface: item.surface,
    reading: item.reading,
    meaning: item.meaning,
    sourceRef: item.sourceRef,
  }
}

function summarizeGrammar(item: GrammarEntry): Record<string, unknown> {
  return {
    pattern: item.pattern,
    meaning: item.meaning,
    sourceRef: item.sourceRef,
  }
}

function summarizeContentBlock(item: ContentBlock): Record<string, unknown> {
  return {
    type: item.type,
    title: item.title,
    text: truncate(item.text ?? '', 180),
    sourceRef: item.sourceRef,
  }
}

function summarizeExercise(item: ExerciseEntry): Record<string, unknown> {
  return {
    label: item.label,
    prompt: truncate(item.prompt ?? '', 180),
    sourceRef: item.sourceRef,
  }
}

function truncate(value: string, maxLength: number): string {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength - 1)}…`
}

function parseArgs(rawArgs: string[]): CliOptions {
  const options: CliOptions = {
    proofPath: 'tools/textbook-pack/out/canonical-proofs/genki_1_lesson_1.json',
    outFile: null,
    force: false,
  }

  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index]
    if (arg === '--proof') options.proofPath = rawArgs[++index] ?? options.proofPath
    if (arg === '--out') options.outFile = rawArgs[++index] ?? options.outFile
    if (arg === '--force') options.force = true
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

async function exists(filePath: string): Promise<boolean> {
  try {
    await readFile(filePath)
    return true
  } catch {
    return false
  }
}

function resolveAppPath(filePath: string): string {
  if (path.isAbsolute(filePath)) return filePath
  return path.resolve(process.cwd(), filePath)
}
