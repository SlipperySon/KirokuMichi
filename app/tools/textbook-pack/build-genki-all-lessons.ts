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

interface SourceRange {
  entry: SourceManifestEntry
  start: number
  end: number
  label: string
  slug?: string
}

// ===== CONFIG =====

const TEXTBOOK_KEY = 'genki_1'
const MANIFEST_PATH = 'app/tools/textbook-pack/out/source-manifest.json'
const GROUPED_ROOT = 'app/tools/textbook-pack/out/grouped'
const OUT_FILE = 'app/tools/textbook-pack/out/canonical-proofs/genki_1_all_lessons.json'

// Shared helpers from the single-lesson builder

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

// ===== MAIN FLOW =====

const manifest = await readJson<TextbookSourceManifest>(resolveAppPath(MANIFEST_PATH))
const textbook = findSource('textbook')
const workbook = findSource('workbook')
const answerKey = findGenkiAnswerKey()

// Build lessons: pre-lessons (greetings, numbers) then lessons 1-12
const lessons: CanonicalLesson[] = []

// Pre-lessons
for (const preSlug of ['greetings', 'numbers']) {
  const range = preLessonRange(textbook, preSlug)
  const workbookRange = preLessonRange(workbook, preSlug)
  const textbookPages = await readGroupedPages(range)
  const workbookPages = await readGroupedPages(workbookRange)
  const lesson = buildLesson(range, workbookRange, textbookPages, workbookPages, 'pre_lesson', 0, preSlug)
  if (lesson) lessons.push(lesson)
}

// Lessons 1-12
for (let lessonNum = 1; lessonNum <= 12; lessonNum += 1) {
  const range = lessonRange(textbook, lessonNum)
  const workbookRange = lessonRange(workbook, lessonNum)
  const textbookPages = await readGroupedPages(range)
  const workbookPages = await readGroupedPages(workbookRange)
  const lesson = buildLesson(range, workbookRange, textbookPages, workbookPages, 'lesson', lessonNum)
  if (lesson) lessons.push(lesson)
}

const pack: CanonicalTextbookPack = {
  schemaVersion: 1,
  textbookKey: TEXTBOOK_KEY,
  title: 'Genki I: An Integrated Course in Elementary Japanese',
  edition: '3rd Edition',
  levelRange: 'N5-N4',
  sources: [
    { sourceId: textbook.id, role: textbook.role, fingerprint: textbook.fingerprint },
    { sourceId: workbook.id, role: workbook.role, fingerprint: workbook.fingerprint },
    { sourceId: answerKey.id, role: answerKey.role, fingerprint: answerKey.fingerprint },
  ],
  lessons,
}

const outPath = resolveAppPath(OUT_FILE)
await mkdir(path.dirname(outPath), { recursive: true })
await writeFile(outPath, JSON.stringify(pack, null, 2))

console.log(`✓ wrote ${path.relative(process.cwd(), outPath)}`)
console.log(
  JSON.stringify(
    {
      textbookKey: TEXTBOOK_KEY,
      lessonsGenerated: lessons.length,
      lessons: lessons.map((l) => ({
        id: l.id,
        title: l.title,
        pageRange: l.pageRange,
        contentBlocks: l.contentBlocks.length,
        exercises: l.exercises.length,
        vocab: l.vocabulary.length,
        grammar: l.grammar.length,
      })),
      totalContentBlocks: lessons.reduce((sum, l) => sum + l.contentBlocks.length, 0),
      totalExercises: lessons.reduce((sum, l) => sum + l.exercises.length, 0),
    },
    null,
    2,
  ),
)

// ===== BUILDER FUNCTIONS =====

function buildLesson(
  textbookRange: SourceRange,
  workbookRange: SourceRange,
  textbookPages: GroupedPage[],
  workbookPages: GroupedPage[],
  unitType: 'pre_lesson' | 'lesson',
  lessonNumber: number,
  slug?: string,
): CanonicalLesson | null {
  if (textbookPages.length === 0) {
    console.warn(`Skipping ${unitType} ${slug ?? lessonNumber}: no textbook pages found`)
    return null
  }

  const contentBlocks = textbookPages.flatMap((page) => page.blocks.map((block) => contentBlockFromGroupedPage(page, block)))
  const exercises = workbookPages.flatMap((page) => page.blocks.map((block) => exerciseFromGroupedPage(page, block)))
  const vocabulary = extractDraftVocabulary(lessonNumber, textbookPages)
  const grammar = extractDraftGrammar(lessonNumber, textbookPages, textbookRange)

  const id =
    unitType === 'pre_lesson' ? `${TEXTBOOK_KEY}_pre_${slug}` : `${TEXTBOOK_KEY}_lesson_${lessonNumber}`

  return {
    id,
    unitType,
    lessonNumber: unitType === 'pre_lesson' ? 0 : lessonNumber,
    title: textbookRange.label,
    level: 'N5-N4',
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

function extractDraftVocabulary(lessonNumber: number, textbookPages: GroupedPage[]): VocabEntry[] {
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
      id: `${TEXTBOOK_KEY}_l${lessonNumber}_vocab_${entries.length + 1}`,
      surface: row.surface,
      reading: row.reading,
      meaning: row.meaning,
      lessonNumber,
      sourceRef: sourceRef(page, block),
      tags: ['draft_table_parse'],
    })
  }
  return entries
}

function extractDraftGrammar(lessonNumber: number, textbookPages: GroupedPage[], textbookRange: SourceRange): GrammarEntry[] {
  // For now, extract only basic grammar patterns for lessons with direct OCR hints
  // Full grammar extraction would require more sophisticated pattern matching
  const entries: GrammarEntry[] = []

  // Try to find grammar blocks in the textbook pages
  const grammarBlocks = textbookPages.filter((page) => page.pageKind === 'grammar')
  if (grammarBlocks.length === 0) return entries

  // Simple heuristic: extract the first grammar block per lesson as a placeholder
  for (const page of grammarBlocks.slice(0, 1)) {
    const blocks = page.blocks.filter((b) => b.type === 'instruction' || b.type === 'heading')
    for (const block of blocks) {
      if (block.text && block.text.length > 5) {
        entries.push({
          id: `${TEXTBOOK_KEY}_l${lessonNumber}_grammar_${entries.length + 1}`,
          pattern: block.text.substring(0, 50),
          meaning: `Lesson ${lessonNumber} grammar pattern`,
          examples: [],
          lessonNumber,
          sourceRef: sourceRef(page, block),
          tags: ['placeholder_extraction'],
        })
        break
      }
    }
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

// ===== HELPER FUNCTIONS =====

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
    label: `${page.section?.label ?? 'Workbook'} p.${page.pageNumber} ${block.id}`,
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
  const dir = resolveAppPath(path.join(GROUPED_ROOT, range.entry.id, 'pages'))
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

function findSource(role: 'textbook' | 'workbook'): SourceManifestEntry {
  const source = manifest.entries.find((entry) => entry.textbookKey === TEXTBOOK_KEY && entry.role === role)
  if (!source) throw new Error(`Missing ${TEXTBOOK_KEY} ${role} in manifest`)
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

  const nextStart = [nextLesson?.pageNumber, nextSection?.pageNumber]
    .filter((value): value is number => typeof value === 'number')
    .sort((a, b) => a - b)[0]

  const label = startHint.label ?? `Lesson ${lessonNumber}`

  return {
    entry,
    start: startHint.pageNumber,
    end: nextStart ? nextStart - 1 : entry.pageCount,
    label,
  }
}

function preLessonRange(entry: SourceManifestEntry, slug: string): SourceRange {
  const startHint = entry.splitHints.find((hint) => hint.kind === 'pre_lesson' && slugFromLabel(hint.label) === slug && hint.pageNumber !== null)
  if (!startHint?.pageNumber) throw new Error(`Missing pre-lesson ${slug} start for ${entry.id}`)

  const nextStart = entry.splitHints
    .filter((hint) => hint.pageNumber !== null && hint.pageNumber > startHint.pageNumber!)
    .sort((a, b) => (a.pageNumber ?? 0) - (b.pageNumber ?? 0))[0]?.pageNumber

  const label = startHint.label ?? slug

  return {
    entry,
    start: startHint.pageNumber,
    end: nextStart ? nextStart - 1 : entry.pageCount,
    label,
    slug,
  }
}

function slugFromLabel(label: string): string {
  const normalized = label.toLowerCase()
  if (normalized.includes('greetings') || normalized.includes('あいさつ')) return 'greetings'
  if (normalized.includes('numbers') || normalized.includes('すうじ')) return 'numbers'
  if (normalized.includes('hiragana')) return 'hiragana'
  if (normalized.includes('katakana')) return 'katakana'
  return normalized.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}

function cleanCell(value: string): string {
  return value.replace(/[＊*]/g, '*').replace(/[|｜]/g, '').replace(/\s+/g, ' ').trim()
}

function cleanSurface(value: string): string {
  return cleanCell(value).replace(/^[*＊\s]+/, '').replace(/[()[\]{}]/g, '').trim()
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

// ===== UTILITY FUNCTIONS =====

function resolveAppPath(filePath: string): string {
  if (filePath.startsWith('/')) return filePath
  // Resolve relative to the project root (cwd)
  return path.resolve(process.cwd(), filePath)
}

async function readJson<T>(filePath: string): Promise<T> {
  const content = await readFile(filePath, 'utf-8')
  return JSON.parse(content)
}
