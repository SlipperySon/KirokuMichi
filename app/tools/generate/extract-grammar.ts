#!/usr/bin/env tsx
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import Anthropic from '@anthropic-ai/sdk'
import type { GenerationResult } from './types.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUTPUT_DIR = path.join(__dirname, '../../data/generated')
const OUTPUT_PATH = path.join(OUTPUT_DIR, 'grammar-points.json')

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true })

// Target grammar point counts per level
const LEVEL_TARGETS: Record<string, number> = {
  N5: 40,
  N4: 50,
  N3: 60,
  N2: 70,
  N1: 80,
}
const BATCH_SIZE = 12

interface RawGrammarPoint {
  title: string
  pattern: string
  meaning: string
  explanation: string
  examples: Array<{ japanese: string; english: string }>
  category: string
  isKeigo: boolean
}

async function generateBatch(
  level: string,
  existingTitles: string[]
): Promise<RawGrammarPoint[]> {
  const exclusionNote = existingTitles.length > 0
    ? `\n\nDo NOT generate any of these (already generated):\n${existingTitles.join(', ')}`
    : ''

  const prompt = `You are a JLPT grammar curriculum author. Generate exactly ${BATCH_SIZE} authentic JLPT ${level} grammar points.${exclusionNote}

Return a JSON array. Each item must have:
{
  "title": "Short descriptive name mixing English/Japanese as standard (e.g. 'て-form + いる (ongoing action)')",
  "pattern": "Standard grammatical notation using V/N/A-i/A-na/S abbreviations",
  "meaning": "Core English meaning in 1 sentence",
  "explanation": "2-3 sentences explaining usage, nuance, register, and when to use",
  "examples": [
    {"japanese": "Natural Japanese sentence.", "english": "Natural English translation."},
    {"japanese": "Natural Japanese sentence.", "english": "Natural English translation."},
    {"japanese": "Natural Japanese sentence.", "english": "Natural English translation."}
  ],
  "category": "particle|verb-form|expression|conjunction|auxiliary|formal|conditional|comparison|honorific",
  "isKeigo": false
}

Requirements:
- All patterns must genuinely appear on JLPT ${level} tests
- Examples must be grammatically correct, natural Japanese at ${level} level
- Cover a variety of categories; do not repeat the same pattern type
- Return ONLY a valid JSON array, no markdown, no other text`

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = response.content.find(b => b.type === 'text')?.text ?? ''
  const match = text.match(/\[[\s\S]*\]/)
  if (!match) throw new Error(`No JSON array found in response for ${level}`)

  const parsed: RawGrammarPoint[] = JSON.parse(match[0])
  if (!Array.isArray(parsed)) throw new Error(`Response was not an array for ${level}`)
  return parsed
}

function mapToDbFormat(point: RawGrammarPoint, level: string, idx: number) {
  return {
    jlptLevel: level,
    title: point.title,
    pattern: point.pattern,
    meaning: point.meaning,
    explanation: point.explanation,
    examplesJson: JSON.stringify(
      point.examples.map(ex => ({ japanese: ex.japanese, reading: ex.japanese, english: ex.english }))
    ),
    category: point.category || null,
    isKeigo: point.isKeigo ? 1 : 0,
    frequencyRank: idx + 1,
  }
}

async function run(): Promise<GenerationResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { success: false, message: 'ANTHROPIC_API_KEY not set', count: 0 }
  }

  // Load existing points to support resume
  const existing: ReturnType<typeof mapToDbFormat>[] = fs.existsSync(OUTPUT_PATH)
    ? JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf-8'))
    : []

  const countByLevel = new Map<string, number>()
  for (const p of existing) countByLevel.set(p.jlptLevel, (countByLevel.get(p.jlptLevel) ?? 0) + 1)

  const all = [...existing]
  const levels = ['N5', 'N4', 'N3', 'N2', 'N1']

  for (const level of levels) {
    const target = LEVEL_TARGETS[level]
    const have = countByLevel.get(level) ?? 0

    if (have >= target) {
      console.log(`✓ ${level}: ${have}/${target} already generated — skipping`)
      continue
    }

    console.log(`\n→ Generating ${level} grammar points (have ${have}, need ${target})...`)

    while (true) {
      const levelPoints = all.filter(p => p.jlptLevel === level)
      if (levelPoints.length >= target) break

      const existingTitles = levelPoints.map(p => p.title)
      const remaining = target - levelPoints.length

      try {
        const batch = await generateBatch(level, existingTitles)
        const toAdd = batch.slice(0, remaining)

        for (const point of toAdd) {
          const idx = all.filter(p => p.jlptLevel === level).length
          all.push(mapToDbFormat(point, level, idx))
        }

        // Save after every batch (resume safety)
        fs.writeFileSync(OUTPUT_PATH, JSON.stringify(all, null, 2))

        const newCount = all.filter(p => p.jlptLevel === level).length
        console.log(`  [${newCount}/${target}] ${level} grammar points`)
      } catch (err) {
        console.error(`  Batch failed for ${level}: ${err}. Retrying...`)
        await new Promise(r => setTimeout(r, 2000))
      }
    }

    console.log(`✓ ${level}: ${all.filter(p => p.jlptLevel === level).length} points`)
  }

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(all, null, 2))

  return {
    success: true,
    message: `Generated ${all.length} grammar points to ${OUTPUT_PATH}`,
    count: all.length,
  }
}

run().then(result => {
  console.log('\n' + result.message)
  if (!result.success) process.exit(1)
})
