export type TextbookKey =
  | 'genki_1'
  | 'genki_2'
  | 'quartet_1'
  | 'quartet_2'
  | 'tobira'
  | 'marugoto_a1'
  | 'marugoto_a2'
  | 'marugoto_b1'
  | 'marugoto'

export interface TextbookDetection {
  textbookKey: TextbookKey | null
  label: string
  confidence: number
  reason: string
}

export const TEXTBOOK_LABELS: Record<TextbookKey, string> = {
  genki_1: 'Genki I',
  genki_2: 'Genki II',
  quartet_1: 'Quartet 1',
  quartet_2: 'Quartet 2',
  tobira: 'Tobira',
  marugoto_a1: 'Marugoto A1',
  marugoto_a2: 'Marugoto A2',
  marugoto_b1: 'Marugoto B1',
  marugoto: 'Marugoto',
}

export const CONFIRMABLE_TEXTBOOKS = Object.entries(TEXTBOOK_LABELS).map(([key, label]) => ({
  key: key as TextbookKey,
  label,
}))

export function detectTextbook(filename: string): TextbookDetection {
  const name = filename.toLowerCase().replace(/[_-]+/g, ' ')
  const has = (...terms: string[]) => terms.some(term => name.includes(term))

  if (has('genki', 'げんき')) {
    if (has('2', 'ii', 'vol 2', 'volume 2', 'second')) {
      return match('genki_2', 0.9, 'filename contains Genki volume 2 markers')
    }
    if (has('1', ' i ', 'vol 1', 'volume 1', 'first')) {
      return match('genki_1', 0.9, 'filename contains Genki volume 1 markers')
    }
    return match('genki_1', 0.68, 'filename contains Genki but no volume marker')
  }

  if (has('quartet')) {
    if (has('2', 'ii', 'vol 2', 'volume 2')) return match('quartet_2', 0.9, 'filename contains Quartet volume 2 markers')
    return match('quartet_1', 0.76, 'filename contains Quartet without volume 2 markers')
  }

  if (has('tobira')) return match('tobira', 0.92, 'filename contains Tobira')

  if (has('marugoto', 'まるごと')) {
    if (has('a1')) return match('marugoto_a1', 0.9, 'filename contains Marugoto A1')
    if (has('a2')) return match('marugoto_a2', 0.9, 'filename contains Marugoto A2')
    if (has('b1', 'intermediate')) return match('marugoto_b1', 0.85, 'filename contains Marugoto B1/intermediate markers')
    return match('marugoto', 0.62, 'filename contains Marugoto but no level marker')
  }

  return {
    textbookKey: null,
    label: 'Unknown textbook',
    confidence: 0,
    reason: 'no known textbook markers found in filename',
  }
}

function match(textbookKey: TextbookKey, confidence: number, reason: string): TextbookDetection {
  return {
    textbookKey,
    label: TEXTBOOK_LABELS[textbookKey],
    confidence,
    reason,
  }
}
