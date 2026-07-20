import { describe, expect, it } from 'vitest'
import { buildTypedRecallQuestion, gradeTypedRecall, injectTypedRecall } from './typedRecall'
import type { QuizQuestion, TeachItem } from './lessonStudyPlanner'

const vocabItem: TeachItem = {
  id: 'vocab:1',
  type: 'vocab',
  title: '学生',
  body: 'student',
  order: 0,
}

describe('typedRecall', () => {
  it('builds a typed recall question from vocab teach items', () => {
    const q = buildTypedRecallQuestion(vocabItem, 'salt')
    expect(q?.recallMode).toBe('typed')
    expect(q?.correctAnswer).toBe('学生')
    expect(q?.options).toEqual([])
  })

  it('grades typed answers with whitespace normalization', () => {
    expect(gradeTypedRecall(' 学生 ', '学生')).toBe(true)
    expect(gradeTypedRecall('がくせい', '学生')).toBe(false)
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
