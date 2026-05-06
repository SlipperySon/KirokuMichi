#!/usr/bin/env tsx
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import JSZip from 'jszip'
import initSqlJs, { Database } from 'sql.js'
import type { GenerationResult } from './types.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUTPUT_DIR = path.join(__dirname, '../../data/generated')

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true })
}

interface AnkiNote {
  flds: string
  tags: string
}

function inferJlptLevel(tags: string): string | null {
  const tagArray = tags.split(' ')
  const jlptMatch = tagArray.find(t => /^[Nn]\d/.test(t))
  if (jlptMatch) {
    const normalized = jlptMatch.toUpperCase()
    if (['N5', 'N4', 'N3', 'N2', 'N1'].includes(normalized)) {
      return normalized
    }
  }
  return null
}

function parseAnkiNote(note: AnkiNote): {
  front: string
  back: string
  reading: string
  jlptLevel: string | null
} | null {
  // ANKI FIELD SEPARATOR: \x1f (Unit Separator ASCII 31)
  const fields = note.flds.split('\x1f')
  if (fields.length < 2) return null

  const front = fields[0].replace(/<[^>]*>/g, '').trim() // Strip HTML tags
  const back = fields[1].replace(/<[^>]*>/g, '').trim()
  const reading = fields.length > 2 ? fields[2].replace(/<[^>]*>/g, '').trim() : ''

  if (!front || !back) return null

  return {
    front,
    back,
    reading: reading || front,
    jlptLevel: inferJlptLevel(note.tags),
  }
}

async function extractApkg(apkgPath: string): Promise<AnkiNote[]> {
  const apkgBuffer = fs.readFileSync(apkgPath)
  const zip = new JSZip()
  await zip.loadAsync(apkgBuffer)

  const collectionFile = zip.file('collection.anki2')
  if (!collectionFile) {
    throw new Error('No collection.anki2 found in APKG')
  }

  const sqlBinary = await collectionFile.async('arraybuffer')
  const SQL = await initSqlJs()
  const db = new SQL.Database(new Uint8Array(sqlBinary))

  // Query notes table
  const result = db.exec('SELECT flds, tags FROM notes ORDER BY id')
  if (!result[0]) {
    return []
  }

  const notes: AnkiNote[] = result[0].values.map(row => ({
    flds: String(row[0]),
    tags: String(row[1]),
  }))

  db.close()
  return notes
}

async function run(apkgPath?: string): Promise<GenerationResult> {
  try {
    const filePath = apkgPath || process.argv[2]
    if (!filePath) {
      return {
        success: false,
        message: 'Usage: extract-vocab.ts <path-to-deck.apkg>',
        count: 0,
      }
    }

    if (!fs.existsSync(filePath)) {
      return {
        success: false,
        message: `File not found: ${filePath}`,
        count: 0,
      }
    }

    console.log(`Extracting vocabulary from ${path.basename(filePath)}...`)
    const notes = await extractApkg(filePath)
    console.log(`Found ${notes.length} notes in Anki deck`)

    const cards = notes
      .map(parseAnkiNote)
      .filter(Boolean)
      .map((card, idx) => ({
        type: 'vocabulary' as const,
        front: card!.front,
        back: card!.back,
        reading: card!.reading,
        jlptLevel: card!.jlptLevel as any,
        frequencyRank: idx + 1, // Use extraction order as frequency proxy
        domain: null,
        audioUrl: null,
      }))

    const outputPath = path.join(OUTPUT_DIR, `vocab-${path.basename(filePath, '.apkg')}.json`)
    fs.writeFileSync(outputPath, JSON.stringify(cards, null, 2))

    return {
      success: true,
      message: `Extracted ${cards.length} vocabulary cards to ${outputPath}`,
      count: cards.length,
    }
  } catch (error) {
    return {
      success: false,
      message: `Failed to extract vocabulary: ${error instanceof Error ? error.message : String(error)}`,
      count: 0,
      errors: [error instanceof Error ? error.stack || '' : String(error)],
    }
  }
}

run().then(result => {
  console.log(result.message)
  if (!result.success) {
    process.exit(1)
  }
})
