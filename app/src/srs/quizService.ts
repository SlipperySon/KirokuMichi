import type { StorageProvider } from '../core/providers'
import type { QuizItem, JlptLevel } from '../content/contentTypes'

export interface TestSession {
  id: number
  userId: number
  jlptLevel: JlptLevel
  startedAt: string
  finishedAt: string | null
  durationSeconds: number | null
  totalQuestions: number
  correctCount: number | null
  scorePercent: number | null
}

export interface TestResponse {
  id: number
  testSessionId: number
  quizQuestionId: number
  userAnswer: string | null
  correct: number
  timeSpentSeconds: number | null
}

export class QuizService {
  db: StorageProvider

  constructor(db: StorageProvider) {
    this.db = db
  }

  async getByLevel(level: JlptLevel, limit = 100): Promise<QuizItem[]> {
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
      `SELECT * FROM questions WHERE jlpt_level = ? AND active = 1 ORDER BY id ASC LIMIT ?`,
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

  async getRandomQuestions(level: JlptLevel, count: number): Promise<QuizItem[]> {
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
      `SELECT * FROM questions WHERE jlpt_level = ? AND active = 1 ORDER BY RANDOM() LIMIT ?`,
      [level, count]
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

  async createTest(
    userId: number,
    level: JlptLevel,
    size: 20 | 30
  ): Promise<{ testId: number; questions: QuizItem[] }> {
    // Create test session
    const sessionId = await this.db.query<{ lastid: number }>(
      `INSERT INTO test_sessions (user_id, jlpt_level, total_questions) VALUES (?, ?, ?) RETURNING id`,
      [userId, level, size]
    )

    // Get random questions
    const questions = await this.getRandomQuestions(level, size)

    return {
      testId: sessionId[0]?.lastid ?? 0,
      questions,
    }
  }

  async logResponse(
    testSessionId: number,
    quizQuestionId: number,
    userAnswer: string | null,
    correct: boolean,
    timeSpentSeconds: number
  ): Promise<void> {
    await this.db.execute(
      `INSERT INTO test_responses (test_session_id, quiz_question_id, user_answer, correct, time_spent_seconds)
       VALUES (?, ?, ?, ?, ?)`,
      [testSessionId, quizQuestionId, userAnswer, correct ? 1 : 0, timeSpentSeconds]
    )
  }

  async endTest(testSessionId: number, stats: {
    correctCount: number
    durationSeconds: number
  }): Promise<void> {
    const scorePercent = await this.db.query<{ total: number }>(
      `SELECT COUNT(*) as total FROM test_responses WHERE test_session_id = ?`,
      [testSessionId]
    )
    const total = scorePercent[0]?.total ?? 1
    const percent = Math.round((stats.correctCount / total) * 100)

    await this.db.execute(
      `UPDATE test_sessions SET finished_at = datetime('now'), duration_seconds = ?, correct_count = ?, score_percent = ? WHERE id = ?`,
      [stats.durationSeconds, stats.correctCount, percent, testSessionId]
    )
  }

  async getTestSession(testSessionId: number): Promise<TestSession | null> {
    const rows = await this.db.query<{
      id: number
      user_id: number
      jlpt_level: string
      started_at: string
      finished_at: string | null
      duration_seconds: number | null
      total_questions: number
      correct_count: number | null
      score_percent: number | null
    }>(
      `SELECT * FROM test_sessions WHERE id = ?`,
      [testSessionId]
    )
    return rows[0] ? {
      id: rows[0].id,
      userId: rows[0].user_id,
      jlptLevel: rows[0].jlpt_level as JlptLevel,
      startedAt: rows[0].started_at,
      finishedAt: rows[0].finished_at,
      durationSeconds: rows[0].duration_seconds,
      totalQuestions: rows[0].total_questions,
      correctCount: rows[0].correct_count,
      scorePercent: rows[0].score_percent,
    } : null
  }

  async getTestResponses(testSessionId: number): Promise<TestResponse[]> {
    const rows = await this.db.query<{
      id: number
      test_session_id: number
      quiz_question_id: number
      user_answer: string | null
      correct: number
      time_spent_seconds: number | null
    }>(
      `SELECT * FROM test_responses WHERE test_session_id = ? ORDER BY id ASC`,
      [testSessionId]
    )
    return rows.map(r => ({
      id: r.id,
      testSessionId: r.test_session_id,
      quizQuestionId: r.quiz_question_id,
      userAnswer: r.user_answer,
      correct: r.correct,
      timeSpentSeconds: r.time_spent_seconds,
    }))
  }

  async getUserTestHistory(userId: number, level?: JlptLevel, limit = 20): Promise<TestSession[]> {
    const sql = level
      ? `SELECT * FROM test_sessions WHERE user_id = ? AND jlpt_level = ? ORDER BY started_at DESC LIMIT ?`
      : `SELECT * FROM test_sessions WHERE user_id = ? ORDER BY started_at DESC LIMIT ?`
    const params = level ? [userId, level, limit] : [userId, limit]

    const rows = await this.db.query<{
      id: number
      user_id: number
      jlpt_level: string
      started_at: string
      finished_at: string | null
      duration_seconds: number | null
      total_questions: number
      correct_count: number | null
      score_percent: number | null
    }>(sql, params)

    return rows.map(r => ({
      id: r.id,
      userId: r.user_id,
      jlptLevel: r.jlpt_level as JlptLevel,
      startedAt: r.started_at,
      finishedAt: r.finished_at,
      durationSeconds: r.duration_seconds,
      totalQuestions: r.total_questions,
      correctCount: r.correct_count,
      scorePercent: r.score_percent,
    }))
  }

  async seedQuiz(level: JlptLevel): Promise<number> {
    try {
      let allQuizzes: any[] = []

      // Load all quiz-part*.json files
      for (let i = 1; i <= 10; i++) {
        try {
          const quizData = await import(`../../data/generated/jlpt/quiz-part${i}.json`)
          const quizzes = Array.isArray(quizData) ? quizData : quizData.default
          if (quizzes) {
            allQuizzes = allQuizzes.concat(quizzes)
          }
        } catch {
          // File might not exist, continue
        }
      }

      // Filter by level
      const levelQuizzes = allQuizzes.filter((q: any) => q.jlptLevel === level)
      console.log(`📥 Loaded quiz items for ${level}: ${levelQuizzes.length} items`)

      if (levelQuizzes.length === 0) {
        console.warn(`⚠️ No quiz items found for ${level}`)
        return 0
      }

      let inserted = 0
      const chunkSize = 100

      for (let i = 0; i < levelQuizzes.length; i += chunkSize) {
        const chunk = levelQuizzes.slice(i, i + chunkSize)
        for (const item of chunk) {
          const options = typeof item.optionsJson === 'string'
            ? item.optionsJson
            : JSON.stringify(item.optionsJson || [])

          await this.db.execute(
            `INSERT OR IGNORE INTO questions (grammar_point_id, jlpt_level, question_type, prompt, options_json, answer, explanation, active)
             VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
            [
              item.grammarPointId || null,
              item.jlptLevel,
              item.questionType,
              item.prompt,
              options,
              item.answer,
              item.explanation || null
            ]
          )
          inserted++
        }
      }

      console.log(`✅ ${level}: ${inserted} quiz items processed`)
      return inserted
    } catch (error) {
      console.error(`Failed to seed quiz for ${level}:`, error)
      throw error
    }
  }
}
