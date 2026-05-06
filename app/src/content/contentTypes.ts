export interface GrammarExample {
  japanese: string
  reading: string
  english: string
}

export interface GrammarPoint {
  id: number
  jlptLevel: string
  title: string
  pattern: string
  meaning: string
  explanation: string
  examples: GrammarExample[]
  category: string | null
  isKeigo: boolean
  frequencyRank: number | null
}

export interface VocabItem {
  id: number
  front: string
  back: string
  reading: string | null
  jlptLevel: string | null
  frequencyRank: number | null
  domain: string | null
  audioUrl: string | null
  isLearned: boolean
}

export interface QuizItem {
  id: number
  grammarPointId: number | null
  jlptLevel: string
  questionType: string
  prompt: string
  options: string[]
  answer: string
  explanation: string | null
}

export type JlptLevel = 'N5' | 'N4' | 'N3' | 'N2' | 'N1'
