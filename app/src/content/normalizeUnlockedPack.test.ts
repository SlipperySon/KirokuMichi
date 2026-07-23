import { describe, expect, it } from 'vitest'
import { normalizeUnlockedPackPayload } from './normalizeUnlockedPack'

describe('normalizeUnlockedPackPayload', () => {
  it('maps canonical proof lessons into extraction shape', () => {
    const result = normalizeUnlockedPackPayload({
      title: 'Genki I',
      lessons: [{
        title: 'Lesson 1',
        vocabulary: [
          { surface: 'だいがく', reading: 'daigaku', meaning: 'college' },
        ],
        grammar: [
          {
            pattern: 'XはYです',
            meaning: 'X is Y',
            examples: [{ japanese: 'せんこうはにほんごです。', english: 'My major is Japanese.' }],
          },
        ],
        contentBlocks: [
          { type: 'dialogue', title: 'Dialogue', text: 'A: こんにちは' },
        ],
      }],
    }, 'fallback')

    expect(result.source_title).toBe('Genki I')
    expect(result.vocab).toEqual([
      { word: 'だいがく', reading: 'daigaku', meaning: 'college', jlpt_level: undefined, example_ja: undefined, example_en: undefined },
    ])
    expect(result.grammar[0]?.pattern).toBe('XはYです')
    expect(result.grammar[0]?.examples[0]?.en).toBe('My major is Japanese.')
    expect(result.lessons[0]?.content_type).toBe('dialogue_script')
    expect(result.lessons[0]?.body).toContain('こんにちは')
  })

  it('passes through extraction-shaped payloads', () => {
    const result = normalizeUnlockedPackPayload({
      source_title: 'Custom',
      vocab: [{ word: '猫', reading: 'ねこ', meaning: 'cat' }],
      grammar: [],
      lessons: [{ content_type: 'text_passage', title: 'Note', body: 'ねこです', sequence: 0 }],
    }, 'fallback')

    expect(result.vocab[0]?.word).toBe('猫')
    expect(result.lessons).toHaveLength(1)
  })
})
