import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type {
  CanonicalLesson,
  CanonicalTextbookPack,
  ContentBlock,
  ExerciseEntry,
  GrammarEntry,
  GroupedPage,
  GroupedPageBlock,
  SourceManifestEntry,
  SourceReference,
  TextbookKey,
  TextbookSourceManifest,
  VocabEntry,
} from './schema.ts'

interface CliOptions {
  textbookKey: Extract<TextbookKey, 'genki_1' | 'genki_2'>
  unit: 'lesson' | 'pre_lesson'
  lessonNumber: number
  slug: string | null
  manifestPath: string
  groupedRoot: string
  outFile: string | null
}

interface SourceRange {
  entry: SourceManifestEntry
  start: number
  end: number
}

const VOCAB_HEADER_RE = /^(vocabulary|additional vocabulary|school|person|time|others|countries|majors|occupations|family|日本語|英語)$/i
const COMMON_ENGLISH_WORD_RE = /^(a|an|and|are|at|be|britain|canada|china|college|computer|doctor|economics|egypt|engineering|family|father|for|high|housewife|is|japan|korea|lawyer|major|mother|name|number|nurse|office|politics|sister|student|teacher|telephone|the|to|um|university|what|worker|yes)$/
const GENKI_1_L1_READING_SURFACES = new Map<string, string>([
  ['lgirisu', 'イギリス'],
  ['oosutoraria', 'オーストラリア'],
  ['kankoku', 'かんこく'],
  ['kanada', 'カナダ'],
  ['chuugoku', 'ちゅうごく'],
  ['nannani', 'なん/なに'],
  ['ajiakenkyuu', 'アジアけんきゅう'],
  ['keezai', 'けいざい'],
  ['konpyuutaa', 'コンピューター'],
  ['seei', 'せいじ'],
  ['seebutsugaku', 'せいぶつがく'],
  ['bijinesu', 'ビジネス'],
  ['bungaku', 'ぶんがく'],
  ['isha', 'いしゃ'],
  ['shufu', 'しゅふ'],
  ['bengoshi', 'べんごし'],
])

const options = parseArgs(process.argv.slice(2))
const manifest = await readJson<TextbookSourceManifest>(resolveAppPath(options.manifestPath))
const textbook = findSource(options.textbookKey, 'textbook')
const workbook = findSource(options.textbookKey, 'workbook')
const answerKey = findGenkiAnswerKey()
const textbookRange = options.unit === 'pre_lesson' ? preLessonRange(textbook, requiredSlug()) : lessonRange(textbook, options.lessonNumber)
const workbookRange = options.unit === 'pre_lesson' ? preLessonRange(workbook, requiredSlug()) : lessonRange(workbook, options.lessonNumber)
const textbookPages = await readGroupedPages(textbookRange)
const workbookPages = await readGroupedPages(workbookRange)
const lesson = buildLesson(textbookRange, workbookRange, textbookPages, workbookPages)

const pack: CanonicalTextbookPack = {
  schemaVersion: 1,
  textbookKey: options.textbookKey,
  title: options.textbookKey === 'genki_1' ? 'Genki I: An Integrated Course in Elementary Japanese' : 'Genki II: An Integrated Course in Elementary Japanese',
  edition: '3rd Edition',
  levelRange: options.textbookKey === 'genki_1' ? 'N5-N4' : 'N4',
  sources: [textbook, workbook, answerKey].map((source) => ({
    sourceId: source.id,
    role: source.role,
    fingerprint: source.fingerprint,
  })),
  lessons: [lesson],
}

const outFile = resolveAppPath(
  options.outFile ??
    path.join(
      'tools/textbook-pack/out/canonical-proofs',
      options.unit === 'pre_lesson' ? `${options.textbookKey}_pre_${requiredSlug()}.json` : `${options.textbookKey}_lesson_${options.lessonNumber}.json`,
    ),
)
await writeJson(outFile, pack)
console.log(`wrote ${path.relative(process.cwd(), outFile)}`)
console.log(
  JSON.stringify(
    {
      unit: lesson.id,
      textbookPages: textbookPages.map((page) => page.pageNumber),
      workbookPages: workbookPages.map((page) => page.pageNumber),
      contentBlocks: lesson.contentBlocks.length,
      exercises: lesson.exercises.length,
      vocabulary: lesson.vocabulary.length,
      grammar: lesson.grammar.length,
      missingTextbookPages: missingPages(textbookRange, textbookPages),
      missingWorkbookPages: missingPages(workbookRange, workbookPages),
    },
    null,
    2,
  ),
)

function buildLesson(
  textbookRange: SourceRange,
  workbookRange: SourceRange,
  textbookPages: GroupedPage[],
  workbookPages: GroupedPage[],
): CanonicalLesson {
  const lessonTitle = titleFromRange(textbookRange) ?? `Lesson ${options.lessonNumber}`
  const contentBlocks = textbookPages.flatMap((page) => page.blocks.map((block) => contentBlockFromGroupedPage(page, block)))
  const exercises = workbookPages.flatMap((page) => page.blocks.map((block) => exerciseFromGroupedPage(page, block)))
  const vocabulary = extractDraftVocabulary(textbookPages)
  const grammar = extractDraftGrammar(textbookPages)

  return {
    id: options.unit === 'pre_lesson' ? `${options.textbookKey}_pre_${requiredSlug()}` : `${options.textbookKey}_lesson_${options.lessonNumber}`,
    unitType: options.unit,
    lessonNumber: options.unit === 'pre_lesson' ? 0 : options.lessonNumber,
    title: lessonTitle,
    level: options.textbookKey === 'genki_1' ? 'N5-N4' : 'N4',
    pageRange: {
      start: textbookRange.start,
      end: textbookRange.end,
    },
    modes: ['conversation_grammar', 'reading_writing', 'workbook'],
    vocabulary,
    grammar,
    contentBlocks,
    exercises,
  }
}

function extractDraftVocabulary(textbookPages: GroupedPage[]): VocabEntry[] {
  if (options.textbookKey !== 'genki_1' || options.unit !== 'lesson' || options.lessonNumber !== 1) return []

  const entries: VocabEntry[] = []
  const seen = new Set<string>()
  const vocabBlocks = textbookPages
    .filter((page) => page.pageKind === 'lesson_vocab')
    .flatMap((page) => page.blocks.filter((block) => block.type === 'table_row').map((block) => ({ page, block })))

  for (const { page, block } of vocabBlocks) {
    const row = parseGenkiVocabRow(block.columns ?? [block.text])
    if (!row || seen.has(row.surface)) continue
    seen.add(row.surface)
    entries.push({
      id: `${options.textbookKey}_l${options.lessonNumber}_vocab_${entries.length + 1}`,
      surface: row.surface,
      reading: row.reading,
      meaning: row.meaning,
      lessonNumber: options.lessonNumber,
      sourceRef: sourceRef(page, block),
      tags: ['draft_table_parse'],
    })
  }
  return entries
}

function extractDraftGrammar(textbookPages: GroupedPage[]): GrammarEntry[] {
  if (options.textbookKey !== 'genki_1' || options.unit !== 'lesson' || options.lessonNumber !== 1) return []

  const grammarPages = textbookPages.filter((page) => page.pageNumber >= 50 && page.pageNumber <= 54)
  const specs = [
    {
      pattern: 'XはYです',
      meaning: 'X is Y',
      examples: [{ japanese: 'せんこうはにほんごです。', english: 'My major is Japanese.' }],
      match: (text: string) => text.includes('はyです') || text.includes('x is y') || text.includes('xはyです'),
    },
    {
      pattern: 'Question Sentences: ～か',
      meaning: 'Add か to make a question',
      examples: [{ japanese: 'りゅうがくせいですか。', english: 'Are you an international student?' }],
      match: (text: string) => text.includes('questionsentences') || text.includes('kaisadded'),
    },
    {
      pattern: 'Noun1のNoun2',
      meaning: 'Noun modification/possession with の',
      examples: [{ japanese: 'たけしさんのでんわばんごう', english: "Takeshi's phone number" }],
      match: (text: string) => text.includes('noun1の') || text.includes('nounz') || text.includes('no is a particle'),
    },
  ] as const

  const entries: GrammarEntry[] = []
  for (const spec of specs) {
    const ref = findRefByMatcher(grammarPages, spec.match) ?? findRefByMatcher(textbookPages, spec.match)
    if (!ref) continue
    entries.push({
      id: `${options.textbookKey}_l${options.lessonNumber}_grammar_${entries.length + 1}`,
      pattern: spec.pattern,
      meaning: spec.meaning,
      examples: [...spec.examples],
      lessonNumber: options.lessonNumber,
      sourceRef: ref,
    })
  }
  return entries
}

function parseGenkiVocabRow(rawColumns: string[]): { surface: string; reading?: string; meaning: string } | null {
  const columns = rawColumns.map(cleanCell).filter(Boolean)
  if (columns.length < 2) return null
  if (columns.some((column) => VOCAB_HEADER_RE.test(column))) return null

  const surfaceIndex = columns.findIndex(isJapaneseVocabSurface)
  const startIndex = surfaceIndex >= 0 ? surfaceIndex : 0
  const afterSurface = columns.slice(surfaceIndex + 1)
  const readingIndex = afterSurface.findIndex(isLikelyRomaji)
  const reading = readingIndex >= 0 ? afterSurface[readingIndex] : undefined
  const canonicalReading = reading ? normalizeReadingKey(reading) : null
  const inferredSurface = canonicalReading ? GENKI_1_L1_READING_SURFACES.get(canonicalReading) : undefined
  const surface = inferredSurface ?? cleanSurface(columns[startIndex])
  if (!surface || surface.length > 24 || !isJapaneseVocabSurface(surface)) return null

  const meaningCells = afterSurface.filter((cell, index) => index !== readingIndex && isLikelyMeaning(cell))
  const meaning = cleanMeaning(meaningCells.join('; '))
  if (!meaning) return null

  return { surface, reading, meaning }
}

function findRefByMatcher(pages: GroupedPage[], matcher: (text: string) => boolean): SourceReference | null {
  for (const page of pages) {
    for (const block of page.blocks) {
      if (matcher(normalizeSearch(block.text))) return sourceRef(page, block)
    }
  }
  return null
}

function findRefForText(pages: GroupedPage[], needle: string): SourceReference | null {
  const normalizedNeedle = normalizeSearch(needle)
  for (const page of pages) {
    for (const block of page.blocks) {
      if (normalizeSearch(block.text).includes(normalizedNeedle)) return sourceRef(page, block)
    }
  }
  return null
}

function normalizeSearch(value: string): string {
  return value.toLowerCase().replace(/\s+/g, '').replace(/[・·•]/g, '')
}

function cleanCell(value: string): string {
  return value
    .replace(/[＊*]/g, '*')
    .replace(/[|｜]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function cleanSurface(value: string): string {
  return cleanCell(value)
    .replace(/^[*＊\s]+/, '')
    .replace(/[()[\]{}]/g, '')
    .trim()
}

function cleanMeaning(value: string): string {
  return value
    .replace(/\bL1\b/g, '')
    .replace(/\s*;\s*/g, '; ')
    .replace(/;{2,}/g, ';')
    .replace(/^[-:;,\s]+|[-:;,\s]+$/g, '')
    .trim()
}

function isJapaneseVocabSurface(value: string): boolean {
  const cleaned = cleanSurface(value)
  if (!/[ぁ-んァ-ン一-龯々]/.test(cleaned)) return false
  if (/^(です|ます|の|は|が|を|に|で|と)$/.test(cleaned)) return false
  return !/[A-Za-z]{3,}/.test(cleaned)
}

function isLikelyRomaji(value: string): boolean {
  const cleaned = normalizeReadingKey(value)
  return /^[a-z]+$/.test(cleaned) && cleaned.length >= 2 && cleaned.length <= 28 && !COMMON_ENGLISH_WORD_RE.test(cleaned)
}

function isLikelyMeaning(value: string): boolean {
  if (/[ぁ-んァ-ン一-龯々]/.test(value)) return false
  if (/^[0-9()[\].,:;!?'"-]+$/.test(value)) return false
  return /[A-Za-z]/.test(value)
}

function normalizeReadingKey(value: string): string {
  return value.toLowerCase().replace(/[.'\-/\s]/g, '')
}


function contentBlockFromGroupedPage(page: GroupedPage, block: GroupedPageBlock): ContentBlock {
  return {
    id: `${page.sourceId}_p${page.pageNumber}_${block.id}`,
    type: page.pageKind === 'dialogue' || block.type === 'dialogue_turn' ? 'dialogue' : block.type === 'table_row' ? 'table' : 'instruction',
    mode: page.pageKind === 'reading' ? 'reading_writing' : 'conversation_grammar',
    title: block.type === 'heading' ? block.text : undefined,
    text: block.type === 'heading' ? undefined : block.text,
    sourceRef: sourceRef(page, block),
  }
}

function exerciseFromGroupedPage(page: GroupedPage, block: GroupedPageBlock): ExerciseEntry {
  return {
    id: `${page.sourceId}_p${page.pageNumber}_${block.id}`,
    label: `${page.section.label ?? 'Workbook'} p.${page.pageNumber} ${block.id}`,
    prompt: block.text,
    sourceRef: sourceRef(page, block),
  }
}

function sourceRef(page: GroupedPage, block: GroupedPageBlock): SourceReference {
  return {
    sourceId: page.sourceId,
    pageNumber: page.pageNumber,
    coordinates: block.boundingBox ?? undefined,
  }
}

async function readGroupedPages(range: SourceRange): Promise<GroupedPage[]> {
  const dir = resolveAppPath(path.join(options.groupedRoot, range.entry.id, 'pages'))
  let files: string[]
  try {
    files = (await readdir(dir)).filter((file) => file.endsWith('.json')).sort()
  } catch {
    return []
  }

  const pages: GroupedPage[] = []
  for (const file of files) {
    const page = await readJson<GroupedPage>(path.join(dir, file))
    if (page.pageNumber >= range.start && page.pageNumber <= range.end) pages.push(page)
  }
  return pages.sort((a, b) => a.pageNumber - b.pageNumber)
}

function findSource(textbookKey: TextbookKey, role: 'textbook' | 'workbook'): SourceManifestEntry {
  const source = manifest.entries.find((entry) => entry.textbookKey === textbookKey && entry.role === role)
  if (!source) throw new Error(`Missing ${textbookKey} ${role} in manifest`)
  return source
}

function findGenkiAnswerKey(): SourceManifestEntry {
  const source = manifest.entries.find((entry) => entry.id === 'genki_combined_answer_key')
  if (!source) throw new Error('Missing genki_combined_answer_key in manifest')
  return source
}

function lessonRange(entry: SourceManifestEntry, lessonNumber: number): SourceRange {
  const lessonHints = entry.splitHints
    .filter((hint) => hint.kind === 'lesson' && hint.lessonNumber === lessonNumber && hint.pageNumber !== null)
    .sort((a, b) => (a.pageNumber ?? 0) - (b.pageNumber ?? 0))
  const startHint = lessonHints[0]
  if (!startHint?.pageNumber) throw new Error(`Missing lesson ${lessonNumber} start for ${entry.id}`)

  const nextLesson = entry.splitHints
    .filter(
      (hint) =>
        hint.kind === 'lesson' &&
        hint.pageNumber !== null &&
        hint.pageNumber > startHint.pageNumber! &&
        (hint.lessonNumber ?? Number.POSITIVE_INFINITY) > lessonNumber,
    )
    .sort((a, b) => (a.pageNumber ?? 0) - (b.pageNumber ?? 0))[0]

  const nextSection = entry.splitHints
    .filter((hint) => hint.kind !== 'lesson' && hint.pageNumber !== null && hint.pageNumber > startHint.pageNumber!)
    .sort((a, b) => (a.pageNumber ?? 0) - (b.pageNumber ?? 0))[0]

  const nextStart = [nextLesson?.pageNumber, nextSection?.pageNumber].filter((value): value is number => typeof value === 'number').sort((a, b) => a - b)[0]

  return {
    entry,
    start: startHint.pageNumber,
    end: nextStart ? nextStart - 1 : entry.pageCount,
  }
}

function preLessonRange(entry: SourceManifestEntry, slug: string): SourceRange {
  const startHint = entry.splitHints.find((hint) => hint.kind === 'pre_lesson' && slugFromLabel(hint.label) === slug && hint.pageNumber !== null)
  if (!startHint?.pageNumber) throw new Error(`Missing pre-lesson ${slug} start for ${entry.id}`)

  const nextStart = entry.splitHints
    .filter((hint) => hint.pageNumber !== null && hint.pageNumber > startHint.pageNumber!)
    .sort((a, b) => (a.pageNumber ?? 0) - (b.pageNumber ?? 0))[0]?.pageNumber

  return {
    entry,
    start: startHint.pageNumber,
    end: nextStart ? nextStart - 1 : entry.pageCount,
  }
}

function titleFromRange(range: SourceRange): string | null {
  const hint = range.entry.splitHints.find((candidate) => candidate.pageNumber === range.start && (options.unit === 'pre_lesson' ? candidate.kind === 'pre_lesson' : candidate.kind === 'lesson' && candidate.lessonNumber === options.lessonNumber))
  if (!hint?.label) return null
  return hint.label.replace(/^第\d+課\s*/, '').trim()
}

function requiredSlug(): string {
  if (!options.slug) throw new Error('--slug is required when --unit pre_lesson is used')
  return options.slug
}

function slugFromLabel(label: string): string {
  const normalized = label.toLowerCase()
  if (normalized.includes('greetings') || normalized.includes('あいさつ')) return 'greetings'
  if (normalized.includes('numbers') || normalized.includes('すうじ')) return 'numbers'
  if (normalized.includes('hiragana')) return 'hiragana'
  if (normalized.includes('katakana')) return 'katakana'
  return normalized.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}

function missingPages(range: SourceRange, pages: GroupedPage[]): number[] {
  const present = new Set(pages.map((page) => page.pageNumber))
  const missing: number[] = []
  for (let page = range.start; page <= range.end; page += 1) {
    if (!present.has(page)) missing.push(page)
  }
  return missing
}

function parseArgs(rawArgs: string[]): CliOptions {
  const options: CliOptions = {
    textbookKey: 'genki_1',
    unit: 'lesson',
    lessonNumber: 1,
    slug: null,
    manifestPath: 'tools/textbook-pack/out/source-manifest.json',
    groupedRoot: 'tools/textbook-pack/out/grouped',
    outFile: null,
  }

  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index]
    if (arg === '--textbook-key') options.textbookKey = rawArgs[++index] as CliOptions['textbookKey']
    if (arg === '--unit') options.unit = rawArgs[++index] as CliOptions['unit']
    if (arg === '--lesson') options.lessonNumber = Number(rawArgs[++index] ?? options.lessonNumber)
    if (arg === '--slug') options.slug = rawArgs[++index] ?? options.slug
    if (arg === '--manifest') options.manifestPath = rawArgs[++index] ?? options.manifestPath
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
