import type { QuizQuestion, TeachItem } from './lessonStudyPlanner'

const KANA_RE = /[\u3040-\u309F\u30A0-\u30FF\uFF66-\uFF9D]/
const KANJI_RE = /[\u4E00-\u9FFF]/
/** Genki-style attachment placeholder: ~ / ～ / 〜 */
const ATTACHMENT_PREFIX_RE = /^[~～〜]+/

/** Strip textbook attachment placeholders (~さん → さん). */
export function stripAttachmentPrefix(value: string): string {
  return value.replace(ATTACHMENT_PREFIX_RE, '')
}

export function isAttachmentSurface(value: string): boolean {
  return ATTACHMENT_PREFIX_RE.test(value.trim())
}

/** Normalize typed Japanese for comparison (spaces, width, kana fold, ~prefix). */
export function normalizeTypedAnswer(value: string): string {
  return stripAttachmentPrefix(
    toHiragana(value.normalize('NFKC')).trim().replace(/\s+/g, ''),
  )
}

/** Fold katakana (incl. half-width) into hiragana for grading. */
export function toHiragana(value: string): string {
  let out = ''
  for (const ch of value) {
    const code = ch.codePointAt(0) ?? 0
    // Katakana block → hiragana
    if (code >= 0x30a1 && code <= 0x30f6) {
      out += String.fromCodePoint(code - 0x60)
      continue
    }
    out += ch
  }
  return out
}

export function isMostlyKana(value: string): boolean {
  const compact = stripAttachmentPrefix(value.replace(/\s+/g, ''))
  if (!compact) return false
  let kana = 0
  let other = 0
  for (const ch of compact) {
    if (KANA_RE.test(ch) || ch === 'ー' || ch === 'ｰ' || ch === '・') kana += 1
    else if (/[a-zA-Z0-9]/.test(ch)) other += 1
    else if (KANJI_RE.test(ch)) other += 1
    else other += 1
  }
  return kana > 0 && kana >= other
}

export interface GradeTypedRecallOptions {
  /** Extra acceptable forms (e.g. IME reading before kanji conversion, card.reading). */
  alsoAccept?: Array<string | null | undefined>
}

/** Shared grader for typed recall and MCQ option comparison. */
export function answersMatch(
  answer: string,
  correct: string,
  options: GradeTypedRecallOptions = {},
): boolean {
  const a = normalizeTypedAnswer(answer)
  const c = normalizeTypedAnswer(correct)
  if (!a || !c) return false
  if (a === c) return true

  const alts = (options.alsoAccept ?? [])
    .map(value => (value == null ? '' : normalizeTypedAnswer(value)))
    .filter(Boolean)

  for (const alt of alts) {
    // Typed form matches an accepted alternate (e.g. card reading).
    if (a === alt) return true
    // IME reading matches expected answer AND final text looks like a kanji conversion
    // of that reading (not a later unrelated edit that left a stale composition buffer).
    if (alt === c && a !== alt && KANJI_RE.test(answer)) return true
  }
  return false
}

/** One free-recall item per checkpoint chunk (English → type Japanese). */
export function buildTypedRecallQuestion(item: TeachItem, salt: string): QuizQuestion | null {
  if (item.type !== 'vocab') return null
  const surface = item.title
  const bare = stripAttachmentPrefix(surface)
  const kanaOnly = isMostlyKana(bare) && !KANJI_RE.test(bare)
  const attachment = isAttachmentSurface(surface)
  return {
    itemId: `${item.id}:typed`,
    type: 'vocab',
    prompt: item.body,
    promptLabel: attachment
      ? `Type the Japanese ending (e.g. ${bare} — the ~ is only a textbook placeholder)`
      : kanaOnly
        ? 'Type the Japanese in kana (IME kanji conversion is OK)'
        : 'Type the Japanese (free recall)',
    correctAnswer: surface,
    options: [],
    recallMode: 'typed',
  }
}

export function gradeTypedRecall(
  answer: string,
  correct: string,
  options: GradeTypedRecallOptions = {},
): boolean {
  return answersMatch(answer, correct, options)
}

/**
 * Keep the last kana-only IME composition string.
 * When the keyboard converts だいがく → 大学, grading can still match the kana reading.
 */
export function rememberImeKanaReading(previous: string, composition: string): string {
  const next = composition.trim()
  if (!next) return previous
  if (isMostlyKana(next)) return next
  return previous
}

export function injectTypedRecall(questions: QuizQuestion[], chunkItems: TeachItem[], salt: string): QuizQuestion[] {
  const typedTarget = chunkItems.find(i => i.type === 'vocab')
  if (!typedTarget) return questions
  const typed = buildTypedRecallQuestion(typedTarget, salt)
  if (!typed) return questions
  if (questions.some(q => q.recallMode === 'typed')) return questions
  return [typed, ...questions.slice(0, 3)]
}
