import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { CEFR_BASE_TEXTBOOK, TEXTBOOK_LESSON_COUNTS, type CEFRLevel } from '../../src/content/cefrMapping'
import { curriculumService, type GrammarItem } from '../../src/content/curriculumService'
import { createLessonMatcher } from '../../src/content/lessonContentUtils'
import { getMaynardSupport, hasMaynardSupport } from '../../src/content/maynardSupport'

interface CoverageLessonRow {
  cefr: CEFRLevel
  textbookKey: string
  lessonId: string
  grammarCount: number
  supportedCount: number
  directCount: number
  curatedCount: number
  attachedCount: number
  coveragePct: number
  unmatchedPatterns: string[]
}

const CEFR_LEVELS: CEFRLevel[] = ['a1', 'a2', 'b1', 'b2']
const REPORT_PATH = 'tools/textbook-pack/out/content-quality/maynard-coverage-report.json'
const MIN_LESSON_COVERAGE = 50

function localDataFetch(url: string) {
  const filePath = resolve(process.cwd(), url.replace(/^\//, ''))
  return {
    ok: true,
    json: async () => JSON.parse(readFileSync(filePath, 'utf8')),
    text: async () => readFileSync(filePath, 'utf8'),
  } as Response
}

async function main() {
  globalThis.fetch = localDataFetch as typeof fetch

  const rows: CoverageLessonRow[] = []
  const unmatchedCounts = new Map<string, number>()
  const curatedCounts = new Map<string, { count: number; topicId: string; title: string }>()
  let grammarCount = 0
  let supportedCount = 0
  let directCount = 0
  let curatedCount = 0
  let attachedCount = 0

  for (const cefr of CEFR_LEVELS) {
    const textbookKey = CEFR_BASE_TEXTBOOK[cefr]
    const curriculum = await curriculumService.getTextbookCurriculum(textbookKey)
    if (!curriculum) continue

    const lessonCount = TEXTBOOK_LESSON_COUNTS[textbookKey] ?? 0
    const seriesPrefix = textbookKey.split('_').slice(0, -1).join('_')

    for (let lessonNum = 1; lessonNum <= lessonCount; lessonNum++) {
      const lessonId = `${seriesPrefix}_${lessonNum}`
      const matchesLesson = createLessonMatcher(lessonId, lessonNum)
      const grammar = curriculum.grammar.filter(item => matchesLesson(item.lesson))
      const supported = grammar.filter(hasMaynardSupport)
      const supportKinds = supported.map(item => getMaynardSupport(item)?.sourceKind ?? sourceKindFromTopicId(getMaynardSupport(item)?.topicId))
      const lessonDirectCount = supportKinds.filter(kind => kind === 'direct').length
      const lessonCuratedCount = supportKinds.filter(kind => kind === 'curated-support').length
      const lessonAttachedCount = supportKinds.filter(kind => kind === 'attached').length
      const unmatched = grammar.filter(item => !hasMaynardSupport(item))

      grammarCount += grammar.length
      supportedCount += supported.length
      directCount += lessonDirectCount
      curatedCount += lessonCuratedCount
      attachedCount += lessonAttachedCount
      for (const item of unmatched) {
        const key = patternKey(item)
        unmatchedCounts.set(key, (unmatchedCounts.get(key) ?? 0) + 1)
      }
      for (const item of supported) {
        const support = getMaynardSupport(item)
        const kind = support?.sourceKind ?? sourceKindFromTopicId(support?.topicId)
        if (kind !== 'curated-support') continue
        const key = patternKey(item)
        const existing = curatedCounts.get(key)
        curatedCounts.set(key, {
          count: (existing?.count ?? 0) + 1,
          topicId: support?.topicId ?? 'curated-support',
          title: support?.title ?? 'Curated support bridge',
        })
      }

      rows.push({
        cefr,
        textbookKey,
        lessonId,
        grammarCount: grammar.length,
        supportedCount: supported.length,
        directCount: lessonDirectCount,
        curatedCount: lessonCuratedCount,
        attachedCount: lessonAttachedCount,
        coveragePct: pct(supported.length, grammar.length),
        unmatchedPatterns: unmatched.slice(0, 12).map(item => `${item.pattern} (${item.meaning})`),
      })
    }
  }

  const lowCoverageLessons = rows.filter(row => row.grammarCount > 0 && row.coveragePct < MIN_LESSON_COVERAGE)
  const commonUnmatched = [...unmatchedCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 40)
    .map(([pattern, count]) => ({ pattern, count }))
  const commonCuratedBridges = [...curatedCounts.entries()]
    .sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0]))
    .slice(0, 60)
    .map(([pattern, detail]) => ({ pattern, ...detail }))

  const report = {
    generatedAt: new Date().toISOString(),
    totals: {
      grammarCount,
      supportedCount,
      directCount,
      curatedCount,
      attachedCount,
      coveragePct: pct(supportedCount, grammarCount),
    },
    lowCoverageLessonCount: lowCoverageLessons.length,
    lowCoverageLessons,
    commonUnmatched,
    commonCuratedBridges,
    rows,
  }

  mkdirSync(dirname(REPORT_PATH), { recursive: true })
  writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`)
  console.log(JSON.stringify({ reportPath: REPORT_PATH, ...report }, null, 2))
}

function patternKey(item: GrammarItem): string {
  return (item.pattern || item.meaning || item.id).replace(/\s+/g, ' ').trim().slice(0, 120)
}

function pct(count: number, total: number): number {
  if (total === 0) return 100
  return Math.round((count / total) * 100)
}

function sourceKindFromTopicId(topicId?: string) {
  if (!topicId) return undefined
  if (topicId.startsWith('curated-support:')) return 'curated-support'
  return 'attached'
}

void main()
