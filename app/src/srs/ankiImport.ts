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
}

/**
 * Parse a raw Anki note's field string (0x1f-delimited) and tags into
 * structured card data. Pure function — safe to call in unit tests.
 */
export function parseAnkiNote(flds: string, tags: string): ParsedAnkiNote | null {
  const parts = flds.split('\x1f')

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

  if (isKaishi) {
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

  return { front, back, reading, wordAudioField, sentence, sentenceMeaning, frequencyRank, isKaishi }
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
  userId: number
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

  for (const [flds, tags] of notes) {
    const parsed = parseAnkiNote(flds, tags)
    if (!parsed) { skipped++; continue }

    const { front, back, reading, wordAudioField, sentence, sentenceMeaning, frequencyRank } = parsed

    // Deduplicate by front text
    const existing = await storage.query<{ id: number }>(
      `SELECT id FROM cards WHERE front = ? LIMIT 1`, [front]
    )
    if (existing.length > 0) { skipped++; continue }

    // Extract audio URL if available
    let audioUrl: string | null = null
    if (wordAudioField) {
      const soundFilename = extractSoundFilename(wordAudioField)
      if (soundFilename) {
        audioUrl = await storeAudioFile(zip, mediaMap, soundFilename)
        if (audioUrl) audioExtracted++
      }
    }

    try {
      await storage.execute(
        `INSERT OR IGNORE INTO cards (type, front, back, reading, jlpt_level, frequency_rank, audio_url, created_at)
         VALUES ('vocabulary', ?, ?, ?, ?, ?, ?, datetime('now'))`,
        [front, back, reading, deriveJlptLevel(tags), frequencyRank, audioUrl]
      )

      // Store sentence as a separate card if present
      if (sentence && sentenceMeaning) {
        await storage.execute(
          `INSERT OR IGNORE INTO cards (type, front, back, jlpt_level, created_at)
           VALUES ('sentence', ?, ?, ?, datetime('now'))`,
          [sentence, sentenceMeaning, deriveJlptLevel(tags)]
        )
      }

      const rows = await storage.query<{ id: number }>(
        `SELECT id FROM cards WHERE front = ? AND type = 'vocabulary' ORDER BY id DESC LIMIT 1`, [front]
      )
      const cardId = rows[0]?.id
      if (cardId) {
        await storage.execute(
          `INSERT OR IGNORE INTO card_states (card_id, user_id, due, state, stability, difficulty, retrievability, reps, lapses, leech_count, is_leech)
           VALUES (?, ?, datetime('now'), 'new', 0, 0, 0, 0, 0, 0, 0)`,
          [cardId, userId]
        )
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
  const textbooksToTry = [
    'genki_1_textbook',
    'genki_2_textbook',
    'marugoto_a1_textbook',
    'marugoto_a2_textbook',
    'marugoto_b1_textbook',
    'quartet_1_textbook',
    'quartet_2_textbook',
    'tobira_textbook'
  ]

  for (const textbook of textbooksToTry) {
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
