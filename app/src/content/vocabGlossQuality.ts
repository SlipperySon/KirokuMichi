/**
 * Shared vocab gloss quality gates for learner overlays and pack repair.
 * Keep teach/check prompts free of OCR scars and obscure intended answers.
 */

const ADMIN_OR_SOURCE_TEXT_RE =
  /(table of contents|copyright|isbn|publisher|answer key|https|www\.|audio file|using tobira|文法項目|読み書き編|構成されています|必要に応じて|聞く練習|漢字の練習|Listening Comprehension|KanjiPractice|Introduction\d|Conversation and Grammar section|corresponding lesson)/i

const STRUCTURAL_JUNK_RE = /([A-Za-z]{22,}|\d{4,}|[{}[\]\\<>|]{2,}|©|\bFAX\b|\bISBN\b)/
const OCR_LETTER_SPACING_RE = /(?:^|[^A-Za-z])(?:[A-Za-z] ){3,}[A-Za-z](?:$|[^A-Za-z])/
const OCR_SCAR_RE =
  /Pr a c|toget\b|→|Lesson\s*\d+|んt\.|He a I t h|N u m b e r s|Dictionary form Present|aff\s*rmative|To recap the rules|Please read the textbook|belongs to which class|U - verbs|I-verbs|Ru-?\s*verb|In Japanese Cla s s|At the Ba n k|G r m m a r/i
const NI_SCAR_RE = /[l1I]\s*[二ニ]|[二ニ]\s*[)）]|~\s*1二|l二|ね二|^1二$|^二$/
const JP_RE = /[\u3040-\u30ff\u4e00-\u9fff]/
const SENTENCE_SURFACE_RE = /[。！？!?]|を|は|が/
const KANA_FRAGMENT_RE = /^[\u3040-\u30ff・]$/

export type VocabGlossIssue =
  | 'empty_surface'
  | 'empty_gloss'
  | 'no_latin_gloss'
  | 'admin_source_text'
  | 'structural_junk'
  | 'ocr_letter_spacing'
  | 'known_ocr_scar'
  | 'ocr_ni_scar'
  | 'jp_in_english_gloss'
  | 'sentence_as_vocab_surface'
  | 'kana_fragment_obscure'
  | 'arrow_spill'
  | 'corrupt_entry'

export function normalizeGlossText(value: string | null | undefined): string {
  return String(value ?? '')
    .normalize('NFKC')
    .trim()
}

/** Particle hints like (~が) / （を） are intentional; strip before JP spill checks. */
export function stripParticleHints(meaning: string): string {
  return meaning
    .replace(/[（(][~～\-]*[\u3040-\u30ffをがにへでとからよりの][)）]/g, '')
    .replace(/（[^）]*）/g, '')
}

export function vocabGlossIssues(surfaceRaw: string, meaningRaw: string): VocabGlossIssue[] {
  const surface = normalizeGlossText(surfaceRaw)
  const meaning = normalizeGlossText(meaningRaw)
  const issues: VocabGlossIssue[] = []

  if (!surface) issues.push('empty_surface')
  if (!meaning || meaning.length < 2) issues.push('empty_gloss')
  if (meaning && !/[A-Za-z]/.test(meaning)) issues.push('no_latin_gloss')
  if (ADMIN_OR_SOURCE_TEXT_RE.test(meaning) || ADMIN_OR_SOURCE_TEXT_RE.test(surface)) {
    issues.push('admin_source_text')
  }
  if (STRUCTURAL_JUNK_RE.test(meaning)) issues.push('structural_junk')
  if (OCR_LETTER_SPACING_RE.test(meaning)) issues.push('ocr_letter_spacing')
  if (OCR_SCAR_RE.test(meaning) || OCR_SCAR_RE.test(surface)) issues.push('known_ocr_scar')
  if (NI_SCAR_RE.test(meaning) || NI_SCAR_RE.test(surface)) issues.push('ocr_ni_scar')

  const stripped = stripParticleHints(meaning)
  if (JP_RE.test(stripped)) issues.push('jp_in_english_gloss')
  if (/=>/.test(meaning)) issues.push('arrow_spill')

  if (
    /[。！？!?]/.test(surface) ||
    (surface.length >= 10 && SENTENCE_SURFACE_RE.test(surface) && JP_RE.test(surface))
  ) {
    issues.push('sentence_as_vocab_surface')
  }

  if (
    KANA_FRAGMENT_RE.test(surface) &&
    (meaning.length > 18 ||
      /^(and|to|why|actions|please)/i.test(meaning) ||
      OCR_SCAR_RE.test(meaning))
  ) {
    issues.push('kana_fragment_obscure')
  }

  if (
    (surface === '水' && /^all$/i.test(meaning)) ||
    (surface === '会' && /^to$/i.test(meaning)) ||
    (surface === '西' && /^OFC$/i.test(meaning)) ||
    (surface === 'と' && /^why$/i.test(meaning)) ||
    surface === '元元' ||
    surface === 'ね二' ||
    surface === '兴' ||
    surface === '・'
  ) {
    issues.push('corrupt_entry')
  }

  return issues
}

/** True when surface+meaning are safe to teach / check. */
export function isLearnerSafeVocab(surface: string, meaning: string): boolean {
  return vocabGlossIssues(surface, meaning).length === 0
}

/** Latin / schematic grammar labels that cannot be exact-cloze filled. */
export function isSchemaGrammarPattern(pattern: string): boolean {
  const p = normalizeGlossText(pattern)
  if (!p) return true
  if (/[A-Za-z]/.test(p)) return true
  if (/Noun|Verb|Adj|Question Sentences|XはY/i.test(p)) return true
  return false
}

/**
 * Find a fillable Japanese span for cloze from a pattern + example.
 * Returns null when cloze would be obscure (e.g. Latin schemas like XはYです).
 */
export function resolveGrammarCloze(
  pattern: string,
  exampleJapanese: string | null | undefined,
): { prompt: string; answer: string } | null {
  const example = normalizeGlossText(exampleJapanese)
  const raw = normalizeGlossText(pattern)
  if (!example || !raw) return null

  if (example.includes(raw)) {
    return { prompt: example.replace(raw, '[___]'), answer: raw }
  }

  const candidates: string[] = []
  for (const part of raw.split(/[・･\/]/)) {
    const cleaned = part
      .replace(/^[~～〜]+/, '')
      .replace(/\s*\+.*$/, '')
      .replace(/\s*\(.*$/, '')
      .trim()
    if (cleaned && !/[A-Za-z]/.test(cleaned)) candidates.push(cleaned)
  }

  // Explicit attachment markers in labels ("Question Sentences: ~か").
  const attachments = raw.match(/[~～〜]([\u3040-\u30ff\u4e00-\u9fffー]+)/g) ?? []
  for (const bit of attachments) {
    candidates.push(bit.replace(/^[~～〜]+/, ''))
  }

  // Latin / schematic labels: do not fish for incidental です/は inside XはYです.
  if (isSchemaGrammarPattern(raw)) {
    const uniqueSchema = [...new Set(candidates)].sort((a, b) => b.length - a.length)
    for (const answer of uniqueSchema) {
      if (answer.length >= 1 && example.includes(answer)) {
        return { prompt: example.replace(answer, '[___]'), answer }
      }
    }
    return null
  }

  const jpBits = raw.match(/[\u3040-\u30ff\u4e00-\u9fffー]+/g) ?? []
  for (const bit of jpBits) candidates.push(bit)

  const unique = [...new Set(candidates)].sort((a, b) => b.length - a.length)
  for (const answer of unique) {
    if (answer.length >= 1 && example.includes(answer)) {
      return { prompt: example.replace(answer, '[___]'), answer }
    }
  }
  return null
}
