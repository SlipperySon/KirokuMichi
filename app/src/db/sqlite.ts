import type { StorageProvider } from '../core/providers'

let dbInstance: import('sql.js').Database | null = null
let dbInitPromise: Promise<import('sql.js').Database> | null = null

async function initDB() {
  if (dbInstance) return dbInstance
  if (dbInitPromise) return dbInitPromise

  dbInitPromise = (async () => {
    const initSqlJs = (await import('sql.js')).default
    const SQL = await initSqlJs({
      locateFile: (file: string) => `/node_modules/sql.js/dist/${file}`,
    })

    const saved = localStorage.getItem('kiroku_michi_db')
    if (saved) {
      const buf = Uint8Array.from(atob(saved), c => c.charCodeAt(0))
      dbInstance = new SQL.Database(buf)
    } else {
      dbInstance = new SQL.Database()
    }

    // Always run schema init + migrations (CREATE IF NOT EXISTS is idempotent)
    initializeSchema()

    // Clear old imported cards on first load of new system
    clearOldCards()

    return dbInstance
  })()

  return dbInitPromise
}

function initializeSchema() {
  if (!dbInstance) return

  dbInstance.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      jlpt_level TEXT DEFAULT 'N5',
      study_mode TEXT DEFAULT 'standard',
      hover_delay_ms INTEGER DEFAULT 2000,
      hiragana_complete INTEGER DEFAULT 0,
      katakana_complete INTEGER DEFAULT 0,
      onboarding_complete INTEGER DEFAULT 0
    )
  `)

  dbInstance.run(`
    CREATE TABLE IF NOT EXISTS cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      front TEXT NOT NULL,
      back TEXT NOT NULL,
      reading TEXT,
      audio_url TEXT,
      jlpt_level TEXT,
      type TEXT DEFAULT 'vocabulary',
      frequency_rank INTEGER,
      source TEXT DEFAULT 'base'
    )
  `)

  dbInstance.run(`
    CREATE TABLE IF NOT EXISTS card_states (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      card_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      state TEXT DEFAULT 'new',
      due TEXT,
      stability REAL DEFAULT 0,
      difficulty REAL DEFAULT 0,
      retrievability REAL DEFAULT 0,
      reps INTEGER DEFAULT 0,
      lapses INTEGER DEFAULT 0,
      leech_count INTEGER DEFAULT 0,
      is_leech INTEGER DEFAULT 0,
      last_review TEXT,
      lesson_id TEXT DEFAULT NULL,
      UNIQUE(card_id, user_id)
    )
  `)

  // Index creation moved after ALTER TABLE (see below)

  dbInstance.run(`
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      mode TEXT DEFAULT 'srs',
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      ended_at DATETIME,
      duration_seconds INTEGER,
      cards_reviewed INTEGER,
      correct_count INTEGER
    )
  `)

  dbInstance.run(`
    CREATE TABLE IF NOT EXISTS questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      grammar_point_id INTEGER,
      jlpt_level TEXT,
      question_type TEXT,
      prompt TEXT,
      options_json TEXT,
      answer TEXT,
      explanation TEXT,
      active INTEGER DEFAULT 1,
      source TEXT DEFAULT 'base'
    )
  `)

  dbInstance.run(`
    CREATE TABLE IF NOT EXISTS mistake_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      card_id INTEGER,
      user_id INTEGER,
      session_id INTEGER,
      user_input TEXT,
      correct_answer TEXT,
      logged_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  dbInstance.run(`
    CREATE TABLE IF NOT EXISTS grammar_points (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      jlpt_level TEXT NOT NULL,
      title TEXT NOT NULL,
      pattern TEXT,
      meaning TEXT,
      explanation TEXT,
      examples_json TEXT,
      category TEXT,
      is_keigo INTEGER DEFAULT 0,
      frequency_rank INTEGER,
      source TEXT DEFAULT 'base'
    )
  `)

  dbInstance.run(`
    CREATE TABLE IF NOT EXISTS test_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      jlpt_level TEXT NOT NULL,
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      finished_at DATETIME,
      duration_seconds INTEGER,
      total_questions INTEGER,
      correct_count INTEGER,
      score_percent INTEGER
    )
  `)

  dbInstance.run(`
    CREATE TABLE IF NOT EXISTS test_responses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      test_session_id INTEGER NOT NULL,
      quiz_question_id INTEGER NOT NULL,
      user_answer TEXT,
      correct INTEGER,
      time_spent_seconds INTEGER,
      FOREIGN KEY (test_session_id) REFERENCES test_sessions(id)
    )
  `)

  dbInstance.run(`
    CREATE TABLE IF NOT EXISTS weak_point_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      computed_at DATETIME NOT NULL,
      summary_json TEXT NOT NULL
    )
  `)

  dbInstance.run(`
    CREATE TABLE IF NOT EXISTS grammar_progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      grammar_point_id INTEGER NOT NULL,
      last_seen_at DATETIME,
      times_seen INTEGER NOT NULL DEFAULT 0,
      UNIQUE(user_id, grammar_point_id)
    )
  `)

  // Idempotent migrations — safe to run against both new and existing DBs
  dbInstance.run(`
    CREATE TABLE IF NOT EXISTS grammar_progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      grammar_point_id INTEGER NOT NULL,
      last_seen_at DATETIME,
      times_seen INTEGER NOT NULL DEFAULT 0,
      UNIQUE(user_id, grammar_point_id)
    )
  `)

  try {
    dbInstance.run(`ALTER TABLE cards ADD COLUMN source TEXT DEFAULT 'base'`)
  } catch {
    // Column already exists
  }

  try {
    dbInstance.run(`ALTER TABLE grammar_points ADD COLUMN source TEXT DEFAULT 'base'`)
  } catch {
    // Column already exists
  }

  try {
    dbInstance.run(`ALTER TABLE questions ADD COLUMN source TEXT DEFAULT 'base'`)
  } catch {
    // Column already exists
  }

  try {
    dbInstance.run(`ALTER TABLE card_states ADD COLUMN lesson_id TEXT DEFAULT NULL`)
  } catch {
    // Column already exists
  }

  try {
    dbInstance.run(`ALTER TABLE card_states ADD COLUMN suspended_at DATETIME NULL`)
  } catch {
    // Column already exists
  }

  try {
    dbInstance.run(`ALTER TABLE card_states ADD COLUMN buried_until DATETIME NULL`)
  } catch {
    // Column already exists
  }

  // Decks table for subdeck hierarchy
  dbInstance.run(`
    CREATE TABLE IF NOT EXISTS decks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      parent_id INTEGER REFERENCES decks(id),
      name TEXT NOT NULL,
      created_at DATETIME DEFAULT (datetime('now'))
    )
  `)

  try {
    dbInstance.run(`ALTER TABLE cards ADD COLUMN deck_id INTEGER REFERENCES decks(id)`)
  } catch {
    // Column already exists
  }

  // Filtered decks table
  dbInstance.run(`
    CREATE TABLE IF NOT EXISTS filtered_decks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      query TEXT NOT NULL,
      card_limit INTEGER DEFAULT 50,
      created_at DATETIME DEFAULT (datetime('now'))
    )
  `)

  // Create index for lesson_id queries (after column exists)
  try {
    dbInstance.run(`
      CREATE INDEX IF NOT EXISTS idx_card_states_lesson
      ON card_states(user_id, lesson_id)
    `)
  } catch {
    // Index already exists
  }

  // Card templates table (Feature 2)
  dbInstance.run(`
    CREATE TABLE IF NOT EXISTS card_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      deck_id INTEGER REFERENCES decks(id),
      name TEXT NOT NULL DEFAULT 'Basic',
      front_template TEXT NOT NULL DEFAULT '{{front}}',
      back_template TEXT NOT NULL DEFAULT '{{front}}\n\n{{back}}',
      css TEXT DEFAULT '',
      created_at DATETIME DEFAULT (datetime('now'))
    )
  `)

  // Idempotent migrations for cards table (Feature 2)
  try {
    dbInstance.run(`ALTER TABLE cards ADD COLUMN fields_json TEXT`)
  } catch {
    // Column already exists
  }

  try {
    dbInstance.run(`ALTER TABLE cards ADD COLUMN template_id INTEGER REFERENCES card_templates(id)`)
  } catch {
    // Column already exists
  }

  persist()
}

function clearOldCards() {
  if (!dbInstance) return

  // Clear old imported cards on first load of new system
  const hasCleared = localStorage.getItem('kiroku_michi_cleared_old_cards')
  if (!hasCleared) {
    try {
      // Delete all imported cards (from old Anki import system)
      dbInstance.run(`DELETE FROM card_states`)
      dbInstance.run(`DELETE FROM cards`)
      localStorage.setItem('kiroku_michi_cleared_old_cards', 'true')
      console.log('Cleared old imported cards from database')
    } catch (e) {
      console.error('Error clearing old cards:', e)
    }
  }
}

function persist() {
  if (!dbInstance) return
  const data = dbInstance.export()
  let binary = ''
  const chunkSize = 8192
  for (let i = 0; i < data.length; i += chunkSize) {
    binary += String.fromCharCode(...data.subarray(i, i + chunkSize))
  }
  localStorage.setItem('kiroku_michi_db', btoa(binary))
}

export class SQLiteStorage implements StorageProvider {
  async query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    const db = await initDB()
    const stmt = db.prepare(sql)
    stmt.bind(params as (string | number | null | Uint8Array)[])
    const rows: T[] = []
    while (stmt.step()) {
      rows.push(stmt.getAsObject() as T)
    }
    stmt.free()
    return rows
  }

  async execute(sql: string, params: unknown[] = []): Promise<void> {
    const db = await initDB()
    db.run(sql, params as (string | number | null | Uint8Array)[])
    persist()
  }

  async close(): Promise<void> {
    if (dbInstance) {
      persist()
      dbInstance.close()
      dbInstance = null
      dbInitPromise = null
    }
  }
}
