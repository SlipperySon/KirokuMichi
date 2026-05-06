import type { StorageProvider, SchedulerProvider, CardState, Rating } from '../core/providers'
import { isLeech, LEECH_THRESHOLD } from '../core/scheduler'
import type { ReviewCard, SessionStats, StreakData, HeatmapDay, GrammarQuestion, IntervalPreview } from '../study/types'

function formatInterval(due: Date, now = new Date()): string {
  const diffMs = due.getTime() - now.getTime()
  const diffMins = Math.round(diffMs / 60000)
  if (diffMins < 60) return `${diffMins}m`
  const diffHours = Math.round(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h`
  return `${Math.round(diffHours / 24)}d`
}

export class SRSService {
  storage: StorageProvider
  scheduler: SchedulerProvider

  constructor(storage: StorageProvider, scheduler: SchedulerProvider) {
    this.storage = storage
    this.scheduler = scheduler
  }

  async getDueCards(userId: number, limit: number): Promise<ReviewCard[]> {
    return this.storage.query<ReviewCard>(
      `SELECT
        cs.id        AS cardStateId,
        cs.card_id   AS cardId,
        cs.state,
        cs.lapses,
        cs.stability,
        cs.difficulty,
        cs.due,
        c.type,
        c.front,
        c.back,
        c.reading,
        c.audio_url  AS audioUrl,
        c.jlpt_level AS jlptLevel
       FROM card_states cs
       JOIN cards c ON c.id = cs.card_id
       WHERE cs.user_id = ?
         AND cs.due <= datetime('now')
         AND cs.is_leech = 0
       ORDER BY cs.due ASC
       LIMIT ?`,
      [userId, limit]
    )
  }

  async getNewCards(userId: number, limit: number): Promise<ReviewCard[]> {
    return this.storage.query<ReviewCard>(
      `SELECT
        cs.id        AS cardStateId,
        cs.card_id   AS cardId,
        cs.state,
        cs.lapses,
        cs.stability,
        cs.difficulty,
        cs.due,
        c.type,
        c.front,
        c.back,
        c.reading,
        c.audio_url  AS audioUrl,
        c.jlpt_level AS jlptLevel
       FROM card_states cs
       JOIN cards c ON c.id = cs.card_id
       WHERE cs.user_id = ?
         AND cs.state = 'new'
       ORDER BY c.frequency_rank ASC, cs.id ASC
       LIMIT ?`,
      [userId, limit]
    )
  }

  async reviewCard(
    userId: number,
    cardStateId: number,
    rating: Rating
  ): Promise<{ isNewLeech: boolean }> {
    const rows = await this.storage.query<{
      due: string; stability: number; difficulty: number
      retrievability: number; state: string; reps: number; lapses: number; is_leech: number
    }>(
      `SELECT due, stability, difficulty, retrievability, state, reps, lapses, is_leech
       FROM card_states WHERE id = ? AND user_id = ?`,
      [cardStateId, userId]
    )
    if (!rows[0]) throw new Error(`card_state ${cardStateId} not found`)

    const row = rows[0]
    const cardState: CardState = {
      due: new Date(row.due),
      stability: row.stability,
      difficulty: row.difficulty,
      retrievability: row.retrievability,
      state: row.state as CardState['state'],
      reps: row.reps,
      lapses: row.lapses,
    }

    const result = this.scheduler.schedule(cardState, rating)
    const wasLeech = row.is_leech === 1
    const newIsLeech = isLeech(result.lapses)

    await this.storage.execute(
      `UPDATE card_states SET
        due            = ?,
        stability      = ?,
        difficulty     = ?,
        retrievability = ?,
        state          = ?,
        reps           = ?,
        lapses         = ?,
        leech_count    = ?,
        is_leech       = ?,
        last_review    = datetime('now')
       WHERE id = ? AND user_id = ?`,
      [
        result.due.toISOString(),
        result.stability,
        result.difficulty,
        result.retrievability,
        result.state,
        result.reps,
        result.lapses,
        result.lapses,
        newIsLeech ? 1 : 0,
        cardStateId,
        userId,
      ]
    )

    return { isNewLeech: newIsLeech && !wasLeech }
  }

  async suspendCard(userId: number, cardStateId: number): Promise<void> {
    await this.storage.execute(
      `UPDATE card_states SET is_leech = 1 WHERE id = ? AND user_id = ?`,
      [cardStateId, userId]
    )
  }

  async unsuspendCard(userId: number, cardStateId: number): Promise<void> {
    await this.storage.execute(
      `UPDATE card_states SET is_leech = 0 WHERE id = ? AND user_id = ?`,
      [cardStateId, userId]
    )
  }

  async getDueCount(userId: number): Promise<number> {
    const rows = await this.storage.query<{ count: number }>(
      `SELECT COUNT(*) AS count FROM card_states
       WHERE user_id = ? AND state != 'new' AND due <= datetime('now') AND is_leech = 0`,
      [userId]
    )
    return rows[0]?.count ?? 0
  }

  async getNewCount(userId: number): Promise<number> {
    const rows = await this.storage.query<{ count: number }>(
      `SELECT COUNT(*) AS count FROM card_states
       WHERE user_id = ? AND state = 'new'`,
      [userId]
    )
    return rows[0]?.count ?? 0
  }

  async startSession(userId: number, mode: string): Promise<number> {
    await this.storage.execute(
      `INSERT INTO sessions (user_id, mode, started_at) VALUES (?, ?, datetime('now'))`,
      [userId, mode]
    )
    const rows = await this.storage.query<{ id: number }>(
      `SELECT id FROM sessions WHERE user_id = ? ORDER BY id DESC LIMIT 1`,
      [userId]
    )
    return rows[0].id
  }

  async endSession(sessionId: number, stats: SessionStats): Promise<void> {
    const durationSeconds = Math.round((Date.now() - stats.startedAt) / 1000)
    await this.storage.execute(
      `UPDATE sessions SET
        ended_at         = datetime('now'),
        duration_seconds = ?,
        cards_reviewed   = ?,
        correct_count    = ?
       WHERE id = ?`,
      [durationSeconds, stats.cardsReviewed, stats.correctCount, sessionId]
    )
  }

  async logMistake(
    userId: number,
    cardId: number,
    userInput: string | null,
    correctAnswer: string,
    sessionId: number
  ): Promise<void> {
    await this.storage.execute(
      `INSERT INTO mistake_logs (user_id, card_id, user_input, correct_answer, session_id, created_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))`,
      [userId, cardId, userInput, correctAnswer, sessionId]
    )
  }

  async getStreakData(userId: number): Promise<StreakData> {
    const rows = await this.storage.query<{ date: string; cardsReviewed: number; sessionCount: number; mode: string }>(
      `SELECT
        date(started_at)        AS date,
        SUM(cards_reviewed)     AS cardsReviewed,
        COUNT(*)                AS sessionCount,
        mode
       FROM sessions
       WHERE user_id = ?
         AND started_at >= date('now', '-84 days')
         AND ended_at IS NOT NULL
       GROUP BY date(started_at), mode
       ORDER BY date ASC`,
      [userId]
    )

    // Aggregate per date, tracking vocab vs grammar separately
    const dayMap = new Map<string, { cardsReviewed: number; sessionCount: number; vocabReviewed: number; grammarReviewed: number }>()
    for (const row of rows) {
      const existing = dayMap.get(row.date) ?? { cardsReviewed: 0, sessionCount: 0, vocabReviewed: 0, grammarReviewed: 0 }
      existing.cardsReviewed += row.cardsReviewed ?? 0
      existing.sessionCount += row.sessionCount ?? 0
      if (row.mode === 'grammar') existing.grammarReviewed += row.cardsReviewed ?? 0
      else existing.vocabReviewed += row.cardsReviewed ?? 0
      dayMap.set(row.date, existing)
    }

    const days: HeatmapDay[] = []
    const today = new Date()

    for (let i = 83; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      const dateStr = d.toISOString().split('T')[0]
      const row = dayMap.get(dateStr)
      days.push({
        date: dateStr,
        cardsReviewed: row?.cardsReviewed ?? 0,
        sessionCount: row?.sessionCount ?? 0,
        vocabReviewed: row?.vocabReviewed ?? 0,
        grammarReviewed: row?.grammarReviewed ?? 0,
      })
    }

    let currentStreak = 0
    let longestStreak = 0
    let running = 0

    for (let i = days.length - 1; i >= 0; i--) {
      if (days[i].cardsReviewed > 0) {
        running++
        if (i === days.length - 1 || days[i + 1].cardsReviewed > 0) {
          currentStreak = running
        }
      } else {
        if (running > longestStreak) longestStreak = running
        if (i < days.length - 1) break
        running = 0
      }
    }
    if (running > longestStreak) longestStreak = running

    return { currentStreak, longestStreak, days }
  }

  async getGrammarQueue(userId: number, limit: number): Promise<{ id: number; jlpt_level: string; title: string; pattern: string; meaning: string; explanation: string; examples_json: string }[]> {
    // Prioritise unseen points, then least recently seen
    return this.storage.query(
      `SELECT gp.id, gp.jlpt_level, gp.title, gp.pattern, gp.meaning, gp.explanation, gp.examples_json
       FROM grammar_points gp
       LEFT JOIN grammar_progress prog ON prog.grammar_point_id = gp.id AND prog.user_id = ?
       ORDER BY prog.times_seen ASC NULLS FIRST, prog.last_seen_at ASC NULLS FIRST, gp.frequency_rank ASC
       LIMIT ?`,
      [userId, limit]
    )
  }

  async getGrammarDueCount(userId: number): Promise<number> {
    const rows = await this.storage.query<{ count: number }>(
      `SELECT COUNT(*) AS count FROM grammar_points gp
       LEFT JOIN grammar_progress prog ON prog.grammar_point_id = gp.id AND prog.user_id = ?
       WHERE prog.times_seen IS NULL OR prog.last_seen_at < date('now', '-1 day')`,
      [userId]
    )
    return rows[0]?.count ?? 0
  }

  async markGrammarSeen(userId: number, grammarPointId: number): Promise<void> {
    await this.storage.execute(
      `INSERT INTO grammar_progress (user_id, grammar_point_id, last_seen_at, times_seen)
       VALUES (?, ?, datetime('now'), 1)
       ON CONFLICT(user_id, grammar_point_id) DO UPDATE SET
         last_seen_at = datetime('now'),
         times_seen = times_seen + 1`,
      [userId, grammarPointId]
    )
  }

  async getLearnedCardIds(userId: number): Promise<number[]> {
    const rows = await this.storage.query<{ card_id: number }>(
      `SELECT card_id FROM card_states WHERE user_id = ? AND reps > 0`,
      [userId]
    )
    return rows.map(r => r.card_id)
  }

  async getGrammarQuestion(jlptLevel: string): Promise<GrammarQuestion | null> {
    const rows = await this.storage.query<{
      questionId: number; prompt: string; optionsJson: string | null
      answer: string; explanation: string | null; grammarPointId: number | null
    }>(
      `SELECT
        id             AS questionId,
        prompt,
        options_json   AS optionsJson,
        answer,
        explanation,
        grammar_point_id AS grammarPointId
       FROM questions
       WHERE jlpt_level = ?
         AND question_type = 'fill_blank'
         AND active = 1
       ORDER BY RANDOM()
       LIMIT 1`,
      [jlptLevel]
    )
    if (!rows[0]) return null
    const r = rows[0]
    return {
      questionId: r.questionId,
      prompt: r.prompt,
      options: r.optionsJson ? JSON.parse(r.optionsJson) as string[] : [],
      answer: r.answer,
      explanation: r.explanation,
      grammarPointId: r.grammarPointId,
    }
  }

  getIntervalPreviews(cardState: CardState): IntervalPreview {
    const ratings: Rating[] = ['again', 'hard', 'good', 'easy']
    const now = new Date()
    const previews = {} as IntervalPreview
    for (const rating of ratings) {
      const result = this.scheduler.schedule(cardState, rating)
      previews[rating] = formatInterval(result.due, now)
    }
    return previews
  }

  leechThreshold(): number {
    return LEECH_THRESHOLD
  }
}
