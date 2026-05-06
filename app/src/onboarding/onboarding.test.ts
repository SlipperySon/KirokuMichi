import { describe, it, expect } from 'vitest'
import { buildKanaQuiz, HIRAGANA, KATAKANA } from './kana-data'
import { PLACEMENT_QUESTIONS, CEFR_TIERS, getQuestionsForTier, pickRandom, cefrToJlpt } from './placement-data'

describe('buildKanaQuiz', () => {
  it('returns the requested number of questions', () => {
    const quiz = buildKanaQuiz(HIRAGANA, 10)
    expect(quiz).toHaveLength(10)
  })

  it('each question has exactly 4 options', () => {
    const quiz = buildKanaQuiz(KATAKANA, 5)
    for (const q of quiz) {
      expect(q.options).toHaveLength(4)
    }
  })

  it('correct answer is always among the options', () => {
    const quiz = buildKanaQuiz(HIRAGANA, 10)
    for (const q of quiz) {
      expect(q.options).toContain(q.target.romaji)
    }
  })

  it('hiragana set has 46 base characters', () => {
    expect(HIRAGANA).toHaveLength(46)
  })

  it('katakana set has 46 base characters', () => {
    expect(KATAKANA).toHaveLength(46)
  })
})

describe('placement question bank', () => {
  it('covers all 6 CEFR levels', () => {
    const levels = new Set(PLACEMENT_QUESTIONS.map(q => q.level))
    expect(levels.size).toBe(6)
    expect(levels).toContain('A1')
    expect(levels).toContain('C2')
  })

  it('every question has exactly 4 options', () => {
    for (const q of PLACEMENT_QUESTIONS) {
      expect(q.options).toHaveLength(4)
    }
  })

  it('correct answer is always among the options', () => {
    for (const q of PLACEMENT_QUESTIONS) {
      expect(q.options).toContain(q.answer)
    }
  })

  it('getQuestionsForTier returns only matching questions', () => {
    const qs = getQuestionsForTier('B1', 'mid')
    expect(qs.every(q => q.level === 'B1' && q.sublevel === 'mid')).toBe(true)
    expect(qs.length).toBeGreaterThan(0)
  })

  it('pickRandom returns requested count and no duplicates', () => {
    const pool = getQuestionsForTier('A1', 'early')
    const picked = pickRandom(pool, 3)
    expect(picked).toHaveLength(3)
    const ids = picked.map(q => q.id)
    expect(new Set(ids).size).toBe(3)
  })

  it('CEFR_TIERS has 17 tiers in order A1-early to C2-late', () => {
    expect(CEFR_TIERS).toHaveLength(17)
    expect(CEFR_TIERS[0]).toEqual({ level: 'A1', sublevel: 'early' })
    expect(CEFR_TIERS[CEFR_TIERS.length - 1]).toEqual({ level: 'C2', sublevel: 'late' })
  })

  it('cefrToJlpt maps correctly', () => {
    expect(cefrToJlpt('A1')).toBe('N5')
    expect(cefrToJlpt('B1')).toBe('N3')
    expect(cefrToJlpt('C2')).toBe('N1')
  })
})
