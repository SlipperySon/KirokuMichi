export type TextbookKey =
  | 'genki_1'
  | 'genki_2'
  | 'quartet_1'
  | 'quartet_2'
  | 'marugoto_a1'
  | 'marugoto_a2'
  | 'marugoto_b1'
  | 'tobira'
  | 'maynard_grammar'

export type CurriculumRole = 'core' | 'pair' | 'in_depth_grammar'

export type CefrPhase = 'A1' | 'A2' | 'B1' | 'B2' | 'global'

export type SourceRole =
  | 'textbook'
  | 'workbook'
  | 'answer_key'
  | 'grammar_reference'
  | 'supplement'
  | 'support'
  | 'unknown'

export type LessonMode = 'conversation_grammar' | 'reading_writing' | 'reading' | 'writing' | 'speaking' | 'listening' | 'workbook'

export interface SourceFingerprint {
  sha256: string
  bytes: number
}

export interface SourceOutlineEntry {
  title: string
  pageNumber: number | null
  depth: number
}

export interface SourceSplitHint {
  kind: 'pre_lesson' | 'lesson' | 'supplement' | 'vocab' | 'kanji' | 'answer_section' | 'listening_script' | 'reading_writing'
  label: string
  pageNumber: number | null
  lessonNumber?: number
}

export interface SourceManifestEntry {
  id: string
  fileName: string
  relativePath: string
  textbookKey: TextbookKey | null
  curriculumRole: CurriculumRole | null
  cefrPhase: CefrPhase | null
  role: SourceRole
  confidence: 'high' | 'medium' | 'low'
  pageCount: number
  sizeMb: number
  fingerprint: SourceFingerprint
  outline: SourceOutlineEntry[]
  splitHints: SourceSplitHint[]
  notes: string[]
}

export interface TextbookSourceManifest {
  generatedAt: string
  sourceRoot: string
  entries: SourceManifestEntry[]
  gaps: string[]
}

export interface CanonicalTextbookPack {
  schemaVersion: 1
  textbookKey: TextbookKey
  title: string
  edition?: string
  levelRange?: string
  sources: Array<{
    sourceId: string
    role: SourceRole
    fingerprint: SourceFingerprint
  }>
  lessons: CanonicalLesson[]
}

export interface CanonicalLesson {
  id: string
  unitType?: 'pre_lesson' | 'lesson'
  lessonNumber: number
  title: string
  level?: string
  pageRange?: {
    start: number
    end: number
  }
  modes: LessonMode[]
  vocabulary: VocabEntry[]
  grammar: GrammarEntry[]
  contentBlocks: ContentBlock[]
  exercises: ExerciseEntry[]
}

export interface VocabEntry {
  id: string
  surface: string
  reading?: string
  meaning: string
  partOfSpeech?: string
  lessonNumber: number
  sourceRef: SourceReference
  tags?: string[]
  review?: ReviewMetadata
}

export interface GrammarEntry {
  id: string
  pattern: string
  meaning: string
  explanation?: string
  examples: Array<{
    japanese: string
    reading?: string
    english?: string
  }>
  lessonNumber: number
  sourceRef: SourceReference
  review?: ReviewMetadata
}

export interface ContentBlock {
  id: string
  type: 'dialogue' | 'reading' | 'grammar_note' | 'activity' | 'image' | 'table' | 'instruction' | 'listening_script'
  mode?: LessonMode
  title?: string
  text?: string
  imageFile?: string
  imageSourceRef?: SourceReference
  sourceRef: SourceReference
  review?: ReviewMetadata
}

export interface ExerciseEntry {
  id: string
  label: string
  prompt?: string
  targetGrammarIds?: string[]
  imageFile?: string
  imageSourceRef?: SourceReference
  sourceRef: SourceReference
  answerKeyRef?: SourceReference
  answerKeyRefs?: SourceReference[]
  answerKey?: ExerciseAnswerKey
  listeningScriptRef?: SourceReference
  review?: ReviewMetadata
}

export interface ExerciseAnswerKey {
  gradingMode: 'exact' | 'sample' | 'open_ended' | 'manual'
  sourceText?: string
  items?: Array<{
    label?: string
    answer: string
  }>
  notes?: string
}

export interface SourceReference {
  sourceId: string
  pageNumber: number
  coordinates?: [number, number, number, number]
}

export type ReviewAction = 'pending' | 'approved' | 'fixed' | 'ignored'
export type CorrectableItemKind = 'vocabulary' | 'grammar' | 'contentBlocks' | 'exercises'

export interface ReviewMetadata {
  action: ReviewAction
  reviewedAt?: string
  reviewer?: string
  notes?: string
}

export interface TextbookPackCorrections {
  schemaVersion: 1
  packId: string
  basedOnProof: string
  generatedAt: string
  corrections: TextbookPackCorrection[]
  additions?: Partial<{
    vocabulary: VocabEntry[]
    grammar: GrammarEntry[]
    contentBlocks: ContentBlock[]
    exercises: ExerciseEntry[]
  }>
}

export interface TextbookPackCorrection {
  id: string
  kind: CorrectableItemKind
  action: ReviewAction
  current?: Record<string, unknown>
  replacement?: Partial<VocabEntry & GrammarEntry & ContentBlock & ExerciseEntry>
  notes?: string
}

export type NormalizedPageKind =
  | 'front_matter'
  | 'lesson_overview'
  | 'dialogue'
  | 'reading'
  | 'grammar'
  | 'lesson_vocab'
  | 'vocab_index'
  | 'bessatsu_vocab'
  | 'bessatsu_kanji'
  | 'workbook_exercise'
  | 'kana_practice'
  | 'answer_key'
  | 'listening_script'
  | 'index'
  | 'unknown'

export interface NormalizedOcrLine {
  id: string
  text: string
  normalizedText: string
  score: number | null
  box: [number, number, number, number] | null
  polygon: Array<[number, number]> | null
  lineIndex: number
}

export interface NormalizedPage {
  schemaVersion: 1
  sourceId: string
  sourceRole: SourceRole
  textbookKey: TextbookKey | null
  curriculumRole?: CurriculumRole | null
  cefrPhase?: CefrPhase | null
  pageNumber: number
  section: {
    kind: SourceSplitHint['kind'] | 'front_matter' | 'index' | 'unknown'
    label: string | null
    lessonNumber?: number
    startsAtPage?: number | null
  }
  pageKind: NormalizedPageKind
  image: {
    width: number
    height: number
    dpi: number
    path: string | null
  }
  lines: NormalizedOcrLine[]
  text: string
  stats: {
    lineCount: number
    lowConfidenceLineCount: number
    averageScore: number | null
    elapsedSeconds?: number
  }
  warnings: string[]
}

export type GroupedBlockType =
  | 'heading'
  | 'text_block'
  | 'dialogue_turn'
  | 'table_row'
  | 'exercise_prompt'
  | 'noise'

export interface GroupedPageBlock {
  id: string
  type: GroupedBlockType
  text: string
  lineIds: string[]
  boundingBox: [number, number, number, number] | null
  columns?: string[]
  score?: number | null
  warnings?: string[]
}

export interface GroupedPage {
  schemaVersion: 1
  sourceId: string
  textbookKey: TextbookKey | null
  curriculumRole?: CurriculumRole | null
  cefrPhase?: CefrPhase | null
  pageNumber: number
  pageKind: NormalizedPageKind
  section: NormalizedPage['section']
  blocks: GroupedPageBlock[]
  stats: {
    blockCount: number
    sourceLineCount: number
    groupedLineCount: number
  }
  warnings: string[]
}
