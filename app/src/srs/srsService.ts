import type { StorageProvider, SchedulerProvider, CardState, Rating } from '../core/providers'
import { isLeech, LEECH_THRESHOLD } from '../core/scheduler'
import type { ReviewCard, SessionStats, StreakData, HeatmapDay, GrammarQuestion, IntervalPreview, GrammarReviewContext } from '../study/types'

/** Full card_state snapshot used by undo-last-review. */
export interface CardStateSnapshot {
  id: number
  due: string
  stability: number
  difficulty: number
  retrievability: number
  state: string
  reps: number
  lapses: number
  leechCount: number
  isLeech: number
  lastReview: string | null
}

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

  async getDueCards(userId: number, limit: number, deckId?: number | null): Promise<ReviewCard[]> {
    const deckFilter = deckId != null ? 'AND c.deck_id = ?' : ''
    const params: (number | string)[] = deckId != null ? [userId, deckId, limit] : [userId, limit]
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
         AND cs.suspended_at IS NULL
         AND (cs.buried_until IS NULL OR cs.buried_until <= datetime('now'))
         ${deckFilter}
       ORDER BY cs.due ASC
       LIMIT ?`,
      params
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

  async getCardsForLesson(userId: number, lessonId: string, limit?: number): Promise<ReviewCard[]> {
    const query = `SELECT
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
       AND cs.lesson_id = ?
       AND cs.is_leech = 0
     ORDER BY cs.state ASC, cs.due ASC, cs.id ASC
     ${limit ? 'LIMIT ?' : ''}`

    const params = limit ? [userId, lessonId, limit] : [userId, lessonId]
    return this.storage.query<ReviewCard>(query, params)
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

  /**
   * Snapshot a card_state row (everything we'd need to roll back a review).
   * Returns null if the row doesn't exist.
   */
  async snapshotCardState(userId: number, cardStateId: number): Promise<CardStateSnapshot | null> {
    const rows = await this.storage.query<CardStateSnapshot>(
      `SELECT id, due, stability, difficulty, retrievability, state, reps, lapses,
              leech_count AS leechCount, is_leech AS isLeech, last_review AS lastReview
       FROM card_states WHERE id = ? AND user_id = ?`,
      [cardStateId, userId]
    )
    return rows[0] ?? null
  }

  /**
   * Restore a card_state row from a snapshot. Used by "undo last review".
   */
  async revertCardState(userId: number, snapshot: CardStateSnapshot): Promise<void> {
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
        last_review    = ?
       WHERE id = ? AND user_id = ?`,
      [
        snapshot.due,
        snapshot.stability,
        snapshot.difficulty,
        snapshot.retrievability,
        snapshot.state,
        snapshot.reps,
        snapshot.lapses,
        snapshot.leechCount,
        snapshot.isLeech,
        snapshot.lastReview,
        snapshot.id,
        userId,
      ]
    )
  }

  /**
   * Remove the most-recent mistake_log row for a card (used when undoing a
   * review that was rated "Again"). No-op if no rows match.
   */
  async deleteLatestMistakeForCard(userId: number, cardId: number): Promise<void> {
    await this.storage.execute(
      `DELETE FROM mistake_logs
       WHERE id = (
         SELECT id FROM mistake_logs
         WHERE user_id = ? AND card_id = ?
         ORDER BY id DESC LIMIT 1
       )`,
      [userId, cardId]
    )
  }

  async suspendCard(userId: number, cardStateId: number): Promise<void> {
    await this.storage.execute(
      `UPDATE card_states SET is_leech = 1, suspended_at = datetime('now') WHERE id = ? AND user_id = ?`,
      [cardStateId, userId]
    )
  }

  async unsuspendCard(userId: number, cardStateId: number): Promise<void> {
    await this.storage.execute(
      `UPDATE card_states SET is_leech = 0, suspended_at = NULL WHERE id = ? AND user_id = ?`,
      [cardStateId, userId]
    )
  }

  async buryCard(userId: number, cardStateId: number): Promise<void> {
    await this.storage.execute(
      `UPDATE card_states SET buried_until = datetime('now', '+1 day') WHERE id = ? AND user_id = ?`,
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
    cardId: number | null,
    userInput: string | null,
    correctAnswer: string,
    sessionId: number | null
  ): Promise<void> {
    await this.storage.execute(
      `INSERT INTO mistake_logs (user_id, card_id, user_input, correct_answer, session_id, logged_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))`,
      [userId, cardId, userInput, correctAnswer, sessionId]
    )
  }

  /**
   * Recent mistakes (default 7 days) joined with the originating card so callers
   * can drill them with the existing ReviewSession queue mechanism. Card-id is
   * nullable because free-form mistakes (e.g. from Conversation Partner) are
   * logged with cardId=null and won't join a row.
   */
  async getRecentMistakes(userId: number, daysBack = 7): Promise<Array<{
    mistakeId: number
    cardId: number | null
    cardStateId: number | null
    front: string | null
    back: string | null
    reading: string | null
    audioUrl: string | null
    type: string | null
    userInput: string | null
    correctAnswer: string
    loggedAt: string
  }>> {
    return this.storage.query(
      `SELECT
        m.id             AS mistakeId,
        m.card_id        AS cardId,
        cs.id            AS cardStateId,
        c.front          AS front,
        c.back           AS back,
        c.reading        AS reading,
        c.audio_url      AS audioUrl,
        c.type           AS type,
        m.user_input     AS userInput,
        m.correct_answer AS correctAnswer,
        m.logged_at      AS loggedAt
       FROM mistake_logs m
       LEFT JOIN cards       c  ON c.id  = m.card_id
       LEFT JOIN card_states cs ON cs.card_id = m.card_id AND cs.user_id = m.user_id
       WHERE m.user_id = ?
         AND m.logged_at >= datetime('now', '-' || ? || ' days')
       ORDER BY m.logged_at DESC`,
      [userId, daysBack]
    )
  }

  /**
   * Fetch full ReviewCard rows for a given list of card_state ids. Used to
   * build a drill queue (e.g. for MistakeReview) without re-running selection
   * logic.
   */
  async getCardsByStateIds(userId: number, cardStateIds: number[]): Promise<ReviewCard[]> {
    if (cardStateIds.length === 0) return []
    const placeholders = cardStateIds.map(() => '?').join(',')
    const rows = await this.storage.query<ReviewCard>(
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
         AND cs.id IN (${placeholders})`,
      [userId, ...cardStateIds]
    )
    // Preserve caller-supplied order
    const byId = new Map(rows.map(r => [r.cardStateId, r]))
    return cardStateIds.map(id => byId.get(id)).filter((r): r is ReviewCard => r != null)
  }

  async getRecentMistakeCount(userId: number, daysBack = 7): Promise<number> {
    const rows = await this.storage.query<{ count: number }>(
      `SELECT COUNT(*) AS count FROM mistake_logs
       WHERE user_id = ? AND logged_at >= datetime('now', '-' || ? || ' days')`,
      [userId, daysBack]
    )
    return rows[0]?.count ?? 0
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
       ORDER BY prog.times_seen ASC, prog.last_seen_at ASC, gp.frequency_rank ASC
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

  async getGrammarReviewContext(grammarPointId: number): Promise<GrammarReviewContext | null> {
    const rows = await this.storage.query<{
      grammarPointId: number
      jlptLevel: string
      title: string
      pattern: string | null
      meaning: string | null
      explanation: string | null
      examplesJson: string | null
      source: string | null
    }>(
      `SELECT
        id            AS grammarPointId,
        jlpt_level    AS jlptLevel,
        title,
        pattern,
        meaning,
        explanation,
        examples_json AS examplesJson,
        source
       FROM grammar_points
       WHERE id = ?`,
      [grammarPointId]
    )

    const row = rows[0]
    if (!row) return null

    let rawExamples: Array<{
      ja?: string
      japanese?: string
      reading?: string
      en?: string
      english?: string
    }> = []
    try {
      rawExamples = JSON.parse(row.examplesJson ?? '[]')
    } catch {
      rawExamples = []
    }

    return {
      grammarPointId: row.grammarPointId,
      title: row.title,
      pattern: row.pattern ?? row.title,
      meaning: row.meaning ?? '',
      explanation: row.explanation ?? '',
      examples: rawExamples
        .map(example => ({
          japanese: example.japanese ?? example.ja ?? '',
          reading: example.reading,
          english: example.english ?? example.en ?? '',
        }))
        .filter(example => example.japanese && example.english)
        .slice(0, 3),
      jlptLevel: row.jlptLevel,
      source: row.source,
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

  async createCardFromCorrection(
    userId: number,
    front: string,
    back: string,
    reading?: string
  ): Promise<number> {
    await this.storage.execute(
      `INSERT OR IGNORE INTO cards (type, front, back, reading) VALUES ('correction', ?, ?, ?)`,
      [front, back, reading ?? null]
    )
    const rows = await this.storage.query<{ id: number }>(
      `SELECT id FROM cards WHERE type = 'correction' AND front = ? LIMIT 1`,
      [front]
    )
    const cardId = rows[0].id
    const existing = await this.storage.query<{ id: number }>(
      `SELECT id FROM card_states WHERE card_id = ? AND user_id = ?`,
      [cardId, userId]
    )
    if (existing.length === 0) {
      await this.storage.execute(
        `INSERT INTO card_states (card_id, user_id, state) VALUES (?, ?, 'new')`,
        [cardId, userId]
      )
    }
    return cardId
  }

  leechThreshold(): number {
    return LEECH_THRESHOLD
  }
}
