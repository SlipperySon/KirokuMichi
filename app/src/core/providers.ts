export interface Token {
  surface: string
  reading: string
  dictionaryForm: string
  partOfSpeech: string
  grammaticalRole?: string
}

export interface ScheduleResult {
  due: Date
  stability: number
  difficulty: number
  retrievability: number
  state: 'new' | 'learning' | 'review' | 'relearning'
  reps: number
  lapses: number
}

export type Rating = 'again' | 'hard' | 'good' | 'easy'

export interface CardState {
  due: Date
  stability: number
  difficulty: number
  retrievability: number
  state: 'new' | 'learning' | 'review' | 'relearning'
  reps: number
  lapses: number
}

export interface SegmentationProvider {
  segment(text: string): Promise<Token[]>
}

export interface SchedulerProvider {
  schedule(card: CardState, rating: Rating): ScheduleResult
  getNewCard(): CardState
}

export interface StorageProvider {
  query<T>(sql: string, params?: unknown[]): Promise<T[]>
  execute(sql: string, params?: unknown[]): Promise<void>
  close(): Promise<void>
}

export interface AIMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface AIProvider {
  complete(prompt: string, tier: 'fast' | 'reasoning'): Promise<string>
  completeWithMessages(messages: AIMessage[], system?: string, tier?: 'fast' | 'reasoning'): Promise<string>
  completeStream(prompt: string, tier: 'fast' | 'reasoning'): AsyncIterable<string>
}

export interface KeyStorageProvider {
  get(key: string): Promise<string | null>
  set(key: string, value: string): Promise<void>
  delete(key: string): Promise<void>
}
