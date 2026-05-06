import type { StorageProvider } from '../core/providers'
import type { VocabItem, GrammarPoint, QuizItem, JlptLevel } from './contentTypes'

export class UserContentService {
  db: StorageProvider

  constructor(db: StorageProvider) {
    this.db = db
  }

  // Vocabulary cards
  async addCard(
    front: string,
    back: string,
    reading: string,
    level: JlptLevel,
    userId: number
  ): Promise<number> {
    const result = await this.db.query<{ lastid: number }>(
      `INSERT INTO cards (front, back, reading, jlpt_level, type, source)
       VALUES (?, ?, ?, ?, 'vocabulary', 'user')
       RETURNING id`,
      [front, back, reading, level]
    )
    const cardId = result[0]?.lastid ?? 0

    // Add to card_states for this user
    if (cardId) {
      await this.db.execute(
        `INSERT INTO card_states (card_id, user_id, due, state)
         VALUES (?, ?, datetime('now'), 'new')`,
        [cardId, userId]
      )
    }

    return cardId
  }

  async deleteCard(id: number): Promise<void> {
    await this.db.execute(
      `DELETE FROM cards WHERE id = ? AND source = 'user'`,
      [id]
    )
    await this.db.execute(
      `DELETE FROM card_states WHERE card_id = ?`,
      [id]
    )
  }

  async getUserCards(userId: number): Promise<VocabItem[]> {
    const rows = await this.db.query<{
      id: number
      front: string
      back: string
      reading: string | null
      jlpt_level: string | null
      frequency_rank: number | null
    }>(
      `SELECT id, front, back, reading, jlpt_level, frequency_rank
       FROM cards
       WHERE type = 'vocabulary' AND source = 'user'
       ORDER BY id DESC`,
      []
    )

    return rows.map(r => ({
      id: r.id,
      front: r.front,
      back: r.back,
      reading: r.reading,
      jlptLevel: r.jlpt_level as JlptLevel | null,
      frequencyRank: r.frequency_rank,
      domain: null,
      audioUrl: null,
      isLearned: false,
    }))
  }

  // Grammar points
  async addGrammarPoint(
    title: string,
    pattern: string,
    meaning: string,
    explanation: string,
    level: JlptLevel,
    examples?: Array<{ japanese: string; reading: string; english: string }>,
    category?: string
  ): Promise<number> {
    const examplesJson = examples ? JSON.stringify(examples) : '[]'

    const result = await this.db.query<{ lastid: number }>(
      `INSERT INTO grammar_points (title, pattern, meaning, explanation, examples_json, jlpt_level, category, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'user')
       RETURNING id`,
      [title, pattern, meaning, explanation, examplesJson, level, category || null]
    )

    return result[0]?.lastid ?? 0
  }

  async deleteGrammarPoint(id: number): Promise<void> {
    await this.db.execute(
      `DELETE FROM grammar_points WHERE id = ? AND source = 'user'`,
      [id]
    )
  }

  async getUserGrammar(): Promise<GrammarPoint[]> {
    const rows = await this.db.query<{
      id: number
      title: string
      pattern: string
      meaning: string
      explanation: string
      examples_json: string
      category: string | null
      is_keigo: number
      frequency_rank: number | null
    }>(
      `SELECT * FROM grammar_points WHERE source = 'user' ORDER BY id DESC`,
      []
    )

    return rows.map(r => {
      let examples = []
      try {
        examples = JSON.parse(r.examples_json)
      } catch {
        // empty
      }

      return {
        id: r.id,
        title: r.title,
        pattern: r.pattern,
        meaning: r.meaning,
        explanation: r.explanation,
        examples,
        jlptLevel: 'N5',
        category: r.category,
        isKeigo: r.is_keigo === 1,
        frequencyRank: r.frequency_rank,
      }
    })
  }

  // Quiz questions
  async addQuizQuestion(
    prompt: string,
    options: string[],
    answer: string,
    level: JlptLevel,
    questionType: string = 'multiple-choice',
    explanation?: string,
    grammarPointId?: number
  ): Promise<number> {
    const optionsJson = JSON.stringify(options)

    const result = await this.db.query<{ lastid: number }>(
      `INSERT INTO questions (prompt, options_json, answer, jlpt_level, question_type, explanation, grammar_point_id, active, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'user')
       RETURNING id`,
      [prompt, optionsJson, answer, level, questionType, explanation || null, grammarPointId || null]
    )

    return result[0]?.lastid ?? 0
  }

  async deleteQuizQuestion(id: number): Promise<void> {
    await this.db.execute(
      `DELETE FROM questions WHERE id = ? AND source = 'user'`,
      [id]
    )
  }

  async getUserQuizzes(): Promise<QuizItem[]> {
    const rows = await this.db.query<{
      id: number
      grammar_point_id: number | null
      jlpt_level: string
      question_type: string
      prompt: string
      options_json: string | null
      answer: string
      explanation: string | null
    }>(
      `SELECT * FROM questions WHERE source = 'user' ORDER BY id DESC`,
      []
    )

    return rows.map(r => ({
      id: r.id,
      grammarPointId: r.grammar_point_id,
      jlptLevel: r.jlpt_level as JlptLevel,
      questionType: r.question_type,
      prompt: r.prompt,
      options: r.options_json ? JSON.parse(r.options_json) : [],
      answer: r.answer,
      explanation: r.explanation,
    }))
  }

  // Import generated content
  async importGeneratedContent(
    json: any,
    userId: number
  ): Promise<{ cards: number; grammar: number; quiz: number }> {
    let cardsCount = 0
    let grammarCount = 0
    let quizCount = 0

    if (Array.isArray(json.cards)) {
      for (const card of json.cards) {
        try {
          await this.addCard(
            card.japanese || card.front,
            card.meaning || card.back,
            card.reading,
            card.jlptLevel || 'N5',
            userId
          )
          cardsCount++
        } catch {
          // Skip on error
        }
      }
    }

    if (Array.isArray(json.grammar)) {
      for (const point of json.grammar) {
        try {
          await this.addGrammarPoint(
            point.title,
            point.pattern,
            point.meaning,
            point.explanation,
            point.jlptLevel || 'N5',
            point.examples,
            point.category
          )
          grammarCount++
        } catch {
          // Skip on error
        }
      }
    }

    if (Array.isArray(json.questions)) {
      for (const question of json.questions) {
        try {
          await this.addQuizQuestion(
            question.prompt,
            question.options,
            question.answer,
            question.jlptLevel || 'N5',
            question.questionType,
            question.explanation,
            question.grammarPointId
          )
          quizCount++
        } catch {
          // Skip on error
        }
      }
    }

    return { cards: cardsCount, grammar: grammarCount, quiz: quizCount }
  }
}
