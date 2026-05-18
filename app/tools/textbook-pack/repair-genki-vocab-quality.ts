import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

interface VocabItem {
  id: string
  surface?: string
  english?: string
  source?: string
  lesson?: string
  page?: number
}

interface Fix {
  id: string
  surface?: string
  english: string
  reason: string
}

interface SuspiciousEntry {
  id: string
  source?: string
  lesson?: string
  page?: number
  surface?: string
  english?: string
  reasons: string[]
  action: 'curated_fix' | 'prune_or_ignore' | 'manual_review'
  fixed: boolean
}

const appRoot = process.cwd().endsWith(`${path.sep}app`) ? process.cwd() : path.join(process.cwd(), 'app')
const apply = process.argv.includes('--apply')
const reportPath = path.join(appRoot, 'tools/textbook-pack/out/vocab-quality/genki-vocab-quality-report.json')

const textbookDir = path.join(appRoot, 'data/generated/textbooks')
const targetFiles = (await readdir(textbookDir))
  .filter(fileName => fileName.endsWith('-comprehensive.json') || fileName === 'comprehensive-curriculum.json')
  .map(fileName => path.join(textbookDir, fileName))

const pruneIds = new Set([
  'genki_1_textbook_genki_1_2_vocab_5',
  'genki_1_textbook_genki_1_9_vocab_48',
  'genki_1_textbook_unknown_vocab_1',
  'genki_1_textbook_unknown_vocab_2',
  'genki_1_textbook_unknown_vocab_3',
  'genki_1_textbook_unknown_vocab_4',
  'genki_2_textbook_2_textbook_genki_2_16_vocab_34',
  'marugoto_a1_textbook_a1_textbook_marugoto_a1_11_vocab_2',
  'marugoto_a1_textbook_a1_textbook_marugoto_a1_11_vocab_8',
  'quartet_2_textbook_quartet_2_11_vocab_11',
  'quartet_2_textbook_quartet_2_8_vocab_26',
  'tobira_textbook_textbook_tobira_textbook_3_vocab_1',
])

const fixes = new Map<string, Fix>([
  fix('genki_1_textbook_1_textbook_genki_1_1_vocab_7', 'おばあさん', 'grandmother', 'English field contained romaji only.'),
  fix('genki_1_textbook_1_textbook_genki_1_1_vocab_8', 'おねえさん', 'older sister', 'English field contained romaji only.'),
  fix('genki_1_textbook_genki_1_3_vocab_24', '千', 'thousand', 'Removed appended Japanese example text from meaning.'),
  fix('genki_1_textbook_genki_1_4_vocab_27', '土', 'soil; earth', 'Removed appended Japanese example text from meaning.'),
  fix('genki_1_textbook_genki_1_5_vocab_30', '元気な', 'healthy; energetic', 'Corrected OCR-garbled meaning.'),
  fix('genki_1_textbook_genki_1_5_vocab_32', '見物', 'sightseeing', 'Removed appended Japanese example text from meaning.'),
  fix('genki_1_textbook_genki_1_6_vocab_39', '先月', 'last month', 'Removed unrelated OCR spillover from meaning.'),
  fix('genki_1_textbook_genki_1_10_vocab_51', '買物', 'shopping', 'Removed unrelated OCR spillover from meaning.'),
  fix('genki_1_textbook_genki_1_10_vocab_52', '自動車', 'automobile; car', 'Corrected truncated surface and OCR-spillover meaning.'),
  fix('genki_1_textbook_genki_1_10_vocab_53', '持つ', 'to carry; to hold', 'Removed appended Japanese example text from meaning.'),
  fix('genki_1_textbook_genki_1_8_vocab_64', '天の川', 'Milky Way', 'Corrected merged reading/surface and missing space.'),
  fix('genki_1_textbook_genki_1_8_vocab_65', 'いってらっしゃい', 'See you later.; Have a good day.', 'Corrected small-kana OCR and garbled meaning.'),
  fix('genki_1_textbook_genki_1_8_vocab_66', 'いじわる', 'mean-spirited', 'Removed appended Japanese text from meaning.'),
  fix('genki_1_textbook_genki_1_8_vocab_67', '運動する', 'to exercise', 'Corrected merged reading/surface and missing space.'),
  fix('genki_1_textbook_genki_1_9_vocab_71', '十七分', 'seventeen minutes', 'Corrected merged reading/surface and incomplete meaning.'),
  fix('genki_1_textbook_genki_1_9_vocab_72', '十二月', 'December', 'Corrected merged reading/surface.'),
  fix('genki_1_textbook_genki_1_9_vocab_73', '十四日', 'fourteenth day of the month', 'Corrected merged reading/surface and missing spaces.'),
  fix('genki_1_textbook_genki_1_9_vocab_74', '再来月', 'month after next', 'Corrected merged reading/surface and meaning.'),
  fix('genki_1_textbook_genki_1_9_vocab_75', '幸せ', 'happiness', 'Corrected OCR-garbled surface and meaning.'),
  fix('genki_1_textbook_genki_1_2_vocab_78', '二十分', 'twenty minutes', 'Corrected merged reading/surface and missing space.'),
  fix('genki_1_textbook_genki_1_2_vocab_79', '土曜日', 'Saturday', 'Corrected merged reading/surface.'),
  fix('genki_1_textbook_genki_1_2_vocab_80', '日本人', 'Japanese people', 'Corrected merged reading/surface.'),
  fix('genki_1_textbook_genki_1_2_vocab_81', '七日', 'seventh day of the month', 'Corrected merged reading/surface and missing spaces.'),
  fix('genki_1_textbook_genki_1_5_vocab_82', '二十日', 'twentieth day of the month', 'Corrected merged reading/surface and truncated meaning.'),
  fix('genki_1_textbook_genki_1_5_vocab_83', 'ひま', 'not busy; free time', 'Removed appended Japanese text from meaning.'),
  fix('genki_1_textbook_genki_1_5_vocab_84', '便利', 'convenient', 'Corrected truncated surface and OCR-spillover meaning.'),
  fix('genki_1_textbook_genki_1_5_vocab_85', '木曜日', 'Thursday', 'Corrected merged reading/surface.'),
  fix('genki_1_textbook_genki_1_5_vocab_86', '三日', 'third day of the month', 'Corrected merged reading/surface and missing spaces.'),

  fix('genki_2_textbook_genki_2_13_vocab_18', '空', 'sky; empty', 'Removed appended Japanese example text from meaning.'),
  fix('genki_2_textbook_genki_2_19_vocab_43', '花火', 'fireworks', 'Removed unrelated OCR spillover from meaning.'),
  fix('genki_2_textbook_genki_2_21_vocab_47', '盲導犬', 'seeing-eye dog', 'Inserted missing space.'),
  fix('genki_2_textbook_2_textbook_genki_2_21_vocab_51', '起こる', 'to occur; to happen', 'Inserted missing spaces.'),
  fix('genki_2_textbook_genki_2_6_vocab_61', 'いじわる', 'mean-spirited', 'Removed appended Japanese text from meaning.'),
  fix('genki_2_textbook_genki_2_4_vocab_66', '遠慮する', 'to hold back; to refrain', 'Corrected merged reading/surface and missing space.'),
  fix('genki_2_textbook_genki_2_14_vocab_69', 'おととい', 'day before yesterday', 'Inserted missing space.'),
  fix('genki_2_textbook_genki_2_2_vocab_71', 'けち', 'stingy; cheap', 'Removed lesson-reference spillover.'),
  fix('genki_2_textbook_genki_2_2_vocab_72', '交換する', 'to exchange', 'Corrected merged reading/surface and missing space.'),
  fix('genki_2_textbook_genki_2_10_vocab_74', '再来月', 'month after next', 'Corrected merged reading/surface and missing spaces.'),
  fix('genki_2_textbook_genki_2_17_vocab_82', '知り合う', 'to get acquainted', 'Corrected merged reading/surface and missing spaces.'),
  fix('genki_2_textbook_genki_2_17_vocab_83', '洗濯する', 'to do laundry', 'Corrected merged reading/surface and missing spaces.'),
  fix('genki_2_textbook_genki_2_5_vocab_89', '十日', 'tenth day of the month', 'Corrected merged reading/surface and missing spaces.'),
  fix('genki_2_textbook_genki_2_7_vocab_90', '二十分', 'twenty minutes', 'Corrected merged reading/surface and missing space.'),
  fix('genki_2_textbook_genki_2_12_vocab_93', 'ひま', 'not busy; free time', 'Removed appended Japanese text from meaning.'),
  fix('genki_2_textbook_genki_2_12_vocab_95', '貧乏', 'poor', 'Removed appended Japanese text from meaning.'),
  fix('genki_2_textbook_genki_2_12_vocab_98', 'ぺらぺら', 'fluent', 'Removed lesson-reference spillover.'),
  fix('genki_2_textbook_genki_2_12_vocab_100', '翻訳する', 'to translate', 'Corrected merged reading/surface and missing space.'),
  fix('genki_2_textbook_genki_2_17_vocab_103', '楽', 'easy; comfortable', 'Removed appended Japanese text from meaning.'),
  fix('genki_2_textbook_genki_2_17_vocab_104', '八日', 'eighth day of the month', 'Corrected merged reading/surface and missing spaces.'),

  fix('quartet_2_textbook_quartet_2_11_vocab_106', '構える', 'to get ready; to take a stance', 'Corrected missing space and clarified meaning.'),
])

const reports = []
for (const filePath of targetFiles) {
  const data = JSON.parse(await readFile(filePath, 'utf8')) as unknown
  const beforeEntries = collectVocab(data)
  const beforeSuspicious = beforeEntries.map(entry => toSuspiciousEntry(entry)).filter(Boolean) as SuspiciousEntry[]
  const changedIds = applyFixesAndPrunes(data)
  const afterSuspicious = collectVocab(data).map(entry => toSuspiciousEntry(entry)).filter(Boolean) as SuspiciousEntry[]

  if (apply && changedIds.size > 0) {
    await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`)
  }

  reports.push({
    file: path.relative(appRoot, filePath),
    totalVocabNodes: beforeEntries.length,
    suspiciousBefore: beforeSuspicious.length,
    suspiciousAfter: afterSuspicious.length,
    fixedIds: [...changedIds].sort(),
    unresolved: afterSuspicious
      .filter(entry => !fixes.has(entry.id))
      .sort((a, b) => (a.source ?? '').localeCompare(b.source ?? '') || (a.lesson ?? '').localeCompare(b.lesson ?? '') || a.id.localeCompare(b.id)),
  })
}

const report = {
  generatedAt: new Date().toISOString(),
  mode: apply ? 'apply' : 'report-only',
  curatedFixesAvailable: fixes.size,
  curatedPrunesAvailable: pruneIds.size,
  reports,
}

await mkdir(path.dirname(reportPath), { recursive: true })
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({
  mode: report.mode,
  reportPath: path.relative(appRoot, reportPath),
  fixedIds: reports.reduce((count, item) => count + item.fixedIds.length, 0),
  unresolvedSuspicious: reports.reduce((count, item) => count + item.unresolved.length, 0),
}, null, 2))

function fix(id: string, surface: string, english: string, reason: string): [string, Fix] {
  return [id, { id, surface, english, reason }]
}

function collectVocab(value: unknown, result: VocabItem[] = []): VocabItem[] {
  if (!value || typeof value !== 'object') return result
  if (isVocabItem(value)) result.push(value)
  if (Array.isArray(value)) {
    for (const item of value) collectVocab(item, result)
    return result
  }
  for (const item of Object.values(value)) collectVocab(item, result)
  return result
}

function isVocabItem(value: object): value is VocabItem {
  const item = value as VocabItem
  return typeof item.id === 'string' &&
    (typeof item.english === 'string' || typeof item.surface === 'string') &&
    ('english' in item || 'surface' in item) &&
    !('pattern' in item) &&
    !('question' in item)
}

function applyFixesAndPrunes(value: unknown, changedIds = new Set<string>()): Set<string> {
  if (!value || typeof value !== 'object') return changedIds

  if (isVocabItem(value)) {
    const targetFix = fixes.get(value.id)
    if (targetFix) {
      const nextSurface = targetFix.surface ?? value.surface
      const willChange = value.surface !== nextSurface || value.english !== targetFix.english
      if (nextSurface) value.surface = nextSurface
      value.english = targetFix.english
      if (willChange) changedIds.add(value.id)
    }
  }

  if (Array.isArray(value)) {
    for (let index = value.length - 1; index >= 0; index--) {
      const item = value[index]
      if (isVocabItem(item) && pruneIds.has(item.id)) {
        value.splice(index, 1)
        changedIds.add(item.id)
      } else {
        applyFixesAndPrunes(item, changedIds)
      }
    }
    return changedIds
  }

  for (const item of Object.values(value)) applyFixesAndPrunes(item, changedIds)
  return changedIds
}

function toSuspiciousEntry(entry: VocabItem): SuspiciousEntry | null {
  const reasons = getSuspicionReasons(entry)
  if (reasons.length === 0) return null
  return {
    id: entry.id,
    source: entry.source,
    lesson: entry.lesson,
    page: entry.page,
    surface: entry.surface,
    english: entry.english,
    reasons,
    action: fixes.has(entry.id) ? 'curated_fix' : classifySuspiciousEntry(entry, reasons),
    fixed: fixes.has(entry.id),
  }
}

function classifySuspiciousEntry(entry: VocabItem, reasons: string[]): SuspiciousEntry['action'] {
  const surface = entry.surface ?? ''
  const english = entry.english ?? ''
  if (
    reasons.includes('missing_surface') ||
    /^(kya|kyu|chu|hyu)$/i.test(english.trim()) ||
    /^(→|-|ー|…|\.)+$/.test(surface.trim()) ||
    /kana|hiragana|katakana|chart|sound change/i.test(entry.lesson ?? '')
  ) {
    return 'prune_or_ignore'
  }
  return 'manual_review'
}

function getSuspicionReasons(entry: VocabItem): string[] {
  const surface = entry.surface ?? ''
  const english = entry.english ?? ''
  const reasons: string[] = []

  if (/^(kya|kyu|chu|hyu|obaasan|oneesan)$/i.test(english)) reasons.push('english_looks_like_romaji')
  if (/[\u3040-\u30ff\u3400-\u9fff]/.test(english)) reasons.push('english_contains_japanese')
  if (/(Pr a c|→|fne|freworks|toexercise|tooccur|todolaundry|totranslate|tohold|toexchange|to\s*getready|twentyminutes|thefourteenth|themonth|theday|dayof|dayofa|lastmonth|theMilkyWay|Pleasego|seeing-eyedog|happ?y)/i.test(english)) {
    reasons.push('ocr_spacing_or_spillover')
  }
  if (!surface.trim()) reasons.push('missing_surface')

  return reasons
}
