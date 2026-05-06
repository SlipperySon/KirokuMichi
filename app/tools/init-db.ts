import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import initSqlJs from 'sql.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dbPath = path.join(__dirname, '../data/kiroku.db')
const sqlPath = path.join(__dirname, '../data/generated/import.sql')

const MIGRATIONS: string[] = [
  `CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    jlpt_level TEXT NOT NULL DEFAULT 'N5',
    goal_level TEXT,
    goal_date TEXT,
    study_mode TEXT NOT NULL DEFAULT 'standard',
    hover_delay_ms INTEGER NOT NULL DEFAULT 2000,
    hiragana_complete INTEGER NOT NULL DEFAULT 0,
    onboarding_complete INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS cards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    front TEXT NOT NULL,
    back TEXT NOT NULL,
    reading TEXT,
    jlpt_level TEXT,
    frequency_rank INTEGER,
    domain TEXT,
    audio_url TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE INDEX IF NOT EXISTS cards_jlpt_idx ON cards(jlpt_level)`,
  `CREATE INDEX IF NOT EXISTS cards_frequency_idx ON cards(frequency_rank)`,
  `CREATE TABLE IF NOT EXISTS card_states (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    card_id INTEGER NOT NULL REFERENCES cards(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    due TEXT NOT NULL DEFAULT (datetime('now')),
    stability REAL NOT NULL DEFAULT 0,
    difficulty REAL NOT NULL DEFAULT 0,
    retrievability REAL NOT NULL DEFAULT 0,
    state TEXT NOT NULL DEFAULT 'new',
    reps INTEGER NOT NULL DEFAULT 0,
    lapses INTEGER NOT NULL DEFAULT 0,
    leech_count INTEGER NOT NULL DEFAULT 0,
    is_leech INTEGER NOT NULL DEFAULT 0,
    last_review TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS card_states_due_idx ON card_states(due)`,
  `CREATE INDEX IF NOT EXISTS card_states_user_idx ON card_states(user_id)`,
  `CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    mode TEXT NOT NULL,
    duration_seconds INTEGER NOT NULL DEFAULT 0,
    cards_reviewed INTEGER NOT NULL DEFAULT 0,
    correct_count INTEGER NOT NULL DEFAULT 0,
    started_at TEXT NOT NULL DEFAULT (datetime('now')),
    ended_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS mistake_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    card_id INTEGER REFERENCES cards(id),
    grammar_point_id INTEGER,
    user_input TEXT,
    correct_answer TEXT NOT NULL,
    session_id INTEGER REFERENCES sessions(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE INDEX IF NOT EXISTS mistake_logs_user_idx ON mistake_logs(user_id)`,
  `CREATE INDEX IF NOT EXISTS mistake_logs_grammar_idx ON mistake_logs(grammar_point_id)`,
  `CREATE TABLE IF NOT EXISTS weak_point_summaries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    summary TEXT NOT NULL,
    staleness_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS assessments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    type TEXT NOT NULL,
    questions_json TEXT NOT NULL,
    answers_json TEXT NOT NULL,
    result_level TEXT,
    ai_breakdown TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS daily_schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    date TEXT NOT NULL,
    blocks_json TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS settings_user_key_idx ON settings(user_id, key)`,
  `CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id),
    event_type TEXT NOT NULL,
    payload TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE INDEX IF NOT EXISTS events_type_idx ON events(event_type)`,
  `CREATE TABLE IF NOT EXISTS questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    grammar_point_id INTEGER,
    jlpt_level TEXT NOT NULL,
    question_type TEXT NOT NULL,
    prompt TEXT NOT NULL,
    options_json TEXT,
    answer TEXT NOT NULL,
    explanation TEXT,
    source TEXT NOT NULL DEFAULT 'pregenerated',
    quality_score REAL,
    confidence REAL,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE INDEX IF NOT EXISTS questions_jlpt_idx ON questions(jlpt_level)`,
  `CREATE TABLE IF NOT EXISTS grammar_dependencies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    grammar_point_id INTEGER NOT NULL,
    prerequisite_id INTEGER NOT NULL,
    jlpt_level TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS prompt_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    template_key TEXT NOT NULL,
    version INTEGER NOT NULL,
    template_content TEXT NOT NULL,
    effective_date TEXT NOT NULL DEFAULT (datetime('now')),
    active INTEGER NOT NULL DEFAULT 1
  )`,
  `CREATE INDEX IF NOT EXISTS prompt_templates_key_idx ON prompt_templates(template_key)`,
  `CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reported_by INTEGER REFERENCES users(id),
    target_type TEXT NOT NULL,
    target_id INTEGER NOT NULL,
    reason TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS grammar_points (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    jlpt_level TEXT NOT NULL,
    title TEXT NOT NULL,
    pattern TEXT NOT NULL,
    meaning TEXT NOT NULL,
    explanation TEXT NOT NULL,
    examples_json TEXT NOT NULL,
    category TEXT,
    is_keigo INTEGER NOT NULL DEFAULT 0,
    frequency_rank INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE INDEX IF NOT EXISTS grammar_jlpt_idx ON grammar_points(jlpt_level)`,
  `CREATE INDEX IF NOT EXISTS grammar_keigo_idx ON grammar_points(is_keigo)`,
]

async function main() {
  try {
    const SQL = await initSqlJs()
    
    let db
    if (fs.existsSync(dbPath)) {
      const buffer = fs.readFileSync(dbPath)
      db = new SQL.Database(new Uint8Array(buffer))
    } else {
      db = new SQL.Database()
    }
    
    console.log('Running migrations...')
    for (const migration of MIGRATIONS) {
      db.run(migration)
    }
    console.log(`✓ Migrations complete`)
    
    console.log('Importing content...')
    const sql = fs.readFileSync(sqlPath, 'utf-8')
    db.exec(sql)
    console.log(`✓ Import complete`)
    
    const buffer = db.export()
    fs.writeFileSync(dbPath, Buffer.from(buffer))
    console.log(`✓ Database saved to ${dbPath}`)
    
    db.close()
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
}

main()
