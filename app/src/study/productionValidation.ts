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
    const bare = fragment.replace(/^[~～〜]+/, '')
    if (!trimmed.includes(fragment) && !(bare && trimmed.includes(bare))) {
      return { ok: false, message: `Include「${bare || fragment}」in your sentence.` }
    }
  }

  return { ok: true, message: 'Looks like real output.' }
}

function isUsableSpeakFragment(value: string | undefined | null): value is string {
  if (!value?.trim()) return false
  const trimmed = value.trim()
  // Schema placeholders like "XはYです" / "~さん" are not learner production targets.
  if (/[A-Za-z]/.test(trimmed)) return false
  if (/^([~～〜])+/.test(trimmed)) return false
  return trimmed.length <= 12
}

export function speakRequiredFragments(grammar: GrammarItem[], vocab: { surface: string }[]): string[] {
  const pattern = grammar.find(g => g.pattern?.trim())?.pattern?.trim()
  // Prefer a concrete vocab stem over attachment placeholders like ~さん.
  const surface = vocab
    .map(v => v.surface?.trim())
    .find(value => isUsableSpeakFragment(value))
    ?? vocab.find(v => v.surface?.trim())?.surface?.trim()?.replace(/^[~～〜]+/, '')
  if (isUsableSpeakFragment(pattern)) return [pattern]
  if (surface) return [surface.replace(/^[~～〜]+/, '')]
  return []
}

export function validateWorkbookTask(response: string, minChars = 5): ProductionValidationResult {
  return validateJapaneseProduction(response, { minChars })
}
