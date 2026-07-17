import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { CEFR_BASE_TEXTBOOK, TEXTBOOK_LESSON_COUNTS, type CEFRLevel } from '../../src/content/cefrMapping'
import { curriculumService } from '../../src/content/curriculumService'
import { createLessonMatcher } from '../../src/content/lessonContentUtils'
import { clearSupplementalScenarioCache, getSupplementalScenarios } from '../../src/content/supplementalScenarioService'
import { getWorkbookPracticeTasks } from '../../src/content/workbookPracticeService'

interface LearnerContentIssue {
  cefr: CEFRLevel
  lessonId: string
  type: 'vocab' | 'grammar' | 'task' | 'scenarioLine'
  id: string
  reason: string
  text: string
}

const CEFR_LEVELS: CEFRLevel[] = ['a1', 'a2', 'b1', 'b2']
const REPORT_PATH = 'tools/textbook-pack/out/content-quality/learner-content-quality-report.json'

const ADMIN_OR_SOURCE_TEXT_RE =
  /(table of contents|copyright|isbn|publisher|answer key|https|www\.|audio file|using tobira|文法項目|読み書き編|構成されています|必要に応じて|聞く練習|漢字の練習|Listening Comprehension|KanjiPractice|Kanj|Introduction\d|Conversation and Grammar section|corresponding lesson)/i
const STRUCTURAL_JUNK_RE = /([A-Za-z]{22,}|\d{4,}|[{}[\]\\<>|]{2,}|©|TEL|FAX)/
const BROKEN_START_RE = /^(?:その後|ただし|必要なら|同じ言葉|[A-Z]：|[0-9]+[.)、])/
const STATEMENT_ONLY_RE = /(?:紹介しています|発表しています|書いてあります|説明しています)。?$/
const OCR_SCAR_RE = /Pr a c|toget\b|→/

const VALID_FALSE_POSITIVE_IDS = new Set([
  'cefr_a2_364',
  'quartet_1_textbook_quartet_1_1_vocab_23',
])

function localDataFetch(url: string) {
  const filePath = resolve(process.cwd(), url.replace(/^\//, ''))
  return {
    ok: true,
    json: async () => JSON.parse(readFileSync(filePath, 'utf8')),
    text: async () => readFileSync(filePath, 'utf8'),
  } as Response
}

function reasonForText(text: string, options: { allowOcrScar?: boolean } = {}) {
  if (!text.trim()) return 'empty text'
  if (ADMIN_OR_SOURCE_TEXT_RE.test(text)) return 'admin/source text'
  if (STRUCTURAL_JUNK_RE.test(text)) return 'structural OCR junk'
  if (BROKEN_START_RE.test(text)) return 'broken continuation/list fragment'
  if (STATEMENT_ONLY_RE.test(text)) return 'statement-only prompt'
  if (options.allowOcrScar !== false && OCR_SCAR_RE.test(text)) return 'known OCR scar'
  return null
}

async function main() {
  globalThis.fetch = localDataFetch as typeof fetch
  const issues: LearnerContentIssue[] = []
  const totals = {
    vocab: 0,
    grammar: 0,
    tasks: 0,
    scenarios: 0,
    scenarioLines: 0,
  }

  for (const cefr of CEFR_LEVELS) {
    const textbookKey = CEFR_BASE_TEXTBOOK[cefr]
    const curriculum = await curriculumService.getTextbookCurriculum(textbookKey)
    if (!curriculum) continue

    const lessonCount = TEXTBOOK_LESSON_COUNTS[textbookKey] ?? 0
    const seriesPrefix = textbookKey.split('_').slice(0, -1).join('_')
    for (let lessonNum = 1; lessonNum <= lessonCount; lessonNum++) {
      clearSupplementalScenarioCache()
      const lessonId = `${seriesPrefix}_${lessonNum}`
      const matchesLesson = createLessonMatcher(lessonId, lessonNum)

      const vocab = curriculum.vocabulary.filter(item => matchesLesson(item.lesson))
      const grammar = curriculum.grammar.filter(item => matchesLesson(item.lesson))
      const [tasks, scenarios] = await Promise.all([
        getWorkbookPracticeTasks({ cefr, lessonId, lessonNum, limit: 20 }),
        getSupplementalScenarios({ cefr, coreLessonId: lessonId }),
      ])

      totals.vocab += vocab.length
      totals.grammar += grammar.length
      totals.tasks += tasks.length
      totals.scenarios += scenarios.length
      totals.scenarioLines += scenarios.reduce((sum, scenario) => sum + scenario.lines.length, 0)

      for (const item of vocab) {
        const reason = reasonForText(`${item.surface} ${item.english}`)
        if (reason && !VALID_FALSE_POSITIVE_IDS.has(item.id)) {
          issues.push({ cefr, lessonId, type: 'vocab', id: item.id, reason, text: `${item.surface} => ${item.english}` })
        }
      }

      for (const item of grammar) {
        const reason = reasonForText(`${item.pattern} ${item.meaning}`)
        if ((reason || item.pattern.length > 80) && !VALID_FALSE_POSITIVE_IDS.has(item.id)) {
          issues.push({ cefr, lessonId, type: 'grammar', id: item.id, reason: reason ?? 'oversized grammar pattern', text: `${item.pattern} => ${item.meaning}` })
        }
      }

      for (const task of tasks) {
        const reason = reasonForText(`${task.prompt} ${task.support}`)
        if (reason) {
          issues.push({ cefr, lessonId, type: 'task', id: task.id, reason, text: task.prompt })
        }
      }

      for (const scenario of scenarios) {
        for (const line of scenario.lines) {
          const reason = reasonForText(line.text)
          if (reason) {
            issues.push({ cefr, lessonId, type: 'scenarioLine', id: scenario.id, reason, text: line.text })
          }
        }
      }
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    totals,
    issueCount: issues.length,
    issues,
  }
  mkdirSync(dirname(REPORT_PATH), { recursive: true })
  writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`)
  console.log(JSON.stringify({ reportPath: REPORT_PATH, ...report }, null, 2))

  if (issues.length > 0) {
    process.exitCode = 1
  }
}

void main()
