import type { GrammarItem, VocabItem } from './curriculumService'

export const GENKI_1_PRE_LESSON_VOCAB: VocabItem[] = [
  { id: 'genki_1_lesson_1_foundation_ohayou', surface: 'おはようございます', english: 'Good morning', lesson: 'genki_1_1', source: 'genki_1_foundation', page: 0 },
  { id: 'genki_1_lesson_1_foundation_konnichiwa', surface: 'こんにちは', english: 'Hello / good afternoon', lesson: 'genki_1_1', source: 'genki_1_foundation', page: 0 },
  { id: 'genki_1_lesson_1_foundation_konbanwa', surface: 'こんばんは', english: 'Good evening', lesson: 'genki_1_1', source: 'genki_1_foundation', page: 0 },
  { id: 'genki_1_lesson_1_foundation_sayounara', surface: 'さようなら', english: 'Goodbye', lesson: 'genki_1_1', source: 'genki_1_foundation', page: 0 },
  { id: 'genki_1_lesson_1_foundation_arigatou', surface: 'ありがとうございます', english: 'Thank you', lesson: 'genki_1_1', source: 'genki_1_foundation', page: 0 },
  { id: 'genki_1_lesson_1_foundation_sumimasen', surface: 'すみません', english: 'Excuse me / I am sorry', lesson: 'genki_1_1', source: 'genki_1_foundation', page: 0 },
  { id: 'genki_1_lesson_1_foundation_iie', surface: 'いいえ', english: 'No / not at all', lesson: 'genki_1_1', source: 'genki_1_foundation', page: 0 },
  { id: 'genki_1_lesson_1_foundation_zero', surface: 'ゼロ / れい', english: 'zero', lesson: 'genki_1_1', source: 'genki_1_foundation', page: 0 },
  { id: 'genki_1_lesson_1_foundation_ichi', surface: 'いち', english: 'one', lesson: 'genki_1_1', source: 'genki_1_foundation', page: 0 },
  { id: 'genki_1_lesson_1_foundation_ni', surface: 'に', english: 'two', lesson: 'genki_1_1', source: 'genki_1_foundation', page: 0 },
  { id: 'genki_1_lesson_1_foundation_san', surface: 'さん', english: 'three', lesson: 'genki_1_1', source: 'genki_1_foundation', page: 0 },
  { id: 'genki_1_lesson_1_foundation_yon', surface: 'よん / し', english: 'four', lesson: 'genki_1_1', source: 'genki_1_foundation', page: 0 },
  { id: 'genki_1_lesson_1_foundation_go', surface: 'ご', english: 'five', lesson: 'genki_1_1', source: 'genki_1_foundation', page: 0 },
  { id: 'genki_1_lesson_1_foundation_roku', surface: 'ろく', english: 'six', lesson: 'genki_1_1', source: 'genki_1_foundation', page: 0 },
  { id: 'genki_1_lesson_1_foundation_nana', surface: 'なな / しち', english: 'seven', lesson: 'genki_1_1', source: 'genki_1_foundation', page: 0 },
  { id: 'genki_1_lesson_1_foundation_hachi', surface: 'はち', english: 'eight', lesson: 'genki_1_1', source: 'genki_1_foundation', page: 0 },
  { id: 'genki_1_lesson_1_foundation_kyuu', surface: 'きゅう / く', english: 'nine', lesson: 'genki_1_1', source: 'genki_1_foundation', page: 0 },
  { id: 'genki_1_lesson_1_foundation_juu', surface: 'じゅう', english: 'ten', lesson: 'genki_1_1', source: 'genki_1_foundation', page: 0 },
]

const GENKI_1_LESSON_1_GRAMMAR_PATTERNS = new Set(['です', 'は', 'か', 'の', 'これ', 'それ', 'あれ', 'も'])

export function applyGenkiLessonOneFoundation(lessonId: string, vocab: VocabItem[]): VocabItem[] {
  if (lessonId !== 'genki_1_1') return vocab

  const seen = new Set(vocab.map(item => item.surface))
  return [
    ...GENKI_1_PRE_LESSON_VOCAB.filter(item => !seen.has(item.surface)),
    ...vocab,
  ]
}

export function applyGenkiLessonOneGrammarScope(lessonId: string, grammar: GrammarItem[]): GrammarItem[] {
  if (lessonId !== 'genki_1_1') return grammar

  const scoped = grammar.filter(item => GENKI_1_LESSON_1_GRAMMAR_PATTERNS.has(item.pattern))
  return scoped.length > 0 ? scoped : grammar
}
