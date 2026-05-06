import { describe, it, expect, beforeEach } from 'vitest'
import { GrammarService } from '../content/grammarService'
import { VocabService } from '../content/vocabService'
import type { StorageProvider } from '../core/providers'

// Minimal in-memory StorageProvider for testing
function makeMemoryDb(): StorageProvider & { _tables: Map<string, Record<string, unknown>[]> } {
  const tables = new Map<string, Record<string, unknown>[]>()
  tables.set('grammar_points', [])
  tables.set('cards', [])
  tables.set('card_states', [])
  tables.set('questions', [])

  const db = {
    _tables: tables,
    async query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
      // Route queries to in-memory tables
      if (sql.includes('FROM grammar_points')) {
        let rows = [...(tables.get('grammar_points') ?? [])]
        if (sql.includes('WHERE jlpt_level = ?')) {
          rows = rows.filter(r => r.jlpt_level === params[0])
        }
        if (sql.includes('is_keigo = 1')) {
          rows = rows.filter(r => r.is_keigo === 1)
        }
        if (sql.includes('WHERE id = ?')) {
          rows = rows.filter(r => r.id === params[0])
        }
        if (sql.includes('COUNT(*)')) {
          return [{ count: rows.length }] as T[]
        }
        return rows as T[]
      }
      if (sql.includes('FROM cards') && sql.includes("type = 'vocabulary'")) {
        let rows = (tables.get('cards') ?? []).filter(r => r.type === 'vocabulary')
        if (sql.includes("c.jlpt_level = ?")) {
          const levelParam = sql.includes('user_id = ?') ? params[1] : params[0]
          rows = rows.filter(r => r.jlpt_level === levelParam)
        }
        if (sql.includes('COUNT(*)')) {
          const level = params[0]
          const count = rows.filter(r => r.jlpt_level === level).length
          return [{ count }] as T[]
        }
        return rows.map(r => ({ ...r, reps: null })) as T[]
      }
      if (sql.includes('FROM card_states')) {
        const rows = tables.get('card_states') ?? []
        return rows.filter(r => r.card_id === params[0] && r.user_id === params[1]) as T[]
      }
      if (sql.includes('FROM questions')) {
        let rows = [...(tables.get('questions') ?? [])]
        if (sql.includes("jlpt_level = ?")) {
          rows = rows.filter(r => r.jlpt_level === params[0] && r.active === 1)
        }
        return rows as T[]
      }
      return [] as T[]
    },
    async execute(sql: string, params: unknown[] = []): Promise<void> {
      if (sql.includes('INSERT INTO card_states')) {
        const states = tables.get('card_states') ?? []
        states.push({ id: states.length + 1, card_id: params[0], user_id: params[1], state: 'new' })
        tables.set('card_states', states)
      }
    },
  }
  return db as unknown as StorageProvider & { _tables: Map<string, Record<string, unknown>[]> }
}

function makeGrammarRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 1, jlpt_level: 'N5', title: '〜は〜です', pattern: 'X は Y です',
    meaning: 'X is Y', explanation: 'Copula form.', examples_json: '[]',
    category: 'copula', is_keigo: 0, frequency_rank: 1,
    ...overrides,
  }
}

function makeVocabRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 1, type: 'vocabulary', front: '水', back: 'water', reading: 'みず',
    jlpt_level: 'N5', frequency_rank: 10, domain: null, audio_url: null,
    ...overrides,
  }
}

describe('GrammarService', () => {
  let db: ReturnType<typeof makeMemoryDb>
  let service: GrammarService

  beforeEach(() => {
    db = makeMemoryDb()
    service = new GrammarService(db as unknown as StorageProvider)
  })

  it('getByLevel returns only matching level', async () => {
    db._tables.set('grammar_points', [
      makeGrammarRow({ id: 1, jlpt_level: 'N5' }),
      makeGrammarRow({ id: 2, jlpt_level: 'N4' }),
    ])
    const results = await service.getByLevel('N5')
    expect(results).toHaveLength(1)
    expect(results[0].jlptLevel).toBe('N5')
  })

  it('getById returns correct point', async () => {
    db._tables.set('grammar_points', [makeGrammarRow({ id: 42 })])
    const result = await service.getById(42)
    expect(result).not.toBeNull()
    expect(result!.id).toBe(42)
  })

  it('getById returns null for missing id', async () => {
    db._tables.set('grammar_points', [])
    const result = await service.getById(999)
    expect(result).toBeNull()
  })

  it('getKeigo returns only keigo points', async () => {
    db._tables.set('grammar_points', [
      makeGrammarRow({ id: 1, is_keigo: 0 }),
      makeGrammarRow({ id: 2, is_keigo: 1 }),
    ])
    const results = await service.getKeigo()
    expect(results.every(r => r.isKeigo)).toBe(true)
  })

  it('getCountByLevel returns correct count', async () => {
    db._tables.set('grammar_points', [
      makeGrammarRow({ id: 1, jlpt_level: 'N5' }),
      makeGrammarRow({ id: 2, jlpt_level: 'N5' }),
      makeGrammarRow({ id: 3, jlpt_level: 'N4' }),
    ])
    const count = await service.getCountByLevel('N5')
    expect(count).toBe(2)
  })

  it('parses examples_json correctly', async () => {
    const examples = [{ japanese: '水です。', reading: 'みずです。', english: 'It is water.' }]
    db._tables.set('grammar_points', [makeGrammarRow({ examples_json: JSON.stringify(examples) })])
    const result = await service.getById(1)
    expect(result!.examples).toHaveLength(1)
    expect(result!.examples[0].japanese).toBe('水です。')
  })

  it('handles malformed examples_json gracefully', async () => {
    db._tables.set('grammar_points', [makeGrammarRow({ examples_json: 'not-json' })])
    const result = await service.getById(1)
    expect(result!.examples).toEqual([])
  })
})

describe('VocabService', () => {
  let db: ReturnType<typeof makeMemoryDb>
  let service: VocabService

  beforeEach(() => {
    db = makeMemoryDb()
    service = new VocabService(db as unknown as StorageProvider)
  })

  it('getByLevel returns only vocabulary cards at that level', async () => {
    db._tables.set('cards', [
      makeVocabRow({ id: 1, jlpt_level: 'N5' }),
      makeVocabRow({ id: 2, jlpt_level: 'N4' }),
      { id: 3, type: 'kanji', front: '水', back: 'water', reading: null, jlpt_level: 'N5', frequency_rank: null, domain: null, audio_url: null },
    ])
    const results = await service.getByLevel('N5', 1)
    expect(results.every(r => r.jlptLevel === 'N5')).toBe(true)
  })

  it('getCountByLevel returns correct count', async () => {
    db._tables.set('cards', [
      makeVocabRow({ id: 1, jlpt_level: 'N5' }),
      makeVocabRow({ id: 2, jlpt_level: 'N5' }),
    ])
    const count = await service.getCountByLevel('N5')
    expect(count).toBe(2)
  })

  it('addToSrs inserts card_state for new card', async () => {
    await service.addToSrs(5, 1)
    const states = db._tables.get('card_states') ?? []
    expect(states).toHaveLength(1)
    expect(states[0].card_id).toBe(5)
  })

  it('addToSrs skips duplicate card_state', async () => {
    db._tables.set('card_states', [{ id: 1, card_id: 5, user_id: 1, state: 'new' }])
    await service.addToSrs(5, 1)
    expect(db._tables.get('card_states')).toHaveLength(1)
  })
})
