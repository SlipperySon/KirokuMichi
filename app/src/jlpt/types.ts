import type { JlptLevel } from '../content/contentTypes'

export type JlptTab = 'grammar' | 'vocab' | 'practice' | 'test' | 'keigo'

export interface LevelProgress {
  level: JlptLevel
  grammarTotal: number
  vocabTotal: number
  learnedCount: number
}

export interface TestResult {
  total: number
  correct: number
  wrongIds: number[]
  durationMs: number
  level: JlptLevel
  mode: 'practice' | 'simulated'
}
