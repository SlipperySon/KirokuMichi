import { describe, expect, it } from 'vitest'
import { extractLessonTerms, findBestMatch, lessonTermVariants } from './cardMatcher'

describe('cardMatcher', () => {
  it('matches common Genki formatting variants', () => {
    expect(findBestMatch('～です', ['です'])?.score).toBeGreaterThan(0)
    expect(findBestMatch('おやすみ（なさい）', ['おやすみ'])?.matchType).toBe('exact')
    expect(findBestMatch('れい', extractLessonTerms([{ surface: 'ゼロ / れい' }], []))?.lessonTerm).toBe('れい')
  })

  it('expands slash and middle-dot lesson terms', () => {
    expect(lessonTermVariants('食べる・飲む')).toEqual(expect.arrayContaining(['食べる', '飲む']))
    expect(lessonTermVariants('なん／なに')).toEqual(expect.arrayContaining(['なん', 'なに']))
  })

  it('does not substring-match short attachment stems like ~さん', () => {
    expect(findBestMatch('おねえさん', ['~さん'])).toBeNull()
    expect(findBestMatch('さん', ['~さん'])?.matchType).toBe('exact')
  })
})
