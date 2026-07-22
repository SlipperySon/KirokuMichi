/**
 * Build Genki I/II gold learner packs from OCR vocab pages + comprehensive grammar/dialogues.
 *
 * Always rebuilds:
 *   - Genki I Lesson 2 (seed + OCR)
 *   - Genki II Lesson 13 (seed + OCR)
 * Plus auto OCR enrich for Genki I L3–12 and Genki II L14–23 when grouped pages exist.
 *
 * Usage (from app/):
 *   npx tsx tools/textbook-pack/build-genki-l2-and-enrich-l13.ts
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import {
  dedupeVocab,
  parseGenki1StyleLines,
  parseGenki2Interleaved,
  parseGenkiKanjiKanaGloss,
  parseUsefulVocabBlocks,
  type ParsedVocab,
} from './parse-genki-ocr-vocab.ts'

const appRoot = process.cwd()
const grouped = (book: string, page: number) =>
  path.join(appRoot, `tools/textbook-pack/out/grouped/${book}/pages/page-${String(page).padStart(4, '0')}.json`)
const reviewedDir = path.join(appRoot, 'tools/textbook-pack/out/reviewed-packs')
const correctionsDir = path.join(appRoot, 'tools/textbook-pack/corrections')
const textbooksDir = path.join(appRoot, 'data/generated/textbooks')
const manifestPath = path.join(appRoot, 'tools/textbook-pack/out/source-manifest.json')

interface GroupedPage {
  pageNumber: number
  sourceId?: string
  blocks?: Array<{ text?: string }>
}

interface LessonHint {
  lessonNumber: number
  pageNumber: number
  label: string
}

function reviewStamp(notes: string) {
  return {
    action: 'approved' as const,
    reviewedAt: new Date().toISOString(),
    reviewer: 'ocr_vocab_enrich',
    notes,
  }
}

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, 'utf8')) as T
}

async function readPage(book: string, page: number): Promise<{ pageNumber: number; text: string; sourceId: string } | null> {
  try {
    const data = JSON.parse(await readFile(grouped(book, page), 'utf8')) as GroupedPage
    const text = (data.blocks ?? []).map((b) => b.text ?? '').join('\n')
    return { pageNumber: data.pageNumber ?? page, text, sourceId: data.sourceId ?? book }
  } catch {
    return null
  }
}

function qualityVocab(items: ParsedVocab[]): ParsedVocab[] {
  const seen = new Set<string>()
  const out: ParsedVocab[] = []
  for (const item of items) {
    const surface = item.surface?.trim()
    const meaning = item.meaning?.trim()
    if (!surface || !meaning) continue
    if (!/[\u3040-\u30ff\u4e00-\u9fff]/.test(surface) || surface.length > 20) continue
    if (/^(単語|たんご|单|語|ご|Vocab|Nouns?|Verbs?|KO?\d)/i.test(surface)) continue
    if (meaning.length < 2 || meaning.length > 80) continue
    if (!/[A-Za-z]{2,}/.test(meaning)) continue
    if (/[\u3040-\u30ff\u4e00-\u9fff]{3,}/.test(meaning)) continue
    if (/^(extracted|unknown|KO?\d|b\s*U|NoUns|U-v|Ru-|W-ad|Irreg)/i.test(meaning)) continue
    if (/^(nouns?|verbs?|adjectives?|adverbs?|expressions?|places?|time|foods?)\b/i.test(meaning)) continue
    // Drop romaji-echo meanings from mixed parsers ("kore this one")
    if (/^[a-z]{2,12}\s+[A-Za-z]/.test(meaning) && item.reading === meaning.split(/\s+/)[0]) continue
    const key = surface
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ ...item, surface, meaning })
  }
  return out
}

function toVocabEntries(
  items: ParsedVocab[],
  idPrefix: string,
  lessonNumber: number,
  sourceId: string,
  notes: string,
) {
  return items.map((item, i) => ({
    id: `${idPrefix}_vocab_${i + 1}`,
    surface: item.surface,
    reading: item.reading,
    meaning: item.meaning,
    lessonNumber,
    sourceRef: { sourceId, pageNumber: item.pageNumber },
    tags: ['gold_ocr'],
    review: reviewStamp(notes),
  }))
}

function scoreVocabPage(text: string): number {
  let score = 0
  if (/単語|たんご|Vocabulary|V\s*o\s*c\s*a\s*b/i.test(text)) score += 2
  if (/Nouns|U-verbs|Ru-verbs|な-adjectives|Adjectives|Adverbs|Expressions/i.test(text)) score += 2
  if ((text.match(/[a-z]{3,}\s+[A-Z][a-z]/g) ?? []).length > 3) score += 1
  if ((text.match(/[\u4e00-\u9fff]{1,6}\s+[\u3040-\u309fー]{1,10}\s+[A-Za-z]/g) ?? []).length >= 3) score += 2
  return score
}

async function findVocabPages(book: string, lessonStart: number, lessonEnd: number): Promise<number[]> {
  const hits: Array<{ page: number; score: number }> = []
  const scanEnd = Math.min(lessonStart + 8, lessonEnd)
  for (let page = lessonStart; page <= scanEnd; page += 1) {
    const data = await readPage(book, page)
    if (!data) continue
    const score = scoreVocabPage(data.text)
    if (score >= 2) hits.push({ page, score })
  }
  if (hits.length === 0) return []
  // Prefer contiguous run starting at first strong hit
  const first = hits[0].page
  const pages = [first]
  for (const hit of hits.slice(1)) {
    if (hit.page === pages[pages.length - 1] + 1) pages.push(hit.page)
    else if (pages.length >= 2) break
  }
  // Also pick up useful-expression pages later in the lesson (optional)
  for (let page = first + 4; page <= Math.min(lessonEnd, first + 28); page += 1) {
    const data = await readPage(book, page)
    if (!data) continue
    if (/Useful Expressions|便利な表現/i.test(data.text) && /[\u3040-\u30ff\u4e00-\u9fff]/.test(data.text)) {
      pages.push(page)
    }
  }
  return [...new Set(pages)]
}

async function loadLessonHints(book: string): Promise<LessonHint[]> {
  const manifest = await readJson<{
    entries: Array<{
      id: string
      pageCount: number
      splitHints: Array<{ kind: string; lessonNumber?: number | null; pageNumber?: number | null; label?: string }>
    }>
  }>(manifestPath)
  const entry = manifest.entries.find((e) => e.id === book)
  if (!entry) return []
  const maxConversationPage = book === 'genki_1_textbook' ? 300 : 280
  return entry.splitHints
    .filter(
      (h) =>
        h.kind === 'lesson' &&
        h.lessonNumber != null &&
        h.pageNumber != null &&
        h.pageNumber < maxConversationPage,
    )
    .map((h) => ({
      lessonNumber: h.lessonNumber!,
      pageNumber: h.pageNumber!,
      label: h.label ?? `Lesson ${h.lessonNumber}`,
    }))
    .sort((a, b) => a.pageNumber - b.pageNumber)
}

async function loadCurriculumExtras(
  textbookFile: string,
  lessonTags: string[],
  lessonNumber: number,
  sourceId: string,
  idPrefix: string,
) {
  const curriculum = await readJson<{
    grammar?: Array<Record<string, unknown>>
    dialogues?: Array<Record<string, unknown>>
    exercises?: Array<Record<string, unknown>>
  }>(path.join(textbooksDir, textbookFile))

  const match = (lesson: string) =>
    lessonTags.includes(lesson) || lessonTags.some((t) => lesson === t || lesson.endsWith(`_${t}`))

  const grammar = (curriculum.grammar ?? [])
    .filter((g) => match(String(g.lesson ?? '')))
    .map((g, i) => ({
      id: `${idPrefix}_grammar_${i + 1}`,
      pattern: String(g.pattern ?? g.title ?? ''),
      meaning: String(g.meaning ?? ''),
      explanation: g.explanation,
      examples: Array.isArray(g.examples) ? g.examples : [],
      lessonNumber,
      sourceRef: {
        sourceId,
        pageNumber: Math.max(1, Number(g.page ?? 0) || 1),
      },
      review: reviewStamp('from comprehensive; source remapped'),
    }))
    .filter((g) => g.pattern.trim().length >= 1)
    .slice(0, 24)

  const contentBlocks = (curriculum.dialogues ?? [])
    .filter((d) => match(String(d.lesson ?? '')))
    .slice(0, 12)
    .map((d, i) => {
      const lines = Array.isArray(d.lines) ? (d.lines as Array<{ speaker?: string; japanese?: string }>) : []
      const text = lines
        .map((line) => `${line.speaker ? `${line.speaker}: ` : ''}${line.japanese ?? ''}`.trim())
        .filter(Boolean)
        .join('\n')
      return {
        id: `${idPrefix}_dialogue_${i + 1}`,
        type: 'dialogue' as const,
        title: String(d.title ?? `Dialogue ${i + 1}`),
        text,
        sourceRef: {
          sourceId,
          pageNumber: Math.max(1, Number(d.page ?? 0) || 1),
        },
        review: reviewStamp('dialogue from comprehensive'),
      }
    })
    .filter((b) => /[\u3040-\u30ff\u4e00-\u9fff]/.test(b.text))

  const exercises = (curriculum.exercises ?? [])
    .filter((e) => match(String(e.lesson ?? '')))
    .slice(0, 20)
    .map((e, i) => ({
      id: `${idPrefix}_ex_${i + 1}`,
      label: String(e.type ?? 'exercise'),
      prompt: String(e.question ?? ''),
      sourceRef: {
        sourceId: String(e.source ?? '').includes('workbook')
          ? sourceId.replace('_textbook', '_workbook')
          : sourceId,
        pageNumber: Math.max(1, Number(e.page ?? 0) || 1),
      },
      review: reviewStamp('exercise from comprehensive'),
    }))
    .filter((e) => e.prompt.trim().length >= 2)

  return { grammar, contentBlocks, exercises }
}

async function loadSources(sourceIds: string[]) {
  const manifest = await readJson<{
    entries: Array<{ id: string; role: string; fingerprint: { sha256: string; bytes: number } }>
  }>(manifestPath)
  return sourceIds
    .map((id) => {
      const entry = manifest.entries.find((e) => e.id === id)
      if (!entry) return { sourceId: id, role: id.includes('workbook') ? 'workbook' : 'textbook' }
      return { sourceId: entry.id, role: entry.role, fingerprint: entry.fingerprint }
    })
}

function parsePages(texts: Array<{ pageNumber: number; text: string }>, mode: 'genki1_early' | 'genki_kana') {
  const items: ParsedVocab[] = []
  for (const page of texts) {
    if (mode === 'genki1_early') {
      items.push(...parseGenki1StyleLines(page.text, page.pageNumber))
    } else {
      items.push(
        ...parseGenkiKanjiKanaGloss(page.text, page.pageNumber),
        ...parseGenki2Interleaved(page.text, page.pageNumber),
        ...parseUsefulVocabBlocks(page.text, page.pageNumber),
      )
    }
  }
  return qualityVocab(dedupeVocab(items))
}

/** Hand-verified fills for OCR gaps (Genki I L2 3rd ed.). */
const GENKI_1_L2_SEED: ParsedVocab[] = [
  { surface: 'これ', reading: 'kore', meaning: 'this one', pageNumber: 58 },
  { surface: 'それ', reading: 'sore', meaning: 'that one', pageNumber: 58 },
  { surface: 'あれ', reading: 'are', meaning: 'that one (over there)', pageNumber: 58 },
  { surface: 'どれ', reading: 'dore', meaning: 'which one', pageNumber: 58 },
  { surface: 'この', reading: 'kono', meaning: 'this ...', pageNumber: 58 },
  { surface: 'その', reading: 'sono', meaning: 'that ...', pageNumber: 58 },
  { surface: 'あの', reading: 'ano', meaning: 'that ... (over there)', pageNumber: 58 },
  { surface: 'どの', reading: 'dono', meaning: 'which ...', pageNumber: 58 },
  { surface: 'ここ', reading: 'koko', meaning: 'here', pageNumber: 58 },
  { surface: 'そこ', reading: 'soko', meaning: 'there', pageNumber: 58 },
  { surface: 'あそこ', reading: 'asoko', meaning: 'over there', pageNumber: 58 },
  { surface: 'どこ', reading: 'doko', meaning: 'where', pageNumber: 58 },
  { surface: 'だれ', reading: 'dare', meaning: 'who', pageNumber: 58 },
  { surface: 'おいしい', reading: 'oishii', meaning: 'delicious', pageNumber: 58 },
  { surface: 'さかな', reading: 'sakana', meaning: 'fish', pageNumber: 58 },
  { surface: 'とんかつ', reading: 'tonkatsu', meaning: 'pork cutlet', pageNumber: 58 },
  { surface: 'にく', reading: 'niku', meaning: 'meat', pageNumber: 58 },
  { surface: 'メニュー', reading: 'menyuu', meaning: 'menu', pageNumber: 58 },
  { surface: 'やさい', reading: 'yasai', meaning: 'vegetable', pageNumber: 58 },
  { surface: 'かさ', reading: 'kasa', meaning: 'umbrella', pageNumber: 58 },
  { surface: 'かばん', reading: 'kaban', meaning: 'bag', pageNumber: 58 },
  { surface: 'くつ', reading: 'kutsu', meaning: 'shoes', pageNumber: 58 },
  { surface: 'さいふ', reading: 'saifu', meaning: 'wallet', pageNumber: 58 },
  { surface: 'ジーンズ', reading: 'jiinzu', meaning: 'jeans', pageNumber: 58 },
  { surface: 'じてんしゃ', reading: 'jitensha', meaning: 'bicycle', pageNumber: 58 },
  { surface: 'しんぶん', reading: 'shinbun', meaning: 'newspaper', pageNumber: 58 },
  { surface: 'スマホ', reading: 'sumaho', meaning: 'smartphone; mobile phone', pageNumber: 58 },
  { surface: 'Tシャツ', reading: 'tiishatsu', meaning: 'T-shirt', pageNumber: 58 },
  { surface: 'とけい', reading: 'tokee', meaning: 'watch; clock', pageNumber: 58 },
  { surface: 'ノート', reading: 'nooto', meaning: 'notebook', pageNumber: 58 },
  { surface: 'ペン', reading: 'pen', meaning: 'pen', pageNumber: 59 },
  { surface: 'ぼうし', reading: 'booshi', meaning: 'hat; cap', pageNumber: 59 },
  { surface: 'ほん', reading: 'hon', meaning: 'book', pageNumber: 59 },
  { surface: 'ぎんこう', reading: 'ginkoo', meaning: 'bank', pageNumber: 59 },
  { surface: 'コンビニ', reading: 'konbini', meaning: 'convenience store', pageNumber: 59 },
  { surface: 'トイレ', reading: 'toire', meaning: 'toilet; restroom', pageNumber: 59 },
  { surface: 'としょかん', reading: 'toshokan', meaning: 'library', pageNumber: 59 },
  { surface: 'ゆうびんきょく', reading: 'yuubinkyoku', meaning: 'post office', pageNumber: 59 },
  { surface: 'いくら', reading: 'ikura', meaning: 'how much', pageNumber: 59 },
  { surface: '~えん', reading: '...en', meaning: '... yen', pageNumber: 59 },
  { surface: 'たかい', reading: 'takai', meaning: 'expensive; high', pageNumber: 59 },
  { surface: 'いらっしゃいませ', reading: 'irasshaimase', meaning: 'Welcome (to our store)', pageNumber: 59 },
  { surface: '(~を)おねがいします', reading: '(...o) onegaishimasu', meaning: '..., please', pageNumber: 59 },
  { surface: '(~を)ください', reading: '(...o) kudasai', meaning: 'Please give me ...', pageNumber: 59 },
  { surface: 'じゃあ', reading: 'jaa', meaning: 'then ...; if that is the case', pageNumber: 59 },
  { surface: 'どうぞ', reading: 'doozo', meaning: 'Please.; Here it is.', pageNumber: 59 },
  { surface: 'どうも', reading: 'doomo', meaning: 'Thank you.', pageNumber: 59 },
]

const GENKI_1_L2_GRAMMAR = [
  {
    id: 'genki_1_l2_grammar_1',
    pattern: 'これ／それ／あれ／どれ',
    meaning: 'this / that (near you) / that (over there) / which (as pronouns)',
    explanation: 'Standalone demonstratives for things. Followed by は／が／を, not by a noun.',
    examples: [{ japanese: 'これはいくらですか。', english: 'How much is this?' }],
    lessonNumber: 2,
    sourceRef: { sourceId: 'genki_1_textbook', pageNumber: 60 },
    review: reviewStamp('Genki I L2 grammar'),
  },
  {
    id: 'genki_1_l2_grammar_2',
    pattern: 'この／その／あの／どの + Noun',
    meaning: 'this/that/which + noun',
    explanation: 'Demonstrative adjectives; must be followed by a noun (people or things).',
    examples: [{ japanese: 'このとけいはいくらですか。', english: 'How much is this watch?' }],
    lessonNumber: 2,
    sourceRef: { sourceId: 'genki_1_textbook', pageNumber: 61 },
    review: reviewStamp('Genki I L2 grammar'),
  },
  {
    id: 'genki_1_l2_grammar_3',
    pattern: 'ここ／そこ／あそこ／どこ',
    meaning: 'here / there / over there / where',
    explanation: 'Place demonstratives.',
    examples: [{ japanese: 'ゆうびんきょくはどこですか。', english: 'Where is the post office?' }],
    lessonNumber: 2,
    sourceRef: { sourceId: 'genki_1_textbook', pageNumber: 62 },
    review: reviewStamp('Genki I L2 grammar'),
  },
  {
    id: 'genki_1_l2_grammar_4',
    pattern: 'だれの Noun',
    meaning: "whose + noun",
    explanation: 'Ask about possession with だれの.',
    examples: [{ japanese: 'これはだれのかばんですか。', english: 'Whose bag is this?' }],
    lessonNumber: 2,
    sourceRef: { sourceId: 'genki_1_textbook', pageNumber: 62 },
    review: reviewStamp('Genki I L2 grammar'),
  },
  {
    id: 'genki_1_l2_grammar_5',
    pattern: 'Noun も',
    meaning: 'Noun too / also',
    explanation: 'も replaces は／が／を on the item that is likewise true.',
    examples: [{ japanese: 'ゆいさんもにほんじんです。', english: 'Yui is Japanese too.' }],
    lessonNumber: 2,
    sourceRef: { sourceId: 'genki_1_textbook', pageNumber: 63 },
    review: reviewStamp('Genki I L2 grammar'),
  },
  {
    id: 'genki_1_l2_grammar_6',
    pattern: 'Noun じゃないです',
    meaning: 'is not Noun',
    explanation: 'Colloquial negation of XはYです. Formal variant: じゃありません.',
    examples: [{ japanese: 'やまださんはがくせいじゃないです。', english: 'Mr. Yamada is not a student.' }],
    lessonNumber: 2,
    sourceRef: { sourceId: 'genki_1_textbook', pageNumber: 63 },
    review: reviewStamp('Genki I L2 grammar'),
  },
]

/** Genki II L13 seed for items OCR often mangles. */
const GENKI_2_L13_SEED: ParsedVocab[] = [
  { surface: '大人', reading: 'おとな', meaning: 'adult', pageNumber: 24 },
  { surface: '弁護士', reading: 'べんごし', meaning: 'lawyer', pageNumber: 24 },
  { surface: '私', reading: 'わたくし', meaning: 'I (formal)', pageNumber: 24 },
  { surface: 'カレー', reading: 'カレー', meaning: 'curry', pageNumber: 24 },
  { surface: '紅茶', reading: 'こうちゃ', meaning: 'black tea', pageNumber: 24 },
  { surface: '着物', reading: 'きもの', meaning: 'kimono; Japanese traditional dress', pageNumber: 24 },
  { surface: 'セーター', reading: 'セーター', meaning: 'sweater', pageNumber: 24 },
  { surface: '楽器', reading: 'がっき', meaning: 'musical instrument', pageNumber: 24 },
  { surface: '空手', reading: 'からて', meaning: 'karate', pageNumber: 24 },
  { surface: 'ゴルフ', reading: 'ゴルフ', meaning: 'golf', pageNumber: 24 },
  { surface: 'バイク', reading: 'バイク', meaning: 'motorcycle', pageNumber: 24 },
  { surface: '象', reading: 'ぞう', meaning: 'elephant', pageNumber: 24 },
  { surface: '体', reading: 'からだ', meaning: 'body', pageNumber: 24 },
  { surface: '外国語', reading: 'がいこくご', meaning: 'foreign language', pageNumber: 24 },
  { surface: '言葉', reading: 'ことば', meaning: 'language; word', pageNumber: 24 },
  { surface: '文法', reading: 'ぶんぽう', meaning: 'grammar', pageNumber: 24 },
  { surface: 'アプリ', reading: 'アプリ', meaning: 'application (app)', pageNumber: 24 },
  { surface: 'アパート', reading: 'アパート', meaning: 'apartment; smaller apartment building', pageNumber: 24 },
  { surface: 'マンション', reading: 'マンション', meaning: 'larger apartment building; condominium', pageNumber: 24 },
  { surface: '空港', reading: 'くうこう', meaning: 'airport', pageNumber: 24 },
  { surface: '店', reading: 'みせ', meaning: 'shop; store', pageNumber: 24 },
  { surface: '物価', reading: 'ぶっか', meaning: 'consumer prices', pageNumber: 24 },
  { surface: '広告', reading: 'こうこく', meaning: 'advertisement', pageNumber: 24 },
  { surface: '募集', reading: 'ぼしゅう', meaning: 'recruitment', pageNumber: 24 },
  { surface: '約束', reading: 'やくそく', meaning: 'promise; appointment', pageNumber: 24 },
  { surface: 'うれしい', reading: 'うれしい', meaning: 'glad; happy', pageNumber: 24 },
  { surface: '悲しい', reading: 'かなしい', meaning: 'sad', pageNumber: 24 },
  { surface: '厳しい', reading: 'きびしい', meaning: 'strict', pageNumber: 24 },
  { surface: '気分が悪い', reading: 'きぶんがわるい', meaning: 'to feel sick', pageNumber: 24 },
  { surface: '辛い', reading: 'からい', meaning: 'hot and spicy; salty', pageNumber: 25 },
  { surface: 'すごい', reading: 'すごい', meaning: 'incredible; awesome', pageNumber: 25 },
  { surface: '近い', reading: 'ちかい', meaning: 'close; near', pageNumber: 25 },
  { surface: 'いろいろ(な)', reading: 'いろいろ(な)', meaning: 'various; different kinds of', pageNumber: 25 },
  { surface: '幸せ(な)', reading: 'しあわせ(な)', meaning: 'happy (lasting happiness)', pageNumber: 25 },
  { surface: 'だめ(な)', reading: 'だめ(な)', meaning: 'no good', pageNumber: 25 },
  { surface: '編む', reading: 'あむ', meaning: 'to knit', pageNumber: 25 },
  { surface: '頑張る', reading: 'がんばる', meaning: "to do one's best; to try hard", pageNumber: 25 },
  { surface: '泣く', reading: 'なく', meaning: 'to cry', pageNumber: 25 },
  { surface: '磨く', reading: 'みがく', meaning: 'to brush (teeth); to polish', pageNumber: 25 },
  { surface: '約束を守る', reading: 'やくそくをまもる', meaning: 'to keep a promise', pageNumber: 25 },
  { surface: '感動する', reading: 'かんどうする', meaning: 'to be moved/touched (by ...)', pageNumber: 25 },
  { surface: '~回', reading: '~かい', meaning: '... times', pageNumber: 25 },
  { surface: '全部', reading: 'ぜんぶ', meaning: 'all', pageNumber: 25 },
  { surface: '~と申します', reading: '~ともうします', meaning: 'my name is ...', pageNumber: 25 },
  { surface: '特に', reading: 'とくに', meaning: 'especially', pageNumber: 25 },
  { surface: '口座', reading: 'こうざ', meaning: 'account', pageNumber: 45 },
  { surface: '手数料', reading: 'てすうりょう', meaning: 'commission', pageNumber: 45 },
  { surface: '通帳', reading: 'つうちょう', meaning: 'passbook', pageNumber: 45 },
  { surface: '預金', reading: 'よきん', meaning: 'savings', pageNumber: 45 },
  { surface: '金額', reading: 'きんがく', meaning: 'amount', pageNumber: 45 },
  { surface: '暗証番号', reading: 'あんしょうばんごう', meaning: 'personal identification number', pageNumber: 45 },
  { surface: '現金', reading: 'げんきん', meaning: 'cash', pageNumber: 45 },
  { surface: '両替', reading: 'りょうがえ', meaning: 'money exchange', pageNumber: 45 },
]

async function writeGoldPack(opts: {
  packId: string
  textbookKey: string
  title: string
  levelRange: string
  lessonNumber: number
  lessonTitle: string
  vocabulary: ReturnType<typeof toVocabEntries>
  grammar: Array<Record<string, unknown>>
  contentBlocks: Array<Record<string, unknown>>
  exercises: Array<Record<string, unknown>>
  sources: Array<Record<string, unknown>>
  writeCorrections?: boolean
}) {
  await mkdir(reviewedDir, { recursive: true })
  const pack = {
    schemaVersion: 1,
    textbookKey: opts.textbookKey,
    title: opts.title,
    edition: 'learner-gold',
    levelRange: opts.levelRange,
    sources: opts.sources,
    lessons: [
      {
        id: opts.packId,
        unitType: 'lesson',
        lessonNumber: opts.lessonNumber,
        title: opts.lessonTitle,
        level: opts.levelRange,
        modes: ['conversation_grammar'],
        vocabulary: opts.vocabulary,
        grammar: opts.grammar,
        contentBlocks: opts.contentBlocks,
        exercises: opts.exercises,
        qualityTier: 'gold',
      },
    ],
  }
  const outFile = path.join(reviewedDir, `${opts.packId}.json`)
  await writeFile(outFile, `${JSON.stringify(pack, null, 2)}\n`, 'utf8')

  if (opts.writeCorrections) {
    await mkdir(correctionsDir, { recursive: true })
    const corrections = {
      schemaVersion: 1,
      packId: opts.packId,
      basedOnProof: `../out/canonical-proofs/${opts.packId}.json`,
      generatedAt: new Date().toISOString(),
      corrections: [] as Array<Record<string, unknown>>,
      additions: {
        vocabulary: opts.vocabulary,
        grammar: opts.grammar,
        contentBlocks: opts.contentBlocks,
        exercises: opts.exercises,
      },
    }
    await writeFile(
      path.join(correctionsDir, `${opts.packId}.corrections.json`),
      `${JSON.stringify(corrections, null, 2)}\n`,
      'utf8',
    )
  }

  return {
    packId: opts.packId,
    vocabulary: opts.vocabulary.length,
    grammar: opts.grammar.length,
    contentBlocks: opts.contentBlocks.length,
    exercises: opts.exercises.length,
    outFile: path.relative(appRoot, outFile),
  }
}

async function buildGenki1Lesson2() {
  const p58 = await readPage('genki_1_textbook', 67)
  const p59 = await readPage('genki_1_textbook', 68)
  if (!p58 || !p59) throw new Error('Missing Genki I L2 vocab pages')
  const ocrParsed = parsePages(
    [
      { pageNumber: 58, text: p58.text },
      { pageNumber: 59, text: p59.text },
    ],
    'genki1_early',
  )
  const vocabulary = qualityVocab(dedupeVocab([...GENKI_1_L2_SEED, ...ocrParsed]))
  const extras = await loadCurriculumExtras(
    'genki_1_textbook-comprehensive.json',
    ['genki_1_2'],
    2,
    'genki_1_textbook',
    'genki_1_l2',
  )
  const sources = await loadSources(['genki_1_textbook', 'genki_1_workbook'])
  return writeGoldPack({
    packId: 'genki_1_lesson_2',
    textbookKey: 'genki_1',
    title: 'Genki I: An Integrated Course in Elementary Japanese',
    levelRange: 'N5-N4',
    lessonNumber: 2,
    lessonTitle: 'かいもの　Shopping',
    vocabulary: toVocabEntries(vocabulary, 'genki_1_l2', 2, 'genki_1_textbook', 'Genki I L2 OCR + seed'),
    grammar: GENKI_1_L2_GRAMMAR,
    contentBlocks: extras.contentBlocks,
    exercises: extras.exercises,
    sources,
    writeCorrections: true,
  })
}

async function enrichGenki2Lesson13() {
  const pages = [32, 33, 53]
  const texts = []
  for (const page of pages) {
    const data = await readPage('genki_2_textbook', page)
    if (data) texts.push({ pageNumber: page === 53 ? 45 : page === 32 ? 24 : 25, text: data.text })
  }
  const ocrParsed = parsePages(texts, 'genki_kana')
  const vocabulary = qualityVocab(dedupeVocab([...GENKI_2_L13_SEED, ...ocrParsed]))
  const extras = await loadCurriculumExtras(
    'genki_2_textbook-comprehensive.json',
    ['genki_2_1', 'genki_2_13'],
    13,
    'genki_2_textbook',
    'genki_2_l13',
  )
  const sources = await loadSources(['genki_2_textbook', 'genki_2_workbook'])
  return writeGoldPack({
    packId: 'genki_2_lesson_13',
    textbookKey: 'genki_2',
    title: 'Genki II Lesson 13',
    levelRange: 'N4',
    lessonNumber: 13,
    lessonTitle: 'Genki II Lesson 13',
    vocabulary: toVocabEntries(vocabulary, 'genki_2_l13', 13, 'genki_2_textbook', 'OCR pages 32–33 + 53 + seed'),
    grammar: extras.grammar,
    contentBlocks: extras.contentBlocks,
    exercises: extras.exercises,
    sources,
  })
}

async function enrichGenkiLesson(opts: {
  book: 'genki_1_textbook' | 'genki_2_textbook'
  textbookKey: 'genki_1' | 'genki_2'
  lessonNumber: number
  startPage: number
  endPage: number
  title: string
  levelRange: string
  appLessonTags: string[]
  parseMode: 'genki1_early' | 'genki_kana'
  minVocab?: number
}) {
  const vocabPages = await findVocabPages(opts.book, opts.startPage, opts.endPage)
  if (vocabPages.length === 0) {
    return { packId: `${opts.textbookKey}_lesson_${opts.lessonNumber}`, skipped: true, reason: 'no vocab pages' }
  }
  const texts = []
  for (const page of vocabPages) {
    const data = await readPage(opts.book, page)
    if (data) texts.push({ pageNumber: page, text: data.text })
  }
  const vocabulary = parsePages(texts, opts.parseMode)
  const minVocab = opts.minVocab ?? 18
  if (vocabulary.length < minVocab) {
    return {
      packId: `${opts.textbookKey}_lesson_${opts.lessonNumber}`,
      skipped: true,
      reason: `only ${vocabulary.length} quality vocab (need ${minVocab})`,
      vocabPages,
    }
  }

  const idPrefix = `${opts.textbookKey}_l${opts.lessonNumber}`
  const extras = await loadCurriculumExtras(
    `${opts.book}-comprehensive.json`,
    opts.appLessonTags,
    opts.lessonNumber,
    opts.book,
    idPrefix,
  )
  const sources = await loadSources([opts.book, opts.book.replace('_textbook', '_workbook')])
  const result = await writeGoldPack({
    packId: `${opts.textbookKey}_lesson_${opts.lessonNumber}`,
    textbookKey: opts.textbookKey,
    title: opts.title,
    levelRange: opts.levelRange,
    lessonNumber: opts.lessonNumber,
    lessonTitle: opts.title,
    vocabulary: toVocabEntries(
      vocabulary,
      idPrefix,
      opts.lessonNumber,
      opts.book,
      `OCR vocab pages ${vocabPages.join(', ')}`,
    ),
    grammar: extras.grammar,
    contentBlocks: extras.contentBlocks,
    exercises: extras.exercises,
    sources,
    writeCorrections: opts.textbookKey === 'genki_1',
  })
  return { ...result, vocabPages, skipped: false }
}

function appTagsForGenki2(sourceLesson: number): string[] {
  // Source L13 ↔ app genki_2_1 and genki_2_13, etc.
  const appIdx = sourceLesson - 12
  return [`genki_2_${appIdx}`, `genki_2_${sourceLesson}`]
}

const results: Record<string, unknown> = {}
results.genki_1_lesson_2 = await buildGenki1Lesson2()
results.genki_2_lesson_13 = await enrichGenki2Lesson13()

const g1Hints = await loadLessonHints('genki_1_textbook')
for (let i = 0; i < g1Hints.length; i += 1) {
  const hint = g1Hints[i]
  if (hint.lessonNumber < 3 || hint.lessonNumber > 12) continue
  const end = (g1Hints[i + 1]?.pageNumber ?? hint.pageNumber + 30) - 1
  results[`genki_1_lesson_${hint.lessonNumber}`] = await enrichGenkiLesson({
    book: 'genki_1_textbook',
    textbookKey: 'genki_1',
    lessonNumber: hint.lessonNumber,
    startPage: hint.pageNumber,
    endPage: end,
    title: hint.label,
    levelRange: 'N5-N4',
    appLessonTags: [`genki_1_${hint.lessonNumber}`],
    parseMode: 'genki_kana',
  })
}

const g2Hints = await loadLessonHints('genki_2_textbook')
for (let i = 0; i < g2Hints.length; i += 1) {
  const hint = g2Hints[i]
  if (hint.lessonNumber < 14 || hint.lessonNumber > 23) continue
  const end = (g2Hints[i + 1]?.pageNumber ?? hint.pageNumber + 30) - 1
  results[`genki_2_lesson_${hint.lessonNumber}`] = await enrichGenkiLesson({
    book: 'genki_2_textbook',
    textbookKey: 'genki_2',
    lessonNumber: hint.lessonNumber,
    startPage: hint.pageNumber,
    endPage: end,
    title: hint.label,
    levelRange: 'N4',
    appLessonTags: appTagsForGenki2(hint.lessonNumber),
    parseMode: 'genki_kana',
  })
}

console.log(JSON.stringify(results, null, 2))
