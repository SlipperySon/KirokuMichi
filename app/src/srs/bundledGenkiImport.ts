import type { StorageProvider } from '../core/providers'
import { storageLessonIdsFor } from '../content/lessonContentUtils'

interface BundledGenkiNote {
  front: string
  back: string
  reading: string | null
  sentence: string | null
  sentenceMeaning: string | null
  sourceLessonId: string | null
}

interface BundledGenkiPack {
  version: 1
  source: string
  media: 'omitted'
  notes: BundledGenkiNote[]
}

export interface BundledGenkiImportResult {
  imported: number
  skipped: number
  cards: number
  linked: number
  /** New cards left active (not suspended) after lesson gating. */
  activeNew: number
}

export const BUNDLED_GENKI_ORIGIN_REF = 'genki-official-test-cards'
const TEST_PACK_URL = '/test-data/genki-official-test-cards.json'
const DEFAULT_ACTIVE_LESSONS = ['genki_1_1']

export interface BundledGenkiImportOptions {
  /**
   * Lesson ids whose cards stay active as Anki "new".
   * All other bundled lesson cards are imported suspended until that lesson is studied.
   */
  activeLessonIds?: string[]
}

export async function importBundledGenkiTestDeck(
  storage: StorageProvider,
  userId: number,
  urlOrOptions: string | BundledGenkiImportOptions = {},
): Promise<BundledGenkiImportResult> {
  const url = typeof urlOrOptions === 'string' ? urlOrOptions : TEST_PACK_URL
  const options = typeof urlOrOptions === 'string' ? {} : urlOrOptions
  const activeLessonIds = expandActiveLessonIds(
    options.activeLessonIds?.length ? options.activeLessonIds : DEFAULT_ACTIVE_LESSONS,
  )
  const activeSet = new Set(activeLessonIds)

  const response = await fetch(url)
  if (!response.ok) throw new Error(`Could not load bundled Genki test deck: ${response.status}`)
  const pack = await response.json() as BundledGenkiPack
  if (pack.version !== 1 || !Array.isArray(pack.notes)) {
    throw new Error('Bundled Genki test deck is not valid')
  }

  let imported = 0
  let skipped = 0

  for (const note of pack.notes) {
    if (!note.front || !note.back) {
      skipped++
      continue
    }

    const existing = await storage.query<{ id: number }>(
      `SELECT id FROM cards WHERE front = ? AND type = 'vocabulary' LIMIT 1`,
      [note.front]
    )

    let vocabCardId = existing[0]?.id ?? null
    if (!vocabCardId) {
      await storage.execute(
        `INSERT OR IGNORE INTO cards
           (type, front, back, reading, deck_id, origin_type, origin_ref, created_at)
         VALUES ('vocabulary', ?, ?, ?, NULL, 'bundled_test_deck', ?, datetime('now'))`,
        [note.front, note.back, note.reading, BUNDLED_GENKI_ORIGIN_REF]
      )
      const rows = await storage.query<{ id: number }>(
        `SELECT id FROM cards WHERE front = ? AND type = 'vocabulary' ORDER BY id DESC LIMIT 1`,
        [note.front]
      )
      vocabCardId = rows[0]?.id ?? null
      if (vocabCardId) imported++
    } else {
      skipped++
    }

    if (vocabCardId) {
      if (note.sentence || note.sentenceMeaning) {
        await storage.execute(
          `UPDATE cards
           SET example_sentence = COALESCE(example_sentence, ?),
               example_translation = COALESCE(example_translation, ?)
           WHERE id = ?`,
          [note.sentence, note.sentenceMeaning, vocabCardId]
        )
      }
      await ensureCardState(storage, userId, vocabCardId, note.sourceLessonId, activeSet)
    }

    if (note.sentence && note.sentenceMeaning) {
      await storage.execute(
        `INSERT OR IGNORE INTO cards
           (type, front, back, deck_id, origin_type, origin_ref, created_at)
         VALUES ('sentence', ?, ?, NULL, 'bundled_test_deck', ?, datetime('now'))`,
        [note.sentence, note.sentenceMeaning, BUNDLED_GENKI_ORIGIN_REF]
      )
      const sentenceRows = await storage.query<{ id: number }>(
        `SELECT id FROM cards WHERE front = ? AND type = 'sentence' ORDER BY id DESC LIMIT 1`,
        [note.sentence]
      )
      const sentenceCardId = sentenceRows[0]?.id
      if (sentenceCardId) {
        await ensureCardState(storage, userId, sentenceCardId, note.sourceLessonId, activeSet)
      }
    }
  }

  const [{ cards }] = await storage.query<{ cards: number }>(
    `SELECT COUNT(*) AS cards FROM cards WHERE origin_ref = ?`,
    [BUNDLED_GENKI_ORIGIN_REF]
  )
  const [{ linked }] = await storage.query<{ linked: number }>(
    `SELECT COUNT(*) AS linked
     FROM card_states cs
     JOIN cards c ON c.id = cs.card_id
     WHERE cs.user_id = ? AND c.origin_ref = ? AND cs.lesson_id IS NOT NULL`,
    [userId, BUNDLED_GENKI_ORIGIN_REF]
  )
  const [{ activeNew }] = await storage.query<{ activeNew: number }>(
    `SELECT COUNT(*) AS activeNew
     FROM card_states cs
     JOIN cards c ON c.id = cs.card_id
     WHERE cs.user_id = ?
       AND c.origin_ref = ?
       AND cs.state = 'new'
       AND cs.suspended_at IS NULL`,
    [userId, BUNDLED_GENKI_ORIGIN_REF]
  )

  return { imported, skipped, cards, linked, activeNew }
}

/**
 * For existing installs that already imported the full pack as active new:
 * suspend future-lesson bundled cards; unsuspend currently active lessons.
 */
export async function gateBundledCardsToActiveLessons(
  storage: StorageProvider,
  userId: number,
  activeLessonIds: string[],
): Promise<void> {
  const keep = expandActiveLessonIds(activeLessonIds)
  if (keep.length === 0) return
  const placeholders = keep.map(() => '?').join(', ')

  await storage.execute(
    `UPDATE card_states
     SET suspended_at = datetime('now')
     WHERE user_id = ?
       AND state = 'new'
       AND suspended_at IS NULL
       AND lesson_id IS NOT NULL
       AND lesson_id NOT IN (${placeholders})
       AND card_id IN (SELECT id FROM cards WHERE origin_ref = ?)`,
    [userId, ...keep, BUNDLED_GENKI_ORIGIN_REF],
  )

  await storage.execute(
    `UPDATE card_states
     SET suspended_at = NULL
     WHERE user_id = ?
       AND lesson_id IN (${placeholders})
       AND suspended_at IS NOT NULL
       AND card_id IN (SELECT id FROM cards WHERE origin_ref = ?)`,
    [userId, ...keep, BUNDLED_GENKI_ORIGIN_REF],
  )
}

/** Unsuspend cards linked to a lesson when the learner opens/studies it. */
export async function activateCardsForLesson(
  storage: StorageProvider,
  userId: number,
  lessonId: string,
): Promise<number> {
  const list = storageLessonIdsFor(lessonId)
  if (list.length === 0) return 0
  const placeholders = list.map(() => '?').join(', ')
  await storage.execute(
    `UPDATE card_states
     SET suspended_at = NULL
     WHERE user_id = ?
       AND lesson_id IN (${placeholders})
       AND suspended_at IS NOT NULL`,
    [userId, ...list],
  )
  const rows = await storage.query<{ count: number }>(
    `SELECT COUNT(*) AS count FROM card_states
     WHERE user_id = ? AND lesson_id IN (${placeholders}) AND suspended_at IS NULL AND state = 'new'`,
    [userId, ...list],
  )
  return rows[0]?.count ?? 0
}

function expandActiveLessonIds(lessonIds: string[]): string[] {
  const expanded = new Set<string>()
  for (const id of lessonIds.filter(Boolean)) {
    for (const alias of storageLessonIdsFor(id)) expanded.add(alias)
  }
  return [...expanded]
}

async function ensureCardState(
  storage: StorageProvider,
  userId: number,
  cardId: number,
  lessonId: string | null,
  activeLessonIds: Set<string>,
) {
  const active = !lessonId || activeLessonIds.has(lessonId)
  await storage.execute(
    `INSERT OR IGNORE INTO card_states
       (card_id, user_id, due, state, stability, difficulty, retrievability, reps, lapses, leech_count, is_leech, lesson_id, suspended_at)
     VALUES (?, ?, datetime('now'), 'new', 0, 0, 0, 0, 0, 0, 0, ?, ?)`,
    [cardId, userId, lessonId, active ? null : new Date().toISOString()],
  )

  // Re-imports / heal: keep suspension aligned with the active lesson set.
  if (active) {
    await storage.execute(
      `UPDATE card_states SET suspended_at = NULL WHERE card_id = ? AND user_id = ?`,
      [cardId, userId],
    )
  } else {
    await storage.execute(
      `UPDATE card_states
       SET suspended_at = COALESCE(suspended_at, datetime('now'))
       WHERE card_id = ? AND user_id = ? AND state = 'new'`,
      [cardId, userId],
    )
  }

  if (!lessonId) return

  await storage.execute(
    `UPDATE card_states
     SET lesson_id = COALESCE(lesson_id, ?)
     WHERE card_id = ? AND user_id = ?`,
    [lessonId, cardId, userId]
  )
  await storage.execute(
    `INSERT OR IGNORE INTO lesson_vocabulary (user_id, lesson_id, card_id, term)
     VALUES (?, ?, ?, (SELECT front FROM cards WHERE id = ?))`,
    [userId, lessonId, cardId, cardId]
  )
}
