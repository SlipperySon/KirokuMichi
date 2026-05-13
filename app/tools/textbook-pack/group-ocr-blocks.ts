import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { GroupedPage, GroupedPageBlock, GroupedBlockType, NormalizedOcrLine, NormalizedPage } from './schema.ts'

interface CliOptions {
  sourceId: string | null
  normalizedRoot: string
  outRoot: string
}

const options = parseArgs(process.argv.slice(2))
const sourceIds = await resolveSourceIds()

for (const sourceId of sourceIds) {
  await groupSource(sourceId)
}

async function resolveSourceIds(): Promise<string[]> {
  if (options.sourceId) return [options.sourceId]
  const root = resolveAppPath(options.normalizedRoot)
  try {
    return (await readdir(root, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort()
  } catch {
    return []
  }
}

async function groupSource(sourceId: string): Promise<void> {
  const pagesDir = resolveAppPath(path.join(options.normalizedRoot, sourceId, 'pages'))
  let pageFiles: string[]
  try {
    pageFiles = (await readdir(pagesDir)).filter((file) => file.endsWith('.json')).sort()
  } catch {
    console.log(`skip ${sourceId}: no normalized pages`)
    return
  }

  const outPagesDir = resolveAppPath(path.join(options.outRoot, sourceId, 'pages'))
  await mkdir(outPagesDir, { recursive: true })
  const summary: Array<{ pageNumber: number; pageKind: string; blocks: number; warnings: string[] }> = []

  for (const pageFile of pageFiles) {
    const normalized = await readJson<NormalizedPage>(path.join(pagesDir, pageFile))
    const grouped = groupPage(normalized)
    await writeJson(path.join(outPagesDir, pageFile), grouped)
    summary.push({
      pageNumber: grouped.pageNumber,
      pageKind: grouped.pageKind,
      blocks: grouped.blocks.length,
      warnings: grouped.warnings,
    })
  }

  await writeJson(resolveAppPath(path.join(options.outRoot, sourceId, 'grouped-summary.json')), {
    sourceId,
    groupedAt: new Date().toISOString(),
    pageCount: summary.length,
    pages: summary,
  })
  console.log(`grouped ${sourceId}: ${summary.length} pages`)
}

function groupPage(page: NormalizedPage): GroupedPage {
  const usefulLines = page.lines.filter((line) => line.normalizedText.length > 0)
  const blocks = isRowPage(page.pageKind) ? groupRows(usefulLines, page.pageKind) : groupVerticalBlocks(usefulLines)
  const warnings = [...page.warnings]

  if (isRowPage(page.pageKind)) warnings.push('row_grouping_is_heuristic')
  if (page.pageKind === 'dialogue') warnings.push('dialogue_turn_grouping_needs_validation')

  return {
    schemaVersion: 1,
    sourceId: page.sourceId,
    textbookKey: page.textbookKey,
    curriculumRole: page.curriculumRole,
    cefrPhase: page.cefrPhase,
    pageNumber: page.pageNumber,
    pageKind: page.pageKind,
    section: page.section,
    blocks,
    stats: {
      blockCount: blocks.length,
      sourceLineCount: page.lines.length,
      groupedLineCount: blocks.reduce((sum, block) => sum + block.lineIds.length, 0),
    },
    warnings: unique(warnings),
  }
}

function isRowPage(pageKind: string): boolean {
  return ['lesson_vocab', 'vocab_index', 'bessatsu_vocab', 'bessatsu_kanji', 'workbook_exercise', 'kana_practice', 'answer_key'].includes(pageKind)
}

function groupRows(lines: NormalizedOcrLine[], pageKind: string): GroupedPageBlock[] {
  const rows: NormalizedOcrLine[][] = []
  const sorted = lines.filter((line) => line.box).sort((a, b) => centerY(a) - centerY(b) || left(a) - left(b))
  const yThreshold = pageKind === 'workbook_exercise' ? 18 : 14

  for (const line of sorted) {
    const last = rows.at(-1)
    if (!last || Math.abs(centerY(last[0]) - centerY(line)) > yThreshold) {
      rows.push([line])
    } else {
      last.push(line)
    }
  }

  return rows.map((row, index) => makeBlock({
    id: `row_${String(index + 1).padStart(4, '0')}`,
    type: pageKind === 'workbook_exercise' || pageKind === 'kana_practice' ? 'exercise_prompt' : 'table_row',
    lines: row.sort((a, b) => left(a) - left(b)),
    columns: row.sort((a, b) => left(a) - left(b)).map((line) => line.normalizedText),
    warnings: row.length === 1 ? ['single_cell_row'] : [],
  }))
}

function groupVerticalBlocks(lines: NormalizedOcrLine[]): GroupedPageBlock[] {
  const sorted = lines.filter((line) => line.box).sort((a, b) => top(a) - top(b) || left(a) - left(b))
  const groups: NormalizedOcrLine[][] = []

  for (const line of sorted) {
    const last = groups.at(-1)
    const gap = last ? top(line) - bottom(last[last.length - 1]) : Number.POSITIVE_INFINITY
    const startsDialogue = /[:：]$/.test(line.normalizedText) || /^[0-9]+.*[:：]/.test(line.normalizedText)
    if (!last || gap > 28 || startsDialogue) {
      groups.push([line])
    } else {
      last.push(line)
    }
  }

  return groups.map((group, index) => {
    const text = group.map((line) => line.normalizedText).join(' ')
    let type: GroupedBlockType = 'text_block'
    if (index < 3 || group.some((line) => line.box && top(line) < 330)) type = 'heading'
    if (/[:：]/.test(text) && /(?:たけし|メアリー|takeshi|mary|mearii|先生|さん)/i.test(text)) type = 'dialogue_turn'
    if (group.length <= 2 && text.length <= 2) type = 'noise'
    return makeBlock({
      id: `block_${String(index + 1).padStart(4, '0')}`,
      type,
      lines: group,
      warnings: type === 'noise' ? ['possible_ocr_noise'] : [],
    })
  })
}

function makeBlock(input: {
  id: string
  type: GroupedBlockType
  lines: NormalizedOcrLine[]
  columns?: string[]
  warnings?: string[]
}): GroupedPageBlock {
  const scores = input.lines.map((line) => line.score).filter((score): score is number => typeof score === 'number')
  return {
    id: input.id,
    type: input.type,
    text: input.lines.map((line) => line.normalizedText).join(' ').trim(),
    lineIds: input.lines.map((line) => line.id),
    boundingBox: mergeBoxes(input.lines),
    columns: input.columns,
    score: scores.length > 0 ? round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : null,
    warnings: input.warnings?.length ? input.warnings : undefined,
  }
}

function mergeBoxes(lines: NormalizedOcrLine[]): [number, number, number, number] | null {
  const boxes = lines.map((line) => line.box).filter((box): box is [number, number, number, number] => box !== null)
  if (boxes.length === 0) return null
  return [
    Math.min(...boxes.map((box) => box[0])),
    Math.min(...boxes.map((box) => box[1])),
    Math.max(...boxes.map((box) => box[2])),
    Math.max(...boxes.map((box) => box[3])),
  ]
}

function left(line: NormalizedOcrLine): number {
  return line.box?.[0] ?? 0
}

function top(line: NormalizedOcrLine): number {
  return line.box?.[1] ?? 0
}

function bottom(line: NormalizedOcrLine): number {
  return line.box?.[3] ?? 0
}

function centerY(line: NormalizedOcrLine): number {
  if (!line.box) return 0
  return (line.box[1] + line.box[3]) / 2
}

function unique(values: string[]): string[] {
  return [...new Set(values)]
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000
}

function parseArgs(rawArgs: string[]): CliOptions {
  const options: CliOptions = {
    sourceId: null,
    normalizedRoot: 'tools/textbook-pack/out/normalized',
    outRoot: 'tools/textbook-pack/out/grouped',
  }

  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index]
    if (arg === '--source-id') options.sourceId = rawArgs[++index] ?? options.sourceId
    if (arg === '--normalized-root') options.normalizedRoot = rawArgs[++index] ?? options.normalizedRoot
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
