import { describe, expect, it } from 'vitest'
import {
  answersMatch,
  buildTypedRecallQuestion,
  gradeTypedRecall,
  injectTypedRecall,
  isMostlyKana,
  normalizeTypedAnswer,
  rememberImeKanaReading,
  toHiragana,
} from './typedRecall'
import type { QuizQuestion, TeachItem } from './lessonStudyPlanner'

const vocabItem: TeachItem = {
  id: 'vocab:1',
  type: 'vocab',
  title: '学生',
  body: 'student',
  order: 0,
}

const kanaVocab: TeachItem = {
  id: 'vocab:2',
  type: 'vocab',
  title: 'だいがく',
  body: 'college; university',
  order: 1,
}

const attachmentVocab: TeachItem = {
  id: 'vocab:3',
  type: 'vocab',
  title: '~さん',
  body: 'Mr./Ms. ...',
  order: 2,
}

describe('typedRecall', () => {
  it('builds a typed recall question from vocab teach items', () => {
    const q = buildTypedRecallQuestion(vocabItem, 'salt')
    expect(q?.recallMode).toBe('typed')
    expect(q?.correctAnswer).toBe('学生')
    expect(q?.options).toEqual([])
  })

  it('grades typed answers with whitespace and kana normalization', () => {
    expect(gradeTypedRecall(' 学生 ', '学生')).toBe(true)
    expect(gradeTypedRecall('ダイガク', 'だいがく')).toBe(true)
    expect(gradeTypedRecall('がくせい', '学生')).toBe(false)
  })

  it('accepts bare stems for Genki attachment surfaces like ~さん', () => {
    expect(normalizeTypedAnswer('~さん')).toBe('さん')
    expect(normalizeTypedAnswer('〜さん')).toBe('さん')
    expect(gradeTypedRecall('さん', '~さん')).toBe(true)
    expect(gradeTypedRecall('サン', '〜さん')).toBe(true)
    expect(answersMatch('さん', '~さん')).toBe(true)
    expect(gradeTypedRecall('せんせい', '~さん')).toBe(false)
  })

  it('accepts IME reading when keyboard converted kana to kanji', () => {
    expect(gradeTypedRecall('大学', 'だいがく', { alsoAccept: ['だいがく'] })).toBe(true)
    expect(gradeTypedRecall('大学', 'だいがく')).toBe(false)
    // Unrelated IME buffer must not force a pass for a kana edit.
    expect(gradeTypedRecall('ねこ', 'だいがく', { alsoAccept: ['だいがく'] })).toBe(false)
    // Wrong kanji after a correct composition still passes today only when kanji remains;
    // stale kana edits must not.
    expect(gradeTypedRecall('がくせい', '学生', { alsoAccept: ['がくせい'] })).toBe(true)
  })

  it('tracks the last kana-only composition for IME assist', () => {
    expect(rememberImeKanaReading('', 'だいがく')).toBe('だいがく')
    expect(rememberImeKanaReading('だいがく', '大学')).toBe('だいがく')
    expect(isMostlyKana('だいがく')).toBe(true)
    expect(isMostlyKana('大学')).toBe(false)
    expect(toHiragana('ダイガク')).toBe('だいがく')
  })

  it('prompts kana / attachment answers appropriately', () => {
    expect(buildTypedRecallQuestion(kanaVocab, 'salt')?.promptLabel).toMatch(/kana/i)
    expect(buildTypedRecallQuestion(attachmentVocab, 'salt')?.promptLabel).toMatch(/placeholder/i)
  })

  it('injects one typed item at the front of checkpoint questions', () => {
    const mcq: QuizQuestion = {
      itemId: 'q1',
      type: 'vocab',
      prompt: '学生',
      promptLabel: 'Meaning',
      correctAnswer: 'student',
      options: ['student', 'teacher'],
    }
    const out = injectTypedRecall([mcq], [vocabItem], 'genki_1_1:cp:1')
    expect(out[0]?.recallMode).toBe('typed')
    expect(out.some(q => q.recallMode === 'typed')).toBe(true)
  })
})
