import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { CanonicalTextbookPack, ExerciseAnswerKey, ExerciseEntry, GroupedPage, SourceReference } from './schema.ts'

interface CliOptions {
  packPath: string
  groupedRoot: string
  outFile: string | null
}

const options = parseArgs(process.argv.slice(2))
const pack = await readJson<CanonicalTextbookPack>(resolveAppPath(options.packPath))
const summary = await attachAnswerGroundTruth(pack)
const outFile = resolveAppPath(options.outFile ?? options.packPath)
await writeJson(outFile, pack)

console.log(
  JSON.stringify(
    {
      pack: path.relative(process.cwd(), outFile),
      ...summary,
    },
    null,
    2,
  ),
)

async function attachAnswerGroundTruth(pack: CanonicalTextbookPack): Promise<Record<string, number>> {
  let exercises = 0
  let answerKeys = 0
  let manual = 0
  let exact = 0
  let sample = 0
  let openEnded = 0

  for (const lesson of pack.lessons) {
    for (const exercise of lesson.exercises) {
      const refs = answerRefs(exercise)
      if (refs.length === 0) continue
      exercises += 1
      const sourceText = await sourceTextForRefs(refs)
      const gradingMode = inferGradingMode(exercise)
      const answerKey: ExerciseAnswerKey = {
        gradingMode,
        sourceText,
        notes: noteForMode(gradingMode),
      }
      exercise.answerKey = answerKey
      answerKeys += 1
      if (gradingMode === 'exact') exact += 1
      if (gradingMode === 'sample') sample += 1
      if (gradingMode === 'manual') manual += 1
      if (gradingMode === 'open_ended') openEnded += 1
    }
  }

  return { exercises, answerKeys, exact, sample, openEnded, manual }
}

function answerRefs(exercise: ExerciseEntry): SourceReference[] {
  if (exercise.answerKeyRefs?.length) return exercise.answerKeyRefs
  return exercise.answerKeyRef ? [exercise.answerKeyRef] : []
}

async function sourceTextForRefs(refs: SourceReference[]): Promise<string> {
  const chunks: string[] = []
  for (const ref of refs) {
    const page = await readGroupedPage(ref)
    const coordinates = ref.coordinates
    const blocks = coordinates ? page.blocks.filter((block) => overlaps(block.boundingBox, coordinates)) : page.blocks
    const text = blocks.map((block) => block.text.trim()).filter(Boolean).join('\n')
    chunks.push(`Page ${ref.pageNumber}\n${text || page.blocks.map((block) => block.text.trim()).filter(Boolean).join('\n')}`)
  }
  return chunks.join('\n\n').trim()
}

async function readGroupedPage(ref: SourceReference): Promise<GroupedPage> {
  const groupedFile = resolveAppPath(path.join(options.groupedRoot, ref.sourceId, 'pages', `page-${String(ref.pageNumber).padStart(4, '0')}.json`))
  return readJson<GroupedPage>(groupedFile)
}

function overlaps(a: [number, number, number, number] | null, b: [number, number, number, number]): boolean {
  if (!a) return false
  const [ax1, ay1, ax2, ay2] = a
  const [bx1, by1, bx2, by2] = b
  return ax1 < bx2 && ax2 > bx1 && ay1 < by2 && ay2 > by1
}

function inferGradingMode(exercise: ExerciseEntry): ExerciseAnswerKey['gradingMode'] {
  const text = `${exercise.id} ${exercise.label} ${exercise.prompt ?? ''}`.toLowerCase()
  if (/oral|口頭|self[- ]?introduction|write a self|作文|composition|personal|interview|ask three people/.test(text)) return 'open_ended'
  if (/translate|content questions|questions|complete|conversation|sentences|summary|gap fill/.test(text)) return 'sample'
  return 'exact'
}

function noteForMode(mode: ExerciseAnswerKey['gradingMode']): string {
  if (mode === 'exact') return 'Extracted from mapped answer-key region; suitable for exact or checklist grading after item parsing.'
  if (mode === 'sample') return 'Extracted from mapped answer-key region; answer key may contain examples or sample answers.'
  if (mode === 'open_ended') return 'Open-ended exercise. Use answer-key text as guidance, not as the only acceptable response.'
  return 'Manual review recommended.'
}

function parseArgs(rawArgs: string[]): CliOptions {
  const options: CliOptions = {
    packPath: 'app/tools/textbook-pack/out/reviewed-packs/genki_1_lesson_1.json',
    groupedRoot: 'app/tools/textbook-pack/out/grouped',
    outFile: null,
  }

  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index]
    if (arg === '--pack') options.packPath = rawArgs[++index] ?? options.packPath
    if (arg === '--grouped-root') options.groupedRoot = rawArgs[++index] ?? options.groupedRoot
    if (arg === '--out') options.outFile = rawArgs[++index] ?? options.outFile
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
