#!/usr/bin/env tsx
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.join(__dirname, '../../data')
const OUTPUT_DIR = path.join(__dirname, '../../data/generated/cefr')

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true })
}

interface GrammarPattern {
  id: string
  pattern: string
  a1: boolean
  a2: boolean
  b1: boolean
  b2: boolean
  frequency: number
}

function parseGrammarTextFile(): GrammarPattern[] {
  const txtPath = path.join(DATA_DIR, 'Grammar Points.txt')
  if (!fs.existsSync(txtPath)) {
    console.error(`Text file not found: ${txtPath}`)
    return []
  }

  const content = fs.readFileSync(txtPath, 'utf-8')
  const lines = content.split('\n')
  const patterns: GrammarPattern[] = []

  // Skip header lines, parse from data lines
  let inDataSection = false
  for (const line of lines) {
    // Skip empty lines and headers
    if (!line.trim() || line.includes('RELATIVE FREQ') || line.includes('corpus version')) {
      inDataSection = false
      continue
    }

    // Start data section when we see "ID" header
    if (line.includes('文法項目')) {
      inDataSection = true
      continue
    }

    if (!inDataSection) continue

    // Parse data line: ID | Pattern | frequency values...
    // Extract ID and pattern (text before first number sequence)
    const match = line.match(/^(\d+(?:-\d+)?)\s+([^0-9,]+?)\s+(\d{1,2}(?:,\d{3})?)\s+/)
    if (!match) continue

    const [, id, pattern, freqStr] = match
    const frequency = parseInt(freqStr.replace(/,/g, ''))

    // Determine CEFR level based on frequency in first appearance
    // Extract English pattern (after colon if present)
    const englishPattern = pattern
      .split(':')
      .pop()?.trim() || pattern.trim()

    // Use frequency heuristic: higher frequency in A1 = A1 level
    const idNum = parseInt(id.split('-')[0])
    let a1 = false, a2 = false, b1 = false, b2 = false

    // Broad heuristic based on ID ranges from the data
    if (idNum <= 65) {
      a1 = true
    }
    if (idNum >= 40 && idNum <= 140) {
      a2 = true
    }
    if (idNum >= 100 && idNum <= 250) {
      b1 = true
    }
    if (idNum >= 200) {
      b2 = true
    }

    // If no levels assigned, check frequency to guess
    if (!a1 && !a2 && !b1 && !b2) {
      if (frequency > 5000) a1 = true
      else if (frequency > 2000) a2 = true
      else if (frequency > 500) b1 = true
      else b2 = true
    }

    patterns.push({
      id,
      pattern: englishPattern,
      a1,
      a2,
      b1,
      b2,
      frequency,
    })
  }

  return patterns
}

async function main() {
  try {
    console.log('Parsing CEFR-J Grammar text file...\n')

    const patterns = parseGrammarTextFile()
    console.log(`Extracted ${patterns.length} grammar patterns`)

    // Group by CEFR level
    const byLevel: Record<string, string[]> = {
      A1: [],
      A2: [],
      B1: [],
      B2: [],
    }

    for (const p of patterns) {
      if (p.a1) byLevel.A1.push(p.pattern)
      if (p.a2) byLevel.A2.push(p.pattern)
      if (p.b1) byLevel.B1.push(p.pattern)
      if (p.b2) byLevel.B2.push(p.pattern)
    }

    // Write seed files
    for (const level of ['A1', 'A2', 'B1', 'B2']) {
      const outputFile = path.join(OUTPUT_DIR, `cefr-grammar-seed-${level}.json`)
      fs.writeFileSync(
        outputFile,
        JSON.stringify(
          {
            level,
            patterns: byLevel[level] || [],
            count: (byLevel[level] || []).length,
          },
          null,
          2
        )
      )

      console.log(`✓ Grammar seed (${level}): ${(byLevel[level] || []).length} patterns`)
    }

    console.log(`\n✓ Grammar patterns parsed and saved to ${OUTPUT_DIR}`)
  } catch (error) {
    console.error('Error parsing grammar file:', error)
    process.exit(1)
  }
}

main()
