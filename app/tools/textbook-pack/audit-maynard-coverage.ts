import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { CEFR_BASE_TEXTBOOK, TEXTBOOK_LESSON_COUNTS, type CEFRLevel } from '../../src/content/cefrMapping'
import { curriculumService, type GrammarItem } from '../../src/content/curriculumService'
import { applyGenkiLessonOneGrammarScope } from '../../src/content/genkiFoundation'
import { createLessonMatcher } from '../../src/content/lessonContentUtils'
import { hasMaynardSupport } from '../../src/content/maynardSupport'

interface CoverageLessonRow {
  cefr: CEFRLevel
  textbookKey: string
  lessonId: string
  grammarCount: number
  supportedCount: number
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
  let grammarCount = 0
  let supportedCount = 0

  for (const cefr of CEFR_LEVELS) {
    const textbookKey = CEFR_BASE_TEXTBOOK[cefr]
    const curriculum = await curriculumService.getTextbookCurriculum(textbookKey)
    if (!curriculum) continue

    const lessonCount = TEXTBOOK_LESSON_COUNTS[textbookKey] ?? 0
    const seriesPrefix = textbookKey.split('_').slice(0, -1).join('_')

    for (let lessonNum = 1; lessonNum <= lessonCount; lessonNum++) {
      const lessonId = `${seriesPrefix}_${lessonNum}`
      const matchesLesson = createLessonMatcher(lessonId, lessonNum)
      const grammar = applyGenkiLessonOneGrammarScope(
        lessonId,
        curriculum.grammar.filter(item => matchesLesson(item.lesson))
      )
      const supported = grammar.filter(hasMaynardSupport)
      const unmatched = grammar.filter(item => !hasMaynardSupport(item))

      grammarCount += grammar.length
      supportedCount += supported.length
      for (const item of unmatched) {
        const key = patternKey(item)
        unmatchedCounts.set(key, (unmatchedCounts.get(key) ?? 0) + 1)
      }

      rows.push({
        cefr,
        textbookKey,
        lessonId,
        grammarCount: grammar.length,
        supportedCount: supported.length,
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

  const report = {
    generatedAt: new Date().toISOString(),
    totals: {
      grammarCount,
      supportedCount,
      coveragePct: pct(supportedCount, grammarCount),
    },
    lowCoverageLessonCount: lowCoverageLessons.length,
    lowCoverageLessons,
    commonUnmatched,
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

void main()
