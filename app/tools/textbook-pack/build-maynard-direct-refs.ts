import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

interface MaynardTopic {
  id: string
  title: string
  pageStart?: number
  pageEnd?: number
  text?: string
  examples?: Array<{ japanese?: string; english?: string }>
}

interface MaynardComprehensive {
  sourceId?: string
  topicIndex: Record<string, MaynardTopic>
}

interface RefSeed {
  id: string
  topicId: string
  aliases: string[]
  confidence: 'direct' | 'keyword'
}

const SOURCE_PATH = 'tools/textbook-pack/out/comprehensive/maynard_grammar-comprehensive.json'
const OUT_PATH = 'src/content/maynardDirectRefs.generated.ts'

const SOURCE_ID = 'maynard_grammar_grammar_reference'
const MAX_EXCERPT_LENGTH = 900

const SEEDS: RefSeed[] = [
  seed('copula-being', 'verb_grammar/being_です_だ_ある_いる', [
    'です',
    'だ',
    'ある',
    'いる',
    'がある',
    'がいる',
    'じゃない',
    'じゃありません',
    'ではない',
  ]),
  seed('ko-so-a-do', 'verb_grammar/pronouns_こそあど', [
    'これ',
    'それ',
    'あれ',
    'どれ',
    'ここ',
    'そこ',
    'あそこ',
    'どこ',
    'この',
    'その',
    'あの',
    'どの',
  ]),
  seed('adjectives', 'verb_grammar/adjectives', ['い-Adjective', 'い-Adjectives', 'な-Adjective', 'な-Adjectives', '形容詞', '形容動詞']),
  seed('basic-inflections', 'verb_grammar/basic_inflections', [
    'Verb (Non-past)',
    'Dictionary form',
    'う-Verb (Dictionary)',
    'る-Verb (Dictionary)',
    'Negative',
    'Negative-Past',
    'Past',
    'ます',
    'ません',
    'ました',
    'ませんでした',
  ]),
  seed('te-form', 'more_grammar/continuative_て_form', [
    'Verb て',
    'Adjective + て',
    'ている',
    'てある',
    'てしまう',
    'てみる',
    'てから',
    'なくて',
    'てよかった',
    'ちゃう',
    'ていく',
    'ていた',
    'て初めて',
  ]),
  seed('requesting', 'more_grammar/requesting_て_てください', ['てください', 'て下さい', 'ください', 'て頂戴', 'お～願う']),
  seed('representative-listing', 'more_grammar/representative_listing_たり', ['たり', 'たり～たり', 'し～し']),
  seed('conditional-tara-nara', 'more_grammar/conditional_たら_なら', ['たら', 'なら', 'ならば', 'もし']),
  seed('desire', 'more_grammar/desire', ['たい', 'たがる', 'ほしい', '欲しい', 'がほしい', 'のがすき', '好き', 'きらい', '嫌い']),
  seed('volitional', 'more_grammar/pseudo_future_おう_よう', ['ようと思う', 'おうと思う', 'Verb[よう]', 'ましょう', 'ませんか']),
  seed('hypothetical-eba', 'more_grammar/hypothetical_えば', ['ば', 'えば', 'なければ', 'ばいい']),
  seed('commands', 'more_grammar/commands', ['命令形', 'な$', 'たまえ', 'なさい', 'ないで', 'そんな', 'こんな', 'あんな', 'どんな']),
  seed('passive', 'more_grammar/passive_れる_られる', ['れる', 'られる', 'Passive']),
  seed('causative', 'more_grammar/causative_せる_させる', ['せる', 'させる', 'Causative']),
  seed('causative-passive', 'more_grammar/causative_passive_せられる_させられる', ['せられる', 'させられる', 'Causative-Passive']),
  seed('potential', 'more_grammar/potential', ['ことができる', 'できる', '得る', 'Potential', 'づらい', 'ぎみ', '切る', '抜く', '聞こえる', '見える']),
  seed('humble-honorific', 'more_grammar/formality_humble_honorific_speech_patterns', ['お～になる', 'いらっしゃる', 'なさる', 'いたす', 'ございます', 'でございます']),
  seed('particles-essential', 'particles/essential_particles', [
    'は',
    'が',
    'も',
    'の',
    'か',
    'を',
    'で',
    'に',
    'へ',
    'と',
    'や',
    'ね',
    'よ',
    'から',
    'まで',
    'ごろ',
  ]),
  seed('emphatic-particles', 'particles/emphatic_particles', ['しか', 'ばかり', 'だけ', 'こそ', 'さえ', 'でも', 'くらい', 'ほど', 'など']),
  seed('further-particles', 'particles/further_particles', [
    'について',
    'として',
    'において',
    'に関して',
    'に対して',
    'によって',
    'につれて',
    'にしたがって',
    'にとって',
    'に取って',
    'から見ると',
    'から言うと',
    '上',
    '以上',
    '反面',
    '限り',
    '向き',
    '向け',
  ]),
  seed('counting', 'counters_and_counting/counting', ['Number', 'なん + counter', '一つ', '二つ', 'いくつ']),
  seed('counters', 'counters_and_counting/counters', ['counter', 'Counters', '枚', '冊', '本', '人']),
  seed('time-counting', 'counters_and_counting/counting_time_related_units', ['時間', '日', '週間', 'か月', '年', '分']),
  seed('comparison-choice', 'language_patterns/comparisons_preferences_and_choice', ['より', 'のほうが', 'どちら', 'どっち', 'あまり']),
  seed('binary-choices', 'language_patterns/binary_choices', ['かどうか']),
  seed('likeness-impression', 'language_patterns/comparison_through_likeness_and_impressions', ['ように', 'ような', 'みたい', 'らしい', 'そうだ', 'そうです', 'そうに', 'そうな', 'あげく', '風']),
  seed('possibilities', 'language_patterns/discussing_possibilities', ['かもしれない', 'でしょう', 'だろう']),
  seed('nominalising', 'language_patterns/nominalising', ['こと', 'のこと', 'ことがある', 'たことがある']),
  seed('back-referral-no', 'language_patterns/back_referral_using_の', ['のです', 'んです', 'のだ', 'んだ']),
  seed('abstract-koto', 'language_patterns/abstract_conceptualisation_using_こと_事', ['ことだ', 'ことなく']),
  seed('time-toki', 'language_patterns/indicating_a_specific_time_or_event_using_とき_時', ['とき', '時']),
  seed('expectation-hazu', 'language_patterns/stating_an_expectation_using_はず_筈', ['はず']),
  seed('social-expectation-beki', 'language_patterns/stating_a_social_expectation_or_custom_using_べき', ['べき']),
  seed('moment-tokoro', 'language_patterns/indicating_a_moment_in_time_using_ところ_所', ['ところ', 'ところで', 'ところが', 'ところに', 'きり']),
  seed('intention-tsumori', 'language_patterns/stating_an_intention_using_つ_積_もり', ['つもり']),
  seed('reason-wake', 'language_patterns/stating_a_meaning_or_situational_explanation_using_わけ_訳', ['わけ', 'わけではない']),
  seed('manner-you', 'language_patterns/describing_a_way_using_よう_様', ['ようにする', 'ようがない']),
  seed('unchanged-mama', 'language_patterns/indicating_an_exact_manner_using_まま', ['まま']),
  seed('purpose-tame', 'language_patterns/stating_purpose_using_ため_為', ['ため', 'ために', 'ための']),
  seed('quoting-to-iu', 'language_patterns/talking_about_a_something_using_とい_言_う', ['という', 'って', 'といった', 'とか', 'いわゆる', 'そういう']),
  seed('giving-receiving', 'language_patterns/giving_and_receiving', ['てあげる', 'てくれる', 'てもらう', 'あげる', 'くれる', 'もらう']),
  seed('indirect-speech', 'language_patterns/indirect_speech', ['と言う', 'と思う', 'と考える', 'とされている', 'と考えられている']),
  seed('adverbs', 'the_syntax/adverbs', [
    'いきなり',
    'おそらく',
    'けっこう',
    'せめて',
    'ぜんぜん',
    'たくさん',
    'たちまち',
    'つまり',
    'どうして',
    'どうせ',
    'どんどん',
    'なお',
    'なぜ',
    'まず',
    'また',
    '一応',
    '一旦',
    '何しろ',
    '精々',
  ], 'keyword'),
  seed('more-negatives', 'more_grammar/more_negatives', ['ざる', 'ぬ', 'まい'], 'keyword'),
  seed('verb-classes', 'the_syntax/verbs', ['他動詞・自動詞', '自動詞', '他動詞', 'おわる', 'つづける'], 'keyword'),
  seed('nouns', 'the_syntax/nouns', ['ら', '代', '中', '気'], 'keyword'),
  seed('pronouns', 'the_syntax/pronouns', ['誰'], 'keyword'),
  seed('prefixes', 'the_syntax/prefixes', ['各', '真'], 'keyword'),
  seed('conjunctive', 'more_grammar/conjunctive', ['つつ', 'っぱなし'], 'keyword'),
  seed('open-choices', 'language_patterns/open_choices', ['か何か', 'なり', 'やら', 'とか', 'など'], 'keyword'),
  seed('real-conceptualisation', 'language_patterns/real_conceptualisation_using_もの_物', ['もの', 'もん'], 'keyword'),
  seed('case-baai', 'language_patterns/illustrating_a_circumstance_case_or_occasion_using_ばあい_場合', ['場合', 'ケース'], 'keyword'),
  seed('shidai', 'language_patterns/indicating_a_moment_of_opportunity_using_しだい_次第', ['次第', 'しだい'], 'keyword'),
  seed('tabi', 'language_patterns/describing_an_occurrence_using_たび_度', ['たび', '度に'], 'keyword'),
  seed('mane', 'language_patterns/incidating_apparent_behaviour_using_まね_真似', ['まね', '真似'], 'keyword'),
]

function seed(id: string, topicId: string, aliases: string[], confidence: 'direct' | 'keyword' = 'direct'): RefSeed {
  return { id, topicId, aliases, confidence }
}

function main() {
  const sourcePath = resolve(process.cwd(), SOURCE_PATH)
  const source = JSON.parse(readFileSync(sourcePath, 'utf8')) as MaynardComprehensive
  const refs = SEEDS.map(refSeed => {
    const topic = source.topicIndex[refSeed.topicId]
    if (!topic) {
      throw new Error(`Missing Maynard topic for direct ref ${refSeed.id}: ${refSeed.topicId}`)
    }
    return {
      id: refSeed.id,
      topicId: topic.id,
      title: topic.title,
      sourceId: source.sourceId ?? SOURCE_ID,
      pageStart: topic.pageStart,
      pageEnd: topic.pageEnd,
      excerpt: excerptFor(topic),
      examples: examplesFor(topic),
      aliases: unique([topic.title, ...refSeed.aliases]),
      confidence: refSeed.confidence,
    }
  })

  const aliasIndex: Record<string, number[]> = {}
  refs.forEach((ref, index) => {
    for (const alias of ref.aliases) {
      const key = normalize(alias)
      if (!key) continue
      aliasIndex[key] ??= []
      aliasIndex[key].push(index)
    }
  })

  const output = [
    '/* This file is generated by tools/textbook-pack/build-maynard-direct-refs.ts. Do not edit by hand. */',
    '',
    "import type { GrammarItem } from './curriculumService'",
    '',
    "export type MaynardDirectRef = NonNullable<GrammarItem['maynardRef']> & {",
    "  sourceKind: 'direct'",
    "  confidence: 'direct' | 'keyword'",
    '  sourceId: string',
    '  pageStart?: number',
    '  pageEnd?: number',
    '  aliases: string[]',
    '}',
    '',
    `const MAYNARD_DIRECT_REFS: MaynardDirectRef[] = ${JSON.stringify(
      refs.map(ref => ({
        topicId: ref.topicId,
        title: ref.title,
        excerpt: ref.excerpt,
        examples: ref.examples,
        sourceKind: 'direct',
        confidence: ref.confidence,
        sourceId: ref.sourceId,
        pageStart: ref.pageStart,
        pageEnd: ref.pageEnd,
        aliases: ref.aliases,
      })),
      null,
      2
    )} as const`,
    '',
    `const MAYNARD_ALIAS_INDEX: Record<string, number[]> = ${JSON.stringify(aliasIndex, null, 2)} as const`,
    '',
    "export function findMaynardDirectRef(pattern: string): MaynardDirectRef | undefined {",
    '  const key = normalizeMaynardAlias(pattern)',
    '  const exact = MAYNARD_ALIAS_INDEX[key]',
    '  if (exact?.length) return MAYNARD_DIRECT_REFS[exact[0]]',
    '',
    '  const compactKey = key.replace(/[()\\[\\]{}+~〜・･]/g, \'\')',
    '  for (const [alias, indexes] of Object.entries(MAYNARD_ALIAS_INDEX)) {',
    '    if (!alias) continue',
    '    const compactAlias = alias.replace(/[()\\[\\]{}+~〜・･]/g, \'\')',
    '    if (compactAlias && (compactKey.includes(compactAlias) || compactAlias.includes(compactKey))) {',
    '      return MAYNARD_DIRECT_REFS[indexes[0]]',
    '    }',
    '  }',
    '  return undefined',
    '}',
    '',
    'export function getMaynardDirectRefStats() {',
    '  return { refCount: MAYNARD_DIRECT_REFS.length, aliasCount: Object.keys(MAYNARD_ALIAS_INDEX).length }',
    '}',
    '',
    'function normalizeMaynardAlias(value: string): string {',
    '  return value',
    "    .toLowerCase()",
    "    .replace(/[\\u3000\\s]/g, '')",
    "    .replace(/〜/g, '~')",
    "    .replace(/下さい/g, 'ください')",
    "    .replace(/[“”]/g, '\"')",
    "    .replace(/[’]/g, \"'\")",
    '}',
    '',
  ].join('\n')

  const outPath = resolve(process.cwd(), OUT_PATH)
  mkdirSync(dirname(outPath), { recursive: true })
  writeFileSync(outPath, output)
  console.log(JSON.stringify({ outPath: OUT_PATH, refs: refs.length, aliases: Object.keys(aliasIndex).length }, null, 2))
}

function excerptFor(topic: MaynardTopic): string {
  const cleaned = cleanText(topic.text ?? '')
  const start = findTopicStart(cleaned, topic.title)
  const focused = start > 0 ? cleaned.slice(start) : cleaned
  const titlePattern = escapeRegExp(topic.title)
  const titled = focused
    .replace(new RegExp(`^\\d+(?:\\.\\d+)*\\.?\\s*${titlePattern.replace(/\\s+/g, '\\s*')}`, 'i'), topic.title)
    .replace(/^\d+(?:\.\d+)*\.?\s*/g, '')
    .trim()

  const sentenceEnd = titled.search(/[。.!?]\s/)
  const firstSentence = sentenceEnd > 140 ? titled.slice(0, sentenceEnd + 1) : titled
  return firstSentence.slice(0, MAX_EXCERPT_LENGTH).trim()
}

function examplesFor(topic: MaynardTopic): Array<{ japanese: string; english?: string }> {
  return (topic.examples ?? [])
    .map(example => ({
      japanese: cleanText(example.japanese ?? ''),
      english: example.english ? cleanText(example.english) : undefined,
    }))
    .filter(example => usefulJapaneseExample(example.japanese))
    .filter(example => example.japanese.length >= 3 && example.japanese.length <= 120)
    .slice(0, 3)
}

function cleanText(value: string): string {
  return value
    .replace(/\s+/g, ' ')
    .replace(/\bCHAPTER\s+\d+\.\s+[A-Z ]+/gi, '')
    .replace(/\d+\.\d+\.\s+[A-Z][A-Z ]+\s+\d+/g, '')
    .trim()
}

function hasJapanese(value: string): boolean {
  return /[\u3040-\u30ff\u3400-\u9fff]/.test(value)
}

function usefulJapaneseExample(value: string): boolean {
  if (!hasJapanese(value)) return false
  const jpChars = [...value].filter(char => /[\u3040-\u30ff\u3400-\u9fff]/.test(char)).length
  const letters = [...value].filter(char => /[a-z]/i.test(char)).length
  if (/^\d+(?:\.\d+)*\s/.test(value)) return false
  if (letters > jpChars * 2) return false
  return jpChars >= 3
}

function findTopicStart(text: string, title: string): number {
  const lower = text.toLowerCase()
  const exactVariants = [
    title,
    title.replace(/:\s*/g, ':').replace(/,\s*/g, ','),
    title.replace(/\s+/g, ''),
  ]
    .map(value => value.trim().toLowerCase())
    .filter(Boolean)

  const indexes = exactVariants.map(variant => lower.indexOf(variant)).filter(index => index >= 0)
  const head = title.split(':')[0].trim()
  const sectionMatch = head ? lower.match(new RegExp(`\\d+(?:\\.\\d+)+\\s+${escapeRegExp(head.toLowerCase())}`)) : null
  if (sectionMatch?.index !== undefined) indexes.push(sectionMatch.index)

  const usefulIndexes = indexes
    .filter(index => index > 40)
  if (usefulIndexes.length === 0) return 0
  return Math.min(...usefulIndexes)
}

function unique(values: string[]): string[] {
  return [...new Set(values.map(value => value.trim()).filter(Boolean))]
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[\u3000\s]/g, '')
    .replace(/〜/g, '~')
    .replace(/下さい/g, 'ください')
    .replace(/[“”]/g, '"')
    .replace(/[’]/g, "'")
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

main()
