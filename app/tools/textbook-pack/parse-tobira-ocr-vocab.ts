/**
 * Parse Tobira 単語表 OCR blobs into vocabulary entries.
 *
 * Tobira grouped pages often collapse the whole list into one dialogue_turn:
 *   "1地理 ちり Ngeography … 2皆さん N everyone 3大き(な) おおき(な) ANa big; large"
 */

export interface ParsedVocab {
  surface: string
  reading: string | null
  meaning: string
  pageNumber: number
}

const POS_TAGS = new Set([
  'N',
  'VN',
  'AN',
  'ANa',
  'Adv',
  'Suf',
  'Phr',
  'DemA',
  'DemP',
  'Conj',
  'Prt',
  'QW',
  'Da',
  'irr-A',
  'u-Vi',
  'u-Vt',
  'ru-Vi',
  'ru-Vt',
  'Ttl',
  'F',
  'Int',
])

const POS_PREFIX_RE =
  /^(N|VN|ANa?|Adv|Suf|Phr|DemA|DemP|Conj|Prt|QW|Da|irr-A|u-Vi|u-Vt|ru-Vi|ru-Vt|Ttl|F|Int)(.*)$/i

const JP = /[\u3040-\u30ff\u4e00-\u9fff]/
const KANA_ONLY = /^[\u3040-\u309fー（）()]+$/

function splitGluedReading(surface: string): { surface: string; reading: string | null } {
  const m = surface.match(
    /^([\u4e00-\u9fff々〜~（）()・／/\-]+(?:[（(][^）)]+[）)])?)([\u3040-\u309fー（）()]+)$/,
  )
  if (!m) return { surface, reading: null }
  return { surface: m[1], reading: m[2] }
}

function cleanMeaning(raw: string): string {
  return raw
    .replace(/\b(N|VN|ANa?|Adv|Suf|Phr|DemA|DemP|Conj|Prt|QW|Da|irr-A|u-Vi|u-Vt|ru-Vi|ru-Vt|Ttl|F|Int)\b/g, '')
    .replace(/\s+/g, ' ')
    .replace(/^[^A-Za-z(\[]+/, '')
    .trim()
}

function isEntryStart(token: string): boolean {
  return /^\d+[\u3040-\u30ff\u4e00-\u9fff〜~（）()]/.test(token) || /^\d+$/.test(token)
}

/**
 * Token-walk parser for Tobira 単語表 OCR text.
 */
export function parseTobiraVocabTable(text: string, pageNumber: number): ParsedVocab[] {
  const tokens = text
    .replace(/太字[=＝]?覚える単語/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)

  const out: ParsedVocab[] = []
  const seen = new Set<string>()

  for (let i = 0; i < tokens.length; i += 1) {
    const tok = tokens[i]
    let surface: string | null = null

    const glued = tok.match(/^(\d+)([\u3040-\u30ff\u4e00-\u9fff〜~（）()・／/\-].*)$/)
    if (glued) {
      surface = glued[2]
    } else if (/^\d+$/.test(tok) && tokens[i + 1] && JP.test(tokens[i + 1])) {
      surface = tokens[++i]
    } else {
      continue
    }

    let reading: string | null = null
    let j = i + 1

    if (tokens[j] && KANA_ONLY.test(tokens[j])) {
      reading = tokens[j]
      j += 1
    }

    let meaning = ''

    if (tokens[j]) {
      const pm = tokens[j].match(POS_PREFIX_RE)
      if (pm && POS_TAGS.has(pm[1])) {
        if (pm[2] && /[A-Za-z]/.test(pm[2])) {
          meaning = pm[2]
          j += 1
        } else {
          j += 1
        }
      }
    }

    while (j < tokens.length) {
      const t = tokens[j]
      if (isEntryStart(t)) break
      if (POS_TAGS.has(t) && meaning.length > 0) {
        j += 1
        continue
      }
      // Stray kana reading that landed before the next numbered entry
      if (KANA_ONLY.test(t) && meaning.length > 6) break
      if (JP.test(t) && !/^[A-Za-z(\[]/.test(t) && meaning.length > 10) break
      if (/^[A-Za-z(\[]/.test(t) || /^[;,:.'\-/)\]]$/.test(t) || meaning.length === 0) {
        meaning += (meaning ? ' ' : '') + t
        j += 1
        if (meaning.length > 100) break
        continue
      }
      break
    }

    meaning = cleanMeaning(meaning)
    if (!surface || !JP.test(surface) || surface.length > 28) {
      i = Math.max(i, j - 1)
      continue
    }
    if (meaning.length < 2 || meaning.length > 90 || !/[A-Za-z]{2,}/.test(meaning)) {
      i = Math.max(i, j - 1)
      continue
    }

    if (!reading) {
      const split = splitGluedReading(surface)
      surface = split.surface
      reading = split.reading
    }

    // Drop POS-only / junk surfaces
    if (/^(単語|たんご|会話文|読み物)$/i.test(surface)) {
      i = Math.max(i, j - 1)
      continue
    }

    const key = surface
    if (!seen.has(key)) {
      seen.add(key)
      out.push({ surface, reading, meaning: meaning.slice(0, 90), pageNumber })
    }
    i = Math.max(i, j - 1)
  }

  return out
}

export function qualityTobiraVocab(items: ParsedVocab[]): ParsedVocab[] {
  const seen = new Set<string>()
  const out: ParsedVocab[] = []
  for (const item of items) {
    let surface = item.surface.trim()
    let reading = item.reading?.trim() || null
    let meaning = item.meaning.trim()

    if (!surface || !JP.test(surface) || surface.length > 28) continue
    if (meaning.length < 2 || meaning.length > 90) continue
    if (!/[A-Za-z]{2,}/.test(meaning)) continue
    if (/[\u3040-\u30ff\u4e00-\u9fff]{4,}/.test(meaning)) continue
    if (/^(extracted|unknown|using tobira)/i.test(meaning)) continue
    // Surface still looks like "皆|さん" OCR split → drop dangling particles alone
    if (/^(は|が|を|に|で|と|も|の|な|さん)$/.test(surface)) continue

    if (!reading) {
      const split = splitGluedReading(surface)
      surface = split.surface
      reading = split.reading
    }

    // Prefer meanings that don't start mid-phrase
    meaning = meaning.replace(/^\|+\s*/, '').replace(/\s+/g, ' ').trim()
    if (meaning.length < 2) continue

    if (seen.has(surface)) continue
    seen.add(surface)
    out.push({ surface, reading, meaning, pageNumber: item.pageNumber })
  }
  return out
}

export function dedupeVocab(items: ParsedVocab[]): ParsedVocab[] {
  const seen = new Set<string>()
  const out: ParsedVocab[] = []
  for (const item of items) {
    const key = item.surface
    if (seen.has(key)) continue
    seen.add(key)
    out.push(item)
  }
  return out
}
