#!/usr/bin/env tsx
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUTPUT_DIR = path.join(__dirname, '../../data/generated/cefr')
const OUTPUT_PATH = path.join(OUTPUT_DIR, 'bunpro-grammar-seed.json')

if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true })

const JLPT_TO_CEFR: Record<string, string> = {
  N5: 'A1',
  N4: 'A2',
  N3: 'B1',
  N2: 'B2',
  N1: 'C1',
}

interface GrammarSeedItem {
  id: number
  pattern: string
  reading: string | null
  meaning: string
  jlptLevel: string
  cefrLevel: string
  slug: string
}

function extractText(html: string, pattern: RegExp): string | null {
  const m = html.match(pattern)
  return m ? m[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"').trim() : null
}

function decodeSlug(href: string): string {
  const slug = href.replace('/grammar_points/', '')
  try {
    return decodeURIComponent(slug)
  } catch {
    return slug
  }
}

function parseGrammarPoints(html: string): GrammarSeedItem[] {
  const items: GrammarSeedItem[] = []

  // Find all grammar point list items
  const liRegex = /<li id="grammar_point-id-(\d+)"[^>]*>([\s\S]*?)<\/li>/g
  let liMatch: RegExpExecArray | null

  while ((liMatch = liRegex.exec(html)) !== null) {
    const id = parseInt(liMatch[1])
    const cardHtml = liMatch[2]

    // Extract href/slug
    const hrefMatch = cardHtml.match(/href="(\/grammar_points\/[^"]+)"/)
    if (!hrefMatch) continue
    const slug = decodeSlug(hrefMatch[1])

    // Extract Japanese pattern from h4
    const pattern = extractText(cardHtml, /<h4[^>]*>\s*([\s\S]*?)\s*<\/h4>/)
    if (!pattern) continue

    // Extract reading (optional sibling p)
    const reading = extractText(cardHtml, /class="[^"]*ml-4 inline text-tertiary-fg[^"]*"[^>]*>\s*([\s\S]*?)\s*<\/p>/)

    // Extract English meaning
    const meaning = extractText(cardHtml, /class="[^"]*line-clamp-1 text-secondary-fg[^"]*"[^>]*>\s*([\s\S]*?)\s*<\/p>/)
    if (!meaning) continue

    // Extract JLPT level from ContentTag span
    const levelMatch = cardHtml.match(/(N\d) Lesson/)
    if (!levelMatch) continue
    const jlptLevel = levelMatch[1]
    const cefrLevel = JLPT_TO_CEFR[jlptLevel] ?? 'B2'

    // Clean up pattern — strip any embedded HTML tags
    const cleanPattern = pattern.replace(/<[^>]+>/g, '').trim()
    const cleanReading = reading ? reading.replace(/<[^>]+>/g, '').replace(/<!--.*?-->/g, '').trim() || null : null
    const cleanMeaning = meaning.replace(/<[^>]+>/g, '').trim()

    if (!cleanPattern || !cleanMeaning) continue

    items.push({
      id,
      pattern: cleanPattern,
      reading: cleanReading,
      meaning: cleanMeaning,
      jlptLevel,
      cefrLevel,
      slug,
    })
  }

  return items
}

async function main() {
  console.log('Fetching Bunpro grammar library...')

  const response = await fetch('https://bunpro.jp/grammar_points', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
    },
  })

  if (!response.ok) {
    console.error(`Failed to fetch: ${response.status} ${response.statusText}`)
    process.exit(1)
  }

  const html = await response.text()
  console.log(`Fetched ${(html.length / 1024).toFixed(0)} KB`)

  const items = parseGrammarPoints(html)
  console.log(`\nExtracted ${items.length} grammar points`)

  // Group by level for reporting
  const byLevel: Record<string, number> = {}
  for (const item of items) {
    byLevel[item.jlptLevel] = (byLevel[item.jlptLevel] ?? 0) + 1
  }
  for (const [level, count] of Object.entries(byLevel).sort()) {
    console.log(`  ${level} (${JLPT_TO_CEFR[level]}): ${count} points`)
  }

  // Group into CEFR-level seed files
  const byCefr: Record<string, GrammarSeedItem[]> = { A1: [], A2: [], B1: [], B2: [], C1: [] }
  for (const item of items) {
    byCefr[item.cefrLevel]?.push(item)
  }

  // Write combined file
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(items, null, 2))
  console.log(`\n✓ Saved ${items.length} items to ${OUTPUT_PATH}`)

  // Write per-level seed files (replacing old CEFR-J grammar seeds)
  for (const level of ['A1', 'A2', 'B1', 'B2']) {
    const levelItems = byCefr[level] ?? []
    const outPath = path.join(OUTPUT_DIR, `cefr-grammar-seed-${level}.json`)
    fs.writeFileSync(
      outPath,
      JSON.stringify(
        {
          level,
          source: 'bunpro',
          items: levelItems,
          count: levelItems.length,
        },
        null,
        2
      )
    )
    console.log(`✓ Grammar seed (${level}): ${levelItems.length} patterns`)
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
