export interface ReviewCard {
  cardStateId: number
  cardId: number
  type: 'vocabulary' | 'kanji' | 'grammar' | 'hiragana' | 'katakana'
  front: string
  back: string
  reading: string | null
  audioUrl: string | null
  jlptLevel: string | null
  state: 'new' | 'learning' | 'review' | 'relearning'
  lapses: number
  stability: number
  difficulty: number
  due: string
}

export interface IntervalPreview {
  again: string
  hard: string
  good: string
  easy: string
}

export interface SessionStats {
  cardsReviewed: number
  correctCount: number
  startedAt: number
}

export interface SessionRecoveryPayload {
  sessionId: number
  userId: number
  mode: string
  queue: ReviewCard[]
  currentIndex: number
  stats: SessionStats
  savedAt: number
}

export interface GrammarQuestion {
  questionId: number
  prompt: string
  options: string[]
  answer: string
  explanation: string | null
  grammarPointId: number | null
}

export interface HeatmapDay {
  date: string
  cardsReviewed: number
  sessionCount: number
  vocabReviewed: number
  grammarReviewed: number
}

export interface StreakData {
  currentStreak: number
  longestStreak: number
  days: HeatmapDay[]
}
