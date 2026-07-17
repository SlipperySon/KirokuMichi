import type { GrammarItem } from './lessonStudyPlanner'
import type { GrammarQuestion, ReviewCard } from './types'

function clozeFromExample(example: string, pattern: string): string | null {
  if (!example.includes(pattern)) return null
  return example.replace(pattern, '[___]')
}

function clozeOptions(pattern: string, pool: string[]): string[] {
  const distractors = pool.filter(p => p !== pattern && p.length > 0).slice(0, 3)
  while (distractors.length < 3) distractors.push('は')
  return [pattern, ...distractors.slice(0, 3)]
}

export function grammarCardFields(item: GrammarItem): {
  front: string
  back: string
  exampleSentence: string | null
  exampleTranslation: string | null
} {
  const pattern = item.pattern.trim()
  const meaning = item.meaning.trim()
  const example = item.examples?.[0]
  const cloze = example?.japanese ? clozeFromExample(example.japanese, pattern) : null

  return {
    front: cloze ?? `Pattern: ${pattern}`,
    back: `${pattern} — ${meaning}`,
    exampleSentence: example?.japanese ?? null,
    exampleTranslation: example?.english ?? null,
  }
}

export function buildGrammarQuestionForCard(
  card: ReviewCard,
  item: GrammarItem,
  patternPool: string[],
): GrammarQuestion {
  const pattern = item.pattern.trim()
  const example = item.examples?.[0]
  const prompt = example?.japanese && example.japanese.includes(pattern)
    ? example.japanese.replace(pattern, '[___]')
    : `Fill in: [___] (${item.meaning})`

  return {
    questionId: card.cardStateId,
    prompt,
    options: clozeOptions(pattern, patternPool),
    answer: pattern,
    explanation: item.explanation ?? item.meaning,
    grammarPointId: null,
  }
}

export function grammarEntriesFromCards(
  queue: ReviewCard[],
  grammarByFront: Map<string, GrammarItem>,
  allPatterns: string[],
): [number, GrammarQuestion][] {
  const entries: [number, GrammarQuestion][] = []
  for (const card of queue) {
    if (card.type !== 'grammar') continue
    const key = card.front.includes('[___]')
      ? card.exampleSentence ?? card.front
      : card.front.replace(/^Pattern:\s*/, '')
    const item = [...grammarByFront.values()].find(g =>
      card.front.includes(g.pattern) || card.back.includes(g.pattern),
    )
    if (!item) continue
    entries.push([card.cardStateId, buildGrammarQuestionForCard(card, item, allPatterns)])
  }
  return entries
}
