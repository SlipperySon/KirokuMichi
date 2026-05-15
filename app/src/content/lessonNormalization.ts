/**
 * Lesson ID Normalization and Structure Service
 * Converts messy lesson IDs from OCR extraction to clean, normalized format
 * Provides lesson-by-lesson structure mapping (textbook + workbook + Anki)
 */

export interface LessonContent {
  vocab: number
  grammar: number
  dialogues: number
  exercises: number
}

export interface LessonReference {
  original_id: string
  vocab: number
  grammar: number
  dialogues: number
  exercises: number
}

export interface LessonStructure {
  normalized_id: string
  series: string
  lesson_number: number
  textbook: LessonReference | null
  workbook: LessonReference | null
  content: LessonContent
}

export interface LessonStructureFile {
  version: string
  generated_at: string
  total_lessons: number
  series_list: string[]
  lessons: LessonStructure[]
}

/**
 * Normalize messy lesson IDs to clean format
 * Examples:
 *   "1_textbook_genki_1_1" → "genki_1_1"
 *   "1_workbook_genki_1_1" → "genki_1_1"
 *   "genki_1_1" → "genki_1_1" (already normalized)
 */
export function normalizeLessonId(originalId: string): string {
  // Already normalized: genki_1_1, genki_2_1, etc
  if (/^[a-z]+_[a-z0-9]+_\d+$/.test(originalId)) return originalId

  // With prefixes: 1_textbook_genki_1_1 -> genki_1_1
  let match = originalId.match(/genki_([12])_(\d+)/)
  if (match) return `genki_${match[1]}_${match[2]}`

  // Marugoto
  match = originalId.match(/marugoto_(a[12]|b[12])_(\d+)/)
  if (match) return `marugoto_${match[1]}_${match[2]}`

  // Quartet
  match = originalId.match(/quartet_([12])_(\d+)/)
  if (match) return `quartet_${match[1]}_${match[2]}`

  // Tobira
  match = originalId.match(/tobira_(\d+)/)
  if (match) return `tobira_${match[1]}`

  // Fallback: extract series and number
  match = originalId.match(/(\d+)$/)
  if (match) return `unknown_${match[1]}`

  return originalId
}

/**
 * Get series name from normalized lesson ID
 */
export function getSeriesName(normalizedId: string): string {
  if (normalizedId.startsWith('genki_1')) return 'Genki I'
  if (normalizedId.startsWith('genki_2')) return 'Genki II'
  if (normalizedId.startsWith('marugoto_a1')) return 'Marugoto A1'
  if (normalizedId.startsWith('marugoto_a2')) return 'Marugoto A2'
  if (normalizedId.startsWith('marugoto_b1')) return 'Marugoto B1'
  if (normalizedId.startsWith('quartet_1')) return 'Quartet 1'
  if (normalizedId.startsWith('quartet_2')) return 'Quartet 2'
  if (normalizedId.startsWith('tobira')) return 'Tobira'
  return 'Unknown'
}

/**
 * Extract lesson number from normalized ID
 */
export function extractLessonNumber(normalizedId: string): number {
  const match = normalizedId.match(/(\d+)$/)
  return match ? parseInt(match[1]) : 0
}

/**
 * Lesson Structure Service
 * Loads and caches the lesson structure JSON
 */
class LessonStructureService {
  private cache: LessonStructureFile | null = null
  private lessonMap: Map<string, LessonStructure> = new Map()

  async loadStructure(): Promise<LessonStructureFile> {
    if (this.cache) return this.cache

    try {
      const response = await fetch('/data/generated/lesson-structure.json')
      if (!response.ok) {
        throw new Error(`Failed to load lesson structure: ${response.status} ${response.statusText}`)
      }

      const text = await response.text()
      if (!text) {
        throw new Error('Empty response from lesson structure endpoint')
      }

      this.cache = JSON.parse(text) as LessonStructureFile

      // Build lesson map for quick lookup
      this.cache.lessons.forEach(lesson => {
        this.lessonMap.set(lesson.normalized_id, lesson)
      })

      return this.cache
    } catch (error) {
      console.error('Error loading lesson structure:', error)
      throw error
    }
  }

  async getLesson(normalizedId: string): Promise<LessonStructure | null> {
    await this.loadStructure()
    return this.lessonMap.get(normalizedId) || null
  }

  async getLessonsBySeries(series: string): Promise<LessonStructure[]> {
    const structure = await this.loadStructure()
    return structure.lessons.filter(l => l.series === series)
  }

  async getAllLessons(): Promise<LessonStructure[]> {
    const structure = await this.loadStructure()
    return structure.lessons
  }

  async getSeriesLessons(): Promise<Map<string, LessonStructure[]>> {
    const structure = await this.loadStructure()
    const map = new Map<string, LessonStructure[]>()

    structure.series_list.forEach(series => {
      const lessons = structure.lessons.filter(l => l.series === series)
      map.set(series, lessons)
    })

    return map
  }

  /**
   * Get lesson with both textbook and workbook
   */
  async getLessonWithBoth(normalizedId: string): Promise<{
    lesson: LessonStructure
    hasTextbook: boolean
    hasWorkbook: boolean
  } | null> {
    const lesson = await this.getLesson(normalizedId)
    if (!lesson) return null

    return {
      lesson,
      hasTextbook: lesson.textbook !== null,
      hasWorkbook: lesson.workbook !== null,
    }
  }

  /**
   * Get total content count for a lesson
   */
  async getLessonContentCount(normalizedId: string): Promise<LessonContent | null> {
    const lesson = await this.getLesson(normalizedId)
    return lesson?.content || null
  }

  clearCache(): void {
    this.cache = null
    this.lessonMap.clear()
  }
}

export const lessonStructureService = new LessonStructureService()
