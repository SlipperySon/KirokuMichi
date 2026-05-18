#!/usr/bin/env npx tsx
/**
 * Clean curriculum data for app consumption
 *
 * Fixes:
 * 1. Removes vocab entries that are OCR artifacts (kana syllables, garbled text)
 * 2. Removes vocab entries where "english" is just romaji
 * 3. Removes grammar entries that are TOC/header noise
 * 4. Optionally enriches grammar with Maynard explanations
 *
 * Reads from: app/data/generated/textbooks/*-comprehensive.json
 * Writes to: same files (in-place cleanup)
 */

import { readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const DATA_DIR = path.resolve(process.cwd(), 'app/data/generated/textbooks')
const MAYNARD_PATH = path.resolve(process.cwd(), 'app/tools/textbook-pack/out/comprehensive/maynard_grammar-comprehensive.json')

// ── Filters ──────────────────────────────────────────────────────────────

const JAPANESE_RE = /[ぁ-んァ-ン一-龯]/
const PURE_ROMAJI_RE = /^[a-z\s\-/(),.'!?:;]+$/i

/** Known real English words that look like romaji */
const REAL_ENGLISH = new Set([
  'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'one', 'two', 'three', 'hundred', 'thousand',
  'north', 'south', 'east', 'west',
  'red', 'blue', 'green', 'white', 'black', 'yellow',
  'big', 'small', 'new', 'old', 'good', 'bad',
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
])

function isGarbageVocab(v: { surface: string; english: string }): boolean {
  const surf = v.surface?.trim()
  const eng = v.english?.trim()

  if (!surf || !eng) return true

  // Single kana character (OCR artifact from kana charts)
  if (surf.length <= 2 && /^[ぁ-んァ-ン]+$/.test(surf)) return true

  // Surface is pure Latin (OCR of English text as Japanese)
  if (/^[A-Za-z\s\-.,]+$/.test(surf)) return true

  // English field is garbled OCR
  if (eng.includes('  ') || /^[A-Z][a-z]?\s[a-z]\s[a-z]/.test(eng)) return true
  if (eng === 'extracted from table') return true

  // English is just romaji of the Japanese (no actual translation)
  if (isRomaji(eng, surf)) return true

  return false
}

function isRomaji(eng: string, surface: string): boolean {
  const lower = eng.toLowerCase().trim()

  // Skip if contains real English content words
  if (lower.split(/\s+/).some(w => w.length > 3 && !isPureRomaji(w))) return false

  // Check if it looks like pure romaji (no English meaning words)
  if (isPureRomaji(lower)) return true

  return false
}

function isPureRomaji(word: string): boolean {
  // Common romaji patterns
  if (REAL_ENGLISH.has(word.toLowerCase())) return false

  // Romaji syllable patterns: consonant+vowel, n, double consonants
  const romajiPattern = /^[bcdfghjkmnprstwyz]?[aeiou]([bcdfghjkmnprstwyz]?[aeiou])*n?$/i
  if (romajiPattern.test(word) && word.length >= 3) return true

  // Long romaji with doubled vowels
  if (/^[a-z]+$/i.test(word) && /[aeiou]{2}/.test(word) && word.length >= 4) return true

  return false
}

function isGarbageGrammar(g: { pattern: string; meaning: string }): boolean {
  const pat = g.pattern?.trim()
  const mean = g.meaning?.trim()

  if (!pat || !mean) return true

  // Pattern is too short or too long to be a grammar pattern
  if (pat.length < 2 || pat.length > 80) return true

  // Pattern is a section header / TOC entry
  if (/^(Index|Practice|Lesson|Chapter|Part|Note|See|As noted)\b/i.test(pat)) return true
  if (/^\d+\s*\./.test(pat)) return true // "1.2 Something"
  if (/…|\.{3,}/.test(pat)) return true // TOC dot leaders
  if (/^\d+$/.test(pat)) return true // Just a number

  // Meaning is a section reference or long prose
  if (/Index|Vocabulary|Lesson|Chapter|Page/i.test(mean) && mean.length > 50) return true
  if (/…|\.{3,}/.test(mean)) return true
  if (mean.length > 200) return true // Too long to be a grammar meaning

  // Pattern is pure English (not a Japanese grammar pattern)
  if (/^[A-Za-z\s,.\-:;()/●*]+$/.test(pat) && !JAPANESE_RE.test(pat)) return true

  // Pattern looks like OCR of textbook prose (multiple English sentences)
  if (/\.\s+[A-Z]/.test(pat)) return true // Contains sentence boundaries
  if ((pat.match(/\s/g) || []).length > 8) return true // Too many spaces for a pattern

  // Meaning is pure Japanese (fields swapped or garbage)
  if (JAPANESE_RE.test(mean) && !/[a-zA-Z]/.test(mean) && mean.length < 30) return true

  // Pattern contains OCR artifacts
  if (/K\d+-\d+|Ｓ[a-z]|V\s*C\s*\d/.test(pat)) return true // Audio track refs
  if (/extracted from table/i.test(mean)) return true

  // Pattern is a heading/label, not a grammar structure
  if (/^(●|＊|★)/.test(pat)) return true
  if (/^[ぁ-ん]{1,4}$/.test(pat) && !JAPANESE_RE.test(mean)) return true // Short kana that's not a particle pattern

  // A real grammar pattern should contain some Japanese
  if (!JAPANESE_RE.test(pat) && !JAPANESE_RE.test(mean)) return true

  // Meaning should look like an English explanation, not OCR noise
  // Real meanings: "when you want to...", "used to express...", "please don't..."
  // Garbage: "K01-21 ichiji", "P r a c t i c e", "Hart, Mary"
  if (mean.length < 5) return true
  if (/^[A-Z][0-9]/.test(mean)) return true // Audio track refs in meaning
  if (/P\s+r\s+a\s+c/.test(mean)) return true // Spaced-out OCR

  // Pattern should not be a vocab word or phrase acting as a section title
  // Real grammar: ~ている, ~てから, Xは Y です, これ/それ/あれ
  // Garbage: ふんほへん, れんしゅう, きむらたけし (names/headings)
  const hasGrammarMarker = /[~〜]|\/|（|は\s|が\s|を\s|に\s|で\s|と\s|も\s|のです|ます|です|ない|たい|ている|てから|ましょう|ください|なければ|ことが|ようにする/.test(pat)
  const meaningLooksExplanatory = /\b(when|used|express|indicate|want|form|verb|adjective|noun|sentence|subject|object|particle|negative|past|present|question|polite|casual|request|suggest|describe|compare|contrast|mean|meaning|pattern|structure|grammar|conjugat)/i.test(mean)

  // If neither pattern looks grammatical nor meaning looks explanatory, it's likely noise
  if (!hasGrammarMarker && !meaningLooksExplanatory && mean.length < 80) return true

  return false
}

// ── Main ─────────────────────────────────────────────────────────────────

interface ComprehensiveJSON {
  textbook: string
  generatedAt: string
  statistics: { vocab: number; grammar: number; dialogues: number; exercises: number }
  vocabulary: Array<{ id: string; surface: string; english: string; lesson: string; source: string; page: number }>
  grammar: Array<{ id: string; pattern: string; meaning: string; lesson: string; source: string; page: number }>
  dialogues: unknown[]
  exercises: unknown[]
}

async function main(): Promise<void> {
  console.log('🧹 Cleaning curriculum data...\n')

  const files = (await readdir(DATA_DIR)).filter(f => f.endsWith('-comprehensive.json'))

  let totalVocabBefore = 0
  let totalVocabAfter = 0
  let totalGrammarBefore = 0
  let totalGrammarAfter = 0

  for (const file of files) {
    const filePath = path.join(DATA_DIR, file)
    const data: ComprehensiveJSON = JSON.parse(await readFile(filePath, 'utf-8'))

    const vocabBefore = data.vocabulary.length
    const grammarBefore = data.grammar.length

    // Clean vocab
    data.vocabulary = data.vocabulary.filter(v => !isGarbageVocab(v))

    // Clean grammar
    data.grammar = data.grammar.filter(g => !isGarbageGrammar(g))

    // Update statistics
    data.statistics.vocab = data.vocabulary.length
    data.statistics.grammar = data.grammar.length

    const vocabRemoved = vocabBefore - data.vocabulary.length
    const grammarRemoved = grammarBefore - data.grammar.length

    totalVocabBefore += vocabBefore
    totalVocabAfter += data.vocabulary.length
    totalGrammarBefore += grammarBefore
    totalGrammarAfter += data.grammar.length

    if (vocabRemoved > 0 || grammarRemoved > 0) {
      console.log(`  ${file}:`)
      if (vocabRemoved > 0) console.log(`    Vocab: ${vocabBefore} → ${data.vocabulary.length} (removed ${vocabRemoved})`)
      if (grammarRemoved > 0) console.log(`    Grammar: ${grammarBefore} → ${data.grammar.length} (removed ${grammarRemoved})`)

      await writeFile(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8')
    } else {
      console.log(`  ${file}: clean (no changes)`)
    }
  }

  console.log(`\n✅ Cleanup complete:`)
  console.log(`   Vocab: ${totalVocabBefore} → ${totalVocabAfter} (removed ${totalVocabBefore - totalVocabAfter})`)
  console.log(`   Grammar: ${totalGrammarBefore} → ${totalGrammarAfter} (removed ${totalGrammarBefore - totalGrammarAfter})`)
}

main().catch(err => {
  console.error('❌ Error:', err)
  process.exit(1)
})
