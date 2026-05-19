import { TEXTBOOK_FILES, SCENARIO_FILES } from './dataRegistry'
import type { CEFRLevel } from './cefrMapping'

export interface SupplementalScenarioLine {
  speaker: string
  text: string
  translation?: string
}

export interface SupplementalScenario {
  id: string
  title: string
  titleJa: string
  description: string
  textbook: string
  textbookKey: string
  level: 'A1' | 'A2' | 'B1' | 'B2'
  lessonId: string
  coreLessonId?: string
  page: number
  sourceKind: 'dialogue' | 'practice_prompt' | 'curated'
  canDo: string
  participants: string[]
  sampleDialogue: string
  lines: SupplementalScenarioLine[]
  practicePrompts: string[]
}

interface RawDialogue {
  id?: string
  lesson?: string
  title?: string
  participants?: string[]
  lines?: Array<{ speaker?: string; japanese?: string; translation?: string }>
  page?: number
}

interface RawExercise {
  id?: string
  lesson?: string
  type?: string
  question?: string
  page?: number
}

interface RawCurriculum {
  dialogues?: RawDialogue[]
  exercises?: RawExercise[]
}

interface RankedScenario {
  scenario: SupplementalScenario
  score: number
}

interface SupplementalSource {
  textbookKey: string
  textbook: string
  level: SupplementalScenario['level']
  corePrefix: string
  allowedPageRanges: Array<[number, number]>
  blockedPageRanges?: Array<[number, number]>
  maxDialogues?: number
  maxPrompts?: number
  promptThreshold?: number
  dialogueThreshold?: number
  preferredTerms?: RegExp
}

export interface SupplementalScenarioSourceInfo {
  textbookKey: string
  textbook: string
  level: SupplementalScenario['level']
}

export const SUPPLEMENTAL_SCENARIO_SOURCES: SupplementalScenarioSourceInfo[] = [
  { textbookKey: 'genki_1_textbook', textbook: 'Genki 1 Textbook', level: 'A1' },
  { textbookKey: 'genki_1_workbook', textbook: 'Genki 1 Workbook', level: 'A1' },
  { textbookKey: 'marugoto_a1_textbook', textbook: 'Marugoto A1', level: 'A1' },
  { textbookKey: 'genki_2_textbook', textbook: 'Genki 2 Textbook', level: 'A2' },
  { textbookKey: 'genki_2_workbook', textbook: 'Genki 2 Workbook', level: 'A2' },
  { textbookKey: 'marugoto_a2_textbook', textbook: 'Marugoto A2', level: 'A2' },
  { textbookKey: 'quartet_1_textbook', textbook: 'Quartet 1 Textbook', level: 'B1' },
  { textbookKey: 'quartet_1_workbook', textbook: 'Quartet 1 Workbook', level: 'B1' },
  { textbookKey: 'marugoto_b1_textbook', textbook: 'Marugoto B1', level: 'B1' },
  { textbookKey: 'quartet_2_textbook', textbook: 'Quartet 2 Textbook', level: 'B2' },
  { textbookKey: 'quartet_2_workbook', textbook: 'Quartet 2 Workbook', level: 'B2' },
  { textbookKey: 'tobira_textbook', textbook: 'Tobira', level: 'B2' },
]

const SOURCES: SupplementalSource[] = [
  {
    textbookKey: 'genki_1_textbook',
    textbook: 'Genki 1 Textbook',
    level: 'A1',
    corePrefix: 'genki_1',
    allowedPageRanges: [[30, 320]],
    maxDialogues: 0,
    maxPrompts: 12,
    promptThreshold: 7,
    preferredTerms: /会話|質問|聞いて|答えて|話しましょう|ペア|Conversation|Practice/i,
  },
  {
    textbookKey: 'genki_1_workbook',
    textbook: 'Genki 1 Workbook',
    level: 'A1',
    corePrefix: 'genki_1',
    allowedPageRanges: [[35, 150]],
    maxDialogues: 0,
    maxPrompts: 18,
    promptThreshold: 7,
    preferredTerms: /会話|質問|聞いて|答えて|話しましょう|ペア/i,
  },
  {
    textbookKey: 'marugoto_a1_textbook',
    textbook: 'Marugoto A1',
    level: 'A1',
    corePrefix: 'genki_1',
    allowedPageRanges: [[22, 105]],
    maxDialogues: 10,
    maxPrompts: 24,
    promptThreshold: 6,
    preferredTerms: /Can-do|can-do|話しましょう|ペア|紹介|聞きましょう|言いましょう/i,
  },
  {
    textbookKey: 'genki_2_textbook',
    textbook: 'Genki 2 Textbook',
    level: 'A2',
    corePrefix: 'genki_2',
    allowedPageRanges: [[25, 330]],
    maxDialogues: 0,
    maxPrompts: 12,
    promptThreshold: 7,
    preferredTerms: /会話|質問|聞いて|答えて|話しましょう|ペア|ロール|Conversation|Practice/i,
  },
  {
    textbookKey: 'genki_2_workbook',
    textbook: 'Genki 2 Workbook',
    level: 'A2',
    corePrefix: 'genki_2',
    allowedPageRanges: [[22, 135]],
    maxDialogues: 0,
    maxPrompts: 18,
    promptThreshold: 7,
    preferredTerms: /会話|質問|聞いて|答えて|話しましょう|ペア|ロール/i,
  },
  {
    textbookKey: 'marugoto_a2_textbook',
    textbook: 'Marugoto A2',
    level: 'A2',
    corePrefix: 'genki_2',
    allowedPageRanges: [[40, 170]],
    blockedPageRanges: [[175, 999]],
    maxDialogues: 10,
    maxPrompts: 18,
    promptThreshold: 6,
    preferredTerms: /Can-do|can-do|話しましょう|話し合い|紹介|説明|相談/i,
  },
  {
    textbookKey: 'marugoto_b1_textbook',
    textbook: 'Marugoto B1',
    level: 'B1',
    corePrefix: 'quartet_1',
    allowedPageRanges: [[47, 245]],
    maxDialogues: 12,
    maxPrompts: 24,
    promptThreshold: 6,
    preferredTerms: /Can-do|can-do|話しましょう|話し合い|意見|相談|説明|発表|紹介/i,
  },
  {
    textbookKey: 'tobira_textbook',
    textbook: 'Tobira',
    level: 'B2',
    corePrefix: 'quartet_2',
    allowedPageRanges: [[36, 220]],
    maxDialogues: 0,
    maxPrompts: 28,
    promptThreshold: 7,
    preferredTerms: /会話|話し合|ディスカッション|意見|説明|発表|ロール|質問/i,
  },
  {
    textbookKey: 'quartet_1_workbook',
    textbook: 'Quartet 1 Workbook',
    level: 'B1',
    corePrefix: 'quartet_1',
    allowedPageRanges: [[12, 115]],
    maxDialogues: 0,
    maxPrompts: 28,
    promptThreshold: 7,
    preferredTerms: /話しましょう|話し合|意見|説明|発表|書いてから話|ペア/i,
  },
  {
    textbookKey: 'quartet_2_workbook',
    textbook: 'Quartet 2 Workbook',
    level: 'B2',
    corePrefix: 'quartet_2',
    allowedPageRanges: [[18, 95]],
    maxDialogues: 0,
    maxPrompts: 28,
    promptThreshold: 7,
    preferredTerms: /話しましょう|話し合|意見|説明|発表|書いてから話|ペア/i,
  },
  {
    textbookKey: 'quartet_1_textbook',
    textbook: 'Quartet 1 Textbook',
    level: 'B1',
    corePrefix: 'quartet_1',
    allowedPageRanges: [[28, 210]],
    maxDialogues: 0,
    maxPrompts: 28,
    promptThreshold: 7,
    preferredTerms: /話しましょう|話し合|意見|説明|発表|考えて|ディスカッション/i,
  },
  {
    textbookKey: 'quartet_2_textbook',
    textbook: 'Quartet 2 Textbook',
    level: 'B2',
    corePrefix: 'quartet_2',
    allowedPageRanges: [[38, 190]],
    maxDialogues: 0,
    maxPrompts: 28,
    promptThreshold: 7,
    preferredTerms: /話しましょう|話し合|意見|説明|発表|考えて|ディスカッション/i,
  },
]

const BAD_TEXT_RE =
  /(table of contents|introduction|welcome|coursebook|foundation|abbreviation|contents|publication|download|https|www\.|bookclub|isbn|copyright|publisher|using tobira|about this book|student'?s guide|audio file|main expressions|corresponding lesson|conversation and grammar section|listening comprehension|初版発行|著作権|複写|複製|出版|営業部|音声ファイル|目次|使い方|はじめに|凡例|索引|index|answer key|references)/i

const PROMPT_RE = /(話|会話|ペア|質問|紹介|説明|相談|意見|聞|答|ロール|発表|比べ|考え|伝え|しょう|ください|can-do|can do|conversation|discuss|interview|presentation|role)/i
const STRONG_PROMPT_RE = /(話しましょう|話し合|会話|ロール|ペア|質問して|聞いて|相談|紹介|説明|意見|発表|インタビュー|ディスカッション|Can-do|can-do|conversation|discuss|interview|presentation|role)/i
const TASK_ACTION_RE = /(話しましょう|話し合|会話|ロール|ペア|質問|聞いて|答えて|相談|自己紹介|紹介しましょう|紹介して|説明して|説明してください|発表しましょう|発表してください|インタビュー|ディスカッション|してください|してみましょう|書いて|述べ|比べ|conversation|discuss|interview|presentation|role)/i
const DRILL_ONLY_RE = /(正しい|選び|選ん|書きなさい|直しなさい|完成|空欄|穴埋め|下線|漢字|単語|意味|文法|練習問題|聞く練習|リスニング|CD|Track|トラック|例のように|答え合わせ|チェックしましょう|答えなさい|合うもの|×をつけ|線で結び|結びなさい|説明ですか|内容に合う|発表しています)/i
const CAN_DO_ADMIN_RE = /(check.*can-do|can-do.*check|can-dos|learning record|self-assessment|attainment|objectively measured|how well you can do|able to do the can-do|Can-doをチェ|Can-doをチェック)/i
const DIALOGUE_NOISE_RE = /(もう一度聞きましょう|見てください|選びましょう|考えましょう|ロールプレイのまえ|何について話していますか|誰が誰に|絵を見て|スクリプト|使役受身|疑問詞|文法|V[（(]|ページ)/
const OCR_JUNK_RE = /([A-Za-z]{14,}|[0-9]{4,}|[|{}[\]\\<>]{2,}|.{0,4}©|第\d+刷|TEL|FAX|電話)/
const BROKEN_PROMPT_FRAGMENT_RE = /^(?:う|を|で|に|は|が|ので|から|そして|その後|また|ただし|必要なら|同じ言葉|[A-Z]：|[0-9]+[.)、])/
const STATEMENT_ONLY_RE = /(?:紹介しています|発表しています|書いてあります|説明しています)。?$/
const JAPANESE_RE = /[\u3040-\u30ff\u3400-\u9fff]/g
const ENGLISH_RE = /[A-Za-z]/g

let scenarioCache: SupplementalScenario[] | null = null

function charRatio(text: string, pattern: RegExp) {
  return (text.match(pattern) ?? []).length / Math.max(1, text.length)
}

function hasUsefulJapanese(text: string) {
  return charRatio(text, JAPANESE_RE) > 0.12
}

function isBadText(text: string) {
  return BAD_TEXT_RE.test(text) || OCR_JUNK_RE.test(text) || text.length < 6
}

function cleanText(text: string) {
  return text
    .replace(/\s+/g, ' ')
    .replace(/[•●◆◇]/g, '')
    .replace(/[→⇒]/g, '。')
    .replace(/[＠@]/g, '')
    .replace(/[ゝ]/g, '')
    .replace(/([てで])ノ(?=[ぁ-んァ-ン一-龯])/g, '$1、')
    .replace(/\bkeephold of\b/gi, 'hold on to')
    .replace(/(^|[。！？、\s])[0-9０-９]+(?=[ぁ-んァ-ン一-龯])/g, '$1')
    .replace(/[。！？、\s][0-9０-９]+(?=[。！？、\s]|$)/g, '。')
    .replace(/[。]{2,}/g, '。')
    .replace(/\s+/g, ' ')
    .trim()
}

function excerpt(text: string, maxLength = 84) {
  const cleaned = cleanText(text)
  return cleaned.length > maxLength ? `${cleaned.slice(0, maxLength - 1)}…` : cleaned
}

function lessonNumberFromId(lessonId: string): number | null {
  const matches = [...lessonId.matchAll(/_(\d+)/g)]
  const last = matches.at(-1)?.[1]
  if (!last) return null
  const parsed = Number(last)
  return Number.isFinite(parsed) ? parsed : null
}

function compareLessonId(a: SupplementalScenario, b: SupplementalScenario) {
  const aLesson = lessonNumberFromId(a.coreLessonId ?? a.lessonId) ?? Number.MAX_SAFE_INTEGER
  const bLesson = lessonNumberFromId(b.coreLessonId ?? b.lessonId) ?? Number.MAX_SAFE_INTEGER
  return aLesson - bLesson
}

function normalizeCoreLesson(source: SupplementalSource, lessonId: string): string | undefined {
  const lessonNumber = lessonNumberFromId(lessonId)
  if (!lessonNumber) return undefined

  if (source.textbookKey.includes('genki_2')) {
    const normalized = lessonNumber > 12 ? lessonNumber - 12 : lessonNumber
    return `${source.corePrefix}_${normalized}`
  }

  if (source.textbookKey.includes('quartet_2')) {
    const normalized = lessonNumber > 6 ? lessonNumber - 6 : lessonNumber
    return `${source.corePrefix}_${normalized}`
  }

  if (source.textbookKey.includes('marugoto')) {
    const normalized = source.level === 'A1'
      ? Math.min(12, Math.max(1, Math.ceil(lessonNumber / 2)))
      : source.level === 'A2'
        ? Math.min(11, Math.max(1, lessonNumber))
        : source.level === 'B1'
          ? Math.min(6, Math.max(1, lessonNumber))
          : lessonNumber
    return `${source.corePrefix}_${normalized}`
  }

  if (source.textbookKey.includes('tobira')) {
    return `${source.corePrefix}_${Math.min(6, Math.max(1, Math.ceil(lessonNumber / 2.5)))}`
  }

  return `${source.corePrefix}_${lessonNumber}`
}

function cleanDialogueLines(dialogue: RawDialogue): SupplementalScenarioLine[] {
  const rawLines = dialogue.lines ?? []
  return rawLines
    .map((line, index) => ({
      speaker: normalizeSpeaker(line.speaker, index),
      text: cleanText(line.japanese ?? ''),
      translation: line.translation ? cleanText(line.translation) : undefined,
    }))
    .filter(line => line.text.length >= 3 && hasUsefulJapanese(line.text) && !isBadText(line.text))
    .slice(0, 10)
}

function normalizeSpeaker(speaker: string | undefined, index: number) {
  const cleaned = cleanText(speaker ?? '')
  if (/^[A-ZＡ-Ｚ]$/.test(cleaned)) return cleaned
  if (/先生|店員|学生|友だち|友達|客|母|父|山田|田中|佐藤|さん$/.test(cleaned) && cleaned.length <= 8) return cleaned
  return index % 2 === 0 ? 'A' : 'B'
}

function isPageInRange(page: number | undefined, ranges: Array<[number, number]>) {
  if (!page || page < 1) return false
  return ranges.some(([start, end]) => page >= start && page <= end)
}

function isAllowedPage(source: SupplementalSource, page: number | undefined) {
  if (!isPageInRange(page, source.allowedPageRanges)) return false
  return !isPageInRange(page, source.blockedPageRanges ?? [])
}

function promptQualityScore(source: SupplementalSource, exercise: RawExercise) {
  const prompt = cleanText(exercise.question ?? '')
  if (!isAllowedPage(source, exercise.page)) return 0
  if (!exercise.lesson || exercise.lesson === 'unknown') return 0
  if (prompt.length < 8 || prompt.length > 180) return 0
  if (isBadText(prompt) || CAN_DO_ADMIN_RE.test(prompt) || !PROMPT_RE.test(prompt)) return 0
  if (BROKEN_PROMPT_FRAGMENT_RE.test(prompt) || STATEMENT_ONLY_RE.test(prompt)) return 0

  const japaneseRatio = charRatio(prompt, JAPANESE_RE)
  const englishRatio = charRatio(prompt, ENGLISH_RE)
  if (japaneseRatio < 0.12 && !/(conversation|discuss|interview|presentation|role)/i.test(prompt)) return 0

  let score = 0

  if (STRONG_PROMPT_RE.test(prompt)) score += 4
  if (source.preferredTerms?.test(prompt)) score += 3
  if (/Can-do|can-do|can do/i.test(prompt)) score += 3
  if (japaneseRatio > 0.45) score += 2
  else if (japaneseRatio > 0.18) score += 1
  if (prompt.length >= 16 && prompt.length <= 120) score += 1
  if (/あなた|友だち|ペア|グループ|クラス|相手/.test(prompt)) score += 1
  if (/理由|例|経験|自分|国|町|生活|将来|文化|社会/.test(prompt)) score += 1

  if (DRILL_ONLY_RE.test(prompt)) score -= 4
  if (!TASK_ACTION_RE.test(prompt)) score -= 5
  if (/^回/.test(prompt)) score -= 5
  if (englishRatio > 0.45 && !/Can-do|can do|conversation|discuss|interview|presentation|role/i.test(prompt)) score -= 3
  if (/^\d+[.)、]|^[A-Z]\.|^[①-⑳]/.test(prompt)) score -= 1
  if (/^[ぁ-んァ-ン一-龯]{1,8}$/.test(prompt)) score -= 2

  return Math.max(0, score)
}

function dialogueQualityScore(source: SupplementalSource, dialogue: RawDialogue) {
  if (!isAllowedPage(source, dialogue.page)) return 0
  if (!dialogue.lesson || dialogue.lesson === 'unknown') return 0
  const text = (dialogue.lines ?? []).map(line => `${line.speaker ?? ''} ${line.japanese ?? ''}`).join('\n')
  if (isBadText(text)) return 0
  if (DIALOGUE_NOISE_RE.test(text)) return 0
  if (charRatio(text, ENGLISH_RE) > 0.35) return 0

  const lines = cleanDialogueLines(dialogue)
  if (lines.length < 2 || lines.length > 10) return 0

  let score = 4
  if (lines.length >= 4) score += 2
  if (text.length >= 40 && text.length <= 360) score += 1
  if (/会話|モデル|ロール|話/.test(`${dialogue.title ?? ''} ${dialogue.id ?? ''}`)) score += 1
  if (source.preferredTerms?.test(text)) score += 1
  return score
}

function isUsableDialogue(source: SupplementalSource, dialogue: RawDialogue) {
  if (!dialogue.lesson || dialogue.lesson === 'unknown') return false
  return dialogueQualityScore(source, dialogue) >= (source.dialogueThreshold ?? 5)
}

function canDoFromPrompt(prompt: string, level: SupplementalScenario['level']) {
  if (/紹介|自己紹介|プロフィール/.test(prompt)) return 'Introduce yourself or someone else with relevant details.'
  if (/相談|困|悩/.test(prompt)) return 'Ask for advice, explain the problem, and respond to suggestions.'
  if (/意見|考え|ディスカッション|議論|話し合/.test(prompt)) return 'Give an opinion and support it with a short reason.'
  if (/質問|聞/.test(prompt)) return 'Ask and answer follow-up questions naturally.'
  if (/すすめ|おすすめ|推薦/.test(prompt)) return 'Recommend something and explain why it fits the listener.'
  if (/比べ|違/.test(prompt)) return 'Compare two things and describe the difference.'
  if (/発表|説明/.test(prompt)) return 'Explain a topic clearly to another person.'
  return level === 'A1' || level === 'A2'
    ? 'Complete a short everyday exchange using the prompt.'
    : 'Use the prompt as a short roleplay or discussion task.'
}

function promptTitleLabel(canDo: string) {
  if (canDo.startsWith('Introduce')) return 'Introduction'
  if (canDo.startsWith('Ask')) return 'Question Exchange'
  if (canDo.startsWith('Give')) return 'Opinion Exchange'
  if (canDo.startsWith('Recommend')) return 'Recommendation'
  if (canDo.startsWith('Compare')) return 'Comparison'
  if (canDo.startsWith('Explain')) return 'Explanation'
  return 'Roleplay'
}

function isUsablePrompt(source: SupplementalSource, exercise: RawExercise) {
  if (!exercise.lesson || exercise.lesson === 'unknown') return false
  return promptQualityScore(source, exercise) >= (source.promptThreshold ?? 6)
}

function scenarioFromDialogue(source: SupplementalSource, dialogue: RawDialogue, index: number): SupplementalScenario | null {
  if (!isUsableDialogue(source, dialogue) || !dialogue.lesson) return null
  const lines = cleanDialogueLines(dialogue)
  const lessonNumber = lessonNumberFromId(dialogue.lesson)
  const title = `${source.textbook} Model Conversation ${lessonNumber ?? index + 1}`
  const canDo = 'Practice the model conversation, then continue it in your own words.'

  return {
    id: `${source.textbookKey}:dialogue:${dialogue.id ?? index}`,
    title,
    titleJa: `${source.textbook} 会話練習`,
    description: `${source.textbook} page ${dialogue.page ?? 0}: ${canDo}`,
    textbook: source.textbook,
    textbookKey: source.textbookKey,
    level: source.level,
    lessonId: dialogue.lesson,
    coreLessonId: normalizeCoreLesson(source, dialogue.lesson),
    page: dialogue.page ?? 0,
    sourceKind: 'dialogue',
    canDo,
    participants: [...new Set(lines.map(line => line.speaker))].slice(0, 3),
    sampleDialogue: lines.map(line => line.text).join(' ').slice(0, 140),
    lines,
    practicePrompts: [
      'Read the model exchange once.',
      'Answer as speaker B, then ask one follow-up question.',
    ],
  }
}

function scenarioFromPrompt(source: SupplementalSource, exercise: RawExercise, index: number): SupplementalScenario | null {
  if (!isUsablePrompt(source, exercise) || !exercise.lesson) return null
  const prompt = cleanText(exercise.question ?? '')
  const lessonNumber = lessonNumberFromId(exercise.lesson)
  const canDo = canDoFromPrompt(prompt, source.level)
  const title = `${source.textbook} ${promptTitleLabel(canDo)} ${lessonNumber ?? index + 1}`
  const levelLine = source.level === 'A1' || source.level === 'A2'
    ? '短く答えて、もう一つ質問してください。'
    : '理由や具体例を入れて、会話を続けてください。'

  return {
    id: `${source.textbookKey}:prompt:${exercise.id ?? index}`,
    title,
    titleJa: `${source.textbook} 場面練習`,
    description: `${source.textbook} page ${exercise.page ?? 0}: ${canDo} Prompt: ${excerpt(prompt)}`,
    textbook: source.textbook,
    textbookKey: source.textbookKey,
    level: source.level,
    lessonId: exercise.lesson,
    coreLessonId: normalizeCoreLesson(source, exercise.lesson),
    page: exercise.page ?? 0,
    sourceKind: 'practice_prompt',
    canDo,
    participants: ['A', 'B'],
    sampleDialogue: prompt,
    lines: [
      { speaker: 'A', text: prompt },
      { speaker: 'B', text: levelLine },
    ],
    practicePrompts: [
      prompt,
      canDo,
    ],
  }
}

function sortScenarios(a: SupplementalScenario, b: SupplementalScenario) {
  return a.level.localeCompare(b.level) ||
    a.textbook.localeCompare(b.textbook) ||
    compareLessonId(a, b) ||
    (a.page - b.page) ||
    a.id.localeCompare(b.id)
}

function dedupeScenarios(scenarios: SupplementalScenario[]) {
  const seen = new Set<string>()
  const result: SupplementalScenario[] = []
  for (const scenario of scenarios) {
    const key = `${scenario.textbookKey}:${scenario.lessonId}:${scenario.page}:${scenario.sampleDialogue.slice(0, 40)}`
    if (seen.has(key)) continue
    seen.add(key)
    result.push(scenario)
  }
  return result
}

async function loadSource(source: SupplementalSource): Promise<SupplementalScenario[]> {
  const filePath = TEXTBOOK_FILES[source.textbookKey]
  if (!filePath) return []

  try {
    const response = await fetch(filePath)
    if (!response.ok) return []
    const data = (await response.json()) as RawCurriculum

    const dialogueLimit = source.maxDialogues ?? 12
    const dialogueScenarios = dialogueLimit <= 0
      ? []
      : (data.dialogues ?? [])
        .map((dialogue, index): RankedScenario | null => {
          const score = dialogueQualityScore(source, dialogue)
          const scenario = scenarioFromDialogue(source, dialogue, index)
          return scenario ? { scenario, score } : null
        })
        .filter((entry): entry is RankedScenario => Boolean(entry))
        .sort((a, b) => b.score - a.score || a.scenario.page - b.scenario.page)
        .slice(0, dialogueLimit)
        .map(entry => entry.scenario)

    const promptScenarios = (data.exercises ?? [])
      .map((exercise, index): RankedScenario | null => {
        const score = promptQualityScore(source, exercise)
        const scenario = scenarioFromPrompt(source, exercise, index)
        return scenario ? { scenario, score } : null
      })
      .filter((entry): entry is RankedScenario => Boolean(entry))
      .sort((a, b) => b.score - a.score || a.scenario.page - b.scenario.page)
      .slice(0, source.maxPrompts ?? (source.level === 'A1' || source.level === 'A2' ? 18 : 28))
      .map(entry => entry.scenario)

    return dedupeScenarios([...dialogueScenarios, ...promptScenarios]).sort(sortScenarios)
  } catch {
    return []
  }
}

async function loadCuratedScenarios(): Promise<SupplementalScenario[]> {
  const results: SupplementalScenario[] = []
  for (const [, filePath] of Object.entries(SCENARIO_FILES)) {
    try {
      const response = await fetch(filePath)
      if (!response.ok) continue
      const raw = (await response.json()) as Array<Partial<SupplementalScenario>>
      for (const entry of raw) {
        const source = SOURCES.find(item => item.textbookKey === entry.textbookKey)
        const lessonId = entry.lessonId ?? ''
        const coreLessonId = source && lessonId
          ? normalizeCoreLesson(source, lessonId)
          : entry.coreLessonId
        results.push({
          ...entry as SupplementalScenario,
          title: polishScenarioTitle(entry.title ?? ''),
          canDo: polishCanDo(entry.canDo ?? ''),
          description: polishScenarioDescription(entry.description ?? '', entry.canDo ?? ''),
          practicePrompts: polishPracticePrompts(entry.practicePrompts),
          page: entry.page ?? 0,
          lines: polishScenarioLines(entry.lines ?? buildLinesFromCurated(entry)),
          coreLessonId: coreLessonId ?? entry.coreLessonId,
        })
      }
    } catch {
      // skip missing files
    }
  }
  return results
}

function polishScenarioTitle(title: string) {
  return title
    .replace(/\s+Pair Work\b/gi, '')
    .replace(/^Short Speech:\s*/i, 'Short Speech: ')
    .replace(/\s+Task\s+\d+$/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function polishCanDo(canDo: string) {
  const cleaned = canDo
    .replace(/^Can\s+/i, '')
    .replace(/^Be able to\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!cleaned) return canDo
  return `${cleaned.charAt(0).toUpperCase()}${cleaned.slice(1)}`
}

function polishScenarioDescription(description: string, canDo: string) {
  const polishedCanDo = polishCanDo(canDo)
  return description
    .replace(canDo, polishedCanDo)
    .replace(/\s+/g, ' ')
    .trim()
}

function polishPracticePrompts(prompts: string[] | undefined) {
  return (prompts ?? [])
    .map(prompt => cleanText(prompt))
    .filter(prompt => prompt.length > 0)
}

function polishScenarioLines(lines: SupplementalScenarioLine[]) {
  return lines.map(line => ({
    ...line,
    text: cleanText(line.text),
    translation: line.translation ? cleanText(line.translation) : undefined,
  }))
}

function buildLinesFromCurated(entry: Partial<SupplementalScenario>): SupplementalScenarioLine[] {
  const lines: SupplementalScenarioLine[] = []
  const participants = entry.participants ?? ['A', 'B']
  if (entry.sampleDialogue) {
    lines.push({ speaker: participants[1] ?? 'B', text: entry.sampleDialogue })
  }
  if (entry.practicePrompts) {
    for (const prompt of entry.practicePrompts.slice(0, 3)) {
      lines.push({ speaker: participants[0] ?? 'A', text: prompt })
    }
  }
  return lines
}

export async function getSupplementalScenarios(options: {
  cefr?: CEFRLevel | SupplementalScenario['level'] | string
  textbookKey?: string
  coreLessonId?: string
} = {}): Promise<SupplementalScenario[]> {
  if (!scenarioCache) {
    const [nested, curated] = await Promise.all([
      Promise.all(SOURCES.map(loadSource)),
      loadCuratedScenarios(),
    ])
    scenarioCache = dedupeScenarios([...nested.flat(), ...curated]).sort(sortScenarios)
  }

  const targetLevel = options.cefr?.toUpperCase()
  return scenarioCache.filter(scenario => {
    if (targetLevel && scenario.level !== targetLevel) return false
    if (options.textbookKey && scenario.textbookKey !== options.textbookKey) return false
    if (options.coreLessonId && scenario.coreLessonId !== options.coreLessonId) return false
    return true
  })
}

export function clearSupplementalScenarioCache() {
  scenarioCache = null
}
