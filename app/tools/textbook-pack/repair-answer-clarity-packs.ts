#!/usr/bin/env tsx
/**
 * Repair / prune obscure or incorrect vocab answers in gold reviewed packs.
 *
 * Usage (from app/):
 *   npx tsx tools/textbook-pack/repair-answer-clarity-packs.ts
 *   npx tsx tools/textbook-pack/repair-answer-clarity-packs.ts --apply
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { isLearnerSafeVocab, vocabGlossIssues } from '../../src/content/vocabGlossQuality.ts'

interface VocabItem {
  id?: string
  surface?: string
  reading?: string | null
  meaning?: string | null
  review?: {
    action?: string
    reviewedAt?: string
    reviewer?: string
    notes?: string
  }
  [key: string]: unknown
}

interface PackLesson {
  vocabulary?: VocabItem[]
  [key: string]: unknown
}

interface Pack {
  lessons?: PackLesson[]
  [key: string]: unknown
}

interface CuratedFix {
  surface?: string
  reading?: string | null
  meaning: string
  reason: string
}

const APPLY = process.argv.includes('--apply')
const REVIEWED_DIR = resolve('data/generated/reviewed')
const REPORT_PATH = 'tools/textbook-pack/out/content-quality/answer-clarity-repair-report.json'
const NOW = new Date().toISOString()

/** Known-correct repairs for Genki / Quartet OCR scars. */
const CURATED: Record<string, CuratedFix> = {
  genki_1_l2_vocab_34: { meaning: 'bank', reason: 'Removed JP OCR spill (イ konbini).' },
  genki_1_l3_vocab_56: { meaning: 'to read', reason: 'Removed Ru-verbs table spill.' },
  genki_1_l4_vocab_12: { surface: 'ねこ', meaning: 'cat', reason: 'Fixed に→二 OCR on ねこ.' },
  genki_1_l4_vocab_45: {
    meaning: 'there is; to exist (inanimate things)',
    reason: 'Replaced OCR に→二 gloss scar.',
  },
  genki_1_l4_vocab_47: {
    surface: 'わかる',
    reading: 'わかる',
    meaning: 'to understand (~が)',
    reason: 'Restored わかる from corrupt 兴 surface.',
  },
  genki_1_l5_vocab_47: { meaning: 'not busy; free (time)', reason: 'Removed I-verbs table spill.' },
  genki_1_l5_vocab_58: { meaning: 'to board; to ride (~に)', reason: 'Fixed に→二 OCR in gloss.' },
  genki_1_l9_vocab_32: {
    surface: 'みんな',
    reading: 'みんな',
    meaning: 'all; everyone',
    reason: 'Corrected wrong 水/all pair to みんな.',
  },
  genki_1_l11_vocab_53: {
    meaning: 'to introduce (a person)',
    reason: 'Fixed に→二 OCR in gloss.',
  },
  genki_2_l14_vocab_41: { meaning: 'to warn; to caution (~に)', reason: 'Fixed に→二 OCR in gloss.' },
  genki_2_l15_vocab_32: {
    surface: 'インターネット',
    reading: 'インターネット',
    meaning: 'internet',
    reason: 'Fixed OCR surface/gloss for インターネット.',
  },
  genki_2_l15_vocab_53: { meaning: 'to be careful (~に)', reason: 'Fixed に→二 OCR in gloss.' },
  genki_2_l19_vocab_21: {
    meaning: 'to eat/drink (honorific for たべる / のむ)',
    reason: 'Clarified honorific gloss; kept intentional JP refs in parentheses via rewrite.',
  },
  // Parenthetical JP is stripped by quality gate — use English-only.
  // Override after noticing: isLearnerSafe rejects JP in gloss. Use English-only forms:
  genki_2_l19_vocab_22: {
    meaning: 'to sleep; to rest (honorific)',
    reason: 'Clarified honorific gloss without JP spill.',
  },
  genki_2_l19_vocab_47: { meaning: 'to be late (~に)', reason: 'Fixed に→二 OCR in gloss.' },
  genki_2_l20_vocab_41: {
    surface: 'でござる',
    meaning: 'humble/formal equivalent of desu',
    reason: 'Normalized humble copula entry.',
  },
  genki_2_l20_vocab_43: {
    meaning: 'to give (humble)',
    reason: 'Clarified humble giving verb gloss.',
  },
  genki_2_l23_vocab_44: { meaning: 'to answer (~に)', reason: 'Fixed に→二 OCR in gloss.' },
  genki_2_l23_vocab_46: { meaning: 'to sympathize (~に)', reason: 'Fixed に→二 OCR in gloss.' },
  quartet_2_l7_vocab_59: {
    surface: '似る',
    reading: 'にる',
    meaning: 'to resemble (~に)',
    reason: 'Removed OCR spill and normalized attachment surface.',
  },
  quartet_2_l12_vocab_89: {
    meaning: 'chief of corporate planning division',
    reason: 'Removed stray 漢 OCR spill.',
  },
}

// English-only override for honorific that previously had JP
CURATED.genki_2_l19_vocab_21 = {
  meaning: 'to eat/drink (honorific)',
  reason: 'Clarified honorific gloss without JP spill.',
}

function spaceEnglishGloss(raw: string): string {
  return raw
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\bto(?=[a-z])/g, 'to ')
    .replace(/\bpoorat\b/gi, 'poor at')
    .replace(/\btogive\b/gi, 'to give')
    .replace(/\btojumpout\b/gi, 'to jump out')
    .replace(/\btowarmup\b/gi, 'to warm up')
    .replace(/\btoblink\b/gi, 'to blink')
    .replace(/\btoremove\b/gi, 'to remove')
    .replace(/\btolook for\b/gi, 'to look for')
    .replace(/\btoturn down\b/gi, 'to turn down')
    .replace(/\btorefuse\b/gi, 'to refuse')
    .replace(/\btorun abusiness\b/gi, 'to run a business')
    .replace(/\btoknit\b/gi, 'to knit')
    .replace(/\btowork\b/gi, 'to work')
    .replace(/\btoserve\b/gi, 'to serve')
    .replace(/\btobe late\b/gi, 'to be late')
    .replace(/\bto attack\b/gi, 'to attack')
    .replace(/\btofight\b/gi, 'to fight')
    .replace(/\btopretend\b/gi, 'to pretend')
    .replace(/\btoset\b/gi, 'to set')
    .replace(/\btodefine\b/gi, 'to define')
    .replace(/\btowish\b/gi, 'to wish')
    .replace(/\btodesire\b/gi, 'to desire')
    .replace(/\btolead\b/gi, 'to lead')
    .replace(/\btosurround\b/gi, 'to surround')
    .replace(/\btoshoulder\b/gi, 'to shoulder')
    .replace(/\btobear\b/gi, 'to bear')
    .replace(/\btomarry\b/gi, 'to marry')
    .replace(/\btosuppress\b/gi, 'to suppress')
    .replace(/\btorepress\b/gi, 'to repress')
    .replace(/\btopick\b/gi, 'to pick')
    .replace(/\btotrim\b/gi, 'to trim')
    .replace(/\btoestablish\b/gi, 'to establish')
    .replace(/\btoprovide\b/gi, 'to provide')
    .replace(/\btoclimb\b/gi, 'to climb')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Quartet OCR often packs `surface=kanjiFrag` + `meaning=全形(よみ)english`.
 * Recover the full headword when possible.
 */
function tryParseQuartetMerged(
  surface: string,
  meaning: string,
): CuratedFix | null {
  const m = meaning.match(
    /^([\u3040-\u30ff\u4e00-\u9fafーヶヵ々〆]+)\(([^)]+)\)\s*(.+)$/u,
  )
  if (!m) return null
  const fullSurface = m[1]!.trim()
  const reading = m[2]!.trim()
  let english = spaceEnglishGloss(m[3]!)
  // Drop trailing duplicate readings like "頭(あ)head"
  english = english.replace(/[\u3040-\u30ff\u4e00-\u9faf].*$/u, '').trim() || spaceEnglishGloss(m[3]!)
  english = english.replace(/[~～]?\s*1二/g, '').replace(/二/g, '').trim()
  if (!fullSurface || !/[A-Za-z]{2,}/.test(english)) return null
  if (english.length < 2) return null
  return {
    surface: fullSurface,
    reading: /[\u3040-\u30ff]/.test(reading) ? reading : null,
    meaning: english,
    reason: `Parsed Quartet merged gloss from OCR (was surface=${surface}).`,
  }
}

function markReview(item: VocabItem, notes: string): void {
  item.review = {
    action: 'approved',
    reviewedAt: NOW,
    reviewer: 'answer_clarity_repair',
    notes,
  }
}

function applyFix(item: VocabItem, fix: CuratedFix): void {
  if (fix.surface) item.surface = fix.surface
  if (fix.reading !== undefined) item.reading = fix.reading
  item.meaning = fix.meaning
  markReview(item, fix.reason)
}

function packFiles(): string[] {
  return readdirSync(REVIEWED_DIR)
    .filter(name => name.endsWith('.json') && name !== 'index.json')
    .sort()
}

const summary = {
  generatedAt: NOW,
  apply: APPLY,
  packsTouched: 0,
  repaired: [] as Array<{ pack: string; id: string; before: string; after: string; reason: string }>,
  pruned: [] as Array<{ pack: string; id: string; surface: string; meaning: string; issues: string[] }>,
  remainingUnsafe: [] as Array<{ pack: string; id: string; surface: string; meaning: string; issues: string[] }>,
}

for (const file of packFiles()) {
  const abs = join(REVIEWED_DIR, file)
  const pack = JSON.parse(readFileSync(abs, 'utf8')) as Pack
  const lesson = pack.lessons?.[0]
  if (!lesson?.vocabulary?.length) continue

  let changed = false
  const kept: VocabItem[] = []

  for (const item of lesson.vocabulary) {
    const id = String(item.id ?? '')
    const surface = String(item.surface ?? '')
    const meaning = String(item.meaning ?? '')
    const before = `${surface} => ${meaning}`

    const curated = CURATED[id]
    if (curated) {
      applyFix(item, curated)
      // Honorific entries: particle (~に) is OK via stripParticleHints
      if (!isLearnerSafeVocab(String(item.surface), String(item.meaning))) {
        // If particle form still fails for other reasons, force english-only meaning
        item.meaning = String(item.meaning).replace(/[（(][~～]?に[)）]/g, '(ni)')
        if (!isLearnerSafeVocab(String(item.surface), String(item.meaning))) {
          summary.pruned.push({
            pack: file,
            id,
            surface: String(item.surface),
            meaning: String(item.meaning),
            issues: vocabGlossIssues(String(item.surface), String(item.meaning)),
          })
          changed = true
          continue
        }
      }
      summary.repaired.push({
        pack: file,
        id,
        before,
        after: `${item.surface} => ${item.meaning}`,
        reason: curated.reason,
      })
      kept.push(item)
      changed = true
      continue
    }

    if (isLearnerSafeVocab(surface, meaning)) {
      kept.push(item)
      continue
    }

    const parsed = tryParseQuartetMerged(surface, meaning)
    if (parsed) {
      applyFix(item, parsed)
      if (isLearnerSafeVocab(String(item.surface), String(item.meaning))) {
        summary.repaired.push({
          pack: file,
          id,
          before,
          after: `${item.surface} => ${item.meaning}`,
          reason: parsed.reason,
        })
        kept.push(item)
        changed = true
        continue
      }
    }

    // Heuristic ni-scar repair when surface is otherwise fine.
    if (/board\(~1二\)|~\s*1二|l二/.test(meaning) && !/ね二|^1二$|^二$/.test(surface)) {
      const cleaned = meaning
        .replace(/board\(~1二\)/gi, 'to board (~に)')
        .replace(/~\s*1二/g, '(~に)')
        .replace(/l二/g, 'に')
        .replace(/\(~1二\)/g, '(~に)')
      item.meaning = cleaned
      if (isLearnerSafeVocab(surface, cleaned)) {
        markReview(item, 'Auto-fixed に→二 OCR scar in gloss.')
        summary.repaired.push({
          pack: file,
          id,
          before,
          after: `${surface} => ${cleaned}`,
          reason: 'Auto-fixed に→二 OCR scar in gloss.',
        })
        kept.push(item)
        changed = true
        continue
      }
    }

    summary.pruned.push({
      pack: file,
      id,
      surface,
      meaning,
      issues: vocabGlossIssues(surface, meaning),
    })
    changed = true
  }

  if (changed) {
    lesson.vocabulary = kept
    summary.packsTouched += 1
    if (APPLY) {
      writeFileSync(abs, `${JSON.stringify(pack, null, 2)}\n`)
    }
  }
}

// Post-pass remaining unsafe check (after keep list)
for (const file of packFiles()) {
  const pack = JSON.parse(
    APPLY
      ? readFileSync(join(REVIEWED_DIR, file), 'utf8')
      : readFileSync(join(REVIEWED_DIR, file), 'utf8'),
  ) as Pack
  // When dry-run, recompute would still see old data; only validate after apply.
  if (!APPLY) continue
  const vocab = pack.lessons?.[0]?.vocabulary ?? []
  for (const item of vocab) {
    const surface = String(item.surface ?? '')
    const meaning = String(item.meaning ?? '')
    if (!isLearnerSafeVocab(surface, meaning)) {
      summary.remainingUnsafe.push({
        pack: file,
        id: String(item.id ?? ''),
        surface,
        meaning,
        issues: vocabGlossIssues(surface, meaning),
      })
    }
  }
}

mkdirSync(resolve('tools/textbook-pack/out/content-quality'), { recursive: true })
writeFileSync(REPORT_PATH, `${JSON.stringify(summary, null, 2)}\n`)

console.log(
  JSON.stringify(
    {
      apply: APPLY,
      packsTouched: summary.packsTouched,
      repaired: summary.repaired.length,
      pruned: summary.pruned.length,
      remainingUnsafe: summary.remainingUnsafe.length,
      report: REPORT_PATH,
      repairedSamples: summary.repaired.slice(0, 12),
      prunedSamples: summary.pruned.slice(0, 12),
    },
    null,
    2,
  ),
)

if (APPLY && summary.remainingUnsafe.length > 0) {
  console.error(`Remaining unsafe vocab: ${summary.remainingUnsafe.length}`)
  process.exitCode = 1
}
