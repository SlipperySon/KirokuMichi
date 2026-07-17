import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearScenarioPractice,
  hasScenarioPractice,
  markScenarioPracticeComplete,
  tryCompleteScenarioPractice,
} from './scenarioPracticeGate'

describe('scenarioPracticeGate', () => {
  beforeEach(() => {
    clearScenarioPractice('genki_1_1')
  })

  it('records valid Japanese scenario output', () => {
    expect(tryCompleteScenarioPractice('genki_1_1', 'わたしは学生です')).toBe(true)
    expect(hasScenarioPractice('genki_1_1')).toBe(true)
  })

  it('rejects romaji-only chat', () => {
    expect(tryCompleteScenarioPractice('genki_1_1', 'konnichiwa')).toBe(false)
    expect(hasScenarioPractice('genki_1_1')).toBe(false)
  })

  it('clears practice markers', () => {
    markScenarioPracticeComplete('genki_1_1')
    clearScenarioPractice('genki_1_1')
    expect(hasScenarioPractice('genki_1_1')).toBe(false)
  })
})
