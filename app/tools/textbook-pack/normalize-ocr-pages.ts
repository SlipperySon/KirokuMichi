import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type {
  NormalizedOcrLine,
  NormalizedPage,
  NormalizedPageKind,
  SourceManifestEntry,
  SourceSplitHint,
  TextbookSourceManifest,
} from './schema.ts'

interface RawOcrPage {
  sourceId: string
  pageNumber: number
  image: {
    width: number
    height: number
    dpi: number
    path: string | null
  }
  text: string
  lineCount: number
  rawResults: Array<{
    rec_texts?: string[]
    rec_scores?: number[]
    rec_boxes?: Array<[number, number, number, number]>
    rec_polys?: Array<Array<[number, number]>>
  }>
  elapsedSeconds?: number
}

interface CliOptions {
  manifestPath: string
  sourceId: string | null
  ocrRoot: string
  outRoot: string
}

const options = parseArgs(process.argv.slice(2))
const manifest = await readJson<TextbookSourceManifest>(resolveAppPath(options.manifestPath))
const entries = options.sourceId ? manifest.entries.filter((entry) => entry.id === options.sourceId) : manifest.entries

for (const entry of entries) {
  await normalizeSource(entry)
}

async function normalizeSource(entry: SourceManifestEntry): Promise<void> {
  const rawDir = resolveAppPath(path.join(options.ocrRoot, entry.id, 'raw'))
  let rawFiles: string[]
  try {
    rawFiles = (await readdir(rawDir)).filter((file) => file.endsWith('.json')).sort()
  } catch {
    console.log(`skip ${entry.id}: no raw OCR directory`)
    return
  }

  const outDir = resolveAppPath(path.join(options.outRoot, entry.id, 'pages'))
  await mkdir(outDir, { recursive: true })

  const summary: Array<{ pageNumber: number; pageKind: NormalizedPageKind; section: string | null; lines: number; warnings: string[] }> = []
  for (const rawFile of rawFiles) {
    const rawPage = await readJson<RawOcrPage>(path.join(rawDir, rawFile))
    const normalized = normalizePage(entry, rawPage)
    const outFile = path.join(outDir, `page-${String(rawPage.pageNumber).padStart(4, '0')}.json`)
    await writeJson(outFile, normalized)
    summary.push({
      pageNumber: normalized.pageNumber,
      pageKind: normalized.pageKind,
      section: normalized.section.label,
      lines: normalized.lines.length,
      warnings: normalized.warnings,
    })
  }

  await writeJson(resolveAppPath(path.join(options.outRoot, entry.id, 'normalized-summary.json')), {
    sourceId: entry.id,
    normalizedAt: new Date().toISOString(),
    pageCount: summary.length,
    pages: summary,
  })
  console.log(`normalized ${entry.id}: ${summary.length} pages`)
}

function normalizePage(entry: SourceManifestEntry, rawPage: RawOcrPage): NormalizedPage {
  const lines = extractLines(rawPage)
  const section = resolveSection(entry, rawPage.pageNumber)
  const pageKind = classifyPageKind(entry, section, lines, rawPage.pageNumber)
  const warnings = buildWarnings(lines, pageKind)
  const scores = lines.map((line) => line.score).filter((score): score is number => typeof score === 'number')
  const averageScore = scores.length > 0 ? round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : null

  return {
    schemaVersion: 1,
    sourceId: entry.id,
    sourceRole: entry.role,
    textbookKey: entry.textbookKey,
    curriculumRole: entry.curriculumRole,
    cefrPhase: entry.cefrPhase,
    pageNumber: rawPage.pageNumber,
    section,
    pageKind,
    image: rawPage.image,
    lines,
    text: lines.map((line) => line.normalizedText).filter(Boolean).join('\n'),
    stats: {
      lineCount: lines.length,
      lowConfidenceLineCount: lines.filter((line) => line.score !== null && line.score < 0.75).length,
      averageScore,
      elapsedSeconds: rawPage.elapsedSeconds,
    },
    warnings,
  }
}

function extractLines(rawPage: RawOcrPage): NormalizedOcrLine[] {
  const lines: NormalizedOcrLine[] = []
  let lineIndex = 0

  for (const result of rawPage.rawResults) {
    const texts = result.rec_texts ?? []
    for (let index = 0; index < texts.length; index += 1) {
      const text = texts[index] ?? ''
      lines.push({
        id: `p${String(rawPage.pageNumber).padStart(4, '0')}_l${String(lineIndex + 1).padStart(4, '0')}`,
        text,
        normalizedText: normalizeText(text),
        score: result.rec_scores?.[index] ?? null,
        box: result.rec_boxes?.[index] ?? null,
        polygon: result.rec_polys?.[index] ?? null,
        lineIndex,
      })
      lineIndex += 1
    }
  }

  return lines.sort((a, b) => {
    const aBox = a.box
    const bBox = b.box
    if (!aBox || !bBox) return a.lineIndex - b.lineIndex
    const yDelta = aBox[1] - bBox[1]
    if (Math.abs(yDelta) > 12) return yDelta
    return aBox[0] - bBox[0]
  })
}

function resolveSection(entry: SourceManifestEntry, pageNumber: number): NormalizedPage['section'] {
  const hints = entry.splitHints
    .filter((hint) => hint.pageNumber !== null && hint.pageNumber <= pageNumber)
    .sort((a, b) => (a.pageNumber ?? 0) - (b.pageNumber ?? 0))
  const active = hints.at(-1)

  if (!active) {
    return { kind: pageNumber <= 12 ? 'front_matter' : 'unknown', label: pageNumber <= 12 ? 'Front matter' : null }
  }

  return {
    kind: active.kind,
    label: active.label,
    lessonNumber: active.lessonNumber,
    startsAtPage: active.pageNumber,
  }
}

function classifyPageKind(entry: SourceManifestEntry, section: NormalizedPage['section'], lines: NormalizedOcrLine[], pageNumber: number): NormalizedPageKind {
  const text = lines.map((line) => line.normalizedText).join(' ')
  const normalized = toHalfWidth(text).toLowerCase()
  const quartetListKind = resolveQuartetListKind(entry, pageNumber)

  if (section.kind === 'front_matter') return 'front_matter'
  if (section.kind === 'pre_lesson') return 'lesson_overview'
  if (entry.role === 'workbook') {
    if (normalized.includes('hiragana') || normalized.includes('katakana') || normalized.includes('ひらがな') || normalized.includes('カタカナ')) {
      return 'kana_practice'
    }
    return 'workbook_exercise'
  }
  if (entry.role === 'answer_key') {
    if (section.kind === 'listening_script' || normalized.includes('script') || normalized.includes('スクリプト')) return 'listening_script'
    return 'answer_key'
  }
  if (quartetListKind === 'kanji') return 'bessatsu_kanji'
  if (quartetListKind === 'vocab') return 'bessatsu_vocab'
  if (section.kind === 'vocab') {
    return entry.textbookKey?.startsWith('quartet') ? 'bessatsu_vocab' : 'vocab_index'
  }
  if (section.kind === 'kanji') return 'bessatsu_kanji'
  if (section.kind === 'reading_writing') return 'reading'
  if (entry.id === 'genki_1_textbook' && section.kind === 'lesson' && section.lessonNumber === 1 && pageNumber >= 47 && pageNumber <= 49) {
    return 'lesson_vocab'
  }
  if (entry.textbookKey?.startsWith('genki') && (normalized.includes('vocabulary') || normalized.includes('vocab') || normalized.includes('たんご') || normalized.includes('additional vocab'))) {
    return 'lesson_vocab'
  }
  if (entry.textbookKey?.startsWith('quartet')) {
    if (normalized.includes('読む')) return 'reading'
    if (normalized.includes('書く') || normalized.includes('話す') || normalized.includes('聞く')) return 'lesson_overview'
  }
  if (normalized.includes('dialogue') || normalized.includes('かいわ') || normalized.includes('会話')) return 'dialogue'
  if (normalized.includes('grammar') || normalized.includes('文法')) return 'grammar'
  if (section.kind === 'lesson') return 'lesson_overview'
  if (normalized.includes('index') || normalized.includes('さくいん')) return 'index'
  return 'unknown'
}

function resolveQuartetListKind(entry: SourceManifestEntry, pageNumber: number): 'vocab' | 'kanji' | null {
  if (!entry.textbookKey?.startsWith('quartet')) return null
  const listHints = entry.splitHints
    .filter((hint) => (hint.kind === 'vocab' || hint.kind === 'kanji') && hint.pageNumber !== null && hint.pageNumber <= pageNumber)
    .sort((a, b) => (a.pageNumber ?? 0) - (b.pageNumber ?? 0))
  return (listHints.at(-1)?.kind as 'vocab' | 'kanji' | undefined) ?? null
}

function buildWarnings(lines: NormalizedOcrLine[], pageKind: NormalizedPageKind): string[] {
  const warnings: string[] = []
  const lowConfidence = lines.filter((line) => line.score !== null && line.score < 0.75).length
  const shortNoise = lines.filter((line) => line.normalizedText.length <= 1).length

  if (lowConfidence > Math.max(5, lines.length * 0.15)) warnings.push('many_low_confidence_lines')
  if (shortNoise > Math.max(8, lines.length * 0.2)) warnings.push('many_short_noise_lines')
  if (pageKind === 'bessatsu_kanji' || pageKind === 'vocab_index' || pageKind === 'bessatsu_vocab') warnings.push('requires_table_or_row_grouping')
  if (pageKind === 'workbook_exercise') warnings.push('requires_blank_and_prompt_grouping')
  return warnings
}

function normalizeText(value: string): string {
  return toHalfWidth(value)
    .replace(/[·•]/g, '・')
    .replace(/\s+/g, ' ')
    .trim()
}

function toHalfWidth(value: string): string {
  return value.replace(/[０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0))
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000
}

function parseArgs(rawArgs: string[]): CliOptions {
  const options: CliOptions = {
    manifestPath: 'tools/textbook-pack/out/source-manifest.json',
    sourceId: null,
    ocrRoot: 'tools/textbook-pack/out/ocr',
    outRoot: 'tools/textbook-pack/out/normalized',
  }

  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index]
    if (arg === '--manifest') options.manifestPath = rawArgs[++index] ?? options.manifestPath
    if (arg === '--source-id') options.sourceId = rawArgs[++index] ?? options.sourceId
    if (arg === '--ocr-root') options.ocrRoot = rawArgs[++index] ?? options.ocrRoot
    if (arg === '--out') options.outRoot = rawArgs[++index] ?? options.outRoot
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
