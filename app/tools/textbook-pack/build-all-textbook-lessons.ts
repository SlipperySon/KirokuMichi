import { mkdir, readFile, writeFile } from 'node:fs/promises'
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

interface BuildConfig {
  textbookKey: TextbookKey
  manifestPath: string
  groupedRoot: string
  outDir: string
  verbose?: boolean
}

// Global config (set by parseArgs)
let config: BuildConfig

const MANIFEST_PATH = 'app/tools/textbook-pack/out/source-manifest.json'
const GROUPED_ROOT = 'app/tools/textbook-pack/out/grouped'
const OUT_DIR = 'app/tools/textbook-pack/out/canonical-proofs'

async function main() {
  config = {
    textbookKey: (process.argv[2] || 'genki_1') as TextbookKey,
    manifestPath: MANIFEST_PATH,
    groupedRoot: GROUPED_ROOT,
    outDir: OUT_DIR,
    verbose: process.argv.includes('-v') || process.argv.includes('--verbose'),
  }

  const manifest = await readJson<TextbookSourceManifest>(resolveAppPath(config.manifestPath))
  const textbook = findSource(manifest, config.textbookKey, 'textbook')
  const workbook = findSource(manifest, config.textbookKey, 'workbook')

  const lessons: CanonicalLesson[] = []
  const lessonSpecs = getTextbookLessonSpec(config.textbookKey)

  console.log(`\n📖 Building ${config.textbookKey} lesson packs...`)
  console.log(`   Structure: ${lessonSpecs.type} (${lessonSpecs.count} units)`)

  // Build lessons based on textbook type
  for (const spec of lessonSpecs.specs) {
    const range =
      spec.type === 'pre_lesson'
        ? preLessonRange(textbook, spec.slug || '')
        : lessonRange(textbook, spec.lessonNumber || 0)

    const workbookRange =
      spec.type === 'pre_lesson'
        ? preLessonRange(workbook, spec.slug || '')
        : lessonRange(workbook, spec.lessonNumber || 0)

    const textbookPages = await readGroupedPages(range)
    const workbookPages = await readGroupedPages(workbookRange)

    const lesson = buildLesson(
      spec.type === 'pre_lesson' ? 'pre_lesson' : 'lesson',
      spec.lessonNumber || 0,
      range,
      workbookRange,
      textbookPages,
      workbookPages,
      spec.slug
    )

    if (lesson) {
      lessons.push(lesson)
      console.log(`  ✓ ${lesson.id}`)
    }
  }

  // Create pack
  const pack: CanonicalTextbookPack = {
    schemaVersion: 1,
    textbookKey: config.textbookKey,
    title: getTextbookTitle(config.textbookKey),
    edition: '3rd Edition',
    levelRange: getLevelRange(config.textbookKey),
    sources: [textbook, workbook].map((src) => ({
      sourceId: src.id,
      role: src.role,
      fingerprint: src.fingerprint,
    })),
    lessons,
  }

  // Write output
  const outPath = resolveAppPath(path.join(config.outDir, `${config.textbookKey}_all_lessons.json`))
  await mkdir(path.dirname(outPath), { recursive: true })
  await writeFile(outPath, JSON.stringify(pack, null, 2))

  console.log(`\n✓ Generated ${lessons.length} lessons`)
  console.log(`  Output: ${path.relative(process.cwd(), outPath)}`)
}

// ===== TEXTBOOK SPECS =====

interface LessonSpec {
  type: 'pre_lesson' | 'lesson'
  lessonNumber?: number
  slug?: string
}

interface TextbookSpec {
  type: string
  count: number
  specs: LessonSpec[]
}

function getTextbookLessonSpec(key: TextbookKey): TextbookSpec {
  switch (key) {
    case 'genki_1':
    case 'genki_2':
      return {
        type: 'Numbered Lessons (Genki)',
        count: key === 'genki_1' ? 14 : 13, // Genki I: 2 pre + 12 lessons, Genki II: 11 lessons (13-23) with no pre-lessons
        specs: [
          ...(key === 'genki_1' ? [
            { type: 'pre_lesson' as const, slug: 'greetings' },
            { type: 'pre_lesson' as const, slug: 'numbers' },
          ] : []),
          ...Array.from({ length: key === 'genki_1' ? 12 : 11 }, (_, i) => ({
            type: 'lesson' as const,
            lessonNumber: key === 'genki_1' ? i + 1 : i + 13,
          })),
        ],
      }

    case 'marugoto_a1':
    case 'marugoto_a2':
      // Marugoto has a different structure - it's organized by units, not numbered lessons
      // For now, treat as a single unit (can be split later based on content)
      return {
        type: 'Marugoto Unit (single pack)',
        count: 1,
        specs: [{ type: 'lesson' as const, lessonNumber: 1 }],
      }

    case 'quartet_1':
    case 'quartet_2':
      return {
        type: 'Quartet Lessons (4-skill structure)',
        count: 6,
        specs: Array.from({ length: 6 }, (_, i) => ({
          type: 'lesson' as const,
          lessonNumber: key === 'quartet_1' ? i + 1 : i + 7,
        })),
      }

    default:
      throw new Error(`Unknown textbook: ${key}`)
  }
}

function getTextbookTitle(key: TextbookKey): string {
  const titles: Record<TextbookKey, string> = {
    genki_1: 'Genki I: An Integrated Course in Elementary Japanese',
    genki_2: 'Genki II: An Integrated Course in Elementary Japanese',
    marugoto_a1: 'Marugoto A1: Katsudoo (Starter)',
    marugoto_a2: 'Marugoto A2: Katsudoo (Elementary 2)',
    quartet_1: 'Quartet I: Japanese Course',
    quartet_2: 'Quartet II: Japanese Course',
    tobira: 'Tobira: Gateway to Advanced Japanese',
    maynard_grammar: 'Maynard Grammar Reference',
  }
  return titles[key] || 'Unknown Textbook'
}

function getLevelRange(key: TextbookKey): string {
  const ranges: Record<TextbookKey, string> = {
    genki_1: 'N5-N4',
    genki_2: 'N4',
    marugoto_a1: 'A1',
    marugoto_a2: 'A2',
    quartet_1: 'N3',
    quartet_2: 'N2',
    tobira: 'B2',
    maynard_grammar: 'A1-B2',
  }
  return ranges[key] || 'Unknown'
}

// ===== LESSON BUILDING =====

function buildLesson(
  unitType: 'pre_lesson' | 'lesson',
  lessonNumber: number,
  textbookRange: SourceRange,
  workbookRange: SourceRange,
  textbookPages: GroupedPage[],
  workbookPages: GroupedPage[],
  slug?: string
): CanonicalLesson | null {
  if (textbookPages.length === 0) {
    if (config.verbose) console.warn(`⚠ No textbook pages for ${slug || lessonNumber}`)
    return null
  }

  const contentBlocks = textbookPages.flatMap((page) =>
    page.blocks.map((block) => contentBlockFromGroupedPage(page, block))
  )
  const exercises = workbookPages.flatMap((page) =>
    page.blocks.map((block) => exerciseFromGroupedPage(page, block))
  )
  const vocabulary = extractDraftVocabulary(lessonNumber, textbookPages)
  const grammar = extractDraftGrammar(lessonNumber, textbookPages)

  const id =
    unitType === 'pre_lesson' ? `${config.textbookKey}_pre_${slug}` : `${config.textbookKey}_lesson_${lessonNumber}`

  return {
    id,
    unitType,
    lessonNumber: unitType === 'pre_lesson' ? 0 : lessonNumber,
    title: textbookRange.label,
    level: getLevelRange(config.textbookKey),
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
    if (!block.text || block.text.length < 2) continue
    seen.add(block.text)
    entries.push({
      id: `${config.textbookKey}_l${lessonNumber}_vocab_${entries.length + 1}`,
      surface: block.text.substring(0, 20),
      meaning: 'extracted from table',
      lessonNumber,
      sourceRef: sourceRef(page, block),
      tags: ['draft_table_parse'],
    })
  }
  return entries
}

function extractDraftGrammar(lessonNumber: number, textbookPages: GroupedPage[]): GrammarEntry[] {
  const entries: GrammarEntry[] = []
  const grammarBlocks = textbookPages.filter((page) => page.pageKind === 'grammar')
  if (grammarBlocks.length === 0) return entries

  for (const page of grammarBlocks.slice(0, 1)) {
    const blocks = page.blocks.filter((b) => b.type === 'instruction' || b.type === 'heading')
    for (const block of blocks) {
      if (block.text && block.text.length > 5) {
        entries.push({
          id: `${config.textbookKey}_l${lessonNumber}_grammar_${entries.length + 1}`,
          pattern: block.text.substring(0, 50),
          meaning: `${config.textbookKey} grammar pattern`,
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

// ===== HELPERS =====

function contentBlockFromGroupedPage(page: GroupedPage, block: GroupedPageBlock): ContentBlock {
  return {
    id: `${page.sourceId}_p${page.pageNumber}_${block.id}`,
    type:
      page.pageKind === 'dialogue' || block.type === 'dialogue_turn'
        ? 'dialogue'
        : block.type === 'table_row'
          ? 'table'
          : 'instruction',
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
  const dir = resolveAppPath(path.join(config.groupedRoot, range.entry.id, 'pages'))
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

function findSource(manifest: TextbookSourceManifest, key: TextbookKey, role: 'textbook' | 'workbook'): SourceManifestEntry {
  const source = manifest.entries.find((entry) => entry.textbookKey === key && entry.role === role)
  if (!source) throw new Error(`Missing ${key} ${role} in manifest`)
  return source
}

function lessonRange(entry: SourceManifestEntry, lessonNumber: number): SourceRange {
  const hints = entry.splitHints.filter(
    (hint) => hint.kind === 'lesson' && hint.lessonNumber === lessonNumber && hint.pageNumber !== null
  )
  const start = hints[0]?.pageNumber
  if (!start) throw new Error(`Missing lesson ${lessonNumber} for ${entry.id}`)

  const nextHint = entry.splitHints
    .filter((h) => h.pageNumber && h.pageNumber > start)
    .sort((a, b) => (a.pageNumber ?? 0) - (b.pageNumber ?? 0))[0]

  return {
    entry,
    start,
    end: nextHint?.pageNumber ? nextHint.pageNumber - 1 : entry.pageCount,
    label: hints[0]?.label || `Lesson ${lessonNumber}`,
  }
}

function preLessonRange(entry: SourceManifestEntry, slug: string): SourceRange {
  const hint = entry.splitHints.find((h) => h.kind === 'pre_lesson' && h.label?.toLowerCase().includes(slug) && h.pageNumber)
  if (!hint?.pageNumber) throw new Error(`Missing pre-lesson ${slug}`)

  const next = entry.splitHints
    .filter((h) => h.pageNumber && h.pageNumber > hint.pageNumber)
    .sort((a, b) => (a.pageNumber ?? 0) - (b.pageNumber ?? 0))[0]

  return {
    entry,
    start: hint.pageNumber,
    end: next?.pageNumber ? next.pageNumber - 1 : entry.pageCount,
    label: hint.label || slug,
    slug,
  }
}

function resolveAppPath(filePath: string): string {
  if (filePath.startsWith('/')) return filePath
  return path.resolve(process.cwd(), filePath)
}

async function readJson<T>(filePath: string): Promise<T> {
  const content = await readFile(filePath, 'utf-8')
  return JSON.parse(content)
}

async function readdir(dirPath: string): Promise<string[]> {
  const { readdir: readdirAsync } = await import('node:fs/promises')
  return readdirAsync(dirPath)
}

main().catch(console.error)
