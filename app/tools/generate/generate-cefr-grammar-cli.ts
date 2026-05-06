#!/usr/bin/env tsx
/**
 * Generate CEFR grammar content using the `claude` CLI (no API key needed).
 * Processes seed data in batches of 10 to stay well under output token limits.
 * Resume-safe: skips already-generated slugs on restart.
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SEED_DIR = path.join(__dirname, '../../data/generated/cefr')
const OUTPUT_DIR = path.join(__dirname, '../../data/generated/cefr')

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
  if (!fs.existsSync(seedPath)) return []
  const data = JSON.parse(fs.readFileSync(seedPath, 'utf-8'))
  return data.items ?? []
}

function loadExisting(level: string): GeneratedGrammarPoint[] {
  const outPath = path.join(OUTPUT_DIR, `cefr-grammar-${level}.json`)
  if (!fs.existsSync(outPath)) return []
  try { return JSON.parse(fs.readFileSync(outPath, 'utf-8')) } catch { return [] }
}

function saveOutput(level: string, items: GeneratedGrammarPoint[]) {
  const sorted = [...items].sort((a, b) => a.bunproId - b.bunproId)
  sorted.forEach((item, idx) => { item.frequencyRank = idx + 1 })
  fs.writeFileSync(path.join(OUTPUT_DIR, `cefr-grammar-${level}.json`), JSON.stringify(sorted, null, 2))
}

function buildPrompt(seeds: SeedItem[], cefrLevel: string): string {
  const seedList = seeds.map(s => `- pattern: "${s.pattern}", meaning: "${s.meaning}"`).join('\n')
  return `You are a Japanese grammar curriculum author for ${cefrLevel}-level learners (English speakers learning Japanese).

Expand these ${seeds.length} grammar points into full teaching entries.

Seed patterns to expand:
${seedList}

Return a JSON array with exactly ${seeds.length} objects in the same order as the seeds. Each object:
{
  "pattern": "The Japanese grammar pattern exactly as given in the seed",
  "title": "Short English name (e.g. 'Topic marker は', 'て-form continuation')",
  "meaning": "Core meaning in 1 sentence",
  "explanation": "2-3 sentences: what it does, register (polite/casual), when to use it. Be concrete.",
  "examples": [
    { "japanese": "Natural Japanese sentence using this pattern", "reading": "Full hiragana reading of the sentence", "english": "Natural English translation" },
    { "japanese": "Second example sentence", "reading": "Full hiragana reading", "english": "Translation" },
    { "japanese": "Third example sentence", "reading": "Full hiragana reading", "english": "Translation" }
  ],
  "category": "particle|verb-form|expression|conjunction|auxiliary|conditional|comparison|honorific|question|tense|adjective|adverb|counter",
  "isKeigo": false
}

Rules:
- Examples must be grammatically correct, natural Japanese at ${cefrLevel} difficulty
- Vocabulary in examples must be common and appropriate for ${cefrLevel} learners
- Readings must be complete hiragana transcriptions (include kanji readings inline)
- isKeigo: true only for keigo/honorific patterns
- Return ONLY a valid JSON array. No markdown fences, no explanation, no other text.`
}

function runClaude(prompt: string): string {
  const tmpFile = path.join('/tmp', `kiroku-prompt-${Date.now()}.txt`)
  try {
    fs.writeFileSync(tmpFile, prompt, 'utf-8')
    const result = execSync(`claude --model haiku --output-format text -p < "${tmpFile}"`, {
      maxBuffer: 10 * 1024 * 1024,
      timeout: 120_000,
      encoding: 'utf-8',
    })
    return result.toString()
  } finally {
    try { fs.unlinkSync(tmpFile) } catch {}
  }
}

function parseResponse(text: string, seeds: SeedItem[], cefrLevel: string): GeneratedGrammarPoint[] {
  const match = text.match(/\[[\s\S]*\]/)
  if (!match) throw new Error('No JSON array found in response')
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
    frequencyRank: 0,
    bunproId: seeds[i]?.id ?? 0,
    bunproSlug: seeds[i]?.slug ?? '',
  }))
}

async function generateLevel(level: string) {
  console.log(`\n${'─'.repeat(50)}`)
  console.log(`CEFR ${level} grammar generation`)

  const seeds = loadSeed(level)
  if (seeds.length === 0) { console.log('  No seed data, skipping'); return }

  const existing = loadExisting(level)
  const doneSlugs = new Set(existing.map(e => e.bunproSlug))
  const remaining = seeds.filter(s => !doneSlugs.has(s.slug))

  console.log(`  Seed: ${seeds.length} | Done: ${existing.length} | Remaining: ${remaining.length}`)
  if (remaining.length === 0) { console.log('  ✓ Already complete'); return }

  const all = [...existing]
  const totalBatches = Math.ceil(remaining.length / BATCH_SIZE)

  for (let i = 0; i < remaining.length; i += BATCH_SIZE) {
    const batch = remaining.slice(i, i + BATCH_SIZE)
    const batchNum = Math.floor(i / BATCH_SIZE) + 1
    process.stdout.write(`  Batch ${batchNum}/${totalBatches} (${batch.length} items)... `)

    let attempts = 0
    let success = false
    while (attempts < 3 && !success) {
      try {
        const prompt = buildPrompt(batch, level)
        const response = runClaude(prompt)
        const generated = parseResponse(response, batch, level)
        all.push(...generated)
        saveOutput(level, all)
        console.log(`✓ (total saved: ${all.length})`)
        success = true
      } catch (err: any) {
        attempts++
        console.log(`\n    Attempt ${attempts} failed: ${err.message?.slice(0, 100)}`)
        if (attempts < 3) await new Promise(r => setTimeout(r, 2000))
        else console.log('    Skipping batch')
      }
    }
  }

  console.log(`✓ ${level} done: ${loadExisting(level).length} points`)
}

async function main() {
  const targetLevels = process.argv[2]
    ? [process.argv[2].toUpperCase()]
    : ['A1', 'A2', 'B1', 'B2']

  console.log('KirokuMichi — CEFR Grammar Generation (claude CLI)')
  console.log(`Levels: ${targetLevels.join(', ')} | Batch size: ${BATCH_SIZE}`)

  for (const level of targetLevels) {
    await generateLevel(level)
  }

  console.log('\n✓ Generation complete')
}

main().catch(err => { console.error(err); process.exit(1) })
