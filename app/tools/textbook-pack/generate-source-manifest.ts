import { createHash } from 'node:crypto'
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import type {
  CefrPhase,
  CurriculumRole,
  SourceManifestEntry,
  SourceOutlineEntry,
  SourceRole,
  SourceSplitHint,
  TextbookKey,
  TextbookSourceManifest,
} from './schema.ts'

type PdfDocument = Awaited<ReturnType<typeof pdfjs.getDocument>['promise']>

interface Classification {
  textbookKey: TextbookKey | null
  role: SourceRole
  confidence: SourceManifestEntry['confidence']
  notes: string[]
}

interface CliOptions {
  sourceRoot: string
  outFile: string
}

const args = parseArgs(process.argv.slice(2))
const sourceRoot = path.resolve(args.sourceRoot)
const outFile = path.resolve(args.outFile)

const entries = await buildEntries(sourceRoot)
const manifest: TextbookSourceManifest = {
  generatedAt: new Date().toISOString(),
  sourceRoot: path.relative(process.cwd(), sourceRoot) || '.',
  entries,
  gaps: detectGaps(entries),
}

await mkdir(path.dirname(outFile), { recursive: true })
await writeFile(outFile, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')

console.log(`Wrote ${path.relative(process.cwd(), outFile)}`)
for (const entry of entries) {
  const label = [entry.id, `${entry.pageCount}p`, entry.confidence].join(' · ')
  console.log(label)
}
if (manifest.gaps.length > 0) {
  console.log('\nGaps/ambiguous sources:')
  for (const gap of manifest.gaps) console.log(`- ${gap}`)
}

function parseArgs(rawArgs: string[]): CliOptions {
  const options: CliOptions = {
    sourceRoot: '../test-fixtures',
    outFile: 'tools/textbook-pack/out/source-manifest.json',
  }

  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index]
    if (arg === '--source') options.sourceRoot = rawArgs[++index] ?? options.sourceRoot
    if (arg === '--out') options.outFile = rawArgs[++index] ?? options.outFile
  }

  return options
}

async function buildEntries(root: string): Promise<SourceManifestEntry[]> {
  const fileNames = (await readdir(root))
    .filter((fileName) => fileName.toLowerCase().endsWith('.pdf'))
    .sort((a, b) => a.localeCompare(b, 'ja'))

  const usedIds = new Map<string, number>()
  const entries: SourceManifestEntry[] = []

  for (const fileName of fileNames) {
    const absolutePath = path.join(root, fileName)
    const fileStat = await stat(absolutePath)
    const data = await readFile(absolutePath)
    const fingerprint = {
      sha256: createHash('sha256').update(data).digest('hex'),
      bytes: fileStat.size,
    }

    const { document, outline, pageCount, loadError } = await loadPdfMetadata(data)
    const classification = classifySource(fileName, pageCount, outline, fingerprint.sha256)
    if (loadError) {
      classification.notes.push(`PDF metadata load failed: ${loadError}`)
      if (classification.confidence === 'high') classification.confidence = 'medium'
    }
    const baseId = buildSourceId(classification, fingerprint.sha256)
    const id = uniqueId(baseId, usedIds)

    const splitHints = addKnownSplitHints(classification, extractSplitHints(outline))

    entries.push({
      id,
      fileName,
      relativePath: path.relative(process.cwd(), absolutePath),
      textbookKey: classification.textbookKey,
      curriculumRole: curriculumRoleFor(classification.textbookKey),
      cefrPhase: cefrPhaseFor(classification.textbookKey),
      role: classification.role,
      confidence: classification.confidence,
      pageCount,
      sizeMb: Number((fileStat.size / 1024 / 1024).toFixed(1)),
      fingerprint,
      outline,
      splitHints,
      notes: classification.notes,
    })

    await document?.destroy()
  }

  return entries
}

async function loadPdfMetadata(data: Buffer): Promise<{
  document: PdfDocument | null
  outline: SourceOutlineEntry[]
  pageCount: number
  loadError: string | null
}> {
  try {
    const pdfData = new Uint8Array(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength))
    const document = await pdfjs.getDocument({
      data: pdfData,
      disableFontFace: true,
      isEvalSupported: false,
      useWorkerFetch: false,
    } as object).promise

    return {
      document,
      outline: await readOutline(document),
      pageCount: document.numPages,
      loadError: null,
    }
  } catch (error) {
    return {
      document: null,
      outline: [],
      pageCount: 0,
      loadError: error instanceof Error ? error.message : String(error),
    }
  }
}

function addKnownSplitHints(classification: Classification, hints: SourceSplitHint[]): SourceSplitHint[] {
  const extended = [...hints]

  if (classification.textbookKey === 'genki_1' && classification.role === 'textbook') {
    extended.push(
      {
        kind: 'pre_lesson',
        label: 'あいさつ　Greetings',
        pageNumber: 39,
      },
      {
        kind: 'pre_lesson',
        label: 'すうじ　Numbers',
        pageNumber: 44,
      },
    )
  }

  if (classification.textbookKey === 'genki_1' && classification.role === 'workbook') {
    extended.push(
      {
        kind: 'pre_lesson',
        label: 'Japanese Writing System-1　Hiragana',
        pageNumber: 15,
      },
      {
        kind: 'pre_lesson',
        label: 'あいさつ　Greetings',
        pageNumber: 17,
      },
      {
        kind: 'pre_lesson',
        label: 'すうじ　Numbers',
        pageNumber: 19,
      },
      {
        kind: 'pre_lesson',
        label: 'Japanese Writing System-2　Katakana',
        pageNumber: 27,
      },
    )
  }

  return extended.sort((a, b) => (a.pageNumber ?? Number.POSITIVE_INFINITY) - (b.pageNumber ?? Number.POSITIVE_INFINITY))
}

async function readOutline(document: PdfDocument): Promise<SourceOutlineEntry[]> {
  const outline = (await document.getOutline()) ?? []
  const entries: SourceOutlineEntry[] = []

  async function visit(items: Awaited<ReturnType<PdfDocument['getOutline']>>, depth: number): Promise<void> {
    for (const item of items ?? []) {
      entries.push({
        title: item.title,
        pageNumber: await resolvePageNumber(document, item.dest),
        depth,
      })
      await visit(item.items, depth + 1)
    }
  }

  await visit(outline, 0)
  return entries
}

async function resolvePageNumber(document: PdfDocument, dest: unknown): Promise<number | null> {
  if (!dest) return null

  try {
    const destination = typeof dest === 'string' ? await document.getDestination(dest) : dest
    if (!Array.isArray(destination) || destination.length === 0) return null
    const pageRef = destination[0]
    if (typeof pageRef === 'number') return pageRef + 1
    return (await document.getPageIndex(pageRef)) + 1
  } catch {
    return null
  }
}

function classifySource(fileName: string, pageCount: number, outline: SourceOutlineEntry[], sha256: string): Classification {
  const override = classifyKnownFingerprint(sha256)
  if (override) return override

  const text = `${fileName} ${outline.map((entry) => entry.title).join(' ')}`
  const file = normalize(fileName)
  const normalized = normalize(text)
  const notes: string[] = []

  if (normalized.includes('genki') || normalized.includes('げんき')) {
    if (file.includes('解答')) {
      return { textbookKey: null, role: 'answer_key', confidence: 'high', notes: ['Combined Genki I/II answer key.'] }
    }

    const isWorkbook = file.includes('workbook') || file.includes('ワークブック')
    const isGenki2 = file.includes(' genki, 2') || file.includes('genki 2') || normalized.includes('第13課')
    const isGenki1 = file.includes(' genki, 1') || file.includes('genki 1') || normalized.includes('第1課')

    if (isGenki2 && isWorkbook) return { textbookKey: 'genki_2', role: 'workbook', confidence: 'high', notes }
    if (isGenki2 && pageCount < 220) {
      notes.push('Filename/outline suggests Genki II, but the short page count means this should be manually verified.')
      return { textbookKey: 'genki_2', role: 'support', confidence: 'low', notes }
    }
    if (isGenki2) return { textbookKey: 'genki_2', role: 'textbook', confidence: 'high', notes }
    if (isGenki1 && isWorkbook) return { textbookKey: 'genki_1', role: 'workbook', confidence: 'high', notes }
    if (isGenki1) return { textbookKey: 'genki_1', role: 'textbook', confidence: 'high', notes }

    notes.push('Genki source detected, but volume/role was not clear.')
    return { textbookKey: null, role: isWorkbook ? 'workbook' : 'unknown', confidence: 'low', notes }
  }

  if (normalized.includes('quartet') || normalized.includes('カルテット')) {
    const isWorkbook = file.includes('workbook') || file.includes('ワークブック')
    const isAnswer = file.includes('解答')
    const isQuartet2 = file.includes('quartet ii') || file.includes('カルテット ii') || normalized.includes('第7課')
    const isQuartet1 = !isQuartet2 && (file.includes('quartet i') || file.includes('カルテット i') || normalized.includes('第1課'))

    if (isQuartet2 && isAnswer) return { textbookKey: 'quartet_2', role: 'answer_key', confidence: 'high', notes: ['Workbook answer key.'] }
    if (isQuartet1 && isAnswer) return { textbookKey: 'quartet_1', role: 'answer_key', confidence: 'high', notes: ['Workbook answer key.'] }
    if (isQuartet2 && isWorkbook) return { textbookKey: 'quartet_2', role: 'workbook', confidence: 'high', notes }
    if (isQuartet1 && isWorkbook) return { textbookKey: 'quartet_1', role: 'workbook', confidence: 'high', notes }
    if (isQuartet2 && pageCount > 250) return { textbookKey: 'quartet_2', role: 'textbook', confidence: 'high', notes: ['Textbook appears to include embedded Bessatsu/supplement sections.'] }
    if (isQuartet1 && pageCount > 250) return { textbookKey: 'quartet_1', role: 'textbook', confidence: 'high', notes: ['Textbook appears to include embedded Bessatsu/supplement sections.'] }
    if (pageCount < 130) {
      notes.push('Quartet source detected, but filename/outline does not clearly identify whether this is an answer key or supplement.')
      return { textbookKey: null, role: 'support', confidence: 'low', notes }
    }

    notes.push('Quartet source detected, but volume/role was not clear.')
    return { textbookKey: null, role: 'unknown', confidence: 'low', notes }
  }

  if (normalized.includes('marugoto') || normalized.includes('まるごと')) {
    if (normalized.includes('a1') || normalized.includes('starter') || normalized.includes('introduction')) {
      return {
        textbookKey: 'marugoto_a1',
        role: 'textbook',
        confidence: 'high',
        notes: ['Pair/practical practice source for A1 Breakthrough.'],
      }
    }
    if (normalized.includes('a2') || normalized.includes('elementary 2')) {
      return {
        textbookKey: 'marugoto_a2',
        role: 'textbook',
        confidence: 'high',
        notes: ['Pair/practical practice source for A2 Elementary.'],
      }
    }
    if (normalized.includes('b1') || normalized.includes('intermediate1') || normalized.includes('intermediate 1') || normalized.includes('中級')) {
      return {
        textbookKey: 'marugoto_b1',
        role: 'textbook',
        confidence: 'high',
        notes: ['Pair/practical practice source for B1 Threshold.'],
      }
    }

    notes.push('Marugoto source detected, but CEFR level was not clear.')
    return { textbookKey: null, role: 'textbook', confidence: 'low', notes }
  }

  if (normalized.includes('tobira') || normalized.includes('gateway to advanced japanese')) {
    return {
      textbookKey: 'tobira',
      role: 'textbook',
      confidence: 'high',
      notes: ['Pair/reading practice source for B2 Independent.'],
    }
  }

  if (normalized.includes('introduction to japanese') || normalized.includes('syntax, grammar') || (normalized.includes('language') && normalized.includes('grammar'))) {
    return {
      textbookKey: 'maynard_grammar',
      role: 'grammar_reference',
      confidence: 'medium',
      notes: [
        'In-depth grammar preset source for broad grammar explanation support. User identified the author/source as the Yanard/Maynard grammar explanation layer.',
      ],
    }
  }

  return { textbookKey: null, role: 'unknown', confidence: 'low', notes: ['No known textbook family detected.'] }
}

function classifyKnownFingerprint(sha256: string): Classification | null {
  if (sha256.startsWith('6e87e3cc853217c6')) {
    return {
      textbookKey: 'quartet_2',
      role: 'answer_key',
      confidence: 'high',
      notes: ['Manual classification: cover text says WORKBOOK ANSWERS and sampled pages begin at Quartet Lesson 7.'],
    }
  }

  if (sha256.startsWith('35847dc441c4f185')) {
    return {
      textbookKey: 'genki_2',
      role: 'workbook',
      confidence: 'medium',
      notes: ['Manual classification: outline covers Genki II Lessons 13-23 with workbook-like page count, but filename lacks a workbook marker.'],
    }
  }

  return null
}

function extractSplitHints(outline: SourceOutlineEntry[]): SourceSplitHint[] {
  const hints: SourceSplitHint[] = []

  for (const entry of outline) {
    const title = entry.title.trim()
    const lessonNumber = parseLessonNumber(title)

    if (lessonNumber !== null) {
      hints.push({ kind: 'lesson', label: title, pageNumber: entry.pageNumber, lessonNumber })
    }
    if (title.includes('別冊') || title.toLowerCase().includes('bessatsu')) {
      hints.push({ kind: 'supplement', label: title, pageNumber: entry.pageNumber })
    }
    if (title.includes('単語リスト') || title.toLowerCase().includes('vocabulary')) {
      hints.push({ kind: 'vocab', label: title, pageNumber: entry.pageNumber })
    }
    if (title.includes('漢字リスト') || title.toLowerCase().includes('kanji')) {
      hints.push({ kind: 'kanji', label: title, pageNumber: entry.pageNumber })
    }
    if (title.includes('読み書き編') || title.toLowerCase().includes('reading and writing')) {
      hints.push({ kind: 'reading_writing', label: title, pageNumber: entry.pageNumber })
    }
    if (title.includes('解答') || title.toLowerCase().includes('answer')) {
      hints.push({ kind: 'answer_section', label: title, pageNumber: entry.pageNumber })
    }
    if (title.includes('スクリプト') || title.toLowerCase().includes('script')) {
      hints.push({ kind: 'listening_script', label: title, pageNumber: entry.pageNumber })
    }
  }

  return hints
}

function parseLessonNumber(title: string): number | null {
  const normalized = toHalfWidthDigits(title)
  const match = normalized.match(/第\s*(\d+)\s*課/)
  return match ? Number(match[1]) : null
}

function toHalfWidthDigits(value: string): string {
  return value.replace(/[０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0))
}

function normalize(value: string): string {
  return toHalfWidthDigits(value).toLowerCase().replace(/\s+/g, ' ')
}

function buildSourceId(classification: Classification, sha256: string): string {
  if (classification.textbookKey && classification.role !== 'unknown') {
    if (classification.role === 'answer_key' && classification.textbookKey.startsWith('quartet_')) {
      return `${classification.textbookKey}_workbook_answer_key`
    }
    return `${classification.textbookKey}_${classification.role}`
  }
  if (classification.role === 'answer_key' && classification.notes.some((note) => note.includes('Genki'))) {
    return 'genki_combined_answer_key'
  }
  if (classification.role === 'answer_key') return `answer_key_${sha256.slice(0, 8)}`
  if (classification.role === 'support') return `support_${sha256.slice(0, 8)}`
  return `unknown_${sha256.slice(0, 8)}`
}

function curriculumRoleFor(textbookKey: TextbookKey | null): CurriculumRole | null {
  if (!textbookKey) return null
  if (textbookKey.startsWith('genki_') || textbookKey.startsWith('quartet_')) return 'core'
  if (textbookKey.startsWith('marugoto_') || textbookKey === 'tobira') return 'pair'
  if (textbookKey === 'maynard_grammar') return 'in_depth_grammar'
  return null
}

function cefrPhaseFor(textbookKey: TextbookKey | null): CefrPhase | null {
  if (!textbookKey) return null
  if (textbookKey === 'genki_1' || textbookKey === 'marugoto_a1') return 'A1'
  if (textbookKey === 'genki_2' || textbookKey === 'marugoto_a2') return 'A2'
  if (textbookKey === 'quartet_1' || textbookKey === 'marugoto_b1') return 'B1'
  if (textbookKey === 'quartet_2' || textbookKey === 'tobira') return 'B2'
  if (textbookKey === 'maynard_grammar') return 'global'
  return null
}

function uniqueId(baseId: string, usedIds: Map<string, number>): string {
  const count = usedIds.get(baseId) ?? 0
  usedIds.set(baseId, count + 1)
  return count === 0 ? baseId : `${baseId}_${count + 1}`
}

function detectGaps(entries: SourceManifestEntry[]): string[] {
  const gaps: string[] = []
  const has = (key: TextbookKey, role: SourceRole) => entries.some((entry) => entry.textbookKey === key && entry.role === role)

  for (const key of ['genki_1', 'genki_2', 'quartet_1', 'quartet_2'] as const) {
    if (!has(key, 'textbook')) gaps.push(`Missing or unclassified ${key} textbook.`)
    if (!has(key, 'workbook')) gaps.push(`Missing or unclassified ${key} workbook.`)
  }

  if (!entries.some((entry) => entry.role === 'answer_key' && entry.notes.some((note) => note.includes('Genki')))) {
    gaps.push('Missing or unclassified combined Genki answer key.')
  }
  if (!has('quartet_1', 'answer_key')) gaps.push('Missing or unclassified quartet_1 workbook answer key.')
  if (!has('quartet_2', 'answer_key')) gaps.push('Missing or unclassified quartet_2 workbook answer key.')
  for (const key of ['marugoto_a1', 'marugoto_a2', 'marugoto_b1', 'tobira'] as const) {
    if (!has(key, 'textbook')) gaps.push(`Missing or unclassified ${key} pair source.`)
  }
  if (!has('maynard_grammar', 'grammar_reference')) {
    gaps.push('Missing or unclassified in-depth grammar preset source.')
  }
  if (entries.some((entry) => entry.pageCount === 0)) {
    gaps.push('One or more PDFs could not be inspected for page count/outline and need metadata verification before OCR.')
  }
  if (entries.some((entry) => entry.confidence === 'low')) {
    gaps.push('One or more PDFs are low-confidence support/unknown sources and need manual classification.')
  }

  return gaps
}
