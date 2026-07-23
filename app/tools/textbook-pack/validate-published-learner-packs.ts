#!/usr/bin/env tsx
/**
 * Post-publish validation gate for learner packs under data/generated/reviewed/.
 * Fails CI when gold packs have structural or OCR-gloss errors (0-error gate).
 *
 * Usage (from app/): npm run textbook:learner:validate-published
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

interface IndexEntry {
  lessonId: string
  packId: string
  tier: 'gold' | 'draft'
  url: string
  vocabulary: number
  grammar: number
}

interface PackVocab {
  id?: string
  surface?: string
  meaning?: string | null
  reading?: string | null
}

interface PackGrammar {
  id?: string
  pattern?: string
  meaning?: string | null
}

interface PackLesson {
  id?: string
  appLessonId?: string
  qualityTier?: string
  vocabulary?: PackVocab[]
  grammar?: PackGrammar[]
}

interface Finding {
  severity: 'error' | 'warning'
  lessonId: string
  packFile: string
  itemId: string
  kind: 'structure' | 'vocab' | 'grammar'
  message: string
  text?: string
}

const REVIEWED_DIR = resolve('data/generated/reviewed')
const REPORT_PATH = 'tools/textbook-pack/out/content-quality/published-learner-packs-report.json'

/** Leftover OCR / curriculum stubs that must not ship as learner overlays. */
const FORBIDDEN_LESSON_IDS = new Set([
  'genki_2_12',
  'quartet_2_0',
  'marugoto_a1_17',
  'marugoto_b1_0',
])

const ADMIN_OR_SOURCE_TEXT_RE =
  /(table of contents|copyright|isbn|publisher|answer key|https|www\.|audio file|using tobira|文法項目|読み書き編|構成されています|必要に応じて|聞く練習|漢字の練習|Listening Comprehension|KanjiPractice|Introduction\d|Conversation and Grammar section|corresponding lesson)/i
const STRUCTURAL_JUNK_RE = /([A-Za-z]{22,}|\d{4,}|[{}[\]\\<>|]{2,}|©|TEL|FAX)/
const OCR_LETTER_SPACING_RE = /(?:^|[^A-Za-z])(?:[A-Za-z] ){4,}[A-Za-z](?:$|[^A-Za-z])/
const OCR_SCAR_RE = /Pr a c|toget\b|→|Lesson\s*\d+/i
const JP_IN_ENGLISH_RE = /[\u3040-\u30ff\u4e00-\u9fff]/

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T
}

function glossIssue(surface: string, meaning: string): string | null {
  const m = meaning.trim()
  const s = surface.trim()
  if (!m) return 'empty meaning'
  if (m.length < 2) return 'meaning too short'
  if (/^extracted from table$/i.test(m) || /^unknown$/i.test(m)) return 'placeholder meaning'
  if (!/[A-Za-z]/.test(m)) return 'meaning missing Latin gloss'
  if (ADMIN_OR_SOURCE_TEXT_RE.test(m) || ADMIN_OR_SOURCE_TEXT_RE.test(s)) return 'admin/source text'
  if (STRUCTURAL_JUNK_RE.test(m)) return 'structural OCR junk'
  if (OCR_LETTER_SPACING_RE.test(m)) return 'OCR letter-spacing scar'
  if (OCR_SCAR_RE.test(m)) return 'known OCR scar / lesson spillover'
  // Particle annotations like (~が) / (～を) are intentional; flag other JP spill.
  const withoutParticles = m.replace(/[（(][~～\-]*[\u3040-\u30ffをがにへでとからよりの][)）]/g, '')
  if (/[l1I]\s*[二ニ]|[二ニ]\s*[)）]/.test(withoutParticles)) return 'OCR に/二 substitution scar'
  if (JP_IN_ENGLISH_RE.test(withoutParticles)) return 'Japanese characters inside English gloss'
  if (s && m.toLowerCase() === s.toLowerCase()) return 'meaning duplicates surface'
  if (/\s{2,}/.test(m) && /[A-Za-z]{2,}\s+[\u3040-\u30ff]/.test(m)) return 'merged reading/gloss spill'
  return null
}

function grammarIssue(pattern: string, meaning: string): string | null {
  if (!pattern.trim()) return 'empty pattern'
  if (pattern.length > 80) return 'oversized grammar pattern'
  if (!meaning.trim()) return 'empty meaning'
  if (ADMIN_OR_SOURCE_TEXT_RE.test(meaning) || ADMIN_OR_SOURCE_TEXT_RE.test(pattern)) return 'admin/source text'
  if (STRUCTURAL_JUNK_RE.test(meaning) || STRUCTURAL_JUNK_RE.test(pattern)) return 'structural OCR junk'
  if (OCR_LETTER_SPACING_RE.test(meaning)) return 'OCR letter-spacing scar'
  if (JP_IN_ENGLISH_RE.test(meaning) && !/[A-Za-z]{3,}/.test(meaning)) return 'non-English grammar meaning'
  return null
}

function validatePackFile(packFile: string, lessonId: string, tier: IndexEntry['tier']): Finding[] {
  const findings: Finding[] = []
  const abs = join(REVIEWED_DIR, packFile)
  let pack: { lessons?: PackLesson[]; title?: string }
  try {
    pack = readJson(abs)
  } catch {
    findings.push({
      severity: 'error',
      lessonId,
      packFile,
      itemId: packFile,
      kind: 'structure',
      message: 'pack file missing or unreadable',
    })
    return findings
  }

  const lesson = pack.lessons?.[0]
  if (!lesson) {
    findings.push({
      severity: 'error',
      lessonId,
      packFile,
      itemId: packFile,
      kind: 'structure',
      message: 'pack has no lessons[0]',
    })
    return findings
  }

  if (tier === 'gold') {
    const vocab = lesson.vocabulary ?? []
    const grammar = lesson.grammar ?? []
    if (vocab.length < 8 && grammar.length < 3) {
      findings.push({
        severity: 'error',
        lessonId,
        packFile,
        itemId: lesson.id ?? lessonId,
        kind: 'structure',
        message: `thin gold pack (v${vocab.length} g${grammar.length})`,
      })
    }

    for (const item of vocab) {
      const surface = String(item.surface ?? '')
      const meaning = String(item.meaning ?? '')
      const reason = glossIssue(surface, meaning)
      if (reason) {
        findings.push({
          severity: reason === 'empty meaning' || reason === 'meaning too short' ? 'error' : 'warning',
          lessonId,
          packFile,
          itemId: item.id ?? surface,
          kind: 'vocab',
          message: reason,
          text: `${surface} => ${meaning}`,
        })
      }
    }

    for (const item of grammar) {
      const pattern = String(item.pattern ?? '')
      const meaning = String(item.meaning ?? '')
      const reason = grammarIssue(pattern, meaning)
      if (reason) {
        findings.push({
          severity: reason.startsWith('empty') ? 'error' : 'warning',
          lessonId,
          packFile,
          itemId: item.id ?? pattern,
          kind: 'grammar',
          message: reason,
          text: `${pattern} => ${meaning}`,
        })
      }
    }
  }

  return findings
}

function main() {
  const indexPath = join(REVIEWED_DIR, 'index.json')
  const index = readJson<{ packs?: IndexEntry[]; summary?: { gold?: number; draft?: number } }>(indexPath)
  const packs = index.packs ?? []
  const findings: Finding[] = []

  for (const entry of packs) {
    if (FORBIDDEN_LESSON_IDS.has(entry.lessonId)) {
      findings.push({
        severity: 'error',
        lessonId: entry.lessonId,
        packFile: entry.url.split('/').pop() ?? entry.lessonId,
        itemId: entry.packId,
        kind: 'structure',
        message: 'forbidden leftover draft stub still published',
      })
    }
  }

  const gold = packs.filter((p) => p.tier === 'gold')
  for (const entry of gold) {
    const packFile = entry.url.replace(/^\/data\/generated\/reviewed\//, '')
    findings.push(...validatePackFile(packFile, entry.lessonId, entry.tier))
  }

  // Catch orphan forbidden files still on disk even if removed from index
  for (const name of readdirSync(REVIEWED_DIR)) {
    if (!name.endsWith('.json') || name === 'index.json') continue
    const lessonId = name.replace(/\.json$/, '')
    if (FORBIDDEN_LESSON_IDS.has(lessonId)) {
      const already = findings.some((f) => f.lessonId === lessonId && f.message.includes('forbidden'))
      if (!already) {
        findings.push({
          severity: 'error',
          lessonId,
          packFile: name,
          itemId: lessonId,
          kind: 'structure',
          message: 'forbidden leftover draft stub file still on disk',
        })
      }
    }
  }

  const errors = findings.filter((f) => f.severity === 'error')
  const warnings = findings.filter((f) => f.severity === 'warning')
  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      indexed: packs.length,
      gold: gold.length,
      draft: packs.filter((p) => p.tier === 'draft').length,
      errors: errors.length,
      warnings: warnings.length,
    },
    // Actionable: group top warning reasons for human spot-check triage
    warningReasons: Object.entries(
      warnings.reduce<Record<string, number>>((acc, f) => {
        acc[f.message] = (acc[f.message] ?? 0) + 1
        return acc
      }, {}),
    )
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([reason, count]) => ({ reason, count })),
    errors: errors.slice(0, 200),
    warnings: warnings.slice(0, 200),
  }

  mkdirSync(dirname(REPORT_PATH), { recursive: true })
  writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`)
  console.log(JSON.stringify({ reportPath: REPORT_PATH, ...report.summary, warningReasons: report.warningReasons }, null, 2))

  if (errors.length > 0) {
    console.error(`published learner pack validation failed: ${errors.length} error(s)`)
    for (const err of errors.slice(0, 25)) {
      console.error(`  [${err.lessonId}] ${err.message}${err.text ? ` — ${err.text}` : ''}`)
    }
    process.exit(1)
  }
}

main()
