#!/usr/bin/env tsx
/**
 * Generate CEFR grammar content by expanding Bunpro seed data.
 * Batches are sized so each API response stays under ~32k output tokens.
 * At ~400 tokens/item, batches of 10 items ≈ 4k tokens — safe margin.
 * Saves after every batch (resume-safe).
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import Anthropic from '@anthropic-ai/sdk'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SEED_DIR = path.join(__dirname, '../../data/generated/cefr')
const OUTPUT_DIR = path.join(__dirname, '../../data/generated/cefr')

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// 10 items × ~400 tokens/item = ~4k tokens output — well under 32k limit
const BATCH_SIZE = 10

interface SeedItem {
  id: number
  pattern: string
  reading: string | null
  meaning: string
  jlptLevel: string
  cefrLevel: string
  slug: string
}

interface GeneratedGrammarPoint {
  cefrLevel: string
  jlptLevel: string
  pattern: string
  title: string
  meaning: string
  explanation: string
  examples: Array<{ japanese: string; reading: string; english: string }>
  category: string
  isKeigo: boolean
  frequencyRank: number
  bunproId: number
  bunproSlug: string
}

function loadSeed(level: string): SeedItem[] {
  const seedPath = path.join(SEED_DIR, `cefr-grammar-seed-${level}.json`)
  if (!fs.existsSync(seedPath)) {
    console.error(`Seed file not found: ${seedPath}`)
    return []
  }
  const data = JSON.parse(fs.readFileSync(seedPath, 'utf-8'))
  return data.items ?? []
}

function loadExisting(level: string): GeneratedGrammarPoint[] {
  const outPath = path.join(OUTPUT_DIR, `cefr-grammar-${level}.json`)
  if (!fs.existsSync(outPath)) return []
  return JSON.parse(fs.readFileSync(outPath, 'utf-8'))
}

function saveOutput(level: string, items: GeneratedGrammarPoint[]) {
  const outPath = path.join(OUTPUT_DIR, `cefr-grammar-${level}.json`)
  fs.writeFileSync(outPath, JSON.stringify(items, null, 2))
}

async function expandBatch(
  seeds: SeedItem[],
  cefrLevel: string
): Promise<GeneratedGrammarPoint[]> {
  const seedList = seeds
    .map(s => `- pattern: "${s.pattern}", meaning: "${s.meaning}"`)
    .join('\n')

  const prompt = `You are a Japanese grammar curriculum author for ${cefrLevel}-level learners (English speakers learning Japanese).

Expand these ${seeds.length} grammar points into full teaching entries. For each, produce a JSON object.

Seed patterns to expand:
${seedList}

Return a JSON array with exactly ${seeds.length} objects in the same order as the seeds. Each object:
{
  "pattern": "The Japanese grammar pattern exactly as given",
  "title": "Short English name (e.g. 'Topic marker は', 'て-form continuation')",
  "meaning": "Core meaning in 1 sentence",
  "explanation": "2-3 sentences: what it does, register (polite/casual), when to use it. Be concrete.",
  "examples": [
    { "japanese": "Natural Japanese sentence using this pattern", "reading": "Full hiragana reading", "english": "Natural English translation" },
    { "japanese": "Second example", "reading": "Full hiragana reading", "english": "Translation" },
    { "japanese": "Third example", "reading": "Full hiragana reading", "english": "Translation" }
  ],
  "category": "particle|verb-form|expression|conjunction|auxiliary|conditional|comparison|honorific|question|tense|adjective|adverb|counter|conjunction",
  "isKeigo": false
}

Rules:
- Examples must be grammatically correct, natural Japanese at ${cefrLevel} difficulty
- Vocabulary in examples must be common, appropriate for ${cefrLevel} learners
- Readings must be complete hiragana transcriptions (include kanji readings)
- isKeigo: true only for keigo/honorific patterns
- Return ONLY a valid JSON array. No markdown, no explanation, no other text.`

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8000,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = response.content.find(b => b.type === 'text')?.text ?? ''
  const match = text.match(/\[[\s\S]*\]/)
  if (!match) throw new Error('No JSON array in response')

  const parsed: any[] = JSON.parse(match[0])
  if (!Array.isArray(parsed) || parsed.length === 0) throw new Error('Empty or invalid array')

  return parsed.map((item, i) => ({
    cefrLevel,
    jlptLevel: seeds[i]?.jlptLevel ?? '',
    pattern: item.pattern ?? seeds[i]?.pattern,
    title: item.title ?? item.pattern,
    meaning: item.meaning ?? seeds[i]?.meaning,
    explanation: item.explanation ?? '',
    examples: Array.isArray(item.examples) ? item.examples : [],
    category: item.category ?? 'expression',
    isKeigo: item.isKeigo ?? false,
    frequencyRank: 0, // set after sort
    bunproId: seeds[i]?.id ?? 0,
    bunproSlug: seeds[i]?.slug ?? '',
  }))
}

async function generateLevel(level: string) {
  console.log(`\n${'─'.repeat(50)}`)
  console.log(`Generating CEFR ${level} grammar...`)

  const seeds = loadSeed(level)
  if (seeds.length === 0) {
    console.log(`  No seed data for ${level}, skipping`)
    return
  }

  const existing = loadExisting(level)
  const doneSlugs = new Set(existing.map(e => e.bunproSlug))
  const remaining = seeds.filter(s => !doneSlugs.has(s.slug))

  console.log(`  Seed: ${seeds.length} | Done: ${existing.length} | Remaining: ${remaining.length}`)

  if (remaining.length === 0) {
    console.log(`  ✓ ${level} already complete`)
    return
  }

  const all = [...existing]

  // Process in batches
  for (let i = 0; i < remaining.length; i += BATCH_SIZE) {
    const batch = remaining.slice(i, i + BATCH_SIZE)
    const batchNum = Math.floor(i / BATCH_SIZE) + 1
    const totalBatches = Math.ceil(remaining.length / BATCH_SIZE)

    process.stdout.write(`  Batch ${batchNum}/${totalBatches} (${batch.length} items)... `)

    let attempts = 0
    while (attempts < 3) {
      try {
        const generated = await expandBatch(batch, level)
        all.push(...generated)

        // Assign frequency ranks by Bunpro ID order (lower ID = more fundamental)
        const sorted = [...all].sort((a, b) => a.bunproId - b.bunproId)
        sorted.forEach((item, idx) => { item.frequencyRank = idx + 1 })

        saveOutput(level, sorted)
        console.log(`✓ (total: ${all.length})`)
        break
      } catch (err: any) {
        attempts++
        console.log(`\n    Attempt ${attempts} failed: ${err.message}`)
        if (attempts < 3) {
          await new Promise(r => setTimeout(r, 3000 * attempts))
        } else {
          console.log(`    Skipping batch after 3 failures`)
        }
      }
    }

    // Small delay between batches to avoid rate limits
    if (i + BATCH_SIZE < remaining.length) {
      await new Promise(r => setTimeout(r, 500))
    }
  }

  const final = loadExisting(level)
  console.log(`✓ ${level} complete: ${final.length} grammar points saved`)
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY not set')
    process.exit(1)
  }

  const targetLevels = process.argv[2]
    ? [process.argv[2].toUpperCase()]
    : ['A1', 'A2', 'B1', 'B2']

  console.log('KirokuMichi — CEFR Grammar Generation')
  console.log(`Levels: ${targetLevels.join(', ')}`)
  console.log(`Batch size: ${BATCH_SIZE} items/request`)

  for (const level of targetLevels) {
    await generateLevel(level)
  }

  console.log('\n✓ Generation complete')
  console.log('Output:', OUTPUT_DIR)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
