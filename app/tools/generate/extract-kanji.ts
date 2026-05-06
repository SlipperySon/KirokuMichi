#!/usr/bin/env tsx
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import https from 'https'
import type { KanjiData, GenerationResult } from './types.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUTPUT_DIR = path.join(__dirname, '../../data/generated')

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true })
}

interface RawKanjiData {
  [kanji: string]: {
    grade?: number
    strokes?: number
    meanings?: string | string[]
    readings_on?: string[]
    readings_kun?: string[]
    jlpt_old?: number
    jlpt_new?: number
    freq?: number
    wk_level?: number
  }
}

async function downloadKanjiData(): Promise<RawKanjiData> {
  return new Promise((resolve, reject) => {
    const url = 'https://raw.githubusercontent.com/davidluzgouveia/kanji-data/master/kanji.json'
    https.get(url, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try {
          const json = JSON.parse(data)
          resolve(json)
        } catch (e) {
          reject(e)
        }
      })
    }).on('error', reject)
  })
}

function mapKanjiToCards(kanjiData: RawKanjiData): Array<{
  type: 'kanji'
  front: string
  back: string
  reading: string
  jlptLevel: string | null
  frequencyRank: number | null
}> {
  return Object.entries(kanjiData).map(([kanji, k]) => {
    const meaningsArray = Array.isArray(k.meanings) ? k.meanings : (k.meanings ? [k.meanings] : [])
    const meanings = meaningsArray.join(', ')
    const onReading = k.readings_on && k.readings_on.length > 0 ? k.readings_on[0] : ''
    const kunReading = k.readings_kun && k.readings_kun.length > 0 ? k.readings_kun[0] : ''
    const reading = [onReading, kunReading].filter(Boolean).join(' / ')

    // Map JLPT level: prefer new system, fallback to old
    const jlptLevel = k.jlpt_new ? `N${k.jlpt_new}` : (k.jlpt_old ? `N${k.jlpt_old}` : null)

    return {
      type: 'kanji' as const,
      front: kanji,
      back: meanings,
      reading,
      jlptLevel: jlptLevel as any,
      frequencyRank: k.freq ?? null,
    }
  })
}

async function run(): Promise<GenerationResult> {
  try {
    console.log('Downloading kanji data from davidluzgouveia/kanji-data...')
    const kanjiData = await downloadKanjiData()
    const kanjiCount = Object.keys(kanjiData).length
    console.log(`Downloaded ${kanjiCount} kanji entries`)

    const cards = mapKanjiToCards(kanjiData)

    // Save as JSON for manual insertion
    const outputPath = path.join(OUTPUT_DIR, 'kanji-cards.json')
    fs.writeFileSync(outputPath, JSON.stringify(cards, null, 2))

    return {
      success: true,
      message: `Extracted ${cards.length} kanji to ${outputPath}`,
      count: cards.length,
    }
  } catch (error) {
    return {
      success: false,
      message: `Failed to extract kanji: ${error instanceof Error ? error.message : String(error)}`,
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
