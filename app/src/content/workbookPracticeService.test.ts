import { describe, expect, it } from 'vitest'
import { isUsableWorkbookExercise, normalizeWorkbookPracticePrompt } from './workbookPracticeService'
import type { Exercise } from './curriculumService'

function exercise(question: string, page: number): Exercise {
  return {
    id: `${page}:${question}`,
    lesson: 'genki_1_1',
    type: 'practice',
    question,
    source: 'genki_1_workbook',
    page,
  }
}

describe('workbook practice filtering', () => {
  it('rejects front matter and OCR admin text', () => {
    expect(isUsableWorkbookExercise(exercise('このワークブックはテキスト初級日本語げんきの補助教材です。', 7))).toBe(false)
  })

  it('keeps usable workbook output tasks', () => {
    expect(isUsableWorkbookExercise(exercise('友だちに質問して、答えを書いてください。', 42))).toBe(true)
  })

  it('keeps early workbook tasks when the prompt is real practice content', () => {
    expect(isUsableWorkbookExercise(exercise('ペアで週末の予定について質問して、答えてください。', 12))).toBe(true)
  })

  it('turns generic answer prompts into usable learner tasks', () => {
    expect(normalizeWorkbookPracticePrompt('日本語で答えてくださ。(Answer the questions in Japanese.)', {
      cefr: 'a2',
      lessonNum: 1,
      type: 'short_answer',
    })).toBe('Answer the workbook questions in Japanese, then add one original A2 Lesson 1 sentence of your own.')
  })

  it('turns sentence-completion fragments into grammar-aware practice', () => {
    expect(normalizeWorkbookPracticePrompt('の言葉を使って、文を完成させなさい。必要なら形を変えなさい。', {
      cefr: 'b2',
      lessonNum: 1,
      type: 'guided_drill',
    })).toBe('Complete the workbook sentences, then explain which grammar clue told you the missing form.')
  })

  it('rejects broken continuation fragments that are not standalone tasks', () => {
    expect(isUsableWorkbookExercise(exercise('う。その後、グループで話しましょう。', 26))).toBe(false)
  })
})
