import type { StorageProvider } from '../core/providers'
import type { VocabItem, JlptLevel } from './contentTypes'

interface RawCardRow {
  id: number
  front: string
  back: string
  reading: string | null
  jlpt_level: string | null
  frequency_rank: number | null
  domain: string | null
  audio_url: string | null
}

export class VocabService {
  db: StorageProvider

  constructor(db: StorageProvider) {
    this.db = db
  }

  async getByLevel(level: JlptLevel, userId: number, offset = 0, limit = 50): Promise<VocabItem[]> {
    const rows = await this.db.query<RawCardRow & { reps: number | null }>(
      `SELECT c.*, cs.reps
       FROM cards c
       LEFT JOIN card_states cs ON cs.card_id = c.id AND cs.user_id = ?
       WHERE c.jlpt_level = ? AND c.type = 'vocabulary'
       ORDER BY c.frequency_rank ASC NULLS LAST, c.id ASC
       LIMIT ? OFFSET ?`,
      [userId, level, limit, offset]
    )
    return rows.map(r => ({
      id: r.id,
      front: r.front,
      back: r.back,
      reading: r.reading,
      jlptLevel: r.jlpt_level,
      frequencyRank: r.frequency_rank,
      domain: r.domain,
      audioUrl: r.audio_url,
      isLearned: (r.reps ?? 0) > 0,
    }))
  }

  async search(query: string, userId: number, level?: JlptLevel): Promise<VocabItem[]> {
    const like = `%${query}%`
    const sql = level
      ? `SELECT c.*, cs.reps FROM cards c
         LEFT JOIN card_states cs ON cs.card_id = c.id AND cs.user_id = ?
         WHERE c.type = 'vocabulary' AND c.jlpt_level = ? AND (c.front LIKE ? OR c.back LIKE ? OR c.reading LIKE ?)
         ORDER BY c.frequency_rank ASC NULLS LAST, c.id ASC LIMIT 100`
      : `SELECT c.*, cs.reps FROM cards c
         LEFT JOIN card_states cs ON cs.card_id = c.id AND cs.user_id = ?
         WHERE c.type = 'vocabulary' AND (c.front LIKE ? OR c.back LIKE ? OR c.reading LIKE ?)
         ORDER BY c.jlpt_level ASC, c.frequency_rank ASC NULLS LAST, c.id ASC LIMIT 100`
    const params = level ? [userId, level, like, like, like] : [userId, like, like, like]
    const rows = await this.db.query<RawCardRow & { reps: number | null }>(sql, params)
    return rows.map(r => ({
      id: r.id,
      front: r.front,
      back: r.back,
      reading: r.reading,
      jlptLevel: r.jlpt_level,
      frequencyRank: r.frequency_rank,
      domain: r.domain,
      audioUrl: r.audio_url,
      isLearned: (r.reps ?? 0) > 0,
    }))
  }

  async getCountByLevel(level: JlptLevel): Promise<number> {
    const rows = await this.db.query<{ count: number }>(
      `SELECT COUNT(*) as count FROM cards WHERE jlpt_level = ? AND type = 'vocabulary'`,
      [level]
    )
    return rows[0]?.count ?? 0
  }

  async addToSrs(cardId: number, userId: number): Promise<void> {
    const existing = await this.db.query<{ id: number }>(
      `SELECT id FROM card_states WHERE card_id = ? AND user_id = ?`,
      [cardId, userId]
    )
    if (existing.length > 0) return
    await this.db.execute(
      `INSERT INTO card_states (card_id, user_id, due, state) VALUES (?, ?, datetime('now'), 'new')`,
      [cardId, userId]
    )
  }

  async seedVocabulary(level: 'N5' | 'N4' | 'N3' | 'N2' | 'N1', userId: number): Promise<number> {
    try {
      const vocabData = await import(`../../data/generated/jlpt/vocab-${level}.json`)
      const vocab = Array.isArray(vocabData) ? vocabData : vocabData.default
      console.log(`📥 Imported vocab-${level}.json: ${vocab?.length ?? 0} items`)
      if (!vocab || vocab.length === 0) {
        console.warn(`⚠️ vocab-${level}.json is empty or undefined`)
        return 0
      }

      console.log(`➕ Inserting vocabulary for ${level}...`)

      // Batch insert cards with INSERT OR IGNORE (idempotent)
      const chunkSize = 100
      let cardsInserted = 0
      for (let i = 0; i < vocab.length; i += chunkSize) {
        const chunk = vocab.slice(i, i + chunkSize)
        for (const item of chunk) {
          await this.db.execute(
            `INSERT OR IGNORE INTO cards (type, front, back, reading, jlpt_level, frequency_rank)
             VALUES ('vocabulary', ?, ?, ?, ?, ?)`,
            [(item as any).japanese, (item as any).meaning, (item as any).reading, level, (item as any).frequency_rank]
          )
          cardsInserted++
        }
        console.log(`📍 Progress: ${i + chunk.length}/${vocab.length} cards processed for ${level}`)
      }
      console.log(`✅ Vocabulary processed for ${level}: ${cardsInserted} cards`)

      // Get all card IDs for this level to create card_states
      const allCards = await this.db.query<{ id: number }>(
        `SELECT id FROM cards WHERE type = 'vocabulary' AND jlpt_level = ?`,
        [level]
      )
      console.log(`✨ Found ${allCards.length} total cards for ${level}`)

      // Batch insert card_states with INSERT OR IGNORE (idempotent)
      let stateInserted = 0
      const stateChunkSize = 100
      for (let i = 0; i < allCards.length; i += stateChunkSize) {
        const chunk = allCards.slice(i, i + stateChunkSize)
        for (const card of chunk) {
          await this.db.execute(
            `INSERT OR IGNORE INTO card_states (card_id, user_id, due, state, stability, difficulty, retrievability, reps, lapses, is_leech)
             VALUES (?, ?, datetime('now'), 'new', 0, 0, 0, 0, 0, 0)`,
            [card.id, userId]
          )
          stateInserted++
        }
      }

      console.log(`✅ ${level}: ${stateInserted} card_states created`)
      return stateInserted
    } catch (error) {
      console.error(`Failed to seed vocabulary for ${level}:`, error)
      throw error
    }
  }
}
