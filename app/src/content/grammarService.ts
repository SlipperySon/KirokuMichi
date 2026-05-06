import type { StorageProvider } from '../core/providers'
import type { GrammarPoint, GrammarExample, JlptLevel } from './contentTypes'

interface RawGrammarRow {
  id: number
  jlpt_level: string
  title: string
  pattern: string
  meaning: string
  explanation: string
  examples_json: string
  category: string | null
  is_keigo: number
  frequency_rank: number | null
}

function parseRow(row: RawGrammarRow): GrammarPoint {
  let examples: GrammarExample[] = []
  try { examples = JSON.parse(row.examples_json) } catch { /* empty table */ }
  return {
    id: row.id,
    jlptLevel: row.jlpt_level,
    title: row.title,
    pattern: row.pattern,
    meaning: row.meaning,
    explanation: row.explanation,
    examples,
    category: row.category,
    isKeigo: row.is_keigo === 1,
    frequencyRank: row.frequency_rank,
  }
}

export class GrammarService {
  db: StorageProvider

  constructor(db: StorageProvider) {
    this.db = db
  }

  async getByLevel(level: JlptLevel): Promise<GrammarPoint[]> {
    const rows = await this.db.query<RawGrammarRow>(
      `SELECT * FROM grammar_points WHERE jlpt_level = ? ORDER BY frequency_rank ASC NULLS LAST, id ASC`,
      [level]
    )
    return rows.map(parseRow)
  }

  async getById(id: number): Promise<GrammarPoint | null> {
    const rows = await this.db.query<RawGrammarRow>(
      `SELECT * FROM grammar_points WHERE id = ?`,
      [id]
    )
    return rows[0] ? parseRow(rows[0]) : null
  }

  async getKeigo(level?: JlptLevel): Promise<GrammarPoint[]> {
    const sql = level
      ? `SELECT * FROM grammar_points WHERE is_keigo = 1 AND jlpt_level = ? ORDER BY frequency_rank ASC NULLS LAST, id ASC`
      : `SELECT * FROM grammar_points WHERE is_keigo = 1 ORDER BY jlpt_level ASC, frequency_rank ASC NULLS LAST, id ASC`
    const rows = await this.db.query<RawGrammarRow>(sql, level ? [level] : [])
    return rows.map(parseRow)
  }

  async search(query: string, level?: JlptLevel): Promise<GrammarPoint[]> {
    const like = `%${query}%`
    const sql = level
      ? `SELECT * FROM grammar_points WHERE jlpt_level = ? AND (title LIKE ? OR meaning LIKE ? OR pattern LIKE ?) ORDER BY frequency_rank ASC NULLS LAST, id ASC`
      : `SELECT * FROM grammar_points WHERE title LIKE ? OR meaning LIKE ? OR pattern LIKE ? ORDER BY jlpt_level ASC, frequency_rank ASC NULLS LAST, id ASC`
    const params = level ? [level, like, like, like] : [like, like, like]
    const rows = await this.db.query<RawGrammarRow>(sql, params)
    return rows.map(parseRow)
  }

  async getCountByLevel(level: JlptLevel): Promise<number> {
    const rows = await this.db.query<{ count: number }>(
      `SELECT COUNT(*) as count FROM grammar_points WHERE jlpt_level = ?`,
      [level]
    )
    return rows[0]?.count ?? 0
  }

  async getQuizItems(level: JlptLevel, limit = 20): Promise<import('./contentTypes').QuizItem[]> {
    const rows = await this.db.query<{
      id: number; grammar_point_id: number | null; jlpt_level: string
      question_type: string; prompt: string; options_json: string | null
      answer: string; explanation: string | null
    }>(
      `SELECT * FROM questions WHERE jlpt_level = ? AND active = 1 ORDER BY RANDOM() LIMIT ?`,
      [level, limit]
    )
    return rows.map(r => ({
      id: r.id,
      grammarPointId: r.grammar_point_id,
      jlptLevel: r.jlpt_level,
      questionType: r.question_type,
      prompt: r.prompt,
      options: r.options_json ? JSON.parse(r.options_json) : [],
      answer: r.answer,
      explanation: r.explanation,
    }))
  }

  async seedGrammar(level: JlptLevel): Promise<number> {
    try {
      const grammarData = await import(`../../data/generated/jlpt/grammar-${level.toLowerCase()}.json`)
      const grammar = Array.isArray(grammarData) ? grammarData : grammarData.default

      console.log(`📥 Imported grammar-${level}.json: ${grammar?.length ?? 0} items`)

      if (!grammar || grammar.length === 0) {
        console.warn(`⚠️ grammar-${level}.json is empty or undefined`)
        return 0
      }

      let inserted = 0
      const chunkSize = 100

      for (let i = 0; i < grammar.length; i += chunkSize) {
        const chunk = grammar.slice(i, i + chunkSize)
        for (const item of chunk) {
          const examples = typeof item.examplesJson === 'string'
            ? item.examplesJson
            : JSON.stringify(item.examplesJson || [])

          await this.db.execute(
            `INSERT OR IGNORE INTO grammar_points (jlpt_level, title, pattern, meaning, explanation, examples_json, category, is_keigo, frequency_rank)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              item.jlptLevel,
              item.title,
              item.pattern,
              item.meaning,
              item.explanation,
              examples,
              item.category,
              item.isKeigo ? 1 : 0,
              item.frequencyRank || 0
            ]
          )
          inserted++
        }
      }

      console.log(`✅ ${level}: ${inserted} grammar points processed`)
      return inserted
    } catch (error) {
      console.error(`Failed to seed grammar for ${level}:`, error)
      throw error
    }
  }
}
