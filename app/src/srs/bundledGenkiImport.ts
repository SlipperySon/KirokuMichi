import type { StorageProvider } from '../core/providers'

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
}

const TEST_PACK_URL = '/test-data/genki-official-test-cards.json'
const ORIGIN_REF = 'genki-official-test-cards'

export async function importBundledGenkiTestDeck(
  storage: StorageProvider,
  userId: number,
  url = TEST_PACK_URL
): Promise<BundledGenkiImportResult> {
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
        [note.front, note.back, note.reading, ORIGIN_REF]
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
      await ensureCardState(storage, userId, vocabCardId, note.sourceLessonId)
    }

    if (note.sentence && note.sentenceMeaning) {
      await storage.execute(
        `INSERT OR IGNORE INTO cards
           (type, front, back, deck_id, origin_type, origin_ref, created_at)
         VALUES ('sentence', ?, ?, NULL, 'bundled_test_deck', ?, datetime('now'))`,
        [note.sentence, note.sentenceMeaning, ORIGIN_REF]
      )
      const sentenceRows = await storage.query<{ id: number }>(
        `SELECT id FROM cards WHERE front = ? AND type = 'sentence' ORDER BY id DESC LIMIT 1`,
        [note.sentence]
      )
      const sentenceCardId = sentenceRows[0]?.id
      if (sentenceCardId) {
        await ensureCardState(storage, userId, sentenceCardId, note.sourceLessonId)
      }
    }
  }

  const [{ cards }] = await storage.query<{ cards: number }>(
    `SELECT COUNT(*) AS cards FROM cards WHERE origin_ref = ?`,
    [ORIGIN_REF]
  )
  const [{ linked }] = await storage.query<{ linked: number }>(
    `SELECT COUNT(*) AS linked
     FROM card_states cs
     JOIN cards c ON c.id = cs.card_id
     WHERE cs.user_id = ? AND c.origin_ref = ? AND cs.lesson_id IS NOT NULL`,
    [userId, ORIGIN_REF]
  )

  return { imported, skipped, cards, linked }
}

async function ensureCardState(
  storage: StorageProvider,
  userId: number,
  cardId: number,
  lessonId: string | null
) {
  await storage.execute(
    `INSERT OR IGNORE INTO card_states
       (card_id, user_id, due, state, stability, difficulty, retrievability, reps, lapses, leech_count, is_leech, lesson_id)
     VALUES (?, ?, datetime('now'), 'new', 0, 0, 0, 0, 0, 0, 0, ?)`,
    [cardId, userId, lessonId]
  )

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
