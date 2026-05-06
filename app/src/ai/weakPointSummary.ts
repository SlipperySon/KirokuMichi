import type { StorageProvider } from '../core/providers'
import type {
  CardPerformance,
  GrammarPerformance,
  WeakPointSummary,
} from '../core/weakPointScorer'
import {
  scoreCards,
  scoreGrammar,
  computeOverallMastery,
  buildRecommendedFocus,
} from '../core/weakPointScorer'

const STALE_HOURS = 24

export interface WeakPointCacheRow {
  id: number
  user_id: number
  computed_at: string
  summary_json: string
}

async function fetchCardPerformance(storage: StorageProvider, userId: number): Promise<CardPerformance[]> {
  return storage.query<CardPerformance>(
    `SELECT
       cs.card_id   AS cardId,
       c.front,
       c.back,
       c.jlpt_level AS jlptLevel,
       cs.lapses,
       cs.reps,
       cs.stability,
       cs.difficulty,
       cs.last_review AS lastReview
     FROM card_states cs
     JOIN cards c ON c.id = cs.card_id
     WHERE cs.user_id = ?
       AND cs.reps > 0`,
    [userId]
  )
}

async function fetchGrammarPerformance(storage: StorageProvider, userId: number): Promise<GrammarPerformance[]> {
  return storage.query<GrammarPerformance>(
    `SELECT
       gp.id AS grammarId,
       gp.title,
       gp.jlpt_level AS jlptLevel,
       COALESCE(SUM(CASE WHEN tr.correct = 1 THEN 1 ELSE 0 END), 0) AS correctCount,
       COUNT(tr.id) AS totalCount
     FROM grammar_points gp
     LEFT JOIN questions q ON q.grammar_point_id = gp.id
     LEFT JOIN test_responses tr ON tr.quiz_question_id = q.id
     LEFT JOIN test_sessions ts ON ts.id = tr.test_session_id AND ts.user_id = ?
     GROUP BY gp.id
     HAVING COUNT(tr.id) > 0`,
    [userId]
  )
}

export async function getCachedWeakPoints(
  storage: StorageProvider,
  userId: number
): Promise<WeakPointSummary | null> {
  const rows = await storage.query<WeakPointCacheRow>(
    `SELECT * FROM weak_point_cache WHERE user_id = ? ORDER BY computed_at DESC LIMIT 1`,
    [userId]
  )
  if (!rows.length) return null

  const row = rows[0]
  const computedAt = new Date(row.computed_at)
  const ageHours = (Date.now() - computedAt.getTime()) / (1000 * 60 * 60)
  if (ageHours > STALE_HOURS) return null

  return JSON.parse(row.summary_json) as WeakPointSummary
}

export async function computeAndCacheWeakPoints(
  storage: StorageProvider,
  userId: number
): Promise<WeakPointSummary> {
  const [cards, grammar] = await Promise.all([
    fetchCardPerformance(storage, userId),
    fetchGrammarPerformance(storage, userId),
  ])

  const topWeakCards = scoreCards(cards).slice(0, 10)
  const topWeakGrammar = scoreGrammar(grammar).slice(0, 5)
  const overallMasteryPercent = computeOverallMastery(cards)
  const recommendedFocus = buildRecommendedFocus(topWeakCards, topWeakGrammar)

  const summary: WeakPointSummary = {
    userId,
    computedAt: new Date().toISOString(),
    topWeakCards,
    topWeakGrammar,
    overallMasteryPercent,
    recommendedFocus,
  }

  await storage.execute(
    `INSERT INTO weak_point_cache (user_id, computed_at, summary_json)
     VALUES (?, ?, ?)`,
    [userId, summary.computedAt, JSON.stringify(summary)]
  )

  // Keep only last 7 snapshots per user
  await storage.execute(
    `DELETE FROM weak_point_cache
     WHERE user_id = ?
       AND id NOT IN (
         SELECT id FROM weak_point_cache
         WHERE user_id = ?
         ORDER BY computed_at DESC
         LIMIT 7
       )`,
    [userId, userId]
  )

  return summary
}

export function buildWeakPointContext(summary: WeakPointSummary | null): string {
  if (!summary) return ''

  const lines: string[] = ['[Learner Profile]']
  lines.push(`Overall mastery: ${summary.overallMasteryPercent}%`)

  if (summary.topWeakCards.length > 0) {
    lines.push('Frequently missed vocabulary:')
    summary.topWeakCards.slice(0, 5).forEach(c => {
      lines.push(`  - ${c.label} (${c.jlptLevel ?? 'unknown level'})`)
    })
  }

  if (summary.topWeakGrammar.length > 0) {
    lines.push('Struggling grammar patterns:')
    summary.topWeakGrammar.slice(0, 3).forEach(g => {
      lines.push(`  - ${g.label}`)
    })
  }

  if (summary.recommendedFocus.length > 0) {
    lines.push('Recommended focus areas:')
    summary.recommendedFocus.forEach(f => lines.push(`  - ${f}`))
  }

  return lines.join('\n')
}
