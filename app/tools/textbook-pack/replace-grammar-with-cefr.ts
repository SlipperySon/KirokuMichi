#!/usr/bin/env npx tsx
/**
 * Replace OCR-extracted grammar with CEFR grammar data
 *
 * The OCR-extracted grammar in comprehensive JSONs is extremely noisy (section headers,
 * exercise instructions, prose). The CEFR grammar files (generated separately) have
 * high-quality patterns with explanations and examples.
 *
 * This script:
 * 1. Loads CEFR grammar for the appropriate level
 * 2. Distributes grammar points across textbook lessons (evenly)
 * 3. Enriches with Maynard grammar reference explanations where patterns match
 * 4. Writes back to the comprehensive JSON files
 *
 * Mapping:
 *   genki_1_textbook → A1 (12 lessons)
 *   genki_2_textbook → A2 (11 lessons, lessons 13-23)
 *   quartet_1_textbook → B1 (12 lessons)
 *   quartet_2_textbook → B2 (12 lessons)
 *   marugoto_a1 → A1, marugoto_a2 → A2, marugoto_b1 → B1
 *   tobira → B2
 */

import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const DATA_DIR = path.resolve(process.cwd(), 'app/data/generated/textbooks')
const CEFR_DIR = path.resolve(process.cwd(), 'app/data/generated/cefr')
const MAYNARD_PATH = path.resolve(process.cwd(), 'app/tools/textbook-pack/out/comprehensive/maynard_grammar-comprehensive.json')

interface CEFRGrammarEntry {
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

interface MaynardTopic {
  id: string
  title: string
  text: string
  examples: Array<{ japanese: string; english?: string }>
  pageStart: number
  pageEnd: number
}

interface MaynardReference {
  sections: Array<{ topics: MaynardTopic[] }>
  topicIndex: Record<string, MaynardTopic>
}

interface TextbookConfig {
  cefrLevel: string
  lessonCount: number
  lessonPrefix: string // e.g., 'genki_1_' for genki_1_1, genki_1_2, etc.
  lessonOffset: number // e.g., 0 for lessons 1-12, 12 for lessons 13-23
}

const TEXTBOOK_CONFIG: Record<string, TextbookConfig> = {
  'genki_1_textbook': { cefrLevel: 'A1', lessonCount: 12, lessonPrefix: 'genki_1_', lessonOffset: 0 },
  'genki_1_workbook': { cefrLevel: 'A1', lessonCount: 12, lessonPrefix: 'genki_1_', lessonOffset: 0 },
  'genki_2_textbook': { cefrLevel: 'A2', lessonCount: 11, lessonPrefix: 'genki_2_', lessonOffset: 0 },
  'genki_2_workbook': { cefrLevel: 'A2', lessonCount: 11, lessonPrefix: 'genki_2_', lessonOffset: 0 },
  'marugoto_a1_textbook': { cefrLevel: 'A1', lessonCount: 18, lessonPrefix: 'marugoto_a1_', lessonOffset: 0 },
  'marugoto_a2_textbook': { cefrLevel: 'A2', lessonCount: 18, lessonPrefix: 'marugoto_a2_', lessonOffset: 0 },
  'marugoto_b1_textbook': { cefrLevel: 'B1', lessonCount: 18, lessonPrefix: 'marugoto_b1_', lessonOffset: 0 },
  'quartet_1_textbook': { cefrLevel: 'B1', lessonCount: 12, lessonPrefix: 'quartet_1_', lessonOffset: 0 },
  'quartet_1_workbook': { cefrLevel: 'B1', lessonCount: 12, lessonPrefix: 'quartet_1_', lessonOffset: 0 },
  'quartet_2_textbook': { cefrLevel: 'B2', lessonCount: 12, lessonPrefix: 'quartet_2_', lessonOffset: 0 },
  'quartet_2_workbook': { cefrLevel: 'B2', lessonCount: 12, lessonPrefix: 'quartet_2_', lessonOffset: 0 },
  'tobira_textbook': { cefrLevel: 'B2', lessonCount: 15, lessonPrefix: 'tobira_', lessonOffset: 0 },
}

// ── Maynard matching ────────────────────────────────────────────────────────

function findMaynardMatch(pattern: string, maynardTopics: MaynardTopic[]): MaynardTopic | null {
  const normalized = pattern.replace(/[~〜]/g, '').trim()

  // Skip very short patterns (single char like は, が, を) — too many false positives in text search
  if (normalized.length <= 1) return null

  // Extract Japanese characters from pattern for matching against Maynard titles
  const jpChars = normalized.replace(/[a-zA-Z\s\-.,;:()/'!?]/g, '')

  // Match against Maynard titles which embed Japanese (e.g., "Being: です, だ, ある, いる")
  for (const topic of maynardTopics) {
    const title = topic.title
    // Extract Japanese from topic title
    const titleJp = title.replace(/[a-zA-Z\s\-.,;:()/'!?]/g, '')

    // Exact match on Japanese portion
    if (jpChars.length >= 2 && titleJp.includes(jpChars)) return topic

    // Check if pattern appears as a comma-separated item in title
    // e.g., pattern "たら" matches "Conditional: たら, なら"
    if (jpChars.length >= 2) {
      const titleParts = title.split(/[,、]\s*/).map(p => p.replace(/[a-zA-Z\s\-.:()/'!?]/g, '').trim())
      if (titleParts.some(p => p === jpChars)) return topic
    }
  }

  // For patterns with English keywords, try keyword match on Maynard titles
  const KEYWORD_MAP: Record<string, string[]> = {
    'ている': ['progressive', 'continuative', 'て form'],
    'てある': ['resultative', 'て form'],
    'ていく': ['going', 'directional'],
    'てくる': ['coming', 'directional'],
    'たい': ['desire', 'want'],
    'ない': ['negative'],
    'なる': ['becoming'],
    'する': ['doing'],
    'れる': ['passive'],
    'られる': ['passive', 'potential'],
    'せる': ['causative'],
    'させる': ['causative'],
    'ば': ['hypothetical', 'conditional'],
    'たら': ['conditional'],
    'なら': ['conditional'],
    'ましょう': ['volitional', 'pseudo-future'],
    'ください': ['requesting'],
    'です': ['being', 'copula'],
    'だ': ['being', 'copula'],
  }

  for (const [jpKey, keywords] of Object.entries(KEYWORD_MAP)) {
    if (jpChars.includes(jpKey) || normalized.includes(jpKey)) {
      for (const topic of maynardTopics) {
        const titleLower = topic.title.toLowerCase()
        if (keywords.some(kw => titleLower.includes(kw))) {
          return topic
        }
      }
    }
  }

  return null
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('📝 Replacing OCR grammar with CEFR grammar data...\n')

  // Load CEFR grammar
  const cefrGrammar: Record<string, CEFRGrammarEntry[]> = {}
  for (const level of ['A1', 'A2', 'B1', 'B2']) {
    const filePath = path.join(CEFR_DIR, `cefr-grammar-${level}.json`)
    cefrGrammar[level] = JSON.parse(await readFile(filePath, 'utf-8'))
    console.log(`  Loaded ${cefrGrammar[level].length} ${level} grammar entries`)
  }

  // Load Maynard grammar reference
  let maynardTopics: MaynardTopic[] = []
  try {
    const maynard: MaynardReference = JSON.parse(await readFile(MAYNARD_PATH, 'utf-8'))
    maynardTopics = Object.values(maynard.topicIndex)
    console.log(`  Loaded ${maynardTopics.length} Maynard topics`)
  } catch {
    console.log('  ⚠️ Maynard reference not found, skipping enrichment')
  }

  console.log('')

  let totalReplaced = 0
  let totalMaynardMatches = 0

  for (const [textbookName, config] of Object.entries(TEXTBOOK_CONFIG)) {
    const filePath = path.join(DATA_DIR, `${textbookName}-comprehensive.json`)

    let data: any
    try {
      data = JSON.parse(await readFile(filePath, 'utf-8'))
    } catch {
      console.log(`  ⚠️ Skipping ${textbookName} (file not found)`)
      continue
    }

    const cefrEntries = cefrGrammar[config.cefrLevel]
    if (!cefrEntries || cefrEntries.length === 0) {
      console.log(`  ⚠️ No CEFR grammar for ${config.cefrLevel}, skipping ${textbookName}`)
      continue
    }

    // Distribute grammar points evenly across lessons
    const perLesson = Math.ceil(cefrEntries.length / config.lessonCount)
    const newGrammar: any[] = []

    for (let i = 0; i < cefrEntries.length; i++) {
      const entry = cefrEntries[i]
      const lessonNum = Math.min(
        Math.floor(i / perLesson) + 1 + config.lessonOffset,
        config.lessonCount + config.lessonOffset
      )
      const lessonId = `${config.lessonPrefix}${lessonNum}`

      // Find Maynard enrichment
      const maynardMatch = findMaynardMatch(entry.pattern, maynardTopics)
      if (maynardMatch) totalMaynardMatches++

      newGrammar.push({
        id: `cefr_${config.cefrLevel.toLowerCase()}_${entry.bunproId || i}`,
        pattern: entry.pattern,
        meaning: entry.meaning,
        explanation: entry.explanation,
        examples: entry.examples,
        lesson: lessonId,
        source: `cefr-${config.cefrLevel.toLowerCase()}`,
        page: 0,
        category: entry.category,
        cefrLevel: entry.cefrLevel,
        jlptLevel: entry.jlptLevel,
        frequencyRank: entry.frequencyRank,
        ...(maynardMatch ? {
          maynardRef: {
            topicId: maynardMatch.id,
            title: maynardMatch.title,
            excerpt: maynardMatch.text.slice(0, 500),
            examples: maynardMatch.examples.slice(0, 3),
          }
        } : {}),
      })
    }

    const oldCount = data.grammar.length
    data.grammar = newGrammar
    data.statistics.grammar = newGrammar.length
    totalReplaced += oldCount

    await writeFile(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8')
    console.log(`  ${textbookName}: ${oldCount} OCR → ${newGrammar.length} CEFR grammar (${config.cefrLevel})`)
  }

  console.log(`\n✅ Grammar replacement complete:`)
  console.log(`   Replaced ${totalReplaced} OCR entries across all textbooks`)
  console.log(`   Maynard matches: ${totalMaynardMatches}`)
}

main().catch(err => {
  console.error('❌ Error:', err)
  process.exit(1)
})
