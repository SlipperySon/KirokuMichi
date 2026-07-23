/**
 * Normalize unlocked textbook pack payloads into the ContentUpload ExtractionResult shape.
 * Supports both already-normalized extraction JSON and canonical proof packs.
 */
export interface ExtractedVocab {
  word: string
  reading: string
  meaning: string
  jlpt_level?: string
  example_ja?: string
  example_en?: string
}

export interface ExtractedGrammar {
  title: string
  pattern: string
  meaning: string
  explanation: string
  jlpt_level?: string
  examples: { ja: string; reading?: string; en: string }[]
}

export interface ExtractedLesson {
  content_type: 'text_passage' | 'sentence_pair' | 'word_list' | 'dialogue_script'
  title: string
  body: string
  translation?: string
  sequence: number
}

export interface ExtractionResult {
  source_title?: string
  vocab: ExtractedVocab[]
  grammar: ExtractedGrammar[]
  lessons: ExtractedLesson[]
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function mapCanonicalVocab(items: unknown[]): ExtractedVocab[] {
  return items.flatMap((raw) => {
    const item = asRecord(raw)
    if (!item) return []
    const word = str(item.surface ?? item.word ?? item.japanese)
    const meaning = str(item.meaning ?? item.english)
    if (!word || !meaning) return []
    return [{
      word,
      reading: str(item.reading),
      meaning,
      jlpt_level: typeof item.jlpt_level === 'string' ? item.jlpt_level : undefined,
      example_ja: typeof item.example_ja === 'string' ? item.example_ja : undefined,
      example_en: typeof item.example_en === 'string' ? item.example_en : undefined,
    }]
  })
}

function mapCanonicalGrammar(items: unknown[]): ExtractedGrammar[] {
  return items.flatMap((raw) => {
    const item = asRecord(raw)
    if (!item) return []
    const pattern = str(item.pattern ?? item.title)
    const meaning = str(item.meaning)
    if (!pattern) return []
    const examplesRaw = Array.isArray(item.examples) ? item.examples : []
    const examples = examplesRaw.flatMap((ex) => {
      const row = asRecord(ex)
      if (!row) return []
      const ja = str(row.japanese ?? row.ja)
      const en = str(row.english ?? row.en)
      if (!ja && !en) return []
      return [{ ja, reading: str(row.reading) || undefined, en }]
    })
    return [{
      title: str(item.title, pattern),
      pattern,
      meaning,
      explanation: str(item.explanation),
      jlpt_level: typeof item.jlpt_level === 'string' ? item.jlpt_level : undefined,
      examples,
    }]
  })
}

function mapCanonicalLessons(lessons: unknown[]): {
  vocab: ExtractedVocab[]
  grammar: ExtractedGrammar[]
  lessons: ExtractedLesson[]
} {
  const vocab: ExtractedVocab[] = []
  const grammar: ExtractedGrammar[] = []
  const mappedLessons: ExtractedLesson[] = []

  lessons.forEach((raw, index) => {
    const lesson = asRecord(raw)
    if (!lesson) return
    vocab.push(...mapCanonicalVocab(Array.isArray(lesson.vocabulary) ? lesson.vocabulary : []))
    grammar.push(...mapCanonicalGrammar(Array.isArray(lesson.grammar) ? lesson.grammar : []))

    const blocks = Array.isArray(lesson.contentBlocks) ? lesson.contentBlocks : []
    for (const blockRaw of blocks) {
      const block = asRecord(blockRaw)
      if (!block) continue
      const body = str(block.text ?? block.body)
      if (!body.trim()) continue
      const type = str(block.type)
      const content_type: ExtractedLesson['content_type'] =
        type === 'dialogue' || type === 'dialogue_script'
          ? 'dialogue_script'
          : type === 'word_list'
            ? 'word_list'
            : type === 'sentence_pair'
              ? 'sentence_pair'
              : 'text_passage'
      mappedLessons.push({
        content_type,
        title: str(block.title ?? lesson.title, `Lesson ${index + 1}`),
        body,
        translation: typeof block.translation === 'string' ? block.translation : undefined,
        sequence: mappedLessons.length,
      })
    }

    if (blocks.length === 0 && str(lesson.title)) {
      mappedLessons.push({
        content_type: 'text_passage',
        title: str(lesson.title),
        body: str(lesson.title),
        sequence: mappedLessons.length,
      })
    }
  })

  return { vocab, grammar, lessons: mappedLessons }
}

/** Convert unlocked pack JSON into ContentUpload preview/import shape. */
export function normalizeUnlockedPackPayload(payload: unknown, fallbackTitle: string): ExtractionResult {
  const root = asRecord(payload)
  if (!root) {
    return { source_title: fallbackTitle, vocab: [], grammar: [], lessons: [] }
  }

  // Already in extraction shape
  if (Array.isArray(root.vocab) || Array.isArray(root.grammar) || Array.isArray(root.lessons)) {
    const lessonsLooksExtracted = Array.isArray(root.lessons)
      && root.lessons.some((item) => {
        const row = asRecord(item)
        return Boolean(row && ('content_type' in row || 'body' in row))
      })
    if (lessonsLooksExtracted || Array.isArray(root.vocab) || Array.isArray(root.grammar)) {
      return {
        source_title: str(root.source_title, fallbackTitle) || fallbackTitle,
        vocab: mapCanonicalVocab(Array.isArray(root.vocab) ? root.vocab : []),
        grammar: Array.isArray(root.grammar)
          ? root.grammar.flatMap((raw) => {
            const item = asRecord(raw)
            if (!item) return []
            // Extraction grammar already uses title/pattern/meaning
            if ('pattern' in item || 'title' in item) {
              return mapCanonicalGrammar([item])
            }
            return []
          })
          : [],
        lessons: lessonsLooksExtracted
          ? (root.lessons as unknown[]).flatMap((raw, sequence) => {
            const item = asRecord(raw)
            if (!item) return []
            const body = str(item.body)
            if (!body) return []
            const contentType = str(item.content_type, 'text_passage') as ExtractedLesson['content_type']
            return [{
              content_type: contentType,
              title: str(item.title, `Lesson ${sequence + 1}`),
              body,
              translation: typeof item.translation === 'string' ? item.translation : undefined,
              sequence: typeof item.sequence === 'number' ? item.sequence : sequence,
            }]
          })
          : mapCanonicalLessons(Array.isArray(root.lessons) ? root.lessons : []).lessons,
      }
    }
  }

  // Canonical proof / reviewed pack shape
  if (Array.isArray(root.lessons)) {
    const mapped = mapCanonicalLessons(root.lessons)
    return {
      source_title: str(root.title, fallbackTitle) || fallbackTitle,
      vocab: mapped.vocab,
      grammar: mapped.grammar,
      lessons: mapped.lessons,
    }
  }

  return {
    source_title: str(root.title ?? root.source_title, fallbackTitle) || fallbackTitle,
    vocab: mapCanonicalVocab(Array.isArray(root.vocabulary) ? root.vocabulary : []),
    grammar: mapCanonicalGrammar(Array.isArray(root.grammar) ? root.grammar : []),
    lessons: [],
  }
}
