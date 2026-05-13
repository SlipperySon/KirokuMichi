import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import type {
  CanonicalLesson,
  CanonicalTextbookPack,
  ContentBlock,
  ExerciseEntry,
  GrammarEntry,
  ReviewAction,
  SourceReference,
  TextbookSourceManifest,
  VocabEntry,
} from './schema.ts'

interface CliOptions {
  packPath: string
  manifestPath: string
  groupedRoot: string
  requireReviewed: boolean
}

type PackItem = VocabEntry | GrammarEntry | ContentBlock | ExerciseEntry
type SectionName = 'vocabulary' | 'grammar' | 'contentBlocks' | 'exercises'

interface ValidationFinding {
  severity: 'error' | 'warning'
  message: string
}

const options = parseArgs(process.argv.slice(2))
const pack = await readJson<CanonicalTextbookPack>(resolveAppPath(options.packPath))
const manifest = await readJson<TextbookSourceManifest>(resolveAppPath(options.manifestPath))
const findings = await validatePack(pack, manifest)
const errors = findings.filter((finding) => finding.severity === 'error')
const warnings = findings.filter((finding) => finding.severity === 'warning')

console.log(
  JSON.stringify(
    {
      pack: path.relative(process.cwd(), resolveAppPath(options.packPath)),
      lessons: pack.lessons.length,
      errors: errors.length,
      warnings: warnings.length,
      review: summarizeReview(pack),
      counts: summarizeCounts(pack),
      findings,
    },
    null,
    2,
  ),
)

if (errors.length > 0) process.exit(1)

async function validatePack(pack: CanonicalTextbookPack, manifest: TextbookSourceManifest): Promise<ValidationFinding[]> {
  const findings: ValidationFinding[] = []
  const manifestBySource = new Map(manifest.entries.map((entry) => [entry.id, entry]))
  const packSourceIds = new Set(pack.sources.map((source) => source.sourceId))

  if (pack.schemaVersion !== 1) error(findings, `Unsupported schemaVersion ${pack.schemaVersion}`)
  if (pack.lessons.length === 0) error(findings, 'Pack has no lessons')

  for (const source of pack.sources) {
    const manifestEntry = manifestBySource.get(source.sourceId)
    if (!manifestEntry) {
      error(findings, `Source ${source.sourceId} is missing from manifest`)
      continue
    }
    if (manifestEntry.fingerprint.sha256 !== source.fingerprint.sha256) {
      error(findings, `Source ${source.sourceId} fingerprint does not match manifest`)
    }
  }

  for (const lesson of pack.lessons) {
    await validateLesson(lesson, packSourceIds, manifestBySource, findings)
  }

  return findings
}

async function validateLesson(
  lesson: CanonicalLesson,
  packSourceIds: Set<string>,
  manifestBySource: Map<string, TextbookSourceManifest['entries'][number]>,
  findings: ValidationFinding[],
): Promise<void> {
  if (!lesson.id) error(findings, 'Lesson is missing id')
  if (lesson.lessonNumber < 0) error(findings, `${lesson.id}: lessonNumber must be >= 0`)
  if (lesson.vocabulary.length === 0) warning(findings, `${lesson.id}: no vocabulary entries`)
  if (lesson.grammar.length === 0) warning(findings, `${lesson.id}: no grammar entries`)
  if (lesson.contentBlocks.length === 0) warning(findings, `${lesson.id}: no content blocks`)
  if (lesson.exercises.length === 0) warning(findings, `${lesson.id}: no exercises`)

  const itemIds = new Set<string>()
  const grammarIds = new Set(lesson.grammar.map((entry) => entry.id))
  for (const [section, items] of lessonSections(lesson)) {
    for (const item of items) {
      if (itemIds.has(item.id)) error(findings, `${lesson.id}: duplicate item id ${item.id}`)
      itemIds.add(item.id)
      validateReview(lesson, section, item, findings)
      await validateSourceRef(lesson, section, item.id, item.sourceRef, packSourceIds, manifestBySource, findings)
      await validateSupplementalRefs(lesson, section, item, packSourceIds, manifestBySource, findings)
      await validateImageAsset(lesson, section, item, packSourceIds, manifestBySource, findings)
      if (section === 'exercises') validateExerciseTargets(lesson, item as ExerciseEntry, grammarIds, findings)
      if (section === 'vocabulary') validateVocabEntry(lesson, item as VocabEntry, findings)
      if (section === 'grammar') validateGrammarEntry(lesson, item as GrammarEntry, findings)
      if (section === 'contentBlocks') validateContentBlock(lesson, item as ContentBlock, findings)
    }
  }
}

async function validateSupplementalRefs(
  lesson: CanonicalLesson,
  section: SectionName,
  item: PackItem,
  packSourceIds: Set<string>,
  manifestBySource: Map<string, TextbookSourceManifest['entries'][number]>,
  findings: ValidationFinding[],
): Promise<void> {
  if (!('answerKeyRef' in item || 'answerKeyRefs' in item || 'listeningScriptRef' in item)) return
  if ('answerKeyRef' in item && item.answerKeyRef) {
    await validateSourceRef(lesson, section, `${item.id}.answerKeyRef`, item.answerKeyRef, packSourceIds, manifestBySource, findings)
  }
  if ('answerKeyRefs' in item && item.answerKeyRefs?.length) {
    for (let index = 0; index < item.answerKeyRefs.length; index += 1) {
      await validateSourceRef(lesson, section, `${item.id}.answerKeyRefs.${index}`, item.answerKeyRefs[index], packSourceIds, manifestBySource, findings)
    }
  }
  if ('listeningScriptRef' in item && item.listeningScriptRef) {
    await validateSourceRef(lesson, section, `${item.id}.listeningScriptRef`, item.listeningScriptRef, packSourceIds, manifestBySource, findings)
  }
}

async function validateImageAsset(
  lesson: CanonicalLesson,
  section: SectionName,
  item: PackItem,
  packSourceIds: Set<string>,
  manifestBySource: Map<string, TextbookSourceManifest['entries'][number]>,
  findings: ValidationFinding[],
): Promise<void> {
  if (!('imageFile' in item) || !item.imageFile?.trim()) return
  const imagePath = resolveAppPath(item.imageFile)
  const imageStats = await statIfExists(imagePath)
  if (!imageStats?.isFile()) error(findings, `${lesson.id}: ${section}.${item.id} imageFile missing at ${path.relative(process.cwd(), imagePath)}`)

  const imageSourceRef = 'imageSourceRef' in item ? item.imageSourceRef : undefined
  if (imageSourceRef) {
    await validateSourceRef(lesson, section, `${item.id}.imageSourceRef`, imageSourceRef, packSourceIds, manifestBySource, findings)
  } else {
    warning(findings, `${lesson.id}: ${section}.${item.id} has imageFile but no imageSourceRef`)
  }
}

function validateReview(lesson: CanonicalLesson, section: SectionName, item: PackItem, findings: ValidationFinding[]): void {
  const action = item.review?.action
  if (!action) {
    const message = `${lesson.id}: ${section}.${item.id} has no review metadata`
    options.requireReviewed ? error(findings, message) : warning(findings, message)
    return
  }
  if (!['approved', 'fixed', 'pending', 'ignored'].includes(action)) error(findings, `${lesson.id}: ${section}.${item.id} has invalid review action ${action}`)
  if (options.requireReviewed && action === 'pending') error(findings, `${lesson.id}: ${section}.${item.id} is still pending review`)
  if (action === 'ignored') error(findings, `${lesson.id}: ${section}.${item.id} should not remain in a reviewed pack as ignored`)
}

async function validateSourceRef(
  lesson: CanonicalLesson,
  section: SectionName,
  itemId: string,
  ref: SourceReference,
  packSourceIds: Set<string>,
  manifestBySource: Map<string, TextbookSourceManifest['entries'][number]>,
  findings: ValidationFinding[],
): Promise<void> {
  const prefix = `${lesson.id}: ${section}.${itemId}`
  if (!packSourceIds.has(ref.sourceId)) error(findings, `${prefix} references source ${ref.sourceId} not listed in pack.sources`)
  const manifestEntry = manifestBySource.get(ref.sourceId)
  if (!manifestEntry) {
    error(findings, `${prefix} references source ${ref.sourceId} missing from manifest`)
  } else if (ref.pageNumber < 1 || ref.pageNumber > manifestEntry.pageCount) {
    error(findings, `${prefix} page ${ref.pageNumber} outside source range 1-${manifestEntry.pageCount}`)
  }

  if (ref.coordinates) {
    const [x1, y1, x2, y2] = ref.coordinates
    if (ref.coordinates.length !== 4 || !ref.coordinates.every(Number.isFinite)) error(findings, `${prefix} has invalid coordinates`)
    if (x2 <= x1 || y2 <= y1) error(findings, `${prefix} has non-positive coordinate bounds`)
  } else {
    warning(findings, `${prefix} has no coordinates`)
  }

  const groupedFile = resolveAppPath(path.join(options.groupedRoot, ref.sourceId, 'pages', `page-${String(ref.pageNumber).padStart(4, '0')}.json`))
  if (!(await exists(groupedFile))) warning(findings, `${prefix} has no grouped page file at ${path.relative(process.cwd(), groupedFile)}`)
}

function validateExerciseTargets(lesson: CanonicalLesson, exercise: ExerciseEntry, grammarIds: Set<string>, findings: ValidationFinding[]): void {
  for (const grammarId of exercise.targetGrammarIds ?? []) {
    if (!grammarIds.has(grammarId)) error(findings, `${lesson.id}: exercises.${exercise.id} targets missing grammar ${grammarId}`)
  }
  validateExerciseAnswerKey(lesson, exercise, findings)
}

function validateExerciseAnswerKey(lesson: CanonicalLesson, exercise: ExerciseEntry, findings: ValidationFinding[]): void {
  if (!exercise.answerKeyRef && !exercise.answerKeyRefs?.length) return
  if (!exercise.answerKey) {
    error(findings, `${lesson.id}: exercises.${exercise.id} has answer-key refs but no answerKey payload`)
    return
  }
  if (!['exact', 'sample', 'open_ended', 'manual'].includes(exercise.answerKey.gradingMode)) {
    error(findings, `${lesson.id}: exercises.${exercise.id} has invalid answerKey gradingMode ${exercise.answerKey.gradingMode}`)
  }
  const hasSourceText = Boolean(exercise.answerKey.sourceText?.trim())
  const hasItems = Boolean(exercise.answerKey.items?.length)
  const allowsNoConcreteAnswer = exercise.answerKey.gradingMode === 'open_ended' || exercise.answerKey.gradingMode === 'manual'
  if (!hasSourceText && !hasItems && !allowsNoConcreteAnswer) {
    error(findings, `${lesson.id}: exercises.${exercise.id} answerKey has no sourceText or items`)
  }
}

function validateVocabEntry(lesson: CanonicalLesson, entry: VocabEntry, findings: ValidationFinding[]): void {
  if (!entry.surface.trim()) error(findings, `${lesson.id}: vocabulary.${entry.id} has empty surface`)
  if (!entry.meaning.trim()) error(findings, `${lesson.id}: vocabulary.${entry.id} has empty meaning`)
  if (entry.lessonNumber !== lesson.lessonNumber) error(findings, `${lesson.id}: vocabulary.${entry.id} lessonNumber mismatch`)
}

function validateGrammarEntry(lesson: CanonicalLesson, entry: GrammarEntry, findings: ValidationFinding[]): void {
  if (!entry.pattern.trim()) error(findings, `${lesson.id}: grammar.${entry.id} has empty pattern`)
  if (!entry.meaning.trim()) error(findings, `${lesson.id}: grammar.${entry.id} has empty meaning`)
  if (entry.examples.length === 0) warning(findings, `${lesson.id}: grammar.${entry.id} has no examples`)
  if (entry.lessonNumber !== lesson.lessonNumber) error(findings, `${lesson.id}: grammar.${entry.id} lessonNumber mismatch`)
}

function validateContentBlock(lesson: CanonicalLesson, entry: ContentBlock, findings: ValidationFinding[]): void {
  if (!entry.title?.trim() && !entry.text?.trim() && !entry.imageFile?.trim()) {
    error(findings, `${lesson.id}: contentBlocks.${entry.id} has no title, text, or imageFile`)
  }
}

function lessonSections(lesson: CanonicalLesson): Array<[SectionName, PackItem[]]> {
  return [
    ['vocabulary', lesson.vocabulary],
    ['grammar', lesson.grammar],
    ['contentBlocks', lesson.contentBlocks],
    ['exercises', lesson.exercises],
  ]
}

function summarizeReview(pack: CanonicalTextbookPack): Record<ReviewAction | 'missing', number> {
  const counts: Record<ReviewAction | 'missing', number> = {
    approved: 0,
    fixed: 0,
    ignored: 0,
    pending: 0,
    missing: 0,
  }
  for (const lesson of pack.lessons) {
    for (const [, items] of lessonSections(lesson)) {
      for (const item of items) counts[item.review?.action ?? 'missing'] += 1
    }
  }
  return counts
}

function summarizeCounts(pack: CanonicalTextbookPack): Record<string, number> {
  return pack.lessons.reduce(
    (counts, lesson) => {
      counts.vocabulary += lesson.vocabulary.length
      counts.grammar += lesson.grammar.length
      counts.contentBlocks += lesson.contentBlocks.length
      counts.exercises += lesson.exercises.length
      return counts
    },
    { vocabulary: 0, grammar: 0, contentBlocks: 0, exercises: 0 },
  )
}

function error(findings: ValidationFinding[], message: string): void {
  findings.push({ severity: 'error', message })
}

function warning(findings: ValidationFinding[], message: string): void {
  findings.push({ severity: 'warning', message })
}

function parseArgs(rawArgs: string[]): CliOptions {
  const options: CliOptions = {
    packPath: 'tools/textbook-pack/out/reviewed-packs/genki_1_lesson_1.json',
    manifestPath: 'tools/textbook-pack/out/source-manifest.json',
    groupedRoot: 'tools/textbook-pack/out/grouped',
    requireReviewed: true,
  }

  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index]
    if (arg === '--pack') options.packPath = rawArgs[++index] ?? options.packPath
    if (arg === '--manifest') options.manifestPath = rawArgs[++index] ?? options.manifestPath
    if (arg === '--grouped-root') options.groupedRoot = rawArgs[++index] ?? options.groupedRoot
    if (arg === '--allow-pending') options.requireReviewed = false
  }

  return options
}

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, 'utf8')) as T
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await readFile(filePath)
    return true
  } catch {
    return false
  }
}

async function statIfExists(filePath: string) {
  try {
    return await stat(filePath)
  } catch {
    return null
  }
}

function resolveAppPath(filePath: string): string {
  if (path.isAbsolute(filePath)) return filePath
  return path.resolve(process.cwd(), filePath)
}
