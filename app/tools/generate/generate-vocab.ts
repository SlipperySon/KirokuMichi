#!/usr/bin/env tsx
/**
 * Generates JLPT N4–N1 vocabulary using Claude Haiku.
 * N5 is expected to already exist from an Anki deck import.
 * Saves to data/generated/vocab-generated-<level>.json
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import Anthropic from '@anthropic-ai/sdk'
import type { GenerationResult } from './types.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUTPUT_DIR = path.join(__dirname, '../../data/generated')

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true })

const LEVEL_TARGETS: Record<string, number> = {
  N4: 600,
  N3: 800,
  N2: 1000,
  N1: 600,  // focus on highest-value N1 words
}
const BATCH_SIZE = 25

interface RawVocabWord {
  japanese: string
  reading: string
  english: string
  partOfSpeech: string
}

async function generateBatch(level: string, existingWords: string[]): Promise<RawVocabWord[]> {
  const exclusionNote = existingWords.length > 0
    ? `\n\nDo NOT include any of these already-generated words:\n${existingWords.slice(-100).join('、')}`
    : ''

  const prompt = `You are a JLPT vocabulary curriculum author. Generate exactly ${BATCH_SIZE} authentic JLPT ${level} vocabulary words.${exclusionNote}

Return a JSON array. Each item:
{
  "japanese": "Word in standard written form (kanji where natural)",
  "reading": "Full hiragana reading",
  "english": "Primary English meaning",
  "partOfSpeech": "noun|verb|adj-i|adj-na|adverb|expression|counter|prefix|suffix"
}

Requirements:
- All words must genuinely appear on official JLPT ${level} vocabulary lists
- Use kanji where standard (e.g. 食べる not たべる, 学校 not がっこう)
- Cover a variety of parts of speech and topics — not all nouns
- Return ONLY valid JSON array, no markdown, no other text`

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = response.content.find(b => b.type === 'text')?.text ?? ''
  const match = text.match(/\[[\s\S]*\]/)
  if (!match) throw new Error(`No JSON array in response for ${level}`)

  const parsed: RawVocabWord[] = JSON.parse(match[0])
  if (!Array.isArray(parsed)) throw new Error(`Response not array for ${level}`)
  return parsed
}

function mapToCardFormat(word: RawVocabWord, level: string, rank: number) {
  return {
    type: 'vocabulary' as const,
    front: word.japanese,
    back: word.english,
    reading: word.reading,
    jlptLevel: level,
    frequencyRank: rank,
    domain: null,
    audioUrl: null,
  }
}

async function run(): Promise<GenerationResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { success: false, message: 'ANTHROPIC_API_KEY not set', count: 0 }
  }

  const levels = (process.argv[2] ? [process.argv[2]] : Object.keys(LEVEL_TARGETS)) as string[]
  let totalGenerated = 0

  for (const level of levels) {
    if (!LEVEL_TARGETS[level]) {
      console.log(`Unknown level: ${level}. Valid: ${Object.keys(LEVEL_TARGETS).join(', ')}`)
      continue
    }

    const outputPath = path.join(OUTPUT_DIR, `vocab-generated-${level}.json`)
    const target = LEVEL_TARGETS[level]

    const existing: ReturnType<typeof mapToCardFormat>[] = fs.existsSync(outputPath)
      ? JSON.parse(fs.readFileSync(outputPath, 'utf-8'))
      : []

    if (existing.length >= target) {
      console.log(`✓ ${level}: ${existing.length}/${target} already generated — skipping`)
      totalGenerated += existing.length
      continue
    }

    console.log(`\n→ Generating ${level} vocabulary (have ${existing.length}, need ${target})...`)
    const all = [...existing]

    while (all.length < target) {
      const existingWords = all.map(w => w.front)
      const remaining = target - all.length

      try {
        const batch = await generateBatch(level, existingWords)
        const toAdd = batch.slice(0, remaining)

        for (const word of toAdd) {
          all.push(mapToCardFormat(word, level, all.length + 1))
        }

        fs.writeFileSync(outputPath, JSON.stringify(all, null, 2))

        const pct = Math.round((all.length / target) * 100)
        console.log(`  [${all.length}/${target}] (${pct}%) ${level} vocab`)
      } catch (err) {
        console.error(`  Batch failed for ${level}: ${err}. Retrying in 2s...`)
        await new Promise(r => setTimeout(r, 2000))
      }
    }

    console.log(`✓ ${level}: ${all.length} words → ${outputPath}`)
    totalGenerated += all.length
  }

  return {
    success: true,
    message: `Generated ${totalGenerated} vocabulary cards across ${levels.join(', ')}`,
    count: totalGenerated,
  }
}

run().then(result => {
  console.log('\n' + result.message)
  if (!result.success) process.exit(1)
})
