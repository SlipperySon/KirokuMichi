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
  LessonMode,
  SourceManifestEntry,
  SourceReference,
  TextbookKey,
  TextbookSourceManifest,
  VocabEntry,
} from './schema.ts'

interface CliOptions {
  textbookKey: Extract<TextbookKey, 'quartet_1' | 'quartet_2'>
  lessonNumber: number
  manifestPath: string
  groupedRoot: string
  outFile: string | null
}

interface SourceRange {
  entry: SourceManifestEntry
  start: number
  end: number
}

const options = parseArgs(process.argv.slice(2))
const manifest = await readJson<TextbookSourceManifest>(resolveAppPath(options.manifestPath))
const textbook = findSource(options.textbookKey, 'textbook')
const workbook = findSource(options.textbookKey, 'workbook')
const answerKey = findSource(options.textbookKey, 'answer_key')
const textbookRange = lessonRange(textbook, options.lessonNumber)
const workbookRange = lessonRange(workbook, options.lessonNumber)
const vocabRange = nestedSupplementLessonRange(textbook, 'vocab', options.lessonNumber)
const kanjiRange = nestedSupplementLessonRange(textbook, 'kanji', options.lessonNumber)
const textbookPages = await readGroupedPages(textbookRange)
const workbookPages = await readGroupedPages(workbookRange)
const vocabPages = await readGroupedPages(vocabRange)
const kanjiPages = await readGroupedPages(kanjiRange)
const lesson = buildLesson(textbookRange, workbookRange, vocabRange, kanjiRange, textbookPages, workbookPages, vocabPages, kanjiPages)

const pack: CanonicalTextbookPack = {
  schemaVersion: 1,
  textbookKey: options.textbookKey,
  title: options.textbookKey === 'quartet_1' ? 'Quartet: Intermediate Japanese Across the Four Language Skills I' : 'Quartet: Intermediate Japanese Across the Four Language Skills II',
  levelRange: options.textbookKey === 'quartet_1' ? 'N3' : 'N2',
  sources: [textbook, workbook, answerKey].map((source) => ({
    sourceId: source.id,
    role: source.role,
    fingerprint: source.fingerprint,
  })),
  lessons: [lesson],
}

const outFile = resolveAppPath(options.outFile ?? path.join('tools/textbook-pack/out/canonical-proofs', `${options.textbookKey}_lesson_${options.lessonNumber}.json`))
await writeJson(outFile, pack)
console.log(`wrote ${path.relative(process.cwd(), outFile)}`)
console.log(
  JSON.stringify(
    {
      unit: lesson.id,
      textbookPages: textbookPages.map((page) => page.pageNumber),
      workbookPages: workbookPages.map((page) => page.pageNumber),
      vocabPages: vocabPages.map((page) => page.pageNumber),
      kanjiPages: kanjiPages.map((page) => page.pageNumber),
      contentBlocks: lesson.contentBlocks.length,
      exercises: lesson.exercises.length,
      vocabulary: lesson.vocabulary.length,
      grammar: lesson.grammar.length,
      missingTextbookPages: missingPages(textbookRange, textbookPages),
      missingWorkbookPages: missingPages(workbookRange, workbookPages),
      missingVocabPages: missingPages(vocabRange, vocabPages),
      missingKanjiPages: missingPages(kanjiRange, kanjiPages),
    },
    null,
    2,
  ),
)

function buildLesson(
  textbookRange: SourceRange,
  workbookRange: SourceRange,
  vocabRange: SourceRange,
  kanjiRange: SourceRange,
  textbookPages: GroupedPage[],
  workbookPages: GroupedPage[],
  vocabPages: GroupedPage[],
  kanjiPages: GroupedPage[],
): CanonicalLesson {
  const contentBlocks = [
    ...textbookPages.flatMap((page) => page.blocks.map((block) => contentBlockFromGroupedPage(page, block))),
    summaryBlock('vocab', vocabRange, 'Bessatsu Vocabulary List', 'Target vocabulary for Quartet Lesson 1 readings, with readings and English meanings.'),
    summaryBlock('kanji', kanjiRange, 'Bessatsu Kanji List', 'Lesson 1 kanji reference pages linked to the target vocabulary.'),
  ]
  const exercises = workbookPages.flatMap((page) => page.blocks.map((block) => exerciseFromGroupedPage(page, block)))

  return {
    id: `${options.textbookKey}_lesson_${options.lessonNumber}`,
    unitType: 'lesson',
    lessonNumber: options.lessonNumber,
    title: titleFromRange(textbookRange) ?? `Lesson ${options.lessonNumber}`,
    level: options.textbookKey === 'quartet_1' ? 'N3' : 'N2',
    pageRange: {
      start: textbookRange.start,
      end: textbookRange.end,
    },
    modes: ['reading', 'writing', 'speaking', 'listening', 'workbook'],
    vocabulary: extractDraftVocabulary(vocabPages),
    grammar: extractDraftGrammar(textbookPages, workbookPages),
    contentBlocks,
    exercises,
  }
}

function extractDraftVocabulary(vocabPages: GroupedPage[]): VocabEntry[] {
  const entries: VocabEntry[] = []
  const seen = new Set<string>()
  for (const page of vocabPages) {
    for (const block of page.blocks) {
      if (block.type !== 'table_row') continue
      const row = parseQuartetVocabRow(block.columns ?? [block.text])
      if (!row || seen.has(row.surface)) continue
      seen.add(row.surface)
      entries.push({
        id: `${options.textbookKey}_l${options.lessonNumber}_vocab_${entries.length + 1}`,
        surface: row.surface,
        reading: row.reading,
        meaning: row.meaning,
        lessonNumber: options.lessonNumber,
        sourceRef: sourceRef(page, block),
        tags: ['draft_bessatsu_parse'],
      })
    }
  }
  return entries
}

function parseQuartetVocabRow(rawColumns: string[]): { surface: string; reading?: string; meaning: string } | null {
  const columns = rawColumns.map(cleanCell).filter(Boolean)
  if (columns.length < 3) return null
  const joined = columns.join(' ')
  if (/Tango_|覚える単語|覚え単語|例文|第\s*\d+\s*課/i.test(joined)) return null
  if (columns.some((column) => /^(単語|読み|意味|漢行|新出|[0-9]{3,})$/i.test(column))) return null

  const meaningIndex = columns.findLastIndex((column) => /[A-Za-z]/.test(column))
  if (meaningIndex < 0) return null
  const meaning = cleanMeaning(columns.slice(meaningIndex).join(' '))
  if (!meaning || !/[A-Za-z]/.test(meaning)) return null

  const beforeMeaning = columns.slice(0, meaningIndex)
  const readingIndex = beforeMeaning.findLastIndex(hasJapaneseText)
  if (readingIndex < 0) return null
  const reading = beforeMeaning[readingIndex]
  const surface = cleanSurface(beforeMeaning.slice(0, readingIndex).findLast(hasJapaneseText) ?? '')
  if (!surface || surface.length > 28) return null
  if (!hasJapaneseText(surface)) return null

  return { surface, reading, meaning }
}

function extractDraftGrammar(textbookPages: GroupedPage[], workbookPages: GroupedPage[]): GrammarEntry[] {
  const specs = [
    ['~なら', 'Marks a topic or condition when giving advice, recommendations, or responses.'],
    ['~とおり(に)', 'Means “as; just as” and describes doing something according to a model, plan, or expectation.'],
    ['~らしい', 'Expresses hearsay or a typical quality.'],
    ['~ために', 'Expresses purpose: “in order to.”'],
    ['~ためのN', 'Expresses purpose/modification: “for.”'],
    ['~ようになる', 'Expresses a change into a new state or ability.'],
    ['~ようにする', 'Expresses making an effort or habit to do something.'],
    ['~によると', 'Introduces an information source: “according to.”'],
    ['~といえば', 'Introduces an associated topic: “speaking of.”'],
    ['~がきっかけで', 'Marks the trigger or impetus for a change/action.'],
    ['~のような', 'Means “like; such as.”'],
  ] as const

  const pages = [...textbookPages, ...workbookPages]
  const entries: GrammarEntry[] = []
  for (const [pattern, meaning] of specs) {
    const ref = findRefForPattern(pages, pattern)
    if (!ref) continue
    entries.push({
      id: `${options.textbookKey}_l${options.lessonNumber}_grammar_${entries.length + 1}`,
      pattern,
      meaning,
      examples: [],
      lessonNumber: options.lessonNumber,
      sourceRef: ref,
    })
  }
  return entries
}

function findRefForPattern(pages: GroupedPage[], pattern: string): SourceReference | null {
  const needle = normalizeSearch(pattern)
  for (const page of pages) {
    for (const block of page.blocks) {
      if (normalizeSearch(block.text).includes(needle)) return sourceRef(page, block)
    }
  }
  return null
}

function contentBlockFromGroupedPage(page: GroupedPage, block: GroupedPageBlock): ContentBlock {
  return {
    id: `${page.sourceId}_p${page.pageNumber}_${block.id}`,
    type: page.pageKind === 'dialogue' || block.type === 'dialogue_turn' ? 'dialogue' : block.type === 'table_row' ? 'table' : block.type === 'heading' ? 'instruction' : 'reading',
    mode: modeForTextbookPage(page.pageNumber),
    title: block.type === 'heading' ? block.text : undefined,
    text: block.type === 'heading' ? undefined : block.text,
    sourceRef: sourceRef(page, block),
  }
}

function summaryBlock(kind: 'vocab' | 'kanji', range: SourceRange, title: string, text: string): ContentBlock {
  return {
    id: `${options.textbookKey}_l${options.lessonNumber}_bessatsu_${kind}`,
    type: 'table',
    mode: 'reading',
    title,
    text,
    sourceRef: {
      sourceId: range.entry.id,
      pageNumber: range.start,
    },
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

function modeForTextbookPage(pageNumber: number): LessonMode {
  if (pageNumber >= 42 && pageNumber <= 43) return 'writing'
  if (pageNumber >= 44 && pageNumber <= 54) return 'speaking'
  if (pageNumber >= 55) return 'listening'
  return 'reading'
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

function findSource(textbookKey: TextbookKey, role: 'textbook' | 'workbook' | 'answer_key'): SourceManifestEntry {
  const source = manifest.entries.find((entry) => entry.textbookKey === textbookKey && entry.role === role)
  if (!source) throw new Error(`Missing ${textbookKey} ${role} in manifest`)
  return source
}

function lessonRange(entry: SourceManifestEntry, lessonNumber: number): SourceRange {
  const startHint = entry.splitHints
    .filter((hint) => hint.kind === 'lesson' && hint.lessonNumber === lessonNumber && hint.pageNumber !== null)
    .sort((a, b) => (a.pageNumber ?? 0) - (b.pageNumber ?? 0))[0]
  if (!startHint?.pageNumber) throw new Error(`Missing lesson ${lessonNumber} start for ${entry.id}`)

  const nextStart = entry.splitHints
    .filter((hint) => hint.kind === 'lesson' && hint.pageNumber !== null && hint.pageNumber > startHint.pageNumber! && (hint.lessonNumber ?? Number.POSITIVE_INFINITY) > lessonNumber)
    .sort((a, b) => (a.pageNumber ?? 0) - (b.pageNumber ?? 0))[0]?.pageNumber

  return { entry, start: startHint.pageNumber, end: nextStart ? nextStart - 1 : entry.pageCount }
}

function nestedSupplementLessonRange(entry: SourceManifestEntry, listKind: 'vocab' | 'kanji', lessonNumber: number): SourceRange {
  const parent = entry.splitHints
    .filter((hint) => hint.kind === listKind && hint.pageNumber !== null)
    .sort((a, b) => (a.pageNumber ?? 0) - (b.pageNumber ?? 0))[0]
  if (!parent?.pageNumber) throw new Error(`Missing ${listKind} section for ${entry.id}`)

  const lessonHints = entry.splitHints
    .filter((hint) => hint.kind === 'lesson' && hint.lessonNumber === lessonNumber && hint.pageNumber !== null && hint.pageNumber > parent.pageNumber!)
    .sort((a, b) => (a.pageNumber ?? 0) - (b.pageNumber ?? 0))
  const startHint = lessonHints[0]
  if (!startHint?.pageNumber) throw new Error(`Missing ${listKind} lesson ${lessonNumber} start for ${entry.id}`)

  const nextStart = entry.splitHints
    .filter((hint) => hint.kind === 'lesson' && hint.pageNumber !== null && hint.pageNumber > startHint.pageNumber! && (hint.lessonNumber ?? Number.POSITIVE_INFINITY) > lessonNumber)
    .sort((a, b) => (a.pageNumber ?? 0) - (b.pageNumber ?? 0))[0]?.pageNumber

  return { entry, start: startHint.pageNumber, end: nextStart ? nextStart - 1 : entry.pageCount }
}

function titleFromRange(range: SourceRange): string | null {
  const hint = range.entry.splitHints.find((candidate) => candidate.pageNumber === range.start && candidate.kind === 'lesson' && candidate.lessonNumber === options.lessonNumber)
  return hint?.label ?? null
}

function missingPages(range: SourceRange, pages: GroupedPage[]): number[] {
  const present = new Set(pages.map((page) => page.pageNumber))
  const missing: number[] = []
  for (let page = range.start; page <= range.end; page += 1) {
    if (!present.has(page)) missing.push(page)
  }
  return missing
}

function cleanCell(value: string): string {
  return value.replace(/[＊*□√△■！↓→]/g, '').replace(/\s+/g, ' ').trim()
}

function cleanSurface(value: string): string {
  return cleanCell(value).replace(/^[0-9.、・\s]+/, '').trim()
}

function cleanMeaning(value: string): string {
  return value.replace(/\s+/g, ' ').replace(/^[-:;,\s]+|[-:;,\s]+$/g, '').trim()
}

function hasJapaneseText(value: string): boolean {
  return /[ぁ-んァ-ン一-龯々]/.test(value)
}

function normalizeSearch(value: string): string {
  return value.toLowerCase().replace(/\s+/g, '').replace(/[・·•]/g, '')
}

function parseArgs(rawArgs: string[]): CliOptions {
  const options: CliOptions = {
    textbookKey: 'quartet_1',
    lessonNumber: 1,
    manifestPath: 'tools/textbook-pack/out/source-manifest.json',
    groupedRoot: 'tools/textbook-pack/out/grouped',
    outFile: null,
  }

  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index]
    if (arg === '--textbook-key') options.textbookKey = rawArgs[++index] as CliOptions['textbookKey']
    if (arg === '--lesson') options.lessonNumber = Number(rawArgs[++index] ?? options.lessonNumber)
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
