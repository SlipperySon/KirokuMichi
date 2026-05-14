/**
 * Note and Note Type interfaces
 */

import type { NoteId, NoteTypeId } from './card'

/**
 * Note - a collection of fields for one concept
 * Multiple cards can be created from one note using templates
 */
export interface Note {
  id: NoteId
  guid: string              // global unique ID (for sync)
  modelId: NoteTypeId       // note type (model)
  mtime: number             // modification timestamp (seconds)
  usn: number               // update sequence number (sync)
  tags: string              // space-separated tags (e.g., "vocab grammar")
  fields: string[]          // field values
  sortField: string         // first field (for sorting)
  checksum: number          // field checksum
  flags: number             // reserved flags
  data: string              // reserved
}

/**
 * Note field definition
 */
export interface NoteField {
  name: string
  ord: number               // ordinal (order)
  sticky: boolean           // remember last value?
  rtl: boolean              // right-to-left?
  font: string
  size: number
  description: string
}

/**
 * Card template (generates cards from notes)
 */
export interface CardTemplate {
  name: string              // e.g., "Card 1"
  ord: number               // ordinal
  qfmt: string              // question format (HTML with {{FieldName}})
  afmt: string              // answer format
  bafmt?: string            // browser answer format
  bqfmt?: string            // browser question format
  did?: NoteTypeId          // deck override (null = no override)
}

/**
 * Note Type (Model) - defines structure for notes
 */
export interface NoteType {
  id: NoteTypeId
  name: string              // e.g., "Basic", "Cloze", "Basic (and reversed)"
  type: 0 | 1               // 0=standard, 1=cloze
  mod: number               // modification timestamp
  usn: number               // update sequence number
  sortFieldIdx: number      // which field is sort field
  didConf?: NoteTypeId      // deck override
  tmpls: CardTemplate[]     // card templates
  flds: NoteField[]         // field definitions
  css: string               // CSS for cards
  latexPre?: string         // LaTeX header
  latexPost?: string        // LaTeX footer
  req?: Array<[number, number | number[], number]>  // required fields
  crt: number               // creation timestamp
  tags: string[]            // note tags
}

/**
 * Cloze deletion (for Cloze note type)
 * {{c1::text}} for cloze 1, {{c2::text}} for cloze 2, etc.
 */
export const ClozePattern = /\{\{c(\d+)::(.+?)\}\}/g

/**
 * Create note request
 */
export interface CreateNoteRequest {
  modelId: NoteTypeId
  fields: string[]
  tags?: string[]
  customData?: string
}

/**
 * Update note request
 */
export interface UpdateNoteRequest {
  noteId: NoteId
  fields?: string[]
  tags?: string[]
  customData?: string
}
