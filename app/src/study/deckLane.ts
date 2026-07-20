/** Deck lane: curriculum/path vs user Extra Anki imports. */

export type DeckLane = 'path' | 'extra'

export const EXTRA_DECKS_PARENT_NAME = 'Extra Anki decks'

/** SQL fragment: card counts as path (lesson-linked or non-extra deck). */
export const PATH_CARD_SQL = `(
  cs.lesson_id IS NOT NULL
  OR COALESCE(d.lane, 'path') != 'extra'
)`

/** SQL fragment: card counts as Extra (extra deck, not lesson-linked). */
export const EXTRA_CARD_SQL = `(
  COALESCE(d.lane, 'path') = 'extra'
  AND (cs.lesson_id IS NULL OR cs.lesson_id = '')
)`

export function laneFilterSql(lane: DeckLane | 'all' | undefined): string {
  if (lane === 'path') return `AND ${PATH_CARD_SQL}`
  if (lane === 'extra') return `AND ${EXTRA_CARD_SQL}`
  return ''
}

export function deckNameFromApkg(fileName: string): string {
  return fileName.replace(/\.apkg$/i, '').trim() || 'Imported deck'
}
