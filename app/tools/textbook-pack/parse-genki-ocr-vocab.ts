/**
 * Parse Genki textbook OCR page text into vocabulary entries.
 * Handles Genki I table-style lines ("これ kore this one") and
 * Genki II interleaved kanji/reading/english blobs.
 */

export interface ParsedVocab {
  surface: string
  reading: string | null
  meaning: string
  pageNumber: number
}

const JP = /[\u3040-\u30ff\u4e00-\u9fff々ー]/
const ROMAJI_TOKEN = /^[A-Za-z][A-Za-z'.\-/]*$/
const SKIP_MEANINGS = /^(extracted from table|unknown|l\d+|words that appear)/i

/** Genki I style: optional *, surface, romaji, english gloss */
const LINE_RE =
  /(?:^|[\s*＊]+)([\u3040-\u30ff\u4e00-\u9fff々ー$\\=a-zA-Z0-9〜~（）()・\/]{1,24})\s+([a-z][a-z'.\-/]{1,28})\s+([A-Za-z][^]*?)(?=(?:\s*[*＊]\s*[\u3040-\u30ff])|(?:\s+[\u3040-\u30ff\u4e00-\u9fff々ー]{1,12}\s+[a-z][a-z'.\-/]{1,28}\s+[A-Za-z])|$)/g

/** Pair: kanji/kana + english, optional reading nearby */
const PAIR_RE =
  /([\u3040-\u30ff\u4e00-\u9fff々ー（）()〜~・\/]{1,20})\s+([A-Za-z][A-Za-z0-9 .;,'\-/()]{1,80}?)(?=\s+[\u3040-\u30ff\u4e00-\u9fff]|\s*$)/g

export function parseGenki1StyleLines(text: string, pageNumber: number): ParsedVocab[] {
  const normalized = text
    .replace(/\$\\a\$/g, 'ノート')
    .replace(/\$x=z=\$/g, 'メニュー')
    .replace(/jlinzu/g, 'jiinzu')
    .replace(/じてんしや/g, 'じてんしゃ')
    .replace(/ゆうびんきよく/g, 'ゆうびんきょく')
    .replace(/いらっしやいませ/g, 'いらっしゃいませ')

  const out: ParsedVocab[] = []
  const seen = new Set<string>()

  // Prefer line-oriented parse for clean vocab pages
  for (const rawLine of normalized.split(/\n+/)) {
    const line = rawLine.replace(/^[*＊\s]+/, '').trim()
    if (!line || /^(たんご|vocabulary|words that|useful|第\d|会話)/i.test(line)) continue

    // Pattern: surface romaji meaning  (may have leading *)
    const m = line.match(
      /^([\u3040-\u30ff\u4e00-\u9fff々ーノートメニュー$\\=a-zA-Z0-9〜~（）()・\/]{1,24})\s+([a-z][a-z'.\-/]{1,28})\s+(.+)$/i,
    )
    if (!m) continue
    let surface = cleanSurface(m[1])
    const reading = m[2].toLowerCase()
    let meaning = cleanMeaning(m[3])
    if (!surface || !meaning || SKIP_MEANINGS.test(meaning)) continue
    // Fix common OCR surface glitches using reading
    if (surface.includes('$') || /[A-Za-z]{3,}/.test(surface)) {
      surface = readingToKanaHint(reading) ?? surface
    }
    if (!JP.test(surface) || surface.length > 20) continue
    const key = `${surface}|${meaning}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ surface, reading, meaning, pageNumber })
  }

  // Fallback: global regex on blob
  if (out.length < 8) {
    let match: RegExpExecArray | null
    const re = new RegExp(LINE_RE.source, 'g')
    while ((match = re.exec(normalized)) !== null) {
      const surface = cleanSurface(match[1])
      const reading = match[2].toLowerCase()
      const meaning = cleanMeaning(match[3])
      if (!surface || !meaning || !JP.test(surface) || SKIP_MEANINGS.test(meaning)) continue
      const key = `${surface}|${meaning}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push({ surface, reading, meaning, pageNumber })
    }
  }

  return out
}

/**
 * Genki II style OCR: "大人 adult おとな 弁護士 べんごし lawyer"
 * Strategy: find English gloss runs, then look left for Japanese surface and optional kana reading.
 */
export function parseGenki2Interleaved(text: string, pageNumber: number): ParsedVocab[] {
  const out: ParsedVocab[] = []
  const seen = new Set<string>()
  const tokens = text
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)

  for (let i = 0; i < tokens.length; i += 1) {
    const tok = tokens[i]
    // Start of an English gloss (not romaji-only short, has letters)
    if (!/^[A-Za-z]/.test(tok)) continue
    if (ROMAJI_TOKEN.test(tok) && tok.length <= 12 && !/[A-Z]/.test(tok.slice(1))) {
      // likely romaji reading, skip as gloss start
      continue
    }

    // Collect english gloss tokens until next Japanese
    const glossParts: string[] = [tok]
    let j = i + 1
    while (j < tokens.length && !JP.test(tokens[j]) && !/^[*＊~～]/.test(tokens[j])) {
      // stop if next looks like a new JP-adjacent gloss start after punctuation-ish
      if (/^(U-verbs|Irregular|Adver|Numbers|W-|な-)/i.test(tokens[j])) break
      glossParts.push(tokens[j])
      j += 1
      if (glossParts.join(' ').length > 90) break
    }
    const meaning = cleanMeaning(glossParts.join(' '))
    if (!meaning || meaning.length < 2 || SKIP_MEANINGS.test(meaning)) continue
    if (!/[A-Za-z]{2,}/.test(meaning)) continue
    // Drop section headers mistaken as glosses
    if (/^(nouns?|verbs?|adjectives?|expressions?|times?|kilometers?)/i.test(meaning) && meaning.length < 20) continue

    // Look left for surface (Japanese) and optional reading
    let surface: string | null = null
    let reading: string | null = null
    for (let k = i - 1; k >= Math.max(0, i - 4); k -= 1) {
      const prev = tokens[k]
      if (/^[\u3040-\u309fー]+$/.test(prev) && prev.length >= 2) {
        reading = prev
        continue
      }
      if (JP.test(prev) && !/^[A-Za-z]/.test(prev)) {
        surface = cleanSurface(prev.replace(/^\*/, ''))
        break
      }
    }
    // Also check right for reading after gloss (大人 adult おとな)
    if (!reading && j < tokens.length && /^[\u3040-\u309fー]+$/.test(tokens[j])) {
      reading = tokens[j]
    }
    // Pattern: reading before kanji: おとな 大人 adult — already handled by left scan preferring JP

    if (!surface || surface.length > 20) continue
    // Prefer kana reading as surface when surface is kanji-only and reading exists? Keep kanji surface.
    const key = `${surface}|${meaning}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ surface, reading, meaning, pageNumber })
    i = j - 1
  }

  return out
}

/**
 * Genki I L3+ / many Genki II pages: "映画 えいが movie" or "スポーツ sports"
 * (kanji + kana reading + English, or katakana loanword + English).
 */
export function parseGenkiKanjiKanaGloss(text: string, pageNumber: number): ParsedVocab[] {
  const out: ParsedVocab[] = []
  const seen = new Set<string>()
  const normalized = text
    .replace(/[＊*]/g, ' * ')
    .replace(/\s+/g, ' ')
    .trim()

  // surface + hiragana/katakana reading + english gloss
  const withReading =
    /([\u3040-\u30ff\u4e00-\u9fff々ー]{1,16})\s+([\u3040-\u309fー]{1,16})\s+([A-Za-z][A-Za-z0-9 .;,'\-/()+~…]{1,70}?)(?=\s+(?:[\u3040-\u30ff\u4e00-\u9fff*]|$))/g
  // katakana (or mixed) surface + english, no separate reading
  const loanOrBare =
    /([\u30a0-\u30ffーA-Za-z0-9]{2,16}|[\u3040-\u30ff\u4e00-\u9fff々ー]{1,12})\s+([A-Za-z][A-Za-z0-9 .;,'\-/()+~…]{1,70}?)(?=\s+(?:[\u3040-\u30ff\u4e00-\u9fff*]|$))/g
  // reading-first: あした 明日 tomorrow
  const readingFirst =
    /([\u3040-\u309fー]{2,12})\s+([\u4e00-\u9fff々]{1,8})\s+([A-Za-z][A-Za-z0-9 .;,'\-/()+~…]{1,70}?)(?=\s+(?:[\u3040-\u30ff\u4e00-\u9fff*]|$))/g

  const push = (surface: string, reading: string | null, meaningRaw: string) => {
    const meaning = cleanMeaning(meaningRaw)
    if (!surface || !meaning || SKIP_MEANINGS.test(meaning)) return
    if (!JP.test(surface) || surface.length > 20) return
    if (!/[A-Za-z]{2,}/.test(meaning)) return
    if (meaning.length > 90) return
    if (/[\u3040-\u30ff\u4e00-\u9fff]{3,}/.test(meaning)) return
    if (/^(nouns?|verbs?|adjectives?|adverbs?|expressions?|places?|time|foods?|people|things|entertainment)/i.test(meaning))
      return
    // Drop OCR section crumbs
    if (/^(KO?\d|JE|EJ|U-v|Ru-|Irreg|W-ad|NoUns)/i.test(surface)) return
    const key = `${surface}|${meaning}`
    if (seen.has(key)) return
    seen.add(key)
    out.push({ surface: cleanSurface(surface), reading, meaning, pageNumber })
  }

  let match: RegExpExecArray | null
  const rf = new RegExp(readingFirst.source, 'g')
  while ((match = rf.exec(normalized)) !== null) {
    push(match[2], match[1], match[3])
  }
  const wr = new RegExp(withReading.source, 'g')
  while ((match = wr.exec(normalized)) !== null) {
    push(match[1], match[2], match[3])
  }
  const lb = new RegExp(loanOrBare.source, 'g')
  while ((match = lb.exec(normalized)) !== null) {
    // Skip if already captured via withReading (same surface+start of meaning)
    const surface = cleanSurface(match[1])
    if (out.some((item) => item.surface === surface)) continue
    // Prefer JP surfaces; allow katakana loans
    if (!JP.test(surface)) continue
    push(surface, null, match[2])
  }

  return out
}

/** Useful Expressions vocab: JP on one line / EN on next, or "口座 account" */
export function parseUsefulVocabBlocks(text: string, pageNumber: number): ParsedVocab[] {
  const out: ParsedVocab[] = []
  const seen = new Set<string>()
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean)

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]
    if (/useful|expressions|銀行|ATM|第\d/i.test(line) && !JP.test(line.slice(0, 2))) continue

    const inline = line.match(/^([\u3040-\u30ff\u4e00-\u9fff々ー]{1,12})\s+([A-Za-z][A-Za-z .;,'\-/()]{2,60})$/)
    if (inline) {
      const surface = cleanSurface(inline[1])
      const meaning = cleanMeaning(inline[2].replace(/[□0]+/g, '').trim())
      if (surface && meaning && !SKIP_MEANINGS.test(meaning)) {
        const key = `${surface}|${meaning}`
        if (!seen.has(key)) {
          seen.add(key)
          const reading = i + 1 < lines.length && /^[\u3040-\u309fー\s]+$/.test(lines[i + 1])
            ? lines[i + 1].replace(/\s+/g, '')
            : null
          out.push({ surface, reading, meaning, pageNumber })
        }
      }
      continue
    }

    // JP-only line followed by English-only line
    if (JP.test(line) && !/[A-Za-z]{3,}/.test(line) && line.length <= 12) {
      const next = lines[i + 1]
      if (next && /^[A-Za-z]/.test(next) && !JP.test(next)) {
        const surface = cleanSurface(line)
        const meaning = cleanMeaning(next.replace(/[□0]+/g, '').trim())
        const readingCandidate = lines[i + 2]
        const reading =
          readingCandidate && /^[\u3040-\u309fー\s]+$/.test(readingCandidate)
            ? readingCandidate.replace(/\s+/g, '')
            : null
        if (surface && meaning) {
          const key = `${surface}|${meaning}`
          if (!seen.has(key)) {
            seen.add(key)
            out.push({ surface, reading, meaning, pageNumber })
          }
        }
      }
    }
  }

  return out
}

export function dedupeVocab(items: ParsedVocab[]): ParsedVocab[] {
  const bySurface = new Map<string, ParsedVocab>()
  for (const item of items) {
    const existing = bySurface.get(item.surface)
    if (!existing) {
      bySurface.set(item.surface, item)
      continue
    }
    // Prefer longer/cleaner meaning and non-null reading
    const betterMeaning = item.meaning.length > existing.meaning.length ? item.meaning : existing.meaning
    bySurface.set(item.surface, {
      ...existing,
      meaning: betterMeaning,
      reading: existing.reading ?? item.reading,
    })
  }
  return [...bySurface.values()]
}

function cleanSurface(value: string): string {
  return value
    .replace(/^[*＊\s]+/, '')
    .replace(/[□■]/g, '')
    .replace(/\s+/g, '')
    .trim()
}

function cleanMeaning(value: string): string {
  return value
    .replace(/\bL\d+\b/g, '')
    .replace(/\(\s*~\s*を?\s*\)/g, '')
    .replace(/\s*;\s*/g, '; ')
    .replace(/\s+/g, ' ')
    .replace(/^[-:;,\s]+|[-:;,\s.]+$/g, '')
    .trim()
}

function readingToKanaHint(reading: string): string | null {
  const map: Record<string, string> = {
    menyuu: 'メニュー',
    nooto: 'ノート',
    jiinzu: 'ジーンズ',
    tiishatsu: 'Tシャツ',
    sumaho: 'スマホ',
  }
  return map[reading.toLowerCase()] ?? null
}
