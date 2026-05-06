#!/usr/bin/env tsx
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import XLSX from 'xlsx'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.join(__dirname, '../../data')
const OUTPUT_DIR = path.join(__dirname, '../../data/generated/cefr')

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true })
}

interface CEFRGrammarItem {
  level: string
  subLevel?: string
  pattern: string
  meaning?: string
  examples?: Array<{ japanese: string; english: string }>
}

interface CEFRVocabItem {
  word: string
  level: string
  pos: string
  meaning?: string
  example?: string
}

// CEFR level mapping
const LEVEL_MAP: Record<string, string> = {
  'A1': 'A1',
  'A1.1': 'A1',
  'A1.2': 'A1',
  'A1.3': 'A1',
  'A2': 'A2',
  'A2.1': 'A2',
  'A2.2': 'A2',
  'B1': 'B1',
  'B1.1': 'B1',
  'B1.2': 'B1',
  'B2': 'B2',
  'B2.1': 'B2',
  'B2.2': 'B2',
}

function parseGrammarProfile(): CEFRGrammarItem[] {
  const grammarPath = path.join(DATA_DIR, 'CEFR-J Grammar Profile full 20200220.xlsx')
  if (!fs.existsSync(grammarPath)) {
    console.error(`Grammar file not found: ${grammarPath}`)
    return []
  }

  const workbook = XLSX.readFile(grammarPath)
  const worksheet = workbook.Sheets['EFL SUMMARY (FULL)'] // Use summary sheet which has CEFR levels
  const data = XLSX.utils.sheet_to_json(worksheet)

  console.log(`✓ Parsed grammar profile: ${data.length} rows`)
  if (data.length > 0) {
    console.log(`  Sample columns: ${Object.keys(data[0]).slice(0, 5).join(', ')}`)
  }

  // Extract grammar items by CEFR level
  const items: CEFRGrammarItem[] = []
  for (const row of data) {
    // Find CEFR level column (usually just called "CEFR" or similar)
    const level = Object.entries(row).find(([k]) =>
      k.toUpperCase().includes('CEFR') || k.toUpperCase().includes('LEVEL')
    )?.[1] as string | undefined

    const pattern = (row['Grammatical Item'] || row['文法項目'] || '') as string

    if (pattern && level && LEVEL_MAP[level]) {
      items.push({
        level: LEVEL_MAP[level],
        pattern: pattern.trim(),
      })
    }
  }

  return items
}

function parseWordlist(): CEFRVocabItem[] {
  const wordlistPath = path.join(DATA_DIR, 'CEFR-J Wordlist Ver1.6.xlsx')
  if (!fs.existsSync(wordlistPath)) {
    console.error(`Wordlist file not found: ${wordlistPath}`)
    return []
  }

  const workbook = XLSX.readFile(wordlistPath)
  const items: CEFRVocabItem[] = []

  // Parse individual level sheets
  for (const level of ['A1', 'A2', 'B1', 'B2']) {
    const worksheet = workbook.Sheets[level]
    if (!worksheet) continue

    const data = XLSX.utils.sheet_to_json(worksheet)
    console.log(`✓ Parsed wordlist (${level}): ${data.length} rows`)

    for (const row of data) {
      const word = (row['Headword'] || row['Word'] || Object.values(row)[0]) as string
      if (word && word.trim().length > 0) {
        items.push({
          word: word.trim(),
          level,
          pos: 'noun',
        })
      }
    }
  }

  return items
}

async function main() {
  try {
    console.log('Parsing CEFR-J seed data...\n')

    const grammarItems = parseGrammarProfile()
    const vocabItems = parseWordlist()

    // Group by level
    const grammarByLevel: Record<string, string[]> = {}
    const vocabByLevel: Record<string, string[]> = {}

    for (const item of grammarItems) {
      if (!grammarByLevel[item.level]) grammarByLevel[item.level] = []
      grammarByLevel[item.level].push(item.pattern)
    }

    for (const item of vocabItems) {
      if (!vocabByLevel[item.level]) vocabByLevel[item.level] = []
      vocabByLevel[item.level].push(item.word)
    }

    // Write seed data files
    for (const level of ['A1', 'A2', 'B1', 'B2']) {
      const grammarFile = path.join(OUTPUT_DIR, `cefr-grammar-seed-${level}.json`)
      const vocabFile = path.join(OUTPUT_DIR, `cefr-vocab-seed-${level}.json`)

      fs.writeFileSync(
        grammarFile,
        JSON.stringify(
          {
            level,
            patterns: grammarByLevel[level] || [],
            count: (grammarByLevel[level] || []).length,
          },
          null,
          2
        )
      )

      fs.writeFileSync(
        vocabFile,
        JSON.stringify(
          {
            level,
            words: vocabByLevel[level] || [],
            count: (vocabByLevel[level] || []).length,
          },
          null,
          2
        )
      )

      console.log(`✓ Grammar seed (${level}): ${(grammarByLevel[level] || []).length} items`)
      console.log(`✓ Vocab seed (${level}): ${(vocabByLevel[level] || []).length} items`)
    }

    console.log(`\n✓ Seed data parsed and saved to ${OUTPUT_DIR}`)
    console.log(`\nNext: Use these seed files with Claude to generate full CEFR content`)
  } catch (error) {
    console.error('Error parsing CEFR seed data:', error)
    process.exit(1)
  }
}

main()
