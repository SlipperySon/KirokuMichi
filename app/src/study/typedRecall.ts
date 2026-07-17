import type { QuizQuestion, TeachItem } from './lessonStudyPlanner'

function normalizeTypedAnswer(value: string): string {
  return value.trim().replace(/\s+/g, '')
}

/** One free-recall item per checkpoint chunk (English → type Japanese). */
export function buildTypedRecallQuestion(item: TeachItem, salt: string): QuizQuestion | null {
  if (item.type !== 'vocab') return null
  return {
    itemId: `${item.id}:typed`,
    type: 'vocab',
    prompt: item.body,
    promptLabel: 'Type the Japanese (free recall)',
    correctAnswer: item.title,
    options: [],
    recallMode: 'typed',
  }
}

export function gradeTypedRecall(answer: string, correct: string): boolean {
  const a = normalizeTypedAnswer(answer)
  const c = normalizeTypedAnswer(correct)
  if (!a || !c) return false
  return a === c
}

export function injectTypedRecall(questions: QuizQuestion[], chunkItems: TeachItem[], salt: string): QuizQuestion[] {
  const typedTarget = chunkItems.find(i => i.type === 'vocab')
  if (!typedTarget) return questions
  const typed = buildTypedRecallQuestion(typedTarget, salt)
  if (!typed) return questions
  if (questions.some(q => q.recallMode === 'typed')) return questions
  return [typed, ...questions.slice(0, 3)]
}
