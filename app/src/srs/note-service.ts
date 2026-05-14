/**
 * Note Service - CRUD operations for notes
 * Notes are the source data; cards are generated from notes via templates
 */

import type { Note, NoteType, CardTemplate, NoteField } from '../types/note'
import type { NoteId, NoteTypeId } from '../types/card'
import type { Card } from '../types/card'

/**
 * Mock database interface for notes
 */
export interface NoteDatabase {
  // Create
  insertNote(note: Omit<Note, 'id' | 'mtime' | 'usn'>): Promise<Note>
  insertNoteType(noteType: Omit<NoteType, 'id' | 'mod' | 'crt'>): Promise<NoteType>

  // Read
  getNote(noteId: NoteId): Promise<Note | null>
  getNoteType(noteTypeId: NoteTypeId): Promise<NoteType | null>
  getNotesByDeck(deckId: number): Promise<Note[]>
  getDefaultNoteType(): Promise<NoteType | null>
  getAllNoteTypes(): Promise<NoteType[]>

  // Update
  updateNote(note: Note): Promise<void>
  updateNoteType(noteType: NoteType): Promise<void>

  // Delete
  deleteNote(noteId: NoteId): Promise<void>
  deleteNoteType(noteTypeId: NoteTypeId): Promise<void>

  // Query
  searchNotes(query: string, deckId?: number): Promise<Note[]>
  getNoteCount(deckId?: number): Promise<number>
}

/**
 * Note Service - business logic for notes
 */
export class NoteService {
  constructor(private db: NoteDatabase) {}

  /**
   * Create a new note
   */
  async createNote(
    modelId: NoteTypeId,
    fields: string[],
    tags: string[] = [],
    deckId?: number
  ): Promise<Note> {
    const now = Math.floor(Date.now() / 1000)

    const note = await this.db.insertNote({
      guid: `${Date.now()}-${Math.random()}`,
      modelId,
      fields,
      tags: tags.join(' '),
      sortField: fields[0] || '',
      checksum: this.calculateChecksum(fields),
      flags: 0,
      data: '',
    })

    return note
  }

  /**
   * Get a note by ID
   */
  async getNote(noteId: NoteId): Promise<Note | null> {
    return this.db.getNote(noteId)
  }

  /**
   * Get notes in a deck
   */
  async getNotesByDeck(deckId: number): Promise<Note[]> {
    return this.db.getNotesByDeck(deckId)
  }

  /**
   * Update a note
   */
  async updateNote(noteId: NoteId, updates: Partial<Note>): Promise<Note> {
    const note = await this.db.getNote(noteId)
    if (!note) throw new Error(`Note ${noteId} not found`)

    const updated = {
      ...note,
      ...updates,
      mtime: Math.floor(Date.now() / 1000),
      usn: -1,
    }

    // Recalculate checksum if fields changed
    if (updates.fields) {
      updated.checksum = this.calculateChecksum(updated.fields)
    }

    await this.db.updateNote(updated)
    return updated
  }

  /**
   * Delete a note
   */
  async deleteNote(noteId: NoteId): Promise<void> {
    await this.db.deleteNote(noteId)
  }

  /**
   * Search notes by content
   */
  async searchNotes(query: string, deckId?: number): Promise<Note[]> {
    return this.db.searchNotes(query, deckId)
  }

  /**
   * Get note count
   */
  async getNoteCount(deckId?: number): Promise<number> {
    return this.db.getNoteCount(deckId)
  }

  /**
   * Get all note types (models)
   */
  async getAllNoteTypes(): Promise<NoteType[]> {
    return this.db.getAllNoteTypes()
  }

  /**
   * Get default note type
   */
  async getDefaultNoteType(): Promise<NoteType | null> {
    return this.db.getDefaultNoteType()
  }

  /**
   * Create a new note type
   */
  async createNoteType(name: string, fields: NoteField[], templates: CardTemplate[]): Promise<NoteType> {
    const now = Math.floor(Date.now() / 1000)

    const noteType: Omit<NoteType, 'id' | 'mod' | 'crt'> = {
      name,
      type: 0, // Standard note type
      usn: -1,
      sortFieldIdx: 0,
      tmpls: templates,
      flds: fields,
      css: this.getDefaultCSS(),
      tags: [],
    }

    return this.db.insertNoteType(noteType as NoteType)
  }

  /**
   * Update note type
   */
  async updateNoteType(noteTypeId: NoteTypeId, updates: Partial<NoteType>): Promise<NoteType> {
    const noteType = await this.db.getNoteType(noteTypeId)
    if (!noteType) throw new Error(`Note type ${noteTypeId} not found`)

    const updated = {
      ...noteType,
      ...updates,
      mod: Math.floor(Date.now() / 1000),
      usn: -1,
    }

    await this.db.updateNoteType(updated)
    return updated
  }

  /**
   * Delete note type
   */
  async deleteNoteType(noteTypeId: NoteTypeId): Promise<void> {
    await this.db.deleteNoteType(noteTypeId)
  }

  /**
   * Get default note type (Basic)
   */
  getBasicNoteType(): NoteType {
    return {
      id: 1 as any,
      name: 'Basic',
      type: 0,
      mod: Math.floor(Date.now() / 1000),
      usn: -1,
      sortFieldIdx: 0,
      tmpls: [
        {
          name: 'Card 1',
          ord: 0,
          qfmt: '{{Front}}',
          afmt: '{{Front}}<hr id=answer>{{Back}}',
        },
      ],
      flds: [
        {
          name: 'Front',
          ord: 0,
          sticky: false,
          rtl: false,
          font: 'Arial',
          size: 20,
          description: 'Front of card',
        },
        {
          name: 'Back',
          ord: 1,
          sticky: false,
          rtl: false,
          font: 'Arial',
          size: 20,
          description: 'Back of card',
        },
      ],
      css: this.getDefaultCSS(),
      crt: Math.floor(Date.now() / 1000),
      tags: [],
    }
  }

  /**
   * Get cloze note type
   */
  getClozeNoteType(): NoteType {
    return {
      id: 2 as any,
      name: 'Cloze',
      type: 1, // Cloze type
      mod: Math.floor(Date.now() / 1000),
      usn: -1,
      sortFieldIdx: 0,
      tmpls: [
        {
          name: 'Cloze',
          ord: 0,
          qfmt: '{{cloze:Text}}',
          afmt: '{{cloze:Text}}<br>{{Extra}}',
        },
      ],
      flds: [
        {
          name: 'Text',
          ord: 0,
          sticky: false,
          rtl: false,
          font: 'Arial',
          size: 20,
          description: 'Text with {{c1::cloze deletion}}',
        },
        {
          name: 'Extra',
          ord: 1,
          sticky: false,
          rtl: false,
          font: 'Arial',
          size: 20,
          description: 'Extra information',
        },
      ],
      css: this.getDefaultCSS(),
      crt: Math.floor(Date.now() / 1000),
      tags: [],
    }
  }

  /**
   * Calculate field checksum (used for detecting changes)
   */
  private calculateChecksum(fields: string[]): number {
    const text = fields.join('')
    let hash = 0
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return Math.abs(hash)
  }

  /**
   * Get default CSS for cards
   */
  private getDefaultCSS(): string {
    return `
.card {
  font-family: arial;
  font-size: 20px;
  text-align: center;
  color: black;
  background-color: white;
}
.card.cloze {
  font-size: 24px;
}
`
  }

  /**
   * Render card question from template
   */
  renderQuestion(template: CardTemplate, fields: string[]): string {
    let html = template.qfmt

    // Replace field placeholders
    const noteType = { flds: [] } // Would be passed in
    // This would parse field placeholders like {{FieldName}}

    return html
  }

  /**
   * Render card answer from template
   */
  renderAnswer(template: CardTemplate, fields: string[]): string {
    let html = template.afmt

    // Replace field placeholders
    return html
  }

  /**
   * Batch create notes
   */
  async createNotesBatch(
    modelId: NoteTypeId,
    fieldsList: string[][],
    tags: string[] = []
  ): Promise<Note[]> {
    const notes: Note[] = []

    for (const fields of fieldsList) {
      const note = await this.createNote(modelId, fields, tags)
      notes.push(note)
    }

    return notes
  }

  /**
   * Export notes as CSV
   */
  async exportNotesAsCsv(notes: Note[]): Promise<string> {
    const lines: string[] = []

    for (const note of notes) {
      const fields = note.fields.map((f) => `"${f.replace(/"/g, '""')}"`).join(',')
      lines.push(`${fields}\t${note.tags}`)
    }

    return lines.join('\n')
  }

  /**
   * Import notes from CSV
   */
  async importNotesFromCsv(
    csv: string,
    modelId: NoteTypeId,
    tags: string[] = []
  ): Promise<Note[]> {
    const lines = csv.split('\n').filter((line) => line.trim())
    const notes: Note[] = []

    for (const line of lines) {
      const fields = line.split('\t').slice(0, -1) // Last element is tags
      if (fields.length > 0) {
        const note = await this.createNote(modelId, fields, tags)
        notes.push(note)
      }
    }

    return notes
  }
}
