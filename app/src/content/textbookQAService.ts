import { CEFR_BASE_TEXTBOOK, TEXTBOOK_LESSON_COUNTS, type CEFRLevel } from './cefrMapping'
import { curriculumService } from './curriculumService'
import { createLessonMatcher } from './lessonContentUtils'
import { getMaynardSupport, hasMaynardSupport } from './maynardSupport'
import { getSupplementalScenarios } from './supplementalScenarioService'
import { textbookAssetService } from './textbookAssetService'
import { getWorkbookPracticeTasks } from './workbookPracticeService'

export interface TextbookQARow {
  cefr: CEFRLevel
  lessonId: string
  lessonNumber: number
  textbookKey: string
  vocabCount: number
  grammarCount: number
  scenarioCount: number
  workbookTaskCount: number
  maynardMatchCount: number
  maynardDirectCount: number
  maynardCuratedCount: number
  maynardCoveragePct: number
  suspiciousVocabCount: number
  assetCount: number
  pageRange: string
  warnings: string[]
}

const SUSPICIOUS_MEANING_RE = /^(?:[a-z]{2,}|[A-Z]{2,}|[-→]+|\?)$/

function suspiciousVocab(surface: string, english: string) {
  if (!english.trim()) return true
  if (english === surface) return true
  if (SUSPICIOUS_MEANING_RE.test(english.trim()) && !/\s/.test(english.trim())) return true
  return false
}

function pageRange(pages: number[]) {
  const valid = pages.filter(page => page > 0)
  if (valid.length === 0) return 'missing'
  const min = Math.min(...valid)
  const max = Math.max(...valid)
  return min === max ? `${min}` : `${min}-${max}`
}

function warnings(row: Omit<TextbookQARow, 'warnings'>) {
  const result: string[] = []
  if (row.vocabCount === 0) result.push('missing vocab')
  if (row.grammarCount === 0) result.push('missing grammar')
  if (row.scenarioCount === 0) result.push('no scenarios')
  if (row.workbookTaskCount === 0) result.push('no workbook output')
  if (row.maynardMatchCount === 0 && row.grammarCount > 0) result.push('no Maynard matches')
  if (row.maynardCoveragePct > 0 && row.maynardCoveragePct < 50) result.push('low Maynard coverage')
  if (row.suspiciousVocabCount > 0) result.push('suspicious vocab')
  if (row.assetCount === 0) result.push('no image assets')
  if (row.pageRange === 'missing') result.push('missing pages')
  return result
}

export async function getTextbookQARows(): Promise<TextbookQARow[]> {
  const cefrLevels: CEFRLevel[] = ['a1', 'a2', 'b1', 'b2']
  const rows: TextbookQARow[] = []

  for (const cefr of cefrLevels) {
    const textbookKey = CEFR_BASE_TEXTBOOK[cefr]
    const curriculum = await curriculumService.getTextbookCurriculum(textbookKey)
    if (!curriculum) continue

    const totalLessons = TEXTBOOK_LESSON_COUNTS[textbookKey] ?? 0
    for (let lessonNumber = 1; lessonNumber <= totalLessons; lessonNumber++) {
      const seriesPrefix = textbookKey.split('_').slice(0, -1).join('_')
      const lessonId = `${seriesPrefix}_${lessonNumber}`
      const matchesLesson = createLessonMatcher(lessonId, lessonNumber)
      const vocab = curriculum.vocabulary.filter(item => matchesLesson(item.lesson))
      const grammar = curriculum.grammar.filter(item => matchesLesson(item.lesson))
      const [scenarios, workbookTasks, assets] = await Promise.all([
        getSupplementalScenarios({ cefr, coreLessonId: lessonId }),
        getWorkbookPracticeTasks({ cefr, lessonId, lessonNum: lessonNumber }),
        textbookAssetService.getAssetsForLesson(textbookKey, lessonId),
      ])
      const maynardMatchCount = grammar.filter(hasMaynardSupport).length
      const maynardSupportKinds = grammar.map(item => getMaynardSupport(item)?.sourceKind).filter(Boolean)
      const maynardDirectCount = maynardSupportKinds.filter(kind => kind === 'direct').length
      const maynardCuratedCount = maynardSupportKinds.filter(kind => kind === 'curated-support').length
      const rowBase = {
        cefr,
        lessonId,
        lessonNumber,
        textbookKey,
        vocabCount: vocab.length,
        grammarCount: grammar.length,
        scenarioCount: scenarios.length,
        workbookTaskCount: workbookTasks.length,
        maynardMatchCount,
        maynardDirectCount,
        maynardCuratedCount,
        maynardCoveragePct: grammar.length > 0 ? Math.round((maynardMatchCount / grammar.length) * 100) : 0,
        suspiciousVocabCount: vocab.filter(item => suspiciousVocab(item.surface, item.english)).length,
        assetCount: assets.length,
        pageRange: pageRange([...vocab.map(item => item.page), ...grammar.map(item => item.page)]),
      }
      rows.push({ ...rowBase, warnings: warnings(rowBase) })
    }
  }

  return rows
}
