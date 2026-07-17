import { useEffect, useState } from 'react'
import { bundledGenkiUsageExampleFor, cardStoredUsageExample } from '../srs/genkiUsageExamples'
import type { ReviewCard } from './types'

interface UsageExample {
  sentence: string
  translation: string | null
}

export function useUsageExample(card: ReviewCard): UsageExample | null {
  const [example, setExample] = useState<UsageExample | null>(() => cardStoredUsageExample(card))

  useEffect(() => {
    let cancelled = false
    const stored = cardStoredUsageExample(card)
    setExample(stored)
    if (stored || card.type !== 'vocabulary') return

    void bundledGenkiUsageExampleFor(card).then(fallback => {
      if (!cancelled) setExample(fallback)
    })

    return () => { cancelled = true }
  }, [card])

  return example
}
