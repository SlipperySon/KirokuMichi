import type { GrammarItem } from './lessonStudyPlanner'

const JAPANESE_RE = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/

export interface ProductionValidationResult {
  ok: boolean
  message: string
}

/** Minimum pushed output: real Japanese characters, not romaji-only. */
export function validateJapaneseProduction(
  text: string,
  options?: { minChars?: number; requiredFragments?: string[] },
): ProductionValidationResult {
  const trimmed = text.trim()
  const minChars = options?.minChars ?? 3

  if (trimmed.length < minChars) {
    return { ok: false, message: `Write at least ${minChars} characters in Japanese.` }
  }
  if (!JAPANESE_RE.test(trimmed)) {
    return { ok: false, message: 'Include Japanese script (hiragana, katakana, or kanji) — romaji alone does not count as production.' }
  }

  const required = (options?.requiredFragments ?? []).filter(Boolean)
  for (const fragment of required) {
    if (!trimmed.includes(fragment)) {
      return { ok: false, message: `Include「${fragment}」in your sentence.` }
    }
  }

  return { ok: true, message: 'Looks like real output.' }
}

export function speakRequiredFragments(grammar: GrammarItem[], vocab: { surface: string }[]): string[] {
  const pattern = grammar.find(g => g.pattern?.trim())?.pattern?.trim()
  const surface = vocab.find(v => v.surface?.trim())?.surface?.trim()
  if (pattern) return [pattern]
  if (surface) return [surface]
  return []
}

export function validateWorkbookTask(response: string, minChars = 5): ProductionValidationResult {
  return validateJapaneseProduction(response, { minChars })
}
