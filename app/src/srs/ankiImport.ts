import JSZip from 'jszip'
import type { StorageProvider } from '../core/providers'
import { saveAudio } from './audioStore'
import { unlockCardsForTextbook } from '../content/lessonUnlockService'

export interface ImportResult {
  imported: number
  skipped: number
  errors: string[]
  audioExtracted: number
  unlockedForLessons?: {
    textbook: string
    totalUnlocked: number
  }
}

export function deriveJlptLevel(tags: string): string | null {
  const match = tags.match(/\b(N[1-5])\b/i)
  return match ? match[1].toUpperCase() : null
}

export function extractSoundFilename(field: string): string | null {
  const match = field.match(/\[sound:([^\]]+)\]/)
  return match ? match[1] : null
}

export function deriveGenkiLessonId(tags: string): string | null {
  const match = tags.match(/\bgenki-L(\d{2})\b/i)
  if (!match) return null

  const lessonNumber = Number(match[1])
  if (!Number.isFinite(lessonNumber)) return null
  if (lessonNumber === 0) return 'genki_1_1'
  if (lessonNumber >= 1 && lessonNumber <= 12) return `genki_1_${lessonNumber}`
  if (lessonNumber >= 13 && lessonNumber <= 23) return `genki_2_${lessonNumber - 12}`
  return null
}

export function stripHtml(text: string): string {
  return text
    .replace(/<br\s*\/?>/gi, ' ')   // line breaks → space (before tag strip)
    .replace(/<[^>]+>/g, '')        // strip all HTML tags
    // Decode HTML entities after stripping tags so encoded angle brackets
    // (e.g. &lt;b&gt;) are preserved as literal text, not re-stripped
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(parseInt(code, 10)))
    .replace(/\s+/g, ' ')           // collapse whitespace
    .trim()
}

export interface ParsedAnkiNote {
  front: string
  back: string
  reading: string | null
  wordAudioField: string | null
  sentence: string | null
  sentenceMeaning: string | null
  frequencyRank: number | null
  isKaishi: boolean
  sourceLessonId: string | null
}

/**
 * Parse a raw Anki note's field string (0x1f-delimited) and tags into
 * structured card data. Pure function — safe to call in unit tests.
 */
export function parseAnkiNote(flds: string, tags: string): ParsedAnkiNote | null {
  const parts = flds.split('\x1f')

  const isGenkiOfficial = /\bgenki-L\d+/i.test(tags) && parts.length >= 9

  // Kaishi 1.5k / Kaishi 2k field layout:
  //   0: Word  1: WordReading  2: WordMeaning  3: WordFurigana
  //   4: WordAudio  5: Sentence  6: SentenceMeaning  7: SentenceFurigana
  //   8: SentenceAudio  9: Notes  10: PitchAccent  11: Frequency  12: Picture
  const isKaishi = parts.length >= 9 && (parts[4]?.includes('[sound:') ?? false)

  let front: string
  let back: string
  let reading: string | null
  let wordAudioField: string | null
  let sentence: string | null
  let sentenceMeaning: string | null
  let frequencyRank: number | null
  const sourceLessonId = isGenkiOfficial ? deriveGenkiLessonId(tags) : null

  if (isGenkiOfficial) {
    // Genki official-app deck layout:
    // 0 English prompt, 1 Japanese expression, 5 word audio,
    // 7 example sentence, 8 sentence translation, 9 sentence audio.
    front = stripHtml(parts[1] ?? '')
    reading = null
    back = stripHtml(parts[0] ?? '')
    wordAudioField = parts[5] ?? null
    sentence = stripHtml(parts[7] ?? '') || null
    sentenceMeaning = stripHtml(parts[8] ?? '') || null
    frequencyRank = null
  } else if (isKaishi) {
    front = stripHtml(parts[0] ?? '')
    reading = stripHtml(parts[1] ?? '') || null
    back = stripHtml(parts[2] ?? '')
    wordAudioField = parts[4] ?? null
    sentence = stripHtml(parts[5] ?? '') || null
    sentenceMeaning = stripHtml(parts[6] ?? '') || null
    const freq = parseInt(parts[11] ?? '', 10)
    frequencyRank = isNaN(freq) ? null : freq
  } else {
    // Generic Anki deck: front / back / optional reading
    front = stripHtml(parts[0] ?? '')
    back = stripHtml(parts[1] ?? '')
    reading = parts.length >= 3 ? stripHtml(parts[2] ?? '') || null : null
    // Check if any field has audio
    wordAudioField = parts.find(p => p.includes('[sound:')) ?? null
    sentence = null
    sentenceMeaning = null
    frequencyRank = null
  }

  // Derive JLPT from tags
  const jlptFromTags = deriveJlptLevel(tags)
  void jlptFromTags // used by the caller; returned via front/back/reading

  if (!front || !back) return null

  return { front, back, reading, wordAudioField, sentence, sentenceMeaning, frequencyRank, isKaishi, sourceLessonId }
}

async function storeAudioFile(
  zip: JSZip,
  mediaMap: Record<string, string>,
  soundFilename: string
): Promise<string | null> {
  const mediaKey = Object.entries(mediaMap).find(([, name]) => name === soundFilename)?.[0]
  if (!mediaKey) return null
  const zipEntry = zip.file(mediaKey)
  if (!zipEntry) return null
  try {
    const audioData = await zipEntry.async('uint8array')
    await saveAudio(soundFilename, audioData)
    // Store the filename as the key — loadAudio() creates a fresh Blob URL at play time
    return `idb:${soundFilename}`
  } catch {
    return null
  }
}

export async function importFromAnki(
  file: File,
  storage: StorageProvider,
  userId: number,
  options: { textbookKey?: string | null; deckId?: number | null; autoUnlock?: boolean; extractAudio?: boolean } = {}
): Promise<ImportResult> {
  const buffer = await file.arrayBuffer()
  const zip = await JSZip.loadAsync(buffer)

  // Kaishi uses collection.anki21; fall back to collection.anki2
  const ankiDbFile = zip.file('collection.anki21') ?? zip.file('collection.anki2')
  if (!ankiDbFile) {
    return { imported: 0, skipped: 0, errors: ['Invalid .apkg: no collection database found'], audioExtracted: 0 }
  }

  // Parse media manifest (maps numeric filenames → original names)
  let mediaMap: Record<string, string> = {}
  const mediaFile = zip.file('media')
  if (mediaFile) {
    try {
      const raw = await mediaFile.async('string')
      mediaMap = JSON.parse(raw)
    } catch { /* no media manifest — continue without audio */ }
  }

  const ankiDbBuffer = await ankiDbFile.async('arraybuffer')
  const initSqlJs = (await import('sql.js')).default
  const SQL = await initSqlJs({ locateFile: f => `/sql.js/${f}` })
  const ankiDb = new SQL.Database(new Uint8Array(ankiDbBuffer))

  const result = ankiDb.exec(`SELECT flds, tags FROM notes`)
  ankiDb.close()

  if (!result[0]) {
    return { imported: 0, skipped: 0, errors: [], audioExtracted: 0 }
  }

  const notes = result[0].values as [string, string][]
  let imported = 0
  let skipped = 0
  let audioExtracted = 0
  const errors: string[] = []

  async function ensureCardState(cardId: number, lessonId: string | null) {
    await storage.execute(
      `INSERT OR IGNORE INTO card_states
         (card_id, user_id, due, state, stability, difficulty, retrievability, reps, lapses, leech_count, is_leech, lesson_id)
       VALUES (?, ?, datetime('now'), 'new', 0, 0, 0, 0, 0, 0, 0, ?)`,
      [cardId, userId, lessonId]
    )

    if (lessonId) {
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
  }

  for (const [flds, tags] of notes) {
    const parsed = parseAnkiNote(flds, tags)
    if (!parsed) { skipped++; continue }

    const { front, back, reading, wordAudioField, sentence, sentenceMeaning, frequencyRank, sourceLessonId } = parsed

    // Deduplicate by front text, but still repair lesson linkage for existing imports.
    const existing = await storage.query<{ id: number }>(
      `SELECT id FROM cards WHERE front = ? AND type = 'vocabulary' LIMIT 1`, [front]
    )
    if (existing[0]) {
      if (sentence || sentenceMeaning) {
        await storage.execute(
          `UPDATE cards
           SET example_sentence = COALESCE(example_sentence, ?),
               example_translation = COALESCE(example_translation, ?)
           WHERE id = ?`,
          [sentence, sentenceMeaning, existing[0].id]
        )
      }
      await ensureCardState(existing[0].id, sourceLessonId)

      if (sentence && sentenceMeaning) {
        await storage.execute(
          `INSERT OR IGNORE INTO cards (type, front, back, jlpt_level, deck_id, origin_type, origin_ref, created_at)
           VALUES ('sentence', ?, ?, ?, ?, 'anki_import', ?, datetime('now'))`,
          [sentence, sentenceMeaning, deriveJlptLevel(tags), options.deckId ?? null, file.name]
        )
        const sentenceRows = await storage.query<{ id: number }>(
          `SELECT id FROM cards WHERE front = ? AND type = 'sentence' LIMIT 1`,
          [sentence]
        )
        if (sentenceRows[0]) await ensureCardState(sentenceRows[0].id, sourceLessonId)
      }

      skipped++
      continue
    }

    // Extract audio URL if available
    let audioUrl: string | null = null
    if (wordAudioField && options.extractAudio !== false) {
      const soundFilename = extractSoundFilename(wordAudioField)
      if (soundFilename) {
        audioUrl = await storeAudioFile(zip, mediaMap, soundFilename)
        if (audioUrl) audioExtracted++
      }
    }

    try {
      await storage.execute(
        `INSERT OR IGNORE INTO cards
           (type, front, back, reading, jlpt_level, frequency_rank, audio_url, deck_id, example_sentence, example_translation, origin_type, origin_ref, created_at)
         VALUES ('vocabulary', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'anki_import', ?, datetime('now'))`,
        [front, back, reading, deriveJlptLevel(tags), frequencyRank, audioUrl, options.deckId ?? null, sentence, sentenceMeaning, file.name]
      )

      // Store sentence as a separate card if present
      let sentenceCardId: number | null = null
      if (sentence && sentenceMeaning) {
        await storage.execute(
          `INSERT OR IGNORE INTO cards (type, front, back, jlpt_level, deck_id, origin_type, origin_ref, created_at)
           VALUES ('sentence', ?, ?, ?, ?, 'anki_import', ?, datetime('now'))`,
          [sentence, sentenceMeaning, deriveJlptLevel(tags), options.deckId ?? null, file.name]
        )
        const sentenceRows = await storage.query<{ id: number }>(
          `SELECT id FROM cards WHERE front = ? AND type = 'sentence' ORDER BY id DESC LIMIT 1`,
          [sentence]
        )
        sentenceCardId = sentenceRows[0]?.id ?? null
      }

      const rows = await storage.query<{ id: number }>(
        `SELECT id FROM cards WHERE front = ? AND type = 'vocabulary' ORDER BY id DESC LIMIT 1`, [front]
      )
      const cardId = rows[0]?.id
      if (cardId) {
        await ensureCardState(cardId, sourceLessonId)
        if (sentenceCardId) await ensureCardState(sentenceCardId, sourceLessonId)
        imported++
      }
    } catch (e) {
      errors.push(`Failed to import "${front}": ${String(e)}`)
    }
  }

  // After importing cards, attempt to unlock them for lessons
  // Try common textbook names from Anki deck
  let unlockedForLessons: { textbook: string; totalUnlocked: number } | undefined

  // Detect which textbook this might be from based on deck name or heuristics
  // For now, try the most common textbooks
  const explicitTextbook = options.textbookKey ? normalizeTextbookKey(options.textbookKey) : null
  const textbooksToTry = explicitTextbook
    ? [explicitTextbook]
    : [
      'genki_1_textbook',
      'genki_2_textbook',
      'marugoto_a1_textbook',
      'marugoto_a2_textbook',
      'marugoto_b1_textbook',
      'quartet_1_textbook',
      'quartet_2_textbook',
      'tobira_textbook',
    ]

  for (const textbook of options.autoUnlock === false ? [] : textbooksToTry) {
    try {
      const result = await unlockCardsForTextbook(textbook, userId, storage)
      if (result.totalUnlocked > 0) {
        unlockedForLessons = {
          textbook,
          totalUnlocked: result.totalUnlocked
        }
        break // Stop after first textbook with matches
      }
    } catch {
      // Continue to next textbook
    }
  }

  return { imported, skipped, errors, audioExtracted, unlockedForLessons }
}

function normalizeTextbookKey(key: string) {
  if (key.endsWith('_textbook')) return key
  if (key === 'marugoto') return 'marugoto_a1_textbook'
  return `${key}_textbook`
}
