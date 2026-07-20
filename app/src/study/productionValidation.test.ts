import { describe, expect, it } from 'vitest'
import {
  speakRequiredFragments,
  validateJapaneseProduction,
  validateWorkbookTask,
} from './productionValidation'

describe('productionValidation', () => {
  it('rejects romaji-only output', () => {
    expect(validateJapaneseProduction('konnichiwa').ok).toBe(false)
  })

  it('accepts hiragana with required fragment', () => {
    const result = validateJapaneseProduction('わたしは学生です', {
      requiredFragments: ['学生'],
    })
    expect(result.ok).toBe(true)
  })

  it('enforces speak minChars of 8 when requested', () => {
    expect(validateJapaneseProduction('学生です', { minChars: 8 }).ok).toBe(false)
    expect(validateJapaneseProduction('わたしは学生です', { minChars: 8 }).ok).toBe(true)
  })

  it('requires lesson fragment in speak validation', () => {
    const result = validateJapaneseProduction('こんにちは', {
      requiredFragments: ['です'],
    })
    expect(result.ok).toBe(false)
    expect(result.message).toContain('です')
  })

  it('picks grammar pattern for speak fragments first', () => {
    expect(
      speakRequiredFragments(
        [{ id: 'g', pattern: 'です', meaning: 'to be', lesson: 'l', source: 's', page: 1 }],
        [{ surface: '学生' }],
      ),
    ).toEqual(['です'])
  })

  it('validates workbook tasks with minimum length', () => {
    expect(validateWorkbookTask('abc').ok).toBe(false)
    expect(validateWorkbookTask('わたしは学生です').ok).toBe(true)
  })
})
