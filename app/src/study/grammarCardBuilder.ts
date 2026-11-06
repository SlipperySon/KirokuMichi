import { resolveGrammarCloze } from '../content/vocabGlossQuality'
import type { GrammarItem } from './lessonStudyPlanner'
import type { GrammarQuestion, ReviewCard } from './types'

function clozeOptions(answer: string, pool: string[]): string[] {
  const distractors = pool
    .filter(p => p && p !== answer)
    .slice(0, 3)
  while (distractors.length < 3) distractors.push('は')
  return [answer, ...distractors.slice(0, 3)]
}

/** Prefer fillable Japanese spans; fall back to pattern recognition (not obscure Latin cloze). */
export function grammarCardFields(item: GrammarItem): {
  front: string
  back: string
  exampleSentence: string | null
  exampleTranslation: string | null
} {
  const pattern = item.pattern.trim()
  const meaning = item.meaning.trim()
  const example = item.examples?.[0]
  const cloze = resolveGrammarCloze(pattern, example?.japanese)

  return {
    front: cloze?.prompt ?? `Pattern: ${pattern}`,
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
  const cloze = resolveGrammarCloze(pattern, example?.japanese)

  if (cloze) {
    // Prefer other fillable Japanese spans as distractors when available.
    const fillablePool = patternPool
      .map(p => resolveGrammarCloze(p, example?.japanese)?.answer ?? p)
      .filter(Boolean)
    return {
      questionId: card.cardStateId,
      prompt: cloze.prompt,
      options: clozeOptions(cloze.answer, fillablePool),
      answer: cloze.answer,
      explanation: item.explanation ?? item.meaning,
      grammarPointId: null,
    }
  }

  // Schema / unmatched patterns: ask meaning recognition instead of an empty [___].
  return {
    questionId: card.cardStateId,
    prompt: `Which pattern means: ${item.meaning}?`,
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
    const item = [...grammarByFront.values()].find(g =>
      card.front.includes(g.pattern) || card.back.includes(g.pattern),
    )
    if (!item) continue
    entries.push([card.cardStateId, buildGrammarQuestionForCard(card, item, allPatterns)])
  }
  return entries
}
