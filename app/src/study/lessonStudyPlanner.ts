export interface VocabItem {
  id: string
  surface: string
  english: string
  lesson: string
  source: string
  page: number
}

export interface GrammarExample {
  japanese: string
  reading?: string
  english: string
}

export interface MaynardRef {
  topicId: string
  title: string
  excerpt: string
  examples: Array<{ japanese: string; english?: string }>
}

export interface GrammarItem {
  id: string
  pattern: string
  meaning: string
  explanation?: string
  examples?: GrammarExample[]
  maynardRef?: MaynardRef
  lesson: string
  source: string
  page: number
}

export interface LessonStudyState {
  vocab: VocabItem[]
  grammar: GrammarItem[]
  lessonId: string
  lessonTitle: string
  cefrLevel: string
  intent?: LessonIntent
  workbookPractice?: WorkbookPracticeTask[]
}

export type TeachItem =
  | { type: 'vocab'; id: string; title: string; body: string; source?: string; page?: number; order: number }
  | { type: 'grammar'; id: string; title: string; body: string; source?: string; page?: number; order: number; explanation?: string; examples?: GrammarExample[]; maynardRef?: MaynardRef; explanationPlan: GrammarExplanationPlan }

export interface QuizQuestion {
  itemId: string
  type: 'vocab' | 'grammar'
  prompt: string
  promptLabel: string
  correctAnswer: string
  options: string[]
}

export type LessonStep =
  | { kind: 'teach'; title: string; goal: string; items: TeachItem[] }
  | { kind: 'checkpoint'; title: string; goal: string; questions: QuizQuestion[] }
  | { kind: 'final'; title: string; goal: string; questions: QuizQuestion[] }

const CHUNK_SIZE = 5

function stableShuffle<T>(arr: T[], salt: string): T[] {
  const next = [...arr]
  let seed = 0
  for (let i = 0; i < salt.length; i++) seed = (seed * 31 + salt.charCodeAt(i)) >>> 0
  for (let i = next.length - 1; i > 0; i--) {
    seed = (seed * 1664525 + 1013904223) >>> 0
    const j = seed % (i + 1)
    ;[next[i], next[j]] = [next[j], next[i]]
  }
  return next
}

function pageRank(item: TeachItem): number {
  if (item.source === 'genki_1_foundation') return -1000 + item.order
  if (typeof item.page === 'number' && item.page > 0) return item.page
  return 100000 + item.order
}

function toTeachItems(vocab: VocabItem[], grammar: GrammarItem[]): TeachItem[] {
  const grammarItems = grammar
    .filter(item => item.pattern && item.meaning)
    .map((item, index) => ({
      type: 'grammar' as const,
      id: `grammar:${item.id}`,
      title: item.pattern,
      body: item.meaning,
      source: item.source,
      page: item.page,
      order: index,
      explanation: item.explanation,
      examples: item.examples,
      maynardRef: item.maynardRef,
      explanationPlan: buildGrammarExplanationPlan(item, grammar),
    }))

  const vocabItems = vocab
    .filter(item => item.surface && item.english)
    .map((item, index) => ({
      type: 'vocab' as const,
      id: `vocab:${item.id}`,
      title: item.surface,
      body: item.english,
      source: item.source,
      page: item.page,
      order: index,
    }))

  return [...vocabItems, ...grammarItems].sort((a, b) =>
    pageRank(a) - pageRank(b) ||
    a.order - b.order ||
    (a.type === 'vocab' ? 0 : 1) - (b.type === 'vocab' ? 0 : 1)
  )
}

function buildQuestion(item: TeachItem, pool: TeachItem[], salt: string): QuizQuestion | null {
  const sameType = pool.filter(candidate => candidate.type === item.type && candidate.id !== item.id)
  const distractors = stableShuffle(sameType, `${salt}:${item.id}`)
    .map(candidate => (item.type === 'vocab' ? candidate.title : candidate.body))
    .filter(Boolean)
    .filter(value => value !== (item.type === 'vocab' ? item.title : item.body))

  if (distractors.length < 2) return null

  if (item.type === 'vocab') {
    return {
      itemId: item.id,
      type: 'vocab',
      prompt: item.body,
      promptLabel: 'Choose the Japanese for',
      correctAnswer: item.title,
      options: stableShuffle([item.title, ...distractors.slice(0, 3)], `${salt}:options:${item.id}`),
    }
  }

  return {
    itemId: item.id,
    type: 'grammar',
    prompt: item.title,
    promptLabel: 'Choose the meaning',
    correctAnswer: item.body,
    options: stableShuffle([item.body, ...distractors.slice(0, 3)], `${salt}:options:${item.id}`),
  }
}

function buildQuestions(items: TeachItem[], pool: TeachItem[], salt: string, limit: number): QuizQuestion[] {
  return stableShuffle(
    items
      .map(item => buildQuestion(item, pool, salt))
      .filter((question): question is QuizQuestion => Boolean(question)),
    `${salt}:questions`
  ).slice(0, limit)
}

export function buildLessonPlan(vocab: VocabItem[], grammar: GrammarItem[], lessonId: string): LessonStep[] {
  const items = toTeachItems(vocab, grammar)
  if (items.length === 0) {
    return [{ kind: 'teach', title: 'Lesson Preview', goal: 'No teachable items were found for this lesson yet.', items: [] }]
  }

  const steps: LessonStep[] = []
  for (let start = 0; start < items.length; start += CHUNK_SIZE) {
    const chunk = items.slice(start, start + CHUNK_SIZE)
    const chunkNumber = Math.floor(start / CHUNK_SIZE) + 1
    steps.push({
      kind: 'teach',
      title: `Learn Set ${chunkNumber}`,
      goal: 'Read the item, say it once, then connect it to the meaning before moving on.',
      items: chunk,
    })

    const checkpoint = buildQuestions(chunk, items, `${lessonId}:checkpoint:${chunkNumber}`, 4)
    if (checkpoint.length > 0) {
      steps.push({
        kind: 'checkpoint',
        title: `Checkpoint ${chunkNumber}`,
        goal: 'Quick recall before the next set. Misses will be shown again in the summary.',
        questions: checkpoint,
      })
    }
  }

  const finalReview = buildQuestions(items, items, `${lessonId}:final`, 12)
  if (finalReview.length > 0) {
    steps.push({
      kind: 'final',
      title: 'Mixed Review',
      goal: 'Final pass across the whole lesson, mixed so recognition is not tied to order.',
      questions: finalReview,
    })
  }

  return steps
}
import { buildGrammarExplanationPlan, type GrammarExplanationPlan } from '../content/maynardExplanationEngine'
import type { LessonIntent } from '../content/lessonIntentService'
import type { WorkbookPracticeTask } from '../content/workbookPracticeService'
