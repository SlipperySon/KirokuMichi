import { describe, expect, it } from 'vitest'
import {
  isLearnerSafeVocab,
  isSchemaGrammarPattern,
  resolveGrammarCloze,
  vocabGlossIssues,
} from './vocabGlossQuality'

describe('vocabGlossQuality', () => {
  it('accepts clean Genki glosses', () => {
    expect(isLearnerSafeVocab('だいがく', 'college; university')).toBe(true)
    expect(isLearnerSafeVocab('ねこ', 'cat')).toBe(true)
    expect(isLearnerSafeVocab('乗る', 'to board (~に)')).toBe(true)
  })

  it('rejects OCR scars and obscure entries', () => {
    expect(vocabGlossIssues('ね二', 'cat')).toContain('ocr_ni_scar')
    expect(vocabGlossIssues('ある', 'l二 thing)')).toContain('ocr_ni_scar')
    expect(vocabGlossIssues('ぎんこう', 'bank イ konbini')).toContain('jp_in_english_gloss')
    expect(vocabGlossIssues('い', 'To recap the rules for telling which verb')).toContain(
      'kana_fragment_obscure',
    )
    expect(vocabGlossIssues('私はよくテレビを見ます。', 'TV')).toContain('sentence_as_vocab_surface')
    expect(isLearnerSafeVocab('元元', 'yes')).toBe(false)
  })

  it('detects schema grammar patterns', () => {
    expect(isSchemaGrammarPattern('XはYです')).toBe(true)
    expect(isSchemaGrammarPattern('Noun1のNoun2')).toBe(true)
    expect(isSchemaGrammarPattern('です')).toBe(false)
  })

  it('resolves cloze from compound / schema-adjacent patterns', () => {
    expect(resolveGrammarCloze('これ/それ/あれ/どれ', 'これはいくらですか。')).toEqual({
      prompt: '[___]はいくらですか。',
      answer: 'これ',
    })
    expect(resolveGrammarCloze('Question Sentences: ~か', '学生ですか。')).toEqual({
      prompt: '学生です[___]。',
      answer: 'か',
    })
    expect(resolveGrammarCloze('XはYです', 'わたしは学生です。')).toBeNull()
  })
})
