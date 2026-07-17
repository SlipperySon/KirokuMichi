import type { ReviewCard } from '../study/types'

interface BundledGenkiNote {
  front: string
  sentence: string | null
  sentenceMeaning: string | null
}

interface BundledGenkiPack {
  notes: BundledGenkiNote[]
}

interface UsageExample {
  sentence: string
  translation: string | null
}

const TEST_PACK_URL = '/test-data/genki-official-test-cards.json'

let bundledExamplePromise: Promise<Map<string, UsageExample>> | null = null

async function loadBundledGenkiExamples() {
  if (!bundledExamplePromise) {
    bundledExamplePromise = fetch(TEST_PACK_URL)
      .then(response => response.ok ? response.json() as Promise<BundledGenkiPack> : { notes: [] })
      .then(pack => {
        const examples = new Map<string, UsageExample>()
        for (const note of pack.notes ?? []) {
          if (!note.front || !note.sentence || examples.has(note.front)) continue
          examples.set(note.front, {
            sentence: note.sentence,
            translation: note.sentenceMeaning,
          })
        }
        return examples
      })
      .catch(() => new Map())
  }
  return bundledExamplePromise
}

export function cardStoredUsageExample(card: ReviewCard): UsageExample | null {
  if (!card.exampleSentence) return null
  return {
    sentence: card.exampleSentence,
    translation: card.exampleTranslation,
  }
}

export async function bundledGenkiUsageExampleFor(card: ReviewCard): Promise<UsageExample | null> {
  if (card.type !== 'vocabulary') return null
  const examples = await loadBundledGenkiExamples()
  return examples.get(card.front) ?? null
}
