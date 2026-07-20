/**
 * 1) Build Genki I Lesson 2 gold pack (+ corrections) from OCR vocab pages.
 * 2) Rebuild Genki II Lesson 13 gold with OCR-enriched vocabulary.
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
  parseUsefulVocabBlocks,
  type ParsedVocab,
} from './parse-genki-ocr-vocab.ts'

const appRoot = process.cwd()
const grouped = (book: string, page: number) =>
  path.join(appRoot, `tools/textbook-pack/out/grouped/${book}/pages/page-${String(page).padStart(4, '0')}.json`)
const reviewedDir = path.join(appRoot, 'tools/textbook-pack/out/reviewed-packs')
const correctionsDir = path.join(appRoot, 'tools/textbook-pack/corrections')
const textbooksDir = path.join(appRoot, 'data/generated/textbooks')

interface GroupedPage {
  pageNumber: number
  sourceId?: string
  blocks?: Array<{ text?: string }>
}

async function readPage(book: string, page: number): Promise<{ pageNumber: number; text: string; sourceId: string }> {
  const data = JSON.parse(await readFile(grouped(book, page), 'utf8')) as GroupedPage
  const text = (data.blocks ?? []).map((b) => b.text ?? '').join('\n')
  return { pageNumber: data.pageNumber ?? page, text, sourceId: data.sourceId ?? book }
}

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, 'utf8')) as T
}

function reviewStamp(notes: string) {
  return {
    action: 'approved' as const,
    reviewedAt: new Date().toISOString(),
    reviewer: 'ocr_vocab_enrich',
    notes,
  }
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

async function buildGenki1Lesson2() {
  const p58 = await readPage('genki_1_textbook', 67) // PDF page 67 ≈ book p.58
  const p59 = await readPage('genki_1_textbook', 68)
  const ocrParsed = dedupeVocab([
    ...parseGenki1StyleLines(p58.text, 58),
    ...parseGenki1StyleLines(p59.text, 59),
  ])
  // Seed wins on conflicts for known-good glosses; OCR adds extras
  const vocabulary = dedupeVocab([...GENKI_1_L2_SEED, ...ocrParsed])

  const curriculum = await readJson<{
    dialogues?: Array<Record<string, unknown>>
    exercises?: Array<Record<string, unknown>>
  }>(path.join(textbooksDir, 'genki_1_textbook-comprehensive.json'))

  const contentBlocks = (curriculum.dialogues ?? [])
    .filter((d) => String(d.lesson ?? '').includes('genki_1_2'))
    .slice(0, 12)
    .map((d, i) => {
      const lines = Array.isArray(d.lines) ? (d.lines as Array<{ speaker?: string; japanese?: string }>) : []
      const text = lines
        .map((line) => `${line.speaker ? `${line.speaker}: ` : ''}${line.japanese ?? ''}`.trim())
        .filter(Boolean)
        .join('\n')
      return {
        id: `genki_1_l2_dialogue_${i + 1}`,
        type: 'dialogue' as const,
        title: String(d.title ?? `Dialogue ${i + 1}`),
        text,
        sourceRef: {
          sourceId: String(d.source ?? 'genki_1_textbook'),
          pageNumber: Number(d.page ?? 0) || 60,
        },
        review: reviewStamp('dialogue from comprehensive'),
      }
    })
    .filter((b) => /[\u3040-\u30ff\u4e00-\u9fff]/.test(b.text))

  const exercises = (curriculum.exercises ?? [])
    .filter((e) => /genki_1_2\b/.test(String(e.lesson ?? '')))
    .slice(0, 20)
    .map((e, i) => ({
      id: String(e.id ?? `genki_1_l2_ex_${i + 1}`),
      label: String(e.type ?? 'exercise'),
      prompt: String(e.question ?? ''),
      sourceRef: {
        sourceId: String(e.source ?? 'genki_1_workbook'),
        pageNumber: Number(e.page ?? 0) || 0,
      },
      review: reviewStamp('exercise from comprehensive'),
    }))
    .filter((e) => e.prompt.trim().length >= 2)

  const proof = await readJson<{ sources: unknown[] }>(
    path.join(appRoot, 'tools/textbook-pack/out/canonical-proofs/genki_1_lesson_2.json'),
  ).catch(() => null)

  const pack = {
    schemaVersion: 1,
    textbookKey: 'genki_1',
    title: 'Genki I: An Integrated Course in Elementary Japanese',
    edition: '3rd Edition',
    levelRange: 'N5-N4',
    sources: proof?.sources ?? [
      { sourceId: 'genki_1_textbook', role: 'textbook' },
      { sourceId: 'genki_1_workbook', role: 'workbook' },
    ],
    lessons: [
      {
        id: 'genki_1_lesson_2',
        unitType: 'lesson',
        lessonNumber: 2,
        title: 'かいもの　Shopping',
        level: 'N5-N4',
        modes: ['conversation_grammar'],
        vocabulary: toVocabEntries(vocabulary, 'genki_1_l2', 2, 'genki_1_textbook', 'Genki I L2 OCR + seed'),
        grammar: GENKI_1_L2_GRAMMAR,
        contentBlocks,
        exercises,
        qualityTier: 'gold',
      },
    ],
  }

  await mkdir(reviewedDir, { recursive: true })
  await mkdir(correctionsDir, { recursive: true })
  const outFile = path.join(reviewedDir, 'genki_1_lesson_2.json')
  await writeFile(outFile, `${JSON.stringify(pack, null, 2)}\n`, 'utf8')

  // Corrections trail: ignore proof garbage; additions = gold vocab/grammar
  const corrections = {
    schemaVersion: 1,
    packId: 'genki_1_lesson_2',
    basedOnProof: '../out/canonical-proofs/genki_1_lesson_2.json',
    generatedAt: new Date().toISOString(),
    corrections: [] as Array<Record<string, unknown>>,
    additions: {
      vocabulary: pack.lessons[0].vocabulary,
      grammar: pack.lessons[0].grammar,
      contentBlocks: pack.lessons[0].contentBlocks,
      exercises: pack.lessons[0].exercises,
    },
  }

  // If proof exists, mark all proof items ignored so finalize/apply keeps only additions
  try {
    const proof = await readJson<{
      lessons: Array<{
        vocabulary?: Array<{ id: string }>
        grammar?: Array<{ id: string }>
        contentBlocks?: Array<{ id: string }>
        exercises?: Array<{ id: string }>
      }>
    }>(path.join(appRoot, 'tools/textbook-pack/out/canonical-proofs/genki_1_lesson_2.json'))
    const lesson = proof.lessons[0]
    for (const item of lesson.vocabulary ?? []) {
      corrections.corrections.push({
        id: item.id,
        kind: 'vocabulary',
        action: 'ignored',
        current: {},
        replacement: {},
        notes: 'Replaced by OCR+seed gold additions',
      })
    }
    for (const item of lesson.grammar ?? []) {
      corrections.corrections.push({
        id: item.id,
        kind: 'grammar',
        action: 'ignored',
        current: {},
        replacement: {},
        notes: 'Replaced by curated L2 grammar',
      })
    }
    for (const item of lesson.contentBlocks ?? []) {
      corrections.corrections.push({
        id: item.id,
        kind: 'contentBlocks',
        action: 'ignored',
        current: {},
        replacement: {},
        notes: 'Bulk OCR ignored',
      })
    }
    for (const item of lesson.exercises ?? []) {
      corrections.corrections.push({
        id: item.id,
        kind: 'exercises',
        action: 'ignored',
        current: {},
        replacement: {},
        notes: 'Bulk OCR ignored',
      })
    }
  } catch {
    // proof optional for direct pack write
  }

  const corrFile = path.join(correctionsDir, 'genki_1_lesson_2.corrections.json')
  await writeFile(corrFile, `${JSON.stringify(corrections, null, 2)}\n`, 'utf8')

  return {
    packId: 'genki_1_lesson_2',
    vocabulary: vocabulary.length,
    ocrOnly: ocrParsed.length,
    grammar: GENKI_1_L2_GRAMMAR.length,
    contentBlocks: contentBlocks.length,
    exercises: exercises.length,
    outFile: path.relative(appRoot, outFile),
    corrections: path.relative(appRoot, corrFile),
  }
}

async function enrichGenki2Lesson13() {
  const p32 = await readPage('genki_2_textbook', 32)
  const p33 = await readPage('genki_2_textbook', 33)
  const p53 = await readPage('genki_2_textbook', 53)

  const ocrParsed = dedupeVocab([
    ...parseGenki2Interleaved(p32.text, 24),
    ...parseGenki2Interleaved(p33.text, 25),
    ...parseUsefulVocabBlocks(p53.text, 45),
  ])
  const vocabulary = dedupeVocab([...GENKI_2_L13_SEED, ...ocrParsed])

  const curriculum = await readJson<{
    grammar?: Array<Record<string, unknown>>
    dialogues?: Array<Record<string, unknown>>
    exercises?: Array<Record<string, unknown>>
  }>(path.join(textbooksDir, 'genki_2_textbook-comprehensive.json'))
  const tags = ['genki_2_1', 'genki_2_13']
  const match = (lesson: string) => tags.includes(lesson) || tags.some((t) => lesson.endsWith(`_${t}`))

  // Always rewrite sourceRefs onto genki_2_* — comprehensive often tags CEFR ids.
  const grammar = (curriculum.grammar ?? [])
    .filter((g) => match(String(g.lesson ?? '')))
    .map((g, i) => ({
      id: `genki_2_l13_grammar_${i + 1}`,
      pattern: String(g.pattern ?? g.title ?? ''),
      meaning: String(g.meaning ?? ''),
      explanation: g.explanation,
      examples: Array.isArray(g.examples) ? g.examples : [],
      lessonNumber: 13,
      sourceRef: {
        sourceId: 'genki_2_textbook',
        pageNumber: Math.max(1, Number(g.page ?? 0) || 26),
      },
      review: reviewStamp('from comprehensive; source remapped'),
    }))
    .filter((g) => g.pattern.trim().length >= 1)

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
        id: `genki_2_l13_dialogue_${i + 1}`,
        type: 'dialogue',
        title: String(d.title ?? `Dialogue ${i + 1}`),
        text,
        sourceRef: {
          sourceId: 'genki_2_textbook',
          pageNumber: Math.max(1, Number(d.page ?? 0) || 24),
        },
        review: reviewStamp('dialogue'),
      }
    })
    .filter((b) => /[\u3040-\u30ff\u4e00-\u9fff]/.test(b.text))

  const exercises = (curriculum.exercises ?? [])
    .filter((e) => match(String(e.lesson ?? '')))
    .slice(0, 20)
    .map((e, i) => ({
      id: `genki_2_l13_ex_${i + 1}`,
      label: String(e.type ?? 'exercise'),
      prompt: String(e.question ?? ''),
      sourceRef: {
        sourceId: String(e.source ?? '').includes('workbook') ? 'genki_2_workbook' : 'genki_2_textbook',
        pageNumber: Math.max(1, Number(e.page ?? 0) || 1),
      },
      review: reviewStamp('exercise'),
    }))
    .filter((e) => e.prompt.trim().length >= 2)

  const manifest = await readJson<{
    entries: Array<{ id: string; role: string; fingerprint: { sha256: string; bytes: number } }>
  }>(path.join(appRoot, 'tools/textbook-pack/out/source-manifest.json'))
  const sources = ['genki_2_textbook', 'genki_2_workbook']
    .map((id) => {
      const entry = manifest.entries.find((e) => e.id === id)
      if (!entry) return null
      return { sourceId: entry.id, role: entry.role, fingerprint: entry.fingerprint }
    })
    .filter((s): s is NonNullable<typeof s> => Boolean(s))

  const pack = {
    schemaVersion: 1,
    textbookKey: 'genki_2',
    title: 'Genki II Lesson 13',
    edition: 'learner-gold',
    levelRange: 'N4',
    sources,
    lessons: [
      {
        id: 'genki_2_lesson_13',
        unitType: 'lesson',
        lessonNumber: 13,
        title: 'Genki II Lesson 13',
        level: 'N4',
        modes: ['conversation_grammar'],
        vocabulary: toVocabEntries(vocabulary, 'genki_2_l13', 13, 'genki_2_textbook', 'OCR pages 32–33 + 53 + seed'),
        grammar,
        contentBlocks,
        exercises,
        qualityTier: 'gold',
      },
    ],
  }

  const outFile = path.join(reviewedDir, 'genki_2_lesson_13.json')
  await writeFile(outFile, `${JSON.stringify(pack, null, 2)}\n`, 'utf8')
  return {
    packId: 'genki_2_lesson_13',
    vocabulary: vocabulary.length,
    ocrOnly: ocrParsed.length,
    grammar: grammar.length,
    contentBlocks: contentBlocks.length,
    exercises: exercises.length,
    outFile: path.relative(appRoot, outFile),
  }
}

const l2 = await buildGenki1Lesson2()
const l13 = await enrichGenki2Lesson13()
console.log(JSON.stringify({ genki_1_lesson_2: l2, genki_2_lesson_13: l13 }, null, 2))
