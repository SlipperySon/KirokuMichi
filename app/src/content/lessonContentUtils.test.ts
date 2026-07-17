import { describe, expect, it } from 'vitest'
import { canonicalSourceLessonId, coreLessonIdFromSource, createLessonMatcher, lessonAliasesFor, storageLessonIdsFor } from './lessonContentUtils'

describe('lesson content matching', () => {
  it('keeps plain Genki I lesson matching intact', () => {
    const matches = createLessonMatcher('genki_1_3', 3)

    expect(matches('genki_1_3')).toBe(true)
    expect(matches('1_textbook_genki_1_3')).toBe(true)
    expect(matches('genki_1')).toBe(false)
    expect(matches('genki_1_4')).toBe(false)
  })

  it('maps app Genki II lessons to source lesson numbers 13-23', () => {
    const matches = createLessonMatcher('genki_2_1', 1)

    expect(canonicalSourceLessonId('genki_2_1')).toBe('genki_2_13')
    expect(lessonAliasesFor('genki_2_1', 1).has('genki_2_13')).toBe(true)
    expect(matches('genki_2_13')).toBe(true)
    expect(matches('2_workbook_genki_2_13')).toBe(true)
    expect(matches('genki_2_14')).toBe(false)
  })

  it('maps Genki II source lessons back to learner-facing lesson ids', () => {
    expect(coreLessonIdFromSource('genki_2_13')).toBe('genki_2_1')
    expect(coreLessonIdFromSource('genki_2_23')).toBe('genki_2_11')
    expect(coreLessonIdFromSource('genki_2_5')).toBe('genki_2_5')
  })

  it('keeps storage lesson ids to real lesson identifiers only', () => {
    expect(storageLessonIdsFor('genki_1_1')).toEqual(['genki_1_1'])
    expect(storageLessonIdsFor('genki_2_1')).toEqual(['genki_2_1', 'genki_2_13'])
    expect(storageLessonIdsFor('genki_2_13')).toEqual(['genki_2_1', 'genki_2_13'])
  })

  it('maps app Quartet II lessons to source lesson numbers 7-12', () => {
    const matches = createLessonMatcher('quartet_2_1', 1)

    expect(canonicalSourceLessonId('quartet_2_1')).toBe('quartet_2_7')
    expect(lessonAliasesFor('quartet_2_1', 1).has('quartet_2_7')).toBe(true)
    expect(matches('quartet_2_7')).toBe(true)
    expect(matches('2_workbook_quartet_2_7')).toBe(true)
    expect(matches('quartet_2_8')).toBe(false)
  })

  it('maps Quartet II source lessons back to learner-facing lesson ids', () => {
    expect(coreLessonIdFromSource('quartet_2_7')).toBe('quartet_2_1')
    expect(coreLessonIdFromSource('quartet_2_12')).toBe('quartet_2_6')
    expect(coreLessonIdFromSource('quartet_1_3')).toBe('quartet_1_3')
  })
})
