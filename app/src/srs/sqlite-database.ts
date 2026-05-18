/**
 * SQLite Database Implementations
 * Implements CardDatabase, NoteDatabase, DeckDatabase interfaces
 * Reads from Anki SQLite databases
 */

import type { Database as SqlJsDatabase } from 'sql.js'
import type { Card, CardId, CardType, CardQueue, NoteId, DeckId } from '../types/card'
import type { Deck, DeckNode, DeckConfig } from '../types/deck'
import type { Note, NoteType, NoteField, CardTemplate } from '../types/note'
import type { CardDatabase } from '../srs/card-service'
import type { NoteDatabase } from '../srs/note-service'
import type { DeckDatabase } from '../srs/deck-service'
import { makeCardId, makeNoteId, makeDeckId, makeNoteTypeId } from '../types/card'

/**
 * SQLite implementation of CardDatabase
 */
export class SqliteCardDatabase implements CardDatabase {
  constructor(private db: SqlJsDatabase) {}

  async insertCard(card: Omit<Card, 'id'>): Promise<Card> {
    const id = makeCardId(Math.floor(Date.now() * 1000 + Math.random() * 1000))
    const stmt = this.db.prepare(
      `INSERT INTO cards (id, nid, did, ord, mod, usn, type, queue, due, ivl, factor, reps, lapses, left, odue, odid, flags, data)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )

    stmt.bind([
      id,
      card.noteId,
      card.deckId,
      card.templateIdx,
      card.mtime,
      card.usn,
      card.type,
      card.queue,
      card.due,
      card.interval,
      card.easeFactor,
      card.reps,
      card.lapses,
      card.remainingSteps,
      card.originalDue,
      card.originalDeckId,
      card.flags,
      card.customData,
    ])

    stmt.step()
    stmt.free()

    return { id, ...card }
  }

  async getCard(cardId: CardId): Promise<Card | null> {
    const result = this.db.exec(
      'SELECT id, nid, did, ord, mod, usn, type, queue, due, ivl, factor, reps, lapses, left, odue, odid, flags, data FROM cards WHERE id = ?',
      [cardId]
    )

    if (result.length === 0 || result[0].values.length === 0) {
      return null
    }

    return this.rowToCard(result[0].values[0])
  }

  async getCardsByDeck(deckId: number): Promise<Card[]> {
    const result = this.db.exec(
      'SELECT id, nid, did, ord, mod, usn, type, queue, due, ivl, factor, reps, lapses, left, odue, odid, flags, data FROM cards WHERE did = ?',
      [deckId]
    )

    if (result.length === 0) return []
    return result[0].values.map((row) => this.rowToCard(row))
  }

  async getCardsByNote(noteId: number): Promise<Card[]> {
    const result = this.db.exec(
      'SELECT id, nid, did, ord, mod, usn, type, queue, due, ivl, factor, reps, lapses, left, odue, odid, flags, data FROM cards WHERE nid = ?',
      [noteId]
    )

    if (result.length === 0) return []
    return result[0].values.map((row) => this.rowToCard(row))
  }

  async getAllCards(): Promise<Card[]> {
    const result = this.db.exec(
      'SELECT id, nid, did, ord, mod, usn, type, queue, due, ivl, factor, reps, lapses, left, odue, odid, flags, data FROM cards'
    )

    if (result.length === 0) return []
    return result[0].values.map((row) => this.rowToCard(row))
  }

  async getCardsByState(type: CardType): Promise<Card[]> {
    const result = this.db.exec(
      'SELECT id, nid, did, ord, mod, usn, type, queue, due, ivl, factor, reps, lapses, left, odue, odid, flags, data FROM cards WHERE type = ?',
      [type]
    )

    if (result.length === 0) return []
    return result[0].values.map((row) => this.rowToCard(row))
  }

  async getCardsByQueue(queue: CardQueue): Promise<Card[]> {
    const result = this.db.exec(
      'SELECT id, nid, did, ord, mod, usn, type, queue, due, ivl, factor, reps, lapses, left, odue, odid, flags, data FROM cards WHERE queue = ?',
      [queue]
    )

    if (result.length === 0) return []
    return result[0].values.map((row) => this.rowToCard(row))
  }

  async updateCard(card: Card): Promise<void> {
    const stmt = this.db.prepare(
      `UPDATE cards SET nid = ?, did = ?, ord = ?, mod = ?, usn = ?, type = ?, queue = ?, due = ?, ivl = ?, factor = ?, reps = ?, lapses = ?, left = ?, odue = ?, odid = ?, flags = ?, data = ? WHERE id = ?`
    )

    stmt.bind([
      card.noteId,
      card.deckId,
      card.templateIdx,
      card.mtime,
      card.usn,
      card.type,
      card.queue,
      card.due,
      card.interval,
      card.easeFactor,
      card.reps,
      card.lapses,
      card.remainingSteps,
      card.originalDue,
      card.originalDeckId,
      card.flags,
      card.customData,
      card.id,
    ])

    stmt.step()
    stmt.free()
  }

  async updateCards(cards: Card[]): Promise<void> {
    for (const card of cards) {
      await this.updateCard(card)
    }
  }

  async deleteCard(cardId: CardId): Promise<void> {
    const stmt = this.db.prepare('DELETE FROM cards WHERE id = ?')
    stmt.bind([cardId])
    stmt.step()
    stmt.free()
  }

  async deleteCardsByNote(noteId: number): Promise<void> {
    const stmt = this.db.prepare('DELETE FROM cards WHERE nid = ?')
    stmt.bind([noteId])
    stmt.step()
    stmt.free()
  }

  async getCardCount(deckId: number): Promise<number> {
    const result = this.db.exec('SELECT COUNT(*) FROM cards WHERE did = ?', [deckId])
    return (result[0]?.values[0]?.[0] as number) || 0
  }

  async getCardCountByType(deckId: number, type: CardType): Promise<number> {
    const result = this.db.exec(
      'SELECT COUNT(*) FROM cards WHERE did = ? AND type = ?',
      [deckId, type]
    )
    return (result[0]?.values[0]?.[0] as number) || 0
  }

  private rowToCard(row: any[]): Card {
    return {
      id: makeCardId(row[0]),
      noteId: makeNoteId(row[1]),
      deckId: makeDeckId(row[2]),
      templateIdx: row[3],
      mtime: row[4],
      usn: row[5],
      type: row[6] as CardType,
      queue: row[7] as CardQueue,
      due: row[8],
      interval: row[9],
      easeFactor: row[10],
      reps: row[11],
      lapses: row[12],
      remainingSteps: row[13],
      originalDue: row[14],
      originalDeckId: makeDeckId(row[15]),
      flags: row[16],
      customData: row[17] || '',
    }
  }
}

/**
 * SQLite implementation of NoteDatabase
 */
export class SqliteNoteDatabase implements NoteDatabase {
  constructor(private db: SqlJsDatabase) {}

  async insertNote(note: Omit<Note, 'id' | 'mtime' | 'usn'>): Promise<Note> {
    const id = makeNoteId(Math.floor(Date.now() * 1000 + Math.random() * 1000))
    const now = Math.floor(Date.now() / 1000)

    const stmt = this.db.prepare(
      `INSERT INTO notes (id, guid, mid, mod, usn, tags, flds, sfld, csum, flags, data)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )

    stmt.bind([
      id,
      note.guid,
      note.modelId,
      now,
      -1,
      note.tags,
      note.fields.join('\x1f'), // Anki uses \x1f as field separator
      note.sortField,
      note.checksum,
      note.flags,
      note.data,
    ])

    stmt.step()
    stmt.free()

    return {
      id,
      mtime: now,
      usn: -1,
      ...note,
    }
  }

  async getNote(noteId: NoteId): Promise<Note | null> {
    const result = this.db.exec(
      'SELECT id, guid, mid, mod, usn, tags, flds, sfld, csum, flags, data FROM notes WHERE id = ?',
      [noteId]
    )

    if (result.length === 0 || result[0].values.length === 0) {
      return null
    }

    return this.rowToNote(result[0].values[0])
  }

  async getNoteType(noteTypeId: any): Promise<NoteType | null> {
    // Would need to parse from col table
    return null
  }

  async getNotesByDeck(deckId: number): Promise<Note[]> {
    const result = this.db.exec(
      `SELECT DISTINCT n.id, n.guid, n.mid, n.mod, n.usn, n.tags, n.flds, n.sfld, n.csum, n.flags, n.data
       FROM notes n
       INNER JOIN cards c ON n.id = c.nid
       WHERE c.did = ?`,
      [deckId]
    )

    if (result.length === 0) return []
    return result[0].values.map((row) => this.rowToNote(row))
  }

  async getAllNotes(): Promise<Note[]> {
    const result = this.db.exec(
      'SELECT id, guid, mid, mod, usn, tags, flds, sfld, csum, flags, data FROM notes'
    )

    if (result.length === 0) return []
    return result[0].values.map((row) => this.rowToNote(row))
  }

  async getDefaultNoteType(): Promise<NoteType | null> {
    return null
  }

  async getAllNoteTypes(): Promise<NoteType[]> {
    return []
  }

  async updateNote(note: Note): Promise<void> {
    const stmt = this.db.prepare(
      `UPDATE notes SET guid = ?, mid = ?, mod = ?, usn = ?, tags = ?, flds = ?, sfld = ?, csum = ?, flags = ?, data = ? WHERE id = ?`
    )

    stmt.bind([
      note.guid,
      note.modelId,
      note.mtime,
      note.usn,
      note.tags,
      note.fields.join('\x1f'),
      note.sortField,
      note.checksum,
      note.flags,
      note.data,
      note.id,
    ])

    stmt.step()
    stmt.free()
  }

  async updateNoteType(noteType: NoteType): Promise<void> {
    // Would update in col table
  }

  async deleteNote(noteId: NoteId): Promise<void> {
    const stmt = this.db.prepare('DELETE FROM notes WHERE id = ?')
    stmt.bind([noteId])
    stmt.step()
    stmt.free()
  }

  async deleteNoteType(noteTypeId: any): Promise<void> {
    // Would delete from col table
  }

  async searchNotes(query: string, deckId?: number): Promise<Note[]> {
    const searchLower = `%${query.toLowerCase()}%`
    const result = this.db.exec(
      `SELECT id, guid, mid, mod, usn, tags, flds, sfld, csum, flags, data FROM notes
       WHERE LOWER(flds) LIKE ? OR LOWER(tags) LIKE ?
       LIMIT 100`,
      [searchLower, searchLower]
    )

    if (result.length === 0) return []
    return result[0].values.map((row) => this.rowToNote(row))
  }

  async getNoteCount(deckId?: number): Promise<number> {
    const result = this.db.exec('SELECT COUNT(*) FROM notes')
    return (result[0]?.values[0]?.[0] as number) || 0
  }

  async insertNoteType(noteType: Omit<NoteType, 'id' | 'mod' | 'crt'>): Promise<NoteType> {
    throw new Error('Not implemented for read-only SQLite')
  }

  private rowToNote(row: any[]): Note {
    return {
      id: makeNoteId(row[0]),
      guid: row[1],
      modelId: makeNoteTypeId(row[2]),
      mtime: row[3],
      usn: row[4],
      tags: row[5],
      fields: (row[6] as string).split('\x1f'),
      sortField: row[7],
      checksum: row[8],
      flags: row[9],
      data: row[10] || '',
    }
  }
}

/**
 * SQLite implementation of DeckDatabase
 */
export class SqliteDeckDatabase implements DeckDatabase {
  constructor(private db: SqlJsDatabase) {}

  async insertDeck(deck: Omit<Deck, 'id'>): Promise<Deck> {
    const id = makeDeckId(Math.floor(Date.now() * 1000 + Math.random() * 1000))
    // Would insert into decks tracking (stored in col table)
    return { id, ...deck }
  }

  async insertDeckConfig(config: DeckConfig): Promise<DeckConfig> {
    // Would insert into dconf table
    return config
  }

  async getDeck(deckId: DeckId): Promise<Deck | null> {
    // Decks are stored in col.decks as JSON
    const colResult = this.db.exec('SELECT decks FROM col LIMIT 1')
    if (colResult.length === 0) return null

    const decksJson = colResult[0].values[0][0] as string
    const decks = JSON.parse(decksJson)
    const deckData = decks[deckId]

    if (!deckData) return null

    return {
      id: deckId,
      name: deckData.name,
      desc: deckData.desc || '',
      conf: makeDeckId(deckData.conf),
      collapsed: deckData.collapsed || false,
      dyn: deckData.dyn || 0,
    }
  }

  async getDeckConfig(deckId: DeckId): Promise<DeckConfig | null> {
    // Config stored in col.dconf as JSON
    const colResult = this.db.exec('SELECT dconf FROM col LIMIT 1')
    if (colResult.length === 0) return null

    const dconfJson = colResult[0].values[0][0] as string
    const dconf = JSON.parse(dconfJson)
    const configData = dconf[deckId]

    if (!configData) return null

    return this.parseConfig(configData)
  }

  async getAllDecks(): Promise<Deck[]> {
    const colResult = this.db.exec('SELECT decks FROM col LIMIT 1')
    if (colResult.length === 0) return []

    const decksJson = colResult[0].values[0][0] as string
    const decks = JSON.parse(decksJson)

    return Object.entries(decks).map(([id, data]: [string, any]) => ({
      id: makeDeckId(parseInt(id)),
      name: data.name,
      desc: data.desc || '',
      conf: makeDeckId(data.conf),
      collapsed: data.collapsed || false,
      dyn: data.dyn || 0,
    }))
  }

  async getAllDeckConfigs(): Promise<DeckConfig[]> {
    const colResult = this.db.exec('SELECT dconf FROM col LIMIT 1')
    if (colResult.length === 0) return []

    const dconfJson = colResult[0].values[0][0] as string
    const dconf = JSON.parse(dconfJson)

    return Object.values(dconf).map((config: any) => this.parseConfig(config))
  }

  async getDeckChildren(parentId: DeckId): Promise<Deck[]> {
    const allDecks = await this.getAllDecks()
    const parentName = (await this.getDeck(parentId))?.name || ''

    return allDecks.filter((deck) => {
      if (deck.id === parentId) return false
      return deck.name.startsWith(parentName + '::')
    })
  }

  async updateDeck(deck: Deck): Promise<void> {
    // Would update in col.decks JSON
  }

  async updateDeckConfig(config: DeckConfig): Promise<void> {
    // Would update in col.dconf JSON
  }

  async deleteDeck(deckId: DeckId): Promise<void> {
    // Would delete from col.decks JSON
  }

  async deleteDeckConfig(configId: DeckId): Promise<void> {
    // Would delete from col.dconf JSON
  }

  async getFullDeckTree(): Promise<DeckNode> {
    const decks = await this.getAllDecks()
    const rootDeck = decks.find((d) => !d.name.includes('::'))

    if (!rootDeck) {
      // Create a synthetic root
      return {
        id: makeDeckId(1),
        name: 'Root',
        desc: '',
        conf: makeDeckId(1),
        collapsed: false,
        dyn: 0,
        children: this.buildDeckTree(decks, ''),
        level: 0,
        newCount: 0,
        learnCount: 0,
        reviewCount: 0,
      }
    }

    return this.buildDeckNode(rootDeck, decks, 0)
  }

  private buildDeckTree(decks: Deck[], parentPath: string): DeckNode[] {
    return decks
      .filter((deck) => {
        const deckParentPath = deck.name.substring(0, deck.name.lastIndexOf('::'))
        return deckParentPath === parentPath
      })
      .map((deck) => this.buildDeckNode(deck, decks, parentPath.split('::').length))
  }

  private buildDeckNode(deck: Deck, allDecks: Deck[], level: number): DeckNode {
    return {
      ...deck,
      children: this.buildDeckTree(allDecks, deck.name),
      level,
      newCount: 0,
      learnCount: 0,
      reviewCount: 0,
    }
  }

  private parseConfig(configData: any): DeckConfig {
    return {
      id: makeDeckId(configData.id),
      name: configData.name,
      new: {
        delays: configData.new?.delays || [1, 10],
        ints: configData.new?.ints || [1, 4],
        initialFactor: configData.new?.initialFactor || 2500,
        separate: configData.new?.separate !== false,
        perDay: configData.new?.perDay || 20,
        order: configData.new?.order || 0,
      },
      review: {
        perDay: configData.review?.perDay || 200,
        ease4: configData.review?.ease4 || 1.3,
        fuzz: configData.review?.fuzz || 0.05,
      },
      lapse: {
        delays: configData.lapse?.delays || [10],
        mult: configData.lapse?.mult || 0.5,
        minInt: configData.lapse?.minInt || 1,
        leechFails: configData.lapse?.leechFails || 8,
      },
    }
  }
}
