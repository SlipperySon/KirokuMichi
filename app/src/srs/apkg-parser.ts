/**
 * APKG Parser - Extract and parse Anki package files
 * Handles ZIP extraction and SQLite database reading
 */

import JSZip from 'jszip'
import initSqlJs, { Database as SqlJsDatabase } from 'sql.js'

export interface ParsedApkg {
  dbData: Uint8Array
  mediaFiles: Map<string, Blob>
  mediaManifest: Record<string, string>
}

export interface ApkgMetadata {
  deckName: string
  cardCount: number
  noteCount: number
  hasReviews: boolean
  creationDate: Date
}

/**
 * Parse APKG file (ZIP archive)
 */
export async function parseApkg(file: File): Promise<ParsedApkg> {
  const zip = new JSZip()
  const loaded = await zip.loadAsync(file)

  // Get the SQLite database (collection.anki21 or collection.anki2)
  let dbFile = loaded.file('collection.anki21')
  if (!dbFile) {
    dbFile = loaded.file('collection.anki2')
  }
  if (!dbFile) {
    throw new Error('No collection database found in APKG')
  }

  const dbData = await dbFile.async('uint8array')

  // Get media manifest
  const mediaFile = loaded.file('media')
  let mediaManifest: Record<string, string> = {}
  if (mediaFile) {
    const mediaJson = await mediaFile.async('string')
    mediaManifest = JSON.parse(mediaJson)
  }

  // Extract all media files (numbered files like 0, 1, 2, ...)
  const mediaFiles = new Map<string, Blob>()
  for (const [filename, file] of Object.entries(loaded.files)) {
    // Skip metadata files
    if (['meta', 'media', 'collection.anki2', 'collection.anki21'].includes(filename)) {
      continue
    }

    // Media files are numbered or in media/ folder
    if (file.dir === false && !filename.startsWith('__')) {
      const blob = await file.async('blob')
      mediaFiles.set(filename, blob)
    }
  }

  return {
    dbData,
    mediaFiles,
    mediaManifest,
  }
}

/**
 * Extract metadata from parsed APKG
 */
export async function extractApkgMetadata(parsed: ParsedApkg): Promise<ApkgMetadata> {
  const SQL = await initSqlJs({ locateFile: f => `/sql.js/${f}` })
  const db = new SQL.Database(parsed.dbData)

  try {
    // Get deck configuration to find deck name
    const colResult = db.exec('SELECT decks FROM col LIMIT 1')
    let deckName = 'Imported Deck'
    if (colResult.length > 0 && colResult[0].values.length > 0) {
      const decksJson = colResult[0].values[0][0] as string
      const decks = JSON.parse(decksJson)
      // Get the first deck's name
      const deckId = Object.keys(decks)[0]
      if (deckId && decks[deckId].name) {
        deckName = decks[deckId].name
      }
    }

    // Count cards and notes
    const cardsResult = db.exec('SELECT COUNT(*) FROM cards')
    const notesResult = db.exec('SELECT COUNT(*) FROM notes')
    const reviewsResult = db.exec('SELECT COUNT(*) FROM revlog')

    const cardCount = cardsResult[0]?.values[0]?.[0] as number || 0
    const noteCount = notesResult[0]?.values[0]?.[0] as number || 0
    const reviewCount = reviewsResult[0]?.values[0]?.[0] as number || 0

    return {
      deckName,
      cardCount,
      noteCount,
      hasReviews: reviewCount > 0,
      creationDate: new Date(),
    }
  } finally {
    db.close()
  }
}

/**
 * Get SQL.js database instance from parsed APKG
 */
export async function getApkgDatabase(parsed: ParsedApkg): Promise<SqlJsDatabase> {
  const SQL = await initSqlJs({ locateFile: f => `/sql.js/${f}` })
  return new SQL.Database(parsed.dbData)
}

/**
 * Export APKG database (for creating new .apkg files)
 */
export async function getApkgDatabaseData(db: SqlJsDatabase): Promise<Uint8Array> {
  return db.export()
}
