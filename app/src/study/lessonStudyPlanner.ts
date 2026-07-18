import { buildGrammarExplanationPlan, type GrammarExplanationPlan } from '../content/maynardExplanationEngine'
import { getMaynardSupport } from '../content/maynardSupport'
import type { WorkbookPracticeTask } from '../content/workbookPracticeService'
import { injectTypedRecall } from './typedRecall'

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
  sourceId?: string
  sourceKind?: 'attached' | 'direct' | 'curated-support'
  confidence?: 'direct' | 'keyword' | 'curated'
  pageStart?: number
  pageEnd?: number
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
  workbookPractice?: WorkbookPracticeTask[]
}

export type TeachItem =
  | { type: 'vocab'; id: string; title: string; body: string; source?: string; page?: number; order: number; lessonId?: string }
  | { type: 'grammar'; id: string; title: string; body: string; source?: string; page?: number; order: number; lessonId?: string; explanation?: string; examples?: GrammarExample[]; maynardRef?: MaynardRef; explanationPlan: GrammarExplanationPlan }

export interface QuizQuestion {
  itemId: string
  type: 'vocab' | 'grammar'
  prompt: string
  promptLabel: string
  correctAnswer: string
  options: string[]
  recallMode?: 'mcq' | 'typed'
}

export type LessonStep =
  | { kind: 'intro'; title: string; goal: string; vocabCount: number; grammarCount: number; estimatedCards: number; targets: string[] }
  | { kind: 'teach'; title: string; goal: string; items: TeachItem[] }
  | { kind: 'checkpoint'; title: string; goal: string; questions: QuizQuestion[] }
  | { kind: 'final'; title: string; goal: string; questions: QuizQuestion[] }
  | { kind: 'workbook'; title: string; goal: string; tasks: WorkbookPracticeTask[] }
  | { kind: 'cards'; title: string; goal: string }
  | { kind: 'speak'; title: string; goal: string; prompt: string; support: string; scenarioLessonId: string }

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

/**
 * Interleave `secondary` items evenly into the `sorted` sequence.
 * After each item in `sorted`, inserts the proportional share of `secondary`
 * items so that both streams finish together. Any remainder is appended at
 * the end.
 *
 * Example: sorted=[V1,V2,V3], secondary=[G1,G2,G3,G4,G5] → ratio≈1.67
 *   V1, G1, G2, V2, G3, G4, V3, G5
 */
function interleaveItems(sorted: TeachItem[], secondary: TeachItem[]): TeachItem[] {
  if (sorted.length === 0) return secondary
  if (secondary.length === 0) return sorted
  const result: TeachItem[] = []
  const ratio = secondary.length / sorted.length
  let idx = 0
  for (let i = 0; i < sorted.length; i++) {
    result.push(sorted[i])
    const target = Math.round((i + 1) * ratio)
    while (idx < target && idx < secondary.length) result.push(secondary[idx++])
  }
  while (idx < secondary.length) result.push(secondary[idx++])
  return result
}

function toTeachItems(vocab: VocabItem[], grammar: GrammarItem[]): TeachItem[] {
  const grammarMapped = grammar
    .filter(item => item.pattern && item.meaning)
    .map((item, index) => ({
      type: 'grammar' as const,
      id: `grammar:${item.id}`,
      title: item.pattern,
      body: item.meaning,
      source: item.source,
      page: item.page,
      order: index,
      lessonId: item.lesson,
      explanation: item.explanation,
      examples: item.examples,
      maynardRef: getMaynardSupport(item),
      explanationPlan: buildGrammarExplanationPlan(item, grammar),
    }))

  const vocabMapped = vocab
    .filter(item => item.surface && item.english)
    .map((item, index) => ({
      type: 'vocab' as const,
      id: `vocab:${item.id}`,
      title: item.surface,
      body: item.english,
      source: item.source,
      page: item.page,
      order: index,
      lessonId: item.lesson,
    }))

  const regularVocab = vocabMapped
    .sort((a, b) => (a.page ?? 0) - (b.page ?? 0) || a.order - b.order)

  const grammarSorted = [...grammarMapped].sort((a, b) => {
    const ap = a.page ?? 0
    const bp = b.page ?? 0
    if (ap > 0 && bp > 0) return ap - bp
    if (ap > 0) return -1
    if (bp > 0) return 1
    return a.order - b.order
  })

  return interleaveItems(regularVocab, grammarSorted)
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

export function buildLessonPlan(
  vocab: VocabItem[],
  grammar: GrammarItem[],
  lessonId: string,
  workbookPractice: WorkbookPracticeTask[] = []
): LessonStep[] {
  const items = toTeachItems(vocab, grammar)
  const targets = [
    ...grammar.filter(g => g.pattern).slice(0, 3).map(g => g.pattern),
    ...vocab.filter(v => v.surface).slice(0, 3).map(v => v.surface),
  ].slice(0, 5)

  const intro: LessonStep = {
    kind: 'intro',
    title: 'Lesson goals',
    goal: 'Orient to what you will learn, then encode → check → practice → review cards → speak.',
    vocabCount: vocab.filter(v => v.surface && v.english).length,
    grammarCount: grammar.filter(g => g.pattern && g.meaning).length,
    estimatedCards: Math.min(12, vocab.filter(v => v.surface && v.english).length),
    targets,
  }

  if (items.length === 0) {
    return [
      intro,
      { kind: 'teach', title: 'Lesson Preview', goal: 'No teachable items were found for this lesson yet.', items: [] },
      { kind: 'cards', title: 'Cards', goal: 'Review any linked cards in the Anki-style SRS.' },
      {
        kind: 'speak',
        title: 'Speak',
        goal: 'Produce one short utterance with today’s targets.',
        prompt: 'Write one simple sentence using something from this lesson.',
        support: 'One clean sentence is enough. Rough output beats silent recognition.',
        scenarioLessonId: lessonId,
      },
    ]
  }

  const steps: LessonStep[] = [intro]
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
        goal: 'Quick recall before the next set. First item is free recall; misses prioritized in Cards.',
        questions: injectTypedRecall(checkpoint, chunk, `${lessonId}:checkpoint:${chunkNumber}`),
      })
    }
  }

  const finalReview = buildQuestions(items, items, `${lessonId}:final`, 12)
  if (finalReview.length > 0) {
    steps.push({
      kind: 'final',
      title: 'Mixed Review',
      goal: 'Final pass across the whole lesson, mixed so recognition is not tied to order.',
      questions: injectTypedRecall(finalReview, items, `${lessonId}:final`),
    })
  }

  const outputTasks = workbookPractice.filter(task => task.practiceMode !== 'guided').slice(0, 4)
  const guidedTasks = workbookPractice.filter(task => task.practiceMode === 'guided').slice(0, 2)
  const tasks = [...guidedTasks, ...outputTasks].slice(0, 5)
  if (tasks.length > 0) {
    steps.push({
      kind: 'workbook',
      title: 'Workbook Output',
      goal: 'Turn the workbook prompts into actual production before Cards.',
      tasks,
    })
  }

  steps.push({
    kind: 'cards',
    title: 'Cards',
    goal: 'Spaced retrieval with the Anki-style scheduler. Weak and new items first (capped).',
  })

  const focusGrammar = grammar.find(g => g.pattern && g.meaning)
  const focusVocab = vocab.find(v => v.surface && v.english)
  const speakPrompt = focusGrammar
    ? `Write one short sentence using「${focusGrammar.pattern}」(${focusGrammar.meaning}).`
    : focusVocab
      ? `Write one short sentence that uses「${focusVocab.surface}」(${focusVocab.english}).`
      : 'Write one short sentence using something you learned in this lesson.'

  steps.push({
    kind: 'speak',
    title: 'Speak',
    goal: 'Pushed output — produce language so you notice gaps before finishing.',
    prompt: speakPrompt,
    support: 'Say it aloud if you can, then type it. Optional: open a linked scenario after you write something.',
    scenarioLessonId: lessonId,
  })

  return steps
}

