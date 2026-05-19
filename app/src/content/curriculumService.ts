import { TEXTBOOK_FILES, EXTRACTION_SUMMARY } from './dataRegistry'

export interface VocabItem {
  id: string
  surface: string
  english: string
  lesson: string
  source: string
  page: number
}

export interface GrammarItem {
  id: string
  pattern: string
  meaning: string
  explanation?: string
  examples?: Array<{ japanese: string; reading?: string; english: string }>
  maynardRef?: {
    topicId: string
    title: string
    excerpt: string
    examples: Array<{ japanese: string; english?: string }>
    sourceId?: string
    sourceKind?: 'attached' | 'direct' | 'curated-support'
    confidence?: 'direct' | 'keyword' | 'curated'
    pageStart?: number
    pageEnd?: number
  }
  lesson: string
  source: string
  page: number
  category?: string
  cefrLevel?: string
  jlptLevel?: string
  frequencyRank?: number
}

export interface DialogueLine {
  speaker: string
  japanese: string
}

export interface Dialogue {
  id: string
  lesson: string
  title: string
  participants: string[]
  lines: DialogueLine[]
  source: string
  page: number
}

export interface Exercise {
  id: string
  lesson: string
  type: string
  question: string
  source: string
  page: number
}

export interface TextbookCurriculum {
  textbook: string
  generatedAt: string
  statistics: {
    vocab: number
    grammar: number
    dialogues: number
    exercises: number
  }
  vocabulary: VocabItem[]
  grammar: GrammarItem[]
  dialogues: Dialogue[]
  exercises: Exercise[]
}

export interface ExtractionSummary {
  extractedAt: string
  version: string
  sourcePages: number
  totalItems: {
    vocabulary: number
    grammar: number
    dialogues: number
    exercises: number
  }
  byTextbook: Record<
    string,
    {
      pages: number
      vocabulary: number
      grammar: number
      dialogues: number
      exercises: number
    }
  >
}

class CurriculumService {
  private cache: Map<string, TextbookCurriculum> = new Map()
  private summaryCache: ExtractionSummary | null = null

  async getTextbookCurriculum(textbookName: string): Promise<TextbookCurriculum | null> {
    // Check cache first
    if (this.cache.has(textbookName)) {
      return this.cache.get(textbookName)!
    }

    const filePath = TEXTBOOK_FILES[textbookName]
    if (!filePath) {
      console.warn(`No curriculum file found for textbook: ${textbookName}`)
      return null
    }

    try {
      const response = await fetch(filePath)
      if (!response.ok) {
        console.error(`Failed to load curriculum for ${textbookName}`)
        return null
      }

      const data = (await response.json()) as TextbookCurriculum
      this.cache.set(textbookName, data)
      return data
    } catch (error) {
      console.error(`Error loading curriculum for ${textbookName}:`, error)
      return null
    }
  }

  async getExtractionSummary(): Promise<ExtractionSummary | null> {
    if (this.summaryCache) {
      return this.summaryCache
    }

    try {
      const response = await fetch(EXTRACTION_SUMMARY)
      if (!response.ok) {
        console.error('Failed to load extraction summary')
        return null
      }

      this.summaryCache = (await response.json()) as ExtractionSummary
      return this.summaryCache
    } catch (error) {
      console.error('Error loading extraction summary:', error)
      return null
    }
  }

  async getAllTextbookNames(): Promise<string[]> {
    const summary = await this.getExtractionSummary()
    if (!summary) return []
    return Object.keys(summary.byTextbook)
  }

  async getVocabularyByLesson(textbookName: string, lesson: string): Promise<VocabItem[]> {
    const curriculum = await this.getTextbookCurriculum(textbookName)
    if (!curriculum) return []
    return curriculum.vocabulary.filter(v => v.lesson === lesson)
  }

  async getGrammarByLesson(textbookName: string, lesson: string): Promise<GrammarItem[]> {
    const curriculum = await this.getTextbookCurriculum(textbookName)
    if (!curriculum) return []
    return curriculum.grammar.filter(g => g.lesson === lesson)
  }

  async getDialoguesByLesson(textbookName: string, lesson: string): Promise<Dialogue[]> {
    const curriculum = await this.getTextbookCurriculum(textbookName)
    if (!curriculum) return []
    return curriculum.dialogues.filter(d => d.lesson === lesson)
  }

  async getExercisesByLesson(textbookName: string, lesson: string): Promise<Exercise[]> {
    const curriculum = await this.getTextbookCurriculum(textbookName)
    if (!curriculum) return []
    return curriculum.exercises.filter(e => e.lesson === lesson)
  }

  async getLessonContent(
    textbookName: string,
    lesson: string
  ): Promise<{
    vocab: VocabItem[]
    grammar: GrammarItem[]
    dialogues: Dialogue[]
    exercises: Exercise[]
  }> {
    const [vocab, grammar, dialogues, exercises] = await Promise.all([
      this.getVocabularyByLesson(textbookName, lesson),
      this.getGrammarByLesson(textbookName, lesson),
      this.getDialoguesByLesson(textbookName, lesson),
      this.getExercisesByLesson(textbookName, lesson),
    ])

    return { vocab, grammar, dialogues, exercises }
  }

  clearCache(): void {
    this.cache.clear()
    this.summaryCache = null
  }
}

export const curriculumService = new CurriculumService()
