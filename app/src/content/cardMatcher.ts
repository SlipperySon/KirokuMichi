/**
 * Card Matching Utility
 * Matches Anki card fronts to lesson vocabulary/grammar using three-tier strategy
 */

export type MatchType = 'exact' | 'substring' | 'fuzzy'

/**
 * Levenshtein distance - measure string similarity
 * Returns a number between 0 (no similarity) and 1 (identical)
 */
function levenshteinSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase()
  const s2 = str2.toLowerCase()

  if (s1 === s2) return 1
  if (s1.length === 0 || s2.length === 0) return 0

  const len1 = s1.length
  const len2 = s2.length
  const matrix: number[][] = Array(len1 + 1)
    .fill(null)
    .map(() => Array(len2 + 1).fill(0))

  for (let i = 0; i <= len1; i++) matrix[i][0] = i
  for (let j = 0; j <= len2; j++) matrix[0][j] = j

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,     // deletion
        matrix[i][j - 1] + 1,     // insertion
        matrix[i - 1][j - 1] + cost // substitution
      )
    }
  }

  const maxLen = Math.max(len1, len2)
  const distance = matrix[len1][len2]
  return 1 - distance / maxLen
}

/**
 * Extract kanji/kana from a string
 * Removes furigana and HTML markup
 */
function extractJapanese(text: string): string {
  // Remove HTML tags
  let cleaned = text.replace(/<[^>]+>/g, '')

  // Remove parenthetical furigana like （き）or (ki)
  cleaned = cleaned.replace(/[（(][^）)]*[）)]/g, '')

  // Remove brackets and cruft
  cleaned = cleaned.replace(/[\[\]{}]/g, '')

  return cleaned.trim()
}

function compactTerm(text: string): string {
  return extractJapanese(text)
    .replace(/[〜~～]/g, '')
    .replace(/[・／/]/g, '')
    .replace(/\s+/g, '')
    .trim()
}

export function lessonTermVariants(term: string): string[] {
  const cleaned = extractJapanese(term)
  const compact = compactTerm(term)
  const variants = new Set([cleaned, compact].filter(Boolean))

  for (const part of cleaned.split(/[・／/]/)) {
    const trimmed = part.trim()
    if (trimmed) variants.add(trimmed)
    const compactPart = compactTerm(trimmed)
    if (compactPart) variants.add(compactPart)
  }

  return [...variants]
}

export interface CardMatch {
  lessonTerm: string
  cardFront: string
  matchType: MatchType
  score: number
}

/**
 * Match a card front against a lesson term
 * Returns match details if matched (any of three tiers)
 */
export function matchCardToTerm(cardFront: string, lessonTerm: string): CardMatch | null {
  const cleanCard = compactTerm(cardFront).toLowerCase()
  const cleanLesson = compactTerm(lessonTerm).toLowerCase()

  if (!cleanCard || !cleanLesson) return null

  // Tier 1: Exact match
  if (cleanCard === cleanLesson) {
    return {
      lessonTerm,
      cardFront,
      matchType: 'exact',
      score: 1.0
    }
  }

  // Tier 2: Substring match (card contains lesson term, or lesson contains card)
  if (cleanCard.includes(cleanLesson) || cleanLesson.includes(cleanCard)) {
    return {
      lessonTerm,
      cardFront,
      matchType: 'substring',
      score: 0.85
    }
  }

  // Tier 3: Fuzzy match (Levenshtein similarity)
  const similarity = levenshteinSimilarity(cleanCard, cleanLesson)

  // Only return fuzzy match if similarity is high enough (>75%)
  if (similarity > 0.75) {
    return {
      lessonTerm,
      cardFront,
      matchType: 'fuzzy',
      score: similarity
    }
  }

  return null
}

/**
 * Find the best match for a card against multiple lesson terms
 * Returns the highest-scoring match, or null if no match found
 */
export function findBestMatch(cardFront: string, lessonTerms: string[]): CardMatch | null {
  let bestMatch: CardMatch | null = null
  let bestScore = -1

  for (const term of lessonTerms) {
    const match = matchCardToTerm(cardFront, term)
    if (match && match.score > bestScore) {
      bestMatch = match
      bestScore = match.score
    }
  }

  return bestMatch
}

/**
 * Get all terms (vocab surface + grammar patterns) from lesson content
 */
export function extractLessonTerms(
  vocab: Array<{ surface: string }>,
  grammar: Array<{ pattern: string }>
): string[] {
  const terms = new Set<string>()
  for (const item of vocab) {
    for (const variant of lessonTermVariants(item.surface)) terms.add(variant)
  }
  for (const item of grammar) {
    for (const variant of lessonTermVariants(item.pattern)) terms.add(variant)
  }
  return [...terms]
}
