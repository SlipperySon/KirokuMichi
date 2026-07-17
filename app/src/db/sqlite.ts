import type { StorageProvider } from '../core/providers'

let dbInstance: import('sql.js').Database | null = null
let dbInitPromise: Promise<import('sql.js').Database> | null = null
let persistTimer: ReturnType<typeof setTimeout> | null = null
let persistInFlight: Promise<void> | null = null

const DB_STORAGE_KEY = 'kiroku_michi_db'
const DB_IDB_NAME = 'kiroku_michi_storage'
const DB_IDB_STORE = 'snapshots'
const DB_IDB_KEY = 'sqlite'
const DB_PERSIST_DEBOUNCE_MS = 250

function hasIndexedDB() {
  return typeof indexedDB !== 'undefined'
}

function hasLocalStorage() {
  return typeof localStorage !== 'undefined'
}

function openPersistenceDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!hasIndexedDB()) {
      reject(new Error('IndexedDB is not available'))
      return
    }
    const request = indexedDB.open(DB_IDB_NAME, 1)
    request.onupgradeneeded = () => {
      request.result.createObjectStore(DB_IDB_STORE)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Could not open IndexedDB'))
  })
}

async function readSnapshotFromIndexedDB(): Promise<Uint8Array | null> {
  if (!hasIndexedDB()) return null
  const idb = await openPersistenceDB()
  try {
    return await new Promise((resolve, reject) => {
      const tx = idb.transaction(DB_IDB_STORE, 'readonly')
      const request = tx.objectStore(DB_IDB_STORE).get(DB_IDB_KEY)
      request.onsuccess = () => {
        const value = request.result
        resolve(value instanceof Uint8Array ? value : value instanceof ArrayBuffer ? new Uint8Array(value) : null)
      }
      request.onerror = () => reject(request.error ?? new Error('Could not read SQLite snapshot'))
    })
  } finally {
    idb.close()
  }
}

async function writeSnapshotToIndexedDB(data: Uint8Array): Promise<void> {
  const idb = await openPersistenceDB()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = idb.transaction(DB_IDB_STORE, 'readwrite')
      tx.objectStore(DB_IDB_STORE).put(data, DB_IDB_KEY)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error ?? new Error('Could not persist SQLite snapshot'))
    })
  } finally {
    idb.close()
  }
}

function readSnapshotFromLocalStorage(): Uint8Array | null {
  if (!hasLocalStorage()) return null
  const saved = localStorage.getItem(DB_STORAGE_KEY)
  if (!saved) return null
  return Uint8Array.from(atob(saved), c => c.charCodeAt(0))
}

function writeSnapshotToLocalStorage(data: Uint8Array) {
  if (!hasLocalStorage()) throw new Error('localStorage is not available')
  let binary = ''
  const chunkSize = 8192
  for (let i = 0; i < data.length; i += chunkSize) {
    binary += String.fromCharCode(...data.subarray(i, i + chunkSize))
  }
  localStorage.setItem(DB_STORAGE_KEY, btoa(binary))
}

async function loadPersistedSnapshot(): Promise<Uint8Array | null> {
  try {
    const idbSnapshot = await readSnapshotFromIndexedDB()
    if (idbSnapshot) return idbSnapshot
  } catch (err) {
    console.warn('Could not read SQLite snapshot from IndexedDB:', err)
  }

  const localSnapshot = readSnapshotFromLocalStorage()
  if (localSnapshot) {
    void writeSnapshotToIndexedDB(localSnapshot).then(() => {
      try {
        if (hasLocalStorage()) localStorage.removeItem(DB_STORAGE_KEY)
      } catch {
        // Keep the fallback copy if removal is blocked.
      }
    }).catch(err => console.warn('Could not migrate SQLite snapshot to IndexedDB:', err))
  }
  return localSnapshot
}

function dispatchPersistenceWarning(error: unknown) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('kiroku:persistence-error', {
    detail: {
      message: error instanceof Error ? error.message : 'Could not save study data',
    },
  }))
}

async function initDB() {
  if (dbInstance) return dbInstance
  if (dbInitPromise) return dbInitPromise

  dbInitPromise = (async () => {
    const initSqlJs = (await import('sql.js')).default
    const SQL = await initSqlJs({
      locateFile: (file: string) => `/sql.js/${file}`,
    })

    const saved = await loadPersistedSnapshot()
    if (saved) {
      dbInstance = new SQL.Database(saved)
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
      example_sentence TEXT,
      example_translation TEXT,
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
    dbInstance.run(`ALTER TABLE cards ADD COLUMN created_at DATETIME DEFAULT (datetime('now'))`)
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

  dbInstance.run(`
    CREATE TABLE IF NOT EXISTS grammar_states (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      grammar_point_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      state TEXT DEFAULT 'new',
      due TEXT DEFAULT (datetime('now')),
      stability REAL DEFAULT 0,
      difficulty REAL DEFAULT 0,
      retrievability REAL DEFAULT 0,
      reps INTEGER DEFAULT 0,
      lapses INTEGER DEFAULT 0,
      leech_count INTEGER DEFAULT 0,
      is_leech INTEGER DEFAULT 0,
      last_review TEXT,
      UNIQUE(grammar_point_id, user_id)
    )
  `)

  dbInstance.run(`
    CREATE INDEX IF NOT EXISTS idx_grammar_states_due
    ON grammar_states(user_id, due)
  `)

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

  try {
    dbInstance.run(`ALTER TABLE cards ADD COLUMN tags TEXT`)
  } catch {
    // Column already exists
  }

  try {
    dbInstance.run(`ALTER TABLE cards ADD COLUMN user_note TEXT`)
  } catch {
    // Column already exists
  }

  try {
    dbInstance.run(`ALTER TABLE cards ADD COLUMN example_sentence TEXT`)
  } catch {
    // Column already exists
  }

  try {
    dbInstance.run(`ALTER TABLE cards ADD COLUMN example_translation TEXT`)
  } catch {
    // Column already exists
  }

  try {
    dbInstance.run(`ALTER TABLE cards ADD COLUMN origin_type TEXT`)
  } catch {
    // Column already exists
  }

  try {
    dbInstance.run(`ALTER TABLE cards ADD COLUMN origin_ref TEXT`)
  } catch {
    // Column already exists
  }

  dbInstance.run(`
    CREATE TABLE IF NOT EXISTS lesson_vocabulary (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      lesson_id TEXT NOT NULL,
      card_id INTEGER NOT NULL,
      term TEXT NOT NULL,
      created_at DATETIME DEFAULT (datetime('now')),
      UNIQUE(user_id, lesson_id, card_id)
    )
  `)

  try {
    dbInstance.run(`
      CREATE INDEX IF NOT EXISTS lesson_vocabulary_lesson_idx
      ON lesson_vocabulary(user_id, lesson_id)
    `)
  } catch {
    // Index already exists
  }

  persist()
}

function clearOldCards() {
  if (!dbInstance) return

  // Clear old imported cards on first load of new system
  const hasCleared = hasLocalStorage() ? localStorage.getItem('kiroku_michi_cleared_old_cards') : null
  if (!hasCleared) {
    try {
      // Delete all imported cards (from old Anki import system)
      dbInstance.run(`DELETE FROM card_states`)
      dbInstance.run(`DELETE FROM cards`)
      if (hasLocalStorage()) localStorage.setItem('kiroku_michi_cleared_old_cards', 'true')
      console.log('Cleared old imported cards from database')
    } catch (e) {
      console.error('Error clearing old cards:', e)
    }
  }
}

async function persistNow() {
  if (!dbInstance) return
  const data = dbInstance.export()
  try {
    await writeSnapshotToIndexedDB(data)
    try {
      if (hasLocalStorage()) localStorage.removeItem(DB_STORAGE_KEY)
    } catch {
      // Non-fatal; IndexedDB has the durable copy.
    }
  } catch (idbErr) {
    try {
      writeSnapshotToLocalStorage(data)
    } catch (localErr) {
      dispatchPersistenceWarning(localErr)
      throw idbErr
    }
  }
}

function persist() {
  if (persistTimer !== null) clearTimeout(persistTimer)
  persistTimer = setTimeout(() => {
    persistTimer = null
    persistInFlight = persistNow().catch(err => {
      console.error('Could not persist SQLite database:', err)
    })
  }, DB_PERSIST_DEBOUNCE_MS)
}

async function flushPersist() {
  if (persistTimer !== null) {
    clearTimeout(persistTimer)
    persistTimer = null
  }
  await persistNow()
  if (persistInFlight) await persistInFlight
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

  async flush(): Promise<void> {
    await flushPersist()
  }

  async close(): Promise<void> {
    if (dbInstance) {
      await flushPersist()
      dbInstance.close()
      dbInstance = null
      dbInitPromise = null
    }
  }
}
