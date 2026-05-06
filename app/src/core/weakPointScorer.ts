export interface CardPerformance {
  cardId: number
  front: string
  back: string
  jlptLevel: string | null
  lapses: number
  reps: number
  stability: number
  difficulty: number
  lastReview: string | null
}

export interface GrammarPerformance {
  grammarId: number
  title: string
  jlptLevel: string
  correctCount: number
  totalCount: number
}

export interface WeakPointScore {
  cardId?: number
  grammarId?: number
  label: string
  jlptLevel: string | null
  score: number // 0-100, higher = weaker
  reason: 'high_lapses' | 'low_stability' | 'high_difficulty' | 'low_accuracy'
}

export interface WeakPointSummary {
  userId: number
  computedAt: string
  topWeakCards: WeakPointScore[]
  topWeakGrammar: WeakPointScore[]
  overallMasteryPercent: number
  recommendedFocus: string[]
}

export function scoreCards(cards: CardPerformance[]): WeakPointScore[] {
  return cards
    .filter(c => c.reps > 0)
    .map(c => {
      // Lapse ratio weighted heavily — the primary signal of weak recall
      const lapseRatio = c.lapses / Math.max(c.reps, 1)
      const difficultyPenalty = Math.max(0, (c.difficulty - 5) / 5) // difficulty 0-10, penalise >5
      const stabilityBonus = Math.min(1, c.stability / 30) // stability in days, cap at 30

      const score = Math.round(
        (lapseRatio * 60 + difficultyPenalty * 30 - stabilityBonus * 10 + 20) * 100
      ) / 100

      let reason: WeakPointScore['reason'] = 'high_lapses'
      if (c.lapses === 0 && c.difficulty > 6) reason = 'high_difficulty'
      else if (c.lapses === 0 && c.stability < 5) reason = 'low_stability'

      return {
        cardId: c.cardId,
        label: `${c.front} → ${c.back}`,
        jlptLevel: c.jlptLevel,
        score: Math.min(100, Math.max(0, score)),
        reason,
      }
    })
    .sort((a, b) => b.score - a.score)
}

export function scoreGrammar(grammar: GrammarPerformance[]): WeakPointScore[] {
  return grammar
    .filter(g => g.totalCount > 0)
    .map(g => {
      const errorRate = 1 - g.correctCount / g.totalCount
      const score = Math.round(errorRate * 100)
      return {
        grammarId: g.grammarId,
        label: g.title,
        jlptLevel: g.jlptLevel,
        score,
        reason: 'low_accuracy' as const,
      }
    })
    .sort((a, b) => b.score - a.score)
}

export function computeOverallMastery(cards: CardPerformance[]): number {
  const reviewed = cards.filter(c => c.reps > 0)
  if (reviewed.length === 0) return 0
  // A card is "mastered" if stability >= 21 days and lapses < 2
  const mastered = reviewed.filter(c => c.stability >= 21 && c.lapses < 2)
  return Math.round((mastered.length / reviewed.length) * 100)
}

export function buildRecommendedFocus(
  weakCards: WeakPointScore[],
  weakGrammar: WeakPointScore[]
): string[] {
  const focuses: string[] = []

  const highLapse = weakCards.filter(c => c.reason === 'high_lapses' && c.score > 50)
  if (highLapse.length > 0) {
    const levels = [...new Set(highLapse.map(c => c.jlptLevel).filter(Boolean))]
    focuses.push(`Review repeatedly-failed vocabulary (${levels.join(', ')})`)
  }

  const hardGrammar = weakGrammar.filter(g => g.score > 40)
  if (hardGrammar.length > 0) {
    focuses.push(`Practice grammar patterns: ${hardGrammar.slice(0, 3).map(g => g.label).join(', ')}`)
  }

  if (focuses.length === 0) {
    focuses.push('Maintain consistent daily reviews to build stability')
  }

  return focuses
}
