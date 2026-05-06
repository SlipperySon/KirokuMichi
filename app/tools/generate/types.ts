export interface KanjiData {
  kanji: string
  grade?: number
  stroke_count: number
  meanings: string[]
  on_readings: string[]
  kun_readings: string[]
  jlpt_old?: number
  jlpt_new?: number
  frequency?: number
  wk_level?: number
}

export interface VocabData {
  front: string
  back: string
  reading: string
  jlptLevel: 'N5' | 'N4' | 'N3' | 'N2' | 'N1'
  frequencyRank?: number
  domain?: string
  audioUrl?: string
}

export interface GrammarData {
  jlptLevel: 'N5' | 'N4' | 'N3' | 'N2' | 'N1'
  title: string
  pattern: string
  meaning: string
  explanation: string
  examples: Array<{ japanese: string; reading: string; english: string }>
  category?: string
  isKeigo?: boolean
  frequencyRank?: number
}

export interface QuizData {
  grammarPointId?: number
  jlptLevel: 'N5' | 'N4' | 'N3' | 'N2' | 'N1'
  questionType: 'multiple_choice' | 'fill_blank' | 'listening' | 'reading'
  prompt: string
  options: string[]
  answer: string
  explanation: string
}

export interface GenerationResult {
  success: boolean
  message: string
  count: number
  errors?: string[]
}
