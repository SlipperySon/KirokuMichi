import { useState, useRef } from 'react'
import { useAppStore } from '../store'
import { SQLiteStorage } from '../db/sqlite'
import { importFromAnki } from '../srs/ankiImport'
import { ClientAIProvider } from '../ai/aiProvider'
import { toast } from '../components/toastStore'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ExtractedVocab {
  word: string
  reading: string
  meaning: string
  jlpt_level?: string
  example_ja?: string
  example_en?: string
}

interface ExtractedGrammar {
  title: string
  pattern: string
  meaning: string
  explanation: string
  jlpt_level?: string
  examples: { ja: string; reading?: string; en: string }[]
}

interface ExtractedLesson {
  content_type: 'text_passage' | 'sentence_pair' | 'word_list' | 'dialogue_script'
  title: string
  body: string
  translation?: string
  sequence: number
}

interface ExtractionResult {
  source_title?: string
  vocab: ExtractedVocab[]
  grammar: ExtractedGrammar[]
  lessons: ExtractedLesson[]
}

interface ImportSummary {
  vocab: number
  grammar: number
  lessons: number
}

interface DevPdfTestResult {
  files: { name: string; sizeMB: number; pages: number; extractedChars: number; ocrUsed?: boolean }[]
  ai: {
    model: string
    responseChars: number
    validJson: boolean
    parseError: string | null
    counts: { vocab: number; grammar: number; lessons: number } | null
    sourceTitle: string | null
  }
}

interface DevPdfOcrResult {
  ok: boolean
  elapsedMs: number
  files: { name: string; sizeMB: number; pages: number; extractedPages: number; extractedChars: number; charsPerPage: number; textSparse: boolean; ocrUsed?: boolean }[]
  totals: { pages: number; chars: number; charsPerPage: number }
}

interface ServerPdfExtractionResponse {
  result: ExtractionResult
  files: { name: string; sizeMB: number; pages: number; extractedChars: number; ocrUsed?: boolean }[]
}

interface PdfRange {
  startPage: number
  pageCount: number
}

// ---------------------------------------------------------------------------
// System prompt — strict multi-category extraction
// ---------------------------------------------------------------------------

const EXTRACTION_SYSTEM_PROMPT = `You are a Japanese learning content extractor for KirokuMichi.

Given any Japanese learning material (textbook pages, grammar guides, vocabulary lists, dialogues, reading passages), extract ALL of the following into one JSON object. Do not omit a category — if nothing fits it, output an empty array.

OUTPUT FORMAT (output ONLY this JSON, no markdown fences, no commentary):
{
  "source_title": "<name or title of the source material if identifiable, otherwise null>",
  "vocab": [...],
  "grammar": [...],
  "lessons": [...]
}

## vocab — every vocabulary item in the material
Each item:
{
  "word": "<the Japanese word or phrase — required>",
  "reading": "<hiragana/katakana reading — required if any kanji present, otherwise omit>",
  "meaning": "<concise English meaning — required>",
  "jlpt_level": "<N5|N4|N3|N2|N1 — include only if the source specifies it>",
  "example_ja": "<an example sentence using this word in Japanese — optional>",
  "example_en": "<English translation of the example — optional>"
}
Rules:
- Include EVERY word that appears with a definition, reading, or translation
- Do not include grammar patterns here — those go in the grammar array
- If a word list has romaji only, convert to hiragana for the reading field
- Copy Japanese characters exactly — never romanise the word field
- Deduplicate by exact word plus reading. If the same word appears again, keep the first occurrence.

## grammar — every grammar pattern or structure explained in the material
Each item:
{
  "title": "<short English description of the pattern — required>",
  "pattern": "<the grammar structure in Japanese, e.g. 〜てから, Verb-て + いる — required>",
  "meaning": "<one-line English meaning — required>",
  "explanation": "<2–5 sentence explanation of usage, nuance, and when to use it — required>",
  "jlpt_level": "<N5|N4|N3|N2|N1 — include only if specified>",
  "examples": [
    { "ja": "<Japanese sentence — required>", "reading": "<furigana reading — optional>", "en": "<English translation — required>" }
  ]
}
Rules:
- Every grammar item MUST have at least 2 examples. If the source only gives 1, synthesise a second that matches the same pattern
- Do not duplicate vocab items here — grammar is about structural patterns, not vocabulary
- Deduplicate by exact pattern. If the same pattern appears again, keep the first occurrence.

## lessons — narrative content, reading passages, sentence sets, dialogues
These are sections of material that provide context and reading practice — NOT individual vocab or grammar points.
Each item:
{
  "content_type": "<text_passage | sentence_pair | dialogue_script>",
  "title": "<descriptive title for this chunk — required>",
  "body": "<the Japanese text, or for dialogue_script a JSON-stringified array of {speaker, text, translation} — required>",
  "translation": "<English translation if present — optional>",
  "sequence": <integer starting at 1>
}
content_type rules:
- text_passage: a prose paragraph or reading passage in Japanese
- sentence_pair: a set of Japanese sentences each with an English equivalent (body = Japanese, translation = English)
- dialogue_script: a conversation — body must be a JSON string: "[{\"speaker\":\"A\",\"text\":\"...\",\"translation\":\"...\"}]"

## Hard rules
1. NEVER alter, romanise, or translate Japanese text in the word/pattern/ja fields — copy exactly
2. If the source has kanji without furigana and you know the reading, add it. If uncertain, omit.
3. If you cannot parse a section into any category, put it in lessons as a text_passage with the raw content as the body
4. Preserve document order inside each array. Do not randomly reorder items.
5. Use the same classification every time: word/translation pairs go to vocab; structural explanations go to grammar; longer passages, exercises, and dialogues go to lessons.
6. Output must be valid JSON parseable by JSON.parse() — no trailing commas, no comments
7. SKIP hiragana/katakana drilling sections entirely (e.g. kana chart pages, pure script-tracing exercises). KirokuMichi learners already know kana — these pages produce no usable vocab, grammar, or lessons.
8. SKIP table-of-contents pages, copyright/publication info, back-cover blurbs, and blank pages.`

// ---------------------------------------------------------------------------
// PDF extraction
// ---------------------------------------------------------------------------

const DEFAULT_PDF_PAGE_LIMIT = 10
const DEFAULT_PDF_PAGE_START = 1
const GENKI_TEXTBOOK_PAGE_START = 14
const GENKI_WORKBOOK_PAGE_START = 12

function isPdfFile(file: File) {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
}

function getPdfRangePreset(file: File): PdfRange {
  const name = file.name.toLowerCase()
  const isGenki = name.includes('genki') || name.includes('げんき')
  const isWorkbook = name.includes('workbook') || name.includes('ワークブック')
  if (isGenki && isWorkbook) {
    return { startPage: GENKI_WORKBOOK_PAGE_START, pageCount: DEFAULT_PDF_PAGE_LIMIT }
  }
  if (isGenki) {
    return { startPage: GENKI_TEXTBOOK_PAGE_START, pageCount: DEFAULT_PDF_PAGE_LIMIT }
  }
  return { startPage: DEFAULT_PDF_PAGE_START, pageCount: DEFAULT_PDF_PAGE_LIMIT }
}

function waitForPaint(): Promise<void> {
  return new Promise(resolve => window.setTimeout(resolve, 0))
}

async function extractPdfText(
  file: File,
  options: {
    maxPages: number
    onProgress?: (page: number, totalPages: number, cappedPages: number) => void
  }
): Promise<string> {
  const { getDocument, GlobalWorkerOptions } = await import('pdfjs-dist')
  GlobalWorkerOptions.workerSrc = '/node_modules/pdfjs-dist/build/pdf.worker.mjs'

  const arrayBuffer = await file.arrayBuffer()
  const pdf = await getDocument({ data: arrayBuffer }).promise
  const parts: string[] = []
  const cappedPages = Math.min(pdf.numPages, Math.max(1, options.maxPages))

  for (let i = 1; i <= cappedPages; i++) {
    options.onProgress?.(i, pdf.numPages, cappedPages)
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const pageText = content.items
      .map(item => 'str' in item ? item.str : '')
      .filter(Boolean)
      .join(' ')
    parts.push(`[Page ${i}]\n${pageText}`)
    await waitForPaint()
  }

  if (cappedPages < pdf.numPages) {
    parts.push(`[Import note]\nOnly the first ${cappedPages} of ${pdf.numPages} pages were extracted from ${file.name}. Increase the page limit and re-run extraction if you need later chapters.`)
  }

  return parts.join('\n\n')
}

async function extractPdfImages(
  file: File,
  maxPages = 8,
  onProgress?: (page: number, totalPages: number, cappedPages: number) => void
): Promise<{ data: string; mediaType: string }[]> {
  const { getDocument, GlobalWorkerOptions } = await import('pdfjs-dist')
  GlobalWorkerOptions.workerSrc = '/node_modules/pdfjs-dist/build/pdf.worker.mjs'

  const arrayBuffer = await file.arrayBuffer()
  const pdf = await getDocument({ data: arrayBuffer }).promise
  const images: { data: string; mediaType: string }[] = []
  const cappedPages = Math.min(pdf.numPages, maxPages)

  for (let i = 1; i <= cappedPages; i++) {
    onProgress?.(i, pdf.numPages, cappedPages)
    const page = await pdf.getPage(i)
    const viewport = page.getViewport({ scale: 1.5 })
    const canvas = document.createElement('canvas')
    canvas.width = viewport.width
    canvas.height = viewport.height
    const ctx = canvas.getContext('2d')!
    await page.render({ canvas, canvasContext: ctx, viewport }).promise
    const dataUrl = canvas.toDataURL('image/jpeg', 0.75)
    images.push({ data: dataUrl.split(',')[1], mediaType: 'image/jpeg' })
    await waitForPaint()
  }

  return images
}

// ---------------------------------------------------------------------------
// DB helpers
// ---------------------------------------------------------------------------

async function ensureTables(storage: SQLiteStorage) {
  await storage.execute(`
    CREATE TABLE IF NOT EXISTS learning_content (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      content_type TEXT NOT NULL DEFAULT 'text_passage',
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      translation TEXT,
      sequence INTEGER NOT NULL DEFAULT 0,
      source_document TEXT,
      jlpt_level TEXT,
      last_seen_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)
}

async function importExtracted(
  result: ExtractionResult,
  storage: SQLiteStorage,
  userId: number,
  sourceDoc: string | null
): Promise<ImportSummary> {
  await ensureTables(storage)
  const summary: ImportSummary = { vocab: 0, grammar: 0, lessons: 0 }

  // Vocab → cards + card_states
  for (const v of result.vocab) {
    try {
      await storage.execute(
        `INSERT OR IGNORE INTO cards (type, front, back, reading, jlpt_level, source)
         VALUES ('vocabulary', ?, ?, ?, ?, 'user')`,
        [v.word, v.meaning, v.reading ?? null, v.jlpt_level ?? null]
      )
      const cardRows = await storage.query<{ id: number }>(
        `SELECT id FROM cards WHERE front = ? AND type = 'vocabulary' LIMIT 1`, [v.word]
      )
      if (cardRows[0]) {
        await storage.execute(
          `INSERT OR IGNORE INTO card_states (user_id, card_id, state, due)
           VALUES (?, ?, 'new', datetime('now'))`,
          [userId, cardRows[0].id]
        )
        summary.vocab++
      }
    } catch { /* skip duplicates */ }
  }

  // Grammar → grammar_points
  for (const g of result.grammar) {
    try {
      await storage.execute(
        `INSERT OR IGNORE INTO grammar_points
           (jlpt_level, title, pattern, meaning, explanation, examples_json, source)
         VALUES (?, ?, ?, ?, ?, ?, 'user')`,
        [g.jlpt_level ?? 'N5', g.title, g.pattern, g.meaning, g.explanation, JSON.stringify(g.examples)]
      )
      summary.grammar++
    } catch { /* skip duplicates */ }
  }

  // Generate word_list lessons from extracted vocab, grouped by JLPT level
  if (result.vocab.length > 0) {
    const vocabByLevel = new Map<string, { word: string; reading?: string; meaning: string; jlpt_level?: string; example_ja?: string; example_en?: string }[]>()
    for (const v of result.vocab) {
      const level = v.jlpt_level || 'unclassified'
      if (!vocabByLevel.has(level)) vocabByLevel.set(level, [])
      vocabByLevel.get(level)!.push(v)
    }
    let seq = result.lessons.length + 1
    for (const [level, words] of vocabByLevel) {
      const wordList = words.map(w => ({ word: w.word, reading: w.reading, meaning: w.meaning }))
      await storage.execute(
        `INSERT INTO learning_content (user_id, content_type, title, body, translation, sequence, source_document, jlpt_level)
         VALUES (?, 'word_list', ?, ?, ?, ?, ?, ?)`,
        [
          userId,
          level === 'unclassified' ? 'Extracted Vocabulary' : `${level} Vocabulary from ${sourceDoc || 'import'}`,
          JSON.stringify(wordList),
          null,
          seq++,
          sourceDoc,
          level === 'unclassified' ? null : level,
        ]
      )
      summary.lessons++
    }
  }

  // Generate grammar_point lessons from extracted grammar
  if (result.grammar.length > 0) {
    let seq = result.lessons.length + 1
    // count word_list entries already added
    const levelCount = new Set(result.vocab.map(v => v.jlpt_level || 'unclassified')).size
    seq += levelCount
    for (const g of result.grammar) {
      await storage.execute(
        `INSERT INTO learning_content (user_id, content_type, title, body, translation, sequence, source_document, jlpt_level)
         VALUES (?, 'grammar_point', ?, ?, ?, ?, ?, ?)`,
        [
          userId,
          g.title,
          g.pattern,
          JSON.stringify(g.examples),
          seq++,
          sourceDoc,
          g.jlpt_level ?? null,
        ]
      )
      summary.lessons++
    }
  }

  // Lessons (text_passage, sentence_pair, dialogue_script) → learning_content
  for (const lesson of result.lessons) {
    await storage.execute(
      `INSERT INTO learning_content (user_id, content_type, title, body, translation, sequence, source_document)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, lesson.content_type, lesson.title, lesson.body, lesson.translation ?? null, lesson.sequence, sourceDoc]
    )
    summary.lessons++
  }

  return summary
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type InputMode = 'text' | 'file'
type Step = 'input' | 'extracting' | 'preview' | 'done'

export function ContentUpload() {
  const { settings, activeUserId, setSessionToken } = useAppStore()
  const [storage] = useState(() => new SQLiteStorage())
  const userId = activeUserId ?? 1

  // Anki
  const [ankiStatus, setAnkiStatus] = useState<string | null>(null)
  const [ankiLoading, setAnkiLoading] = useState(false)

  // Content import
  const [inputMode, setInputMode] = useState<InputMode>('text')
  const [rawText, setRawText] = useState('')
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [extractImages, setExtractImages] = useState(false)
  const [pdfRanges, setPdfRanges] = useState<Record<string, PdfRange>>({})

  const [step, setStep] = useState<Step>('input')
  const [statusMsg, setStatusMsg] = useState('')
  const [progressMsg, setProgressMsg] = useState('')
  const [preview, setPreview] = useState<ExtractionResult | null>(null)
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [devTestLoading, setDevTestLoading] = useState(false)
  const [devTestResult, setDevTestResult] = useState<DevPdfTestResult | null>(null)
  const [devOcrResult, setDevOcrResult] = useState<DevPdfOcrResult | null>(null)
  const [devTestError, setDevTestError] = useState<string | null>(null)

  // Per-category enable toggles in preview
  const [importVocab, setImportVocab] = useState(true)
  const [importGrammar, setImportGrammar] = useState(true)
  const [importLessons, setImportLessons] = useState(true)

  const fileInputRef = useRef<HTMLInputElement>(null)

  async function refreshSessionToken() {
    const response = await fetch('/api/session', { method: 'POST' })
    if (!response.ok) throw new Error('Could not refresh session token')
    const data = await response.json() as { token: string }
    setSessionToken(data.token)
    return data.token
  }

  async function fetchWithClientTimeout(url: string, init: RequestInit, timeoutMs = 120000) {
    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs)
    try {
      return await fetch(url, { ...init, signal: controller.signal })
    } finally {
      window.clearTimeout(timeoutId)
    }
  }

  function getPdfRange(file: File) {
    return pdfRanges[file.name] ?? getPdfRangePreset(file)
  }

  function updatePdfRange(file: File, patch: Partial<PdfRange>) {
    setPdfRanges(current => {
      const existing = current[file.name] ?? getPdfRangePreset(file)
      return {
        ...current,
        [file.name]: {
          startPage: Math.max(1, patch.startPage ?? existing.startPage),
          pageCount: Math.max(1, patch.pageCount ?? existing.pageCount),
        },
      }
    })
  }

  // -------------------------------------------------------------------------
  // Anki import
  // -------------------------------------------------------------------------

  async function handleAnkiFile(file: File) {
    setAnkiLoading(true)
    setAnkiStatus('Importing…')
    try {
      const result = await importFromAnki(file, storage, userId)
      const audioNote = result.audioExtracted > 0 ? `, ${result.audioExtracted} audio files` : ''
      const summary = `Imported ${result.imported} cards, skipped ${result.skipped}${audioNote}`
      setAnkiStatus(summary)
      toast.success(`📦 ${summary}`, 5000)
      if (result.errors.length > 0) {
        toast.error(`⚠️ ${result.errors[0]}`, 6000)
      }
      if (result.unlockedForLessons && result.unlockedForLessons.totalUnlocked > 0) {
        const tb = result.unlockedForLessons.textbook.replace(/_/g, ' ')
        toast.info(`🔓 Unlocked ${result.unlockedForLessons.totalUnlocked} lesson items for ${tb}`, 5000)
      }
    } catch (e) {
      const msg = `Import failed: ${e instanceof Error ? e.message : 'unknown error'}`
      setAnkiStatus(msg)
      toast.error(msg)
    } finally {
      setAnkiLoading(false)
    }
  }

  async function handleDevFixtureTest() {
    setDevTestLoading(true)
    setDevTestResult(null)
    setDevOcrResult(null)
    setDevTestError(null)
    try {
      let token = settings.sessionToken || await refreshSessionToken()
      const request = (sessionToken: string) => fetchWithClientTimeout('/api/dev/test-pdf-import', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-session-token': sessionToken,
        },
        body: JSON.stringify({
          apiKey: settings.apiKey,
          fastModel: settings.fastModel,
          pageStart: GENKI_TEXTBOOK_PAGE_START,
          pageLimit: 2,
        }),
      })
      let response = await request(token)
      if (response.status === 401) {
        token = await refreshSessionToken()
        response = await request(token)
      }
      if (!response.ok) {
        const data = await response.json().catch(() => null) as { error?: string } | null
        throw new Error(data?.error || 'Fixture test failed')
      }
      setDevTestResult(await response.json() as DevPdfTestResult)
    } catch (err) {
      setDevTestError(err instanceof Error ? err.message : 'Fixture test failed')
    } finally {
      setDevTestLoading(false)
    }
  }

  async function handleDevOcrTest() {
    setDevTestLoading(true)
    setDevTestResult(null)
    setDevOcrResult(null)
    setDevTestError(null)
    try {
      let token = settings.sessionToken || await refreshSessionToken()
      const request = (sessionToken: string) => fetchWithClientTimeout('/api/dev/test-pdf-ocr', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-session-token': sessionToken,
        },
        body: JSON.stringify({ pageStart: GENKI_TEXTBOOK_PAGE_START, pageLimit: 2 }),
      })
      let response = await request(token)
      if (response.status === 401) {
        token = await refreshSessionToken()
        response = await request(token)
      }
      if (!response.ok) {
        const data = await response.json().catch(() => null) as { error?: string } | null
        throw new Error(data?.error || 'OCR fixture test failed')
      }
      setDevOcrResult(await response.json() as DevPdfOcrResult)
    } catch (err) {
      setDevTestError(err instanceof Error ? err.message : 'OCR fixture test failed')
    } finally {
      setDevTestLoading(false)
    }
  }

  async function extractPdfsOnServer(files: File[]) {
    let token = settings.sessionToken || await refreshSessionToken()
    const request = (sessionToken: string) => {
      const formData = new FormData()
      for (const file of files) formData.append('files', file)
      const fileRanges = files
        .filter(isPdfFile)
        .map(file => {
          const range = getPdfRange(file)
          return { filename: file.name, startPage: range.startPage, pageLimit: range.pageCount }
        })
      formData.append('fileRanges', JSON.stringify(fileRanges))
      formData.append('pageStart', String(fileRanges[0]?.startPage ?? DEFAULT_PDF_PAGE_START))
      formData.append('pageLimit', String(fileRanges[0]?.pageLimit ?? DEFAULT_PDF_PAGE_LIMIT))
      formData.append('provider', settings.aiProvider || '')
      formData.append('apiKey', settings.apiKey || '')
      formData.append('fastModel', settings.fastModel)
      formData.append('system', EXTRACTION_SYSTEM_PROMPT)
      formData.append('ocrMode', 'prefer')
      return fetch('/api/content/extract-pdfs', {
        method: 'POST',
        headers: { 'x-session-token': sessionToken },
        body: formData,
      })
    }

    let response = await request(token)
    if (response.status === 401) {
      token = await refreshSessionToken()
      response = await request(token)
    }
    if (!response.ok) {
      const data = await response.json().catch(() => null) as { error?: string } | null
      throw new Error(data?.error || 'Server PDF extraction failed')
    }

    return await response.json() as ServerPdfExtractionResponse
  }

  // -------------------------------------------------------------------------
  // Extract
  // -------------------------------------------------------------------------

  async function handleExtract() {
    const setProgress = async (message: string) => {
      setStatusMsg(message)
      setProgressMsg(message)
      await waitForPaint()
    }

    setStep('extracting')
    setError(null)
    setPreview(null)
    setImportSummary(null)
    setStatusMsg('Preparing extraction…')
    setProgressMsg('Preparing extraction…')
    await waitForPaint()

    try {
      const ai = new ClientAIProvider(settings.sessionToken)
      let userContent: unknown

      if (inputMode === 'file' && selectedFiles.length > 0) {
        const allPdfFiles = selectedFiles.every(file => file.type === 'application/pdf' || file.name.endsWith('.pdf'))
        if (allPdfFiles && !extractImages) {
          await setProgress(`Uploading ${selectedFiles.length} PDF${selectedFiles.length === 1 ? '' : 's'} for server-side extraction…`)
          const serverResult = await extractPdfsOnServer(selectedFiles)
          const parsed = serverResult.result
          parsed.vocab = parsed.vocab ?? []
          parsed.grammar = parsed.grammar ?? []
          parsed.lessons = parsed.lessons ?? []
          setPreview(parsed)
          setProgressMsg('')
          setStep('preview')
          return
        }

        const textParts: string[] = []
        const imageParts: { data: string; mediaType: string }[] = []

        for (const file of selectedFiles) {
          const pdfFile = isPdfFile(file)

          if (pdfFile) {
            const range = getPdfRange(file)
            await setProgress(`Loading ${file.name}…`)
            const text = await extractPdfText(file, {
              maxPages: range.pageCount,
              onProgress: (page, totalPages, cappedPages) => {
                const message = `Extracting ${file.name}: page ${page}/${cappedPages}${cappedPages < totalPages ? ` of ${totalPages}` : ''}…`
                setStatusMsg(message)
                setProgressMsg(message)
              },
            })
            textParts.push(`## ${file.name}\n\n${text}`)

            if (extractImages) {
              await setProgress(`Preparing page images from ${file.name}…`)
              imageParts.push(...await extractPdfImages(
                file,
                Math.min(8, range.pageCount),
                (page, totalPages, cappedPages) => {
                  const message = `Rendering images from ${file.name}: page ${page}/${cappedPages}${cappedPages < totalPages ? ` of ${totalPages}` : ''}…`
                  setStatusMsg(message)
                  setProgressMsg(message)
                }
              ))
            }
          } else {
            await setProgress(`Reading ${file.name}…`)
            const text = await file.text()
            textParts.push(`## ${file.name}\n\n${text}`)
          }
        }

        const combinedText = textParts.join('\n\n---\n\n')
        await setProgress('Sending extracted content to AI…')

        if (imageParts.length > 0) {
          userContent = [
            { type: 'text', text: `Extract all Japanese learning content from these uploaded materials in document order. Treat related files, such as a textbook and workbook, as one shared context.\n\nExtracted text:\n${combinedText}` },
            ...imageParts.map(img => ({
              type: 'image',
              source: { type: 'base64', media_type: img.mediaType, data: img.data },
            })),
          ]
        } else {
          userContent = `Extract all Japanese learning content from these uploaded materials in document order. Treat related files, such as a textbook and workbook, as one shared context.\n\n${combinedText}`
        }
      } else {
        await setProgress('Sending text to AI…')
        userContent = rawText
      }

      const tier = extractImages ? 'reasoning' : 'fast'
      const json = await ai.completeWithMessages(
        [{ role: 'user', content: userContent as never }],
        EXTRACTION_SYSTEM_PROMPT,
        tier
      )

      const cleaned = json.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
      const parsed: ExtractionResult = JSON.parse(cleaned)

      // Normalise — ensure arrays exist
      parsed.vocab = parsed.vocab ?? []
      parsed.grammar = parsed.grammar ?? []
      parsed.lessons = parsed.lessons ?? []

      setPreview(parsed)
      setProgressMsg('')
      setStep('preview')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Extraction failed')
      setProgressMsg('')
      setStep('input')
    }
  }

  // -------------------------------------------------------------------------
  // Import
  // -------------------------------------------------------------------------

  async function handleImport() {
    if (!preview) return
    const filtered: ExtractionResult = {
      ...preview,
      vocab: importVocab ? preview.vocab : [],
      grammar: importGrammar ? preview.grammar : [],
      lessons: importLessons ? preview.lessons : [],
    }
    const sourceDoc = preview.source_title ?? (selectedFiles.length > 0 ? selectedFiles.map(file => file.name).join(', ') : null)
    const summary = await importExtracted(filtered, storage, userId, sourceDoc)
    setImportSummary(summary)
    setStep('done')
  }

  function reset() {
    setStep('input')
    setRawText('')
    setSelectedFiles([])
    setPdfRanges({})
    setPreview(null)
    setImportSummary(null)
    setError(null)
    setStatusMsg('')
    setProgressMsg('')
  }

  const canExtract = inputMode === 'text' ? rawText.trim().length > 0 : selectedFiles.length > 0
  const hasPdf = selectedFiles.some(isPdfFile)

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="flex flex-col gap-8 p-6 max-w-2xl mx-auto w-full">

      {/* Anki */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-gray-900">Import Anki Deck</h2>
        <p className="text-sm text-gray-500">Upload a .apkg file to import vocabulary cards with pre-recorded audio.</p>
        <label className={`flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer ${ankiLoading ? 'opacity-50 pointer-events-none' : ''}`}>
          {ankiLoading && (
            <span className="inline-block h-4 w-4 rounded-full border-2 border-gray-400 border-t-transparent animate-spin" aria-hidden="true" />
          )}
          {ankiLoading ? 'Importing…' : 'Choose .apkg file'}
          <input type="file" accept=".apkg" className="hidden" disabled={ankiLoading}
            onChange={e => { if (e.target.files?.[0]) void handleAnkiFile(e.target.files[0]) }} />
        </label>
        {ankiStatus && <p className="text-sm text-center text-gray-600">{ankiStatus}</p>}
      </section>

      <hr className="border-gray-200" />

      {/* Content import */}
      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Import Learning Material</h2>
          <p className="text-sm text-gray-500 mt-1">
            Upload or paste any Japanese study material. The AI will extract vocabulary, grammar patterns,
            and lesson content — each going into the right section automatically.
          </p>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-slate-800">Dev fixture smoke test</p>
              <p className="text-xs text-slate-500 mt-0.5">Runs a small Genki fixture slice through server-side OCR and DeepSeek JSON extraction.</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleDevOcrTest}
                disabled={devTestLoading}
                className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {devTestLoading ? 'Testing…' : 'Test OCR'}
              </button>
              <button
                onClick={handleDevFixtureTest}
                disabled={devTestLoading || !settings.apiKey}
                className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-semibold hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {devTestLoading ? 'Testing…' : 'Run AI test'}
              </button>
            </div>
          </div>
          {devOcrResult && (
            <div className="text-xs text-slate-600 space-y-1">
              <p>OCR passed in {(devOcrResult.elapsedMs / 1000).toFixed(1)}s · Pages: {devOcrResult.totals.pages} · Chars: {devOcrResult.totals.chars} · Avg: {devOcrResult.totals.charsPerPage}/page</p>
              <p>Files: {devOcrResult.files.map(file => `${file.extractedPages}/${file.pages} pages, ${file.charsPerPage}/page`).join(' · ')}</p>
            </div>
          )}
          {devTestResult && (
            <div className="text-xs text-slate-600 space-y-1">
              <p>Files: {devTestResult.files.length} · Pages: {devTestResult.files.map(file => file.pages).join(' + ')} · Extracted chars: {devTestResult.files.reduce((sum, file) => sum + file.extractedChars, 0)} · OCR: {devTestResult.files.some(file => file.ocrUsed) ? 'used' : 'not needed'}</p>
              <p>AI JSON: {devTestResult.ai.validJson ? 'valid' : 'invalid'} · Vocab: {devTestResult.ai.counts?.vocab ?? 0} · Grammar: {devTestResult.ai.counts?.grammar ?? 0} · Lessons: {devTestResult.ai.counts?.lessons ?? 0}</p>
              {devTestResult.ai.parseError && <p className="text-red-600">Parse error: {devTestResult.ai.parseError}</p>}
            </div>
          )}
          {devTestError && <p className="text-xs text-red-600">{devTestError}</p>}
        </div>

        {/* Input step */}
        {(step === 'input' || step === 'extracting') && (
          <>
            {/* Mode toggle */}
            <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit text-sm">
              {(['text', 'file'] as InputMode[]).map(m => (
                <button key={m} onClick={() => setInputMode(m)}
                  className={`px-4 py-1.5 rounded-lg font-medium transition-colors capitalize
                    ${inputMode === m ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                  {m === 'text' ? 'Paste text' : 'Upload file'}
                </button>
              ))}
            </div>

            {inputMode === 'text' && (
              <textarea
                value={rawText}
                onChange={e => setRawText(e.target.value)}
                rows={10}
                placeholder={"Paste any Japanese learning material here:\n\n• Textbook pages or chapters\n• Vocabulary lists with readings and meanings\n• Grammar explanations with examples\n• Reading passages\n• Dialogue scripts\n• Sentence pairs (Japanese + English)\n\nThe AI will sort everything into vocabulary, grammar, and lessons automatically."}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y font-mono"
              />
            )}

            {inputMode === 'file' && (
              <div className="flex flex-col gap-3">
                <label
                  className={`flex flex-col items-center justify-center px-4 py-8 border-2 border-dashed rounded-xl transition-colors cursor-pointer
                    ${selectedFiles.length > 0 ? 'border-indigo-400 bg-indigo-50' : 'border-gray-300 hover:bg-gray-50'}`}
                >
                  <span className="text-3xl mb-2">{selectedFiles.length > 0 ? '📄' : '⬆️'}</span>
                  {selectedFiles.length > 0
                    ? (
                      <span className="flex flex-col items-center gap-1">
                        <span className="text-sm font-medium text-indigo-700">
                          {selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''} selected
                        </span>
                        <span className="text-xs text-indigo-500 text-center">
                          {selectedFiles.map(file => file.name).join(' · ')}
                        </span>
                      </span>
                    )
                    : <span className="text-sm text-gray-600">Click to choose files</span>}
                  <span className="text-xs text-gray-400 mt-1">.pdf · .txt · .md · .csv</span>
                  <input ref={fileInputRef} type="file" multiple accept=".pdf,.txt,.md,.csv,.text" className="hidden"
                    onChange={e => {
                      const files = Array.from(e.target.files ?? [])
                      if (files.length > 0) {
                        setSelectedFiles(files)
                        setPdfRanges(current => {
                          const next: Record<string, PdfRange> = {}
                          for (const file of files.filter(isPdfFile)) {
                            next[file.name] = current[file.name] ?? getPdfRangePreset(file)
                          }
                          return next
                        })
                        setError(null)
                      }
                    }} />
                </label>

                {hasPdf && (
                  <div className="flex flex-col gap-3">
                    <label className="flex items-start gap-3 cursor-pointer select-none">
                      <input type="checkbox" checked={extractImages} onChange={e => setExtractImages(e.target.checked)} className="mt-0.5 accent-indigo-600" />
                      <div>
                        <p className="text-sm font-medium text-gray-800">Also extract page images</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          Renders up to 8 pages per PDF as images alongside the text — useful for tables, diagrams, or
                          mixed layouts. Uses a vision-capable model and more credits.
                        </p>
                      </div>
                    </label>

                    <div className="flex flex-col gap-2">
                      {selectedFiles.filter(isPdfFile).map(file => {
                        const range = getPdfRange(file)
                        return (
                          <div key={file.name} className="rounded-xl border border-gray-200 px-4 py-3">
                            <p className="text-sm font-medium text-gray-800 truncate">{file.name}</p>
                            <div className="grid grid-cols-2 gap-3 mt-3">
                              <label className="flex items-center justify-between gap-3">
                                <span className="text-xs text-gray-500">Start page</span>
                                <input
                                  type="number"
                                  min={1}
                                  max={500}
                                  value={range.startPage}
                                  onChange={e => updatePdfRange(file, { startPage: Number(e.target.value) || getPdfRangePreset(file).startPage })}
                                  className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-sm text-center"
                                  aria-label={`${file.name} start page`}
                                />
                              </label>
                              <label className="flex items-center justify-between gap-3">
                                <span className="text-xs text-gray-500">Page count</span>
                                <input
                                  type="number"
                                  min={1}
                                  max={500}
                                  value={range.pageCount}
                                  onChange={e => updatePdfRange(file, { pageCount: Number(e.target.value) || DEFAULT_PDF_PAGE_LIMIT })}
                                  className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-sm text-center"
                                  aria-label={`${file.name} page count`}
                                />
                              </label>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                      <p className="text-xs text-amber-800">
                        Scanned PDFs use local OCR automatically. Genki defaults: textbook page {GENKI_TEXTBOOK_PAGE_START}, workbook page {GENKI_WORKBOOK_PAGE_START}.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                <p className="text-sm text-red-700 font-medium">Extraction failed</p>
                <p className="text-xs text-red-500 mt-1">{error}</p>
              </div>
            )}

            {step === 'extracting' && progressMsg && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
                <p className="text-sm font-medium text-blue-800">Extraction in progress</p>
                <p className="text-xs text-blue-600 mt-1 break-words">{progressMsg}</p>
              </div>
            )}

            <button
              onClick={handleExtract}
              disabled={!canExtract || step === 'extracting'}
              className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold text-sm hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors self-end"
            >
              {step === 'extracting' ? statusMsg || 'Working…' : 'Extract Content →'}
            </button>
          </>
        )}

        {/* Preview step */}
        {step === 'preview' && preview && (
          <PreviewPanel
            preview={preview}
            importVocab={importVocab} setImportVocab={setImportVocab}
            importGrammar={importGrammar} setImportGrammar={setImportGrammar}
            importLessons={importLessons} setImportLessons={setImportLessons}
            onImport={handleImport}
            onDiscard={reset}
          />
        )}

        {/* Done step */}
        {step === 'done' && importSummary && (
          <div className="flex flex-col gap-4">
            <div className="bg-green-50 border border-green-200 rounded-2xl p-6 flex flex-col gap-3">
              <p className="text-lg font-bold text-green-800">Import complete</p>
              <div className="grid grid-cols-3 gap-3">
                <SummaryTile icon="📝" label="Vocab cards" count={importSummary.vocab} colour="indigo" />
                <SummaryTile icon="📐" label="Grammar points" count={importSummary.grammar} colour="purple" />
                <SummaryTile icon="📖" label="Lessons" count={importSummary.lessons} colour="green" />
              </div>
              <p className="text-xs text-green-600">
                Vocabulary is now in your SRS review queue. Grammar is available under Study Grammar.
                Lessons appear in the Learn section.
              </p>
            </div>
            <button onClick={reset} className="text-sm text-indigo-600 hover:text-indigo-800 self-center">
              Import more content
            </button>
          </div>
        )}
      </section>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SummaryTile({ icon, label, count, colour }: { icon: string; label: string; count: number; colour: string }) {
  const colours: Record<string, string> = {
    indigo: 'bg-indigo-50 text-indigo-700',
    purple: 'bg-purple-50 text-purple-700',
    green: 'bg-green-100 text-green-700',
  }
  return (
    <div className={`rounded-xl p-3 flex flex-col items-center gap-1 ${colours[colour]}`}>
      <span className="text-xl">{icon}</span>
      <span className="text-2xl font-bold">{count}</span>
      <span className="text-xs text-center leading-tight opacity-80">{label}</span>
    </div>
  )
}

interface PreviewPanelProps {
  preview: ExtractionResult
  importVocab: boolean; setImportVocab: (v: boolean) => void
  importGrammar: boolean; setImportGrammar: (v: boolean) => void
  importLessons: boolean; setImportLessons: (v: boolean) => void
  onImport: () => void
  onDiscard: () => void
}

function PreviewPanel({
  preview, importVocab, setImportVocab, importGrammar, setImportGrammar,
  importLessons, setImportLessons, onImport, onDiscard,
}: PreviewPanelProps) {
  const [openSection, setOpenSection] = useState<'vocab' | 'grammar' | 'lessons' | null>('vocab')

  const totalSelected =
    (importVocab ? preview.vocab.length : 0) +
    (importGrammar ? preview.grammar.length : 0) +
    (importLessons ? preview.lessons.length : 0)

  return (
    <div className="flex flex-col gap-4">
      {preview.source_title && (
        <p className="text-sm text-gray-500">
          Source: <span className="font-medium text-gray-800">{preview.source_title}</span>
        </p>
      )}

      {/* Category cards */}
      <div className="flex flex-col gap-3">
        <CategorySection
          icon="📝" label="Vocabulary" colour="indigo"
          items={preview.vocab} count={preview.vocab.length}
          enabled={importVocab} onToggle={setImportVocab}
          isOpen={openSection === 'vocab'} onToggleOpen={() => setOpenSection(openSection === 'vocab' ? null : 'vocab')}
        >
          {preview.vocab.slice(0, 12).map((v, i) => (
            <div key={i} className="flex items-baseline gap-2 py-1.5 border-b border-indigo-50 last:border-0">
              <span className="font-bold text-gray-900 text-sm" lang="ja">{v.word}</span>
              {v.reading && <span className="text-xs text-indigo-400" lang="ja">{v.reading}</span>}
              <span className="text-xs text-gray-500 ml-auto truncate max-w-32">{v.meaning}</span>
            </div>
          ))}
          {preview.vocab.length > 12 && (
            <p className="text-xs text-indigo-400 pt-1">+{preview.vocab.length - 12} more</p>
          )}
        </CategorySection>

        <CategorySection
          icon="📐" label="Grammar" colour="purple"
          items={preview.grammar} count={preview.grammar.length}
          enabled={importGrammar} onToggle={setImportGrammar}
          isOpen={openSection === 'grammar'} onToggleOpen={() => setOpenSection(openSection === 'grammar' ? null : 'grammar')}
        >
          {preview.grammar.map((g, i) => (
            <div key={i} className="py-2 border-b border-purple-50 last:border-0">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm text-purple-700" lang="ja">{g.pattern}</span>
                {g.jlpt_level && <span className="text-xs text-gray-400">{g.jlpt_level}</span>}
              </div>
              <p className="text-xs text-gray-500 mt-0.5">{g.meaning}</p>
            </div>
          ))}
        </CategorySection>

        <CategorySection
          icon="📖" label="Lessons" colour="green"
          items={preview.lessons} count={preview.lessons.length}
          enabled={importLessons} onToggle={setImportLessons}
          isOpen={openSection === 'lessons'} onToggleOpen={() => setOpenSection(openSection === 'lessons' ? null : 'lessons')}
        >
          {preview.lessons.map((l, i) => (
            <div key={i} className="py-2 border-b border-green-50 last:border-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-green-600 uppercase">{l.content_type}</span>
              </div>
              <p className="text-sm font-medium text-gray-800 mt-0.5">{l.title}</p>
              <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{l.body}</p>
            </div>
          ))}
        </CategorySection>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-2">
        <button onClick={onDiscard} className="text-sm text-gray-400 hover:text-gray-600">
          Discard
        </button>
        <button
          onClick={onImport}
          disabled={totalSelected === 0}
          className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold text-sm hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Import {totalSelected} item{totalSelected !== 1 ? 's' : ''} →
        </button>
      </div>
    </div>
  )
}

interface CategorySectionProps {
  icon: string
  label: string
  colour: 'indigo' | 'purple' | 'green'
  items: unknown[]
  count: number
  enabled: boolean
  onToggle: (v: boolean) => void
  isOpen: boolean
  onToggleOpen: () => void
  children: React.ReactNode
}

function CategorySection({
  icon, label, colour, count, enabled, onToggle, isOpen, onToggleOpen, children,
}: CategorySectionProps) {
  const colours = {
    indigo: { border: 'border-indigo-200', bg: 'bg-indigo-50', header: 'text-indigo-800', badge: 'bg-indigo-100 text-indigo-600' },
    purple: { border: 'border-purple-200', bg: 'bg-purple-50', header: 'text-purple-800', badge: 'bg-purple-100 text-purple-600' },
    green:  { border: 'border-green-200',  bg: 'bg-green-50',  header: 'text-green-800',  badge: 'bg-green-100  text-green-600'  },
  }[colour]

  return (
    <div className={`border ${colours.border} rounded-xl overflow-hidden ${!enabled ? 'opacity-50' : ''}`}>
      <div className={`flex items-center gap-3 px-4 py-3 ${colours.bg}`}>
        <span>{icon}</span>
        <span className={`font-semibold text-sm ${colours.header}`}>{label}</span>
        <span className={`text-xs px-2 py-0.5 rounded-full font-mono ${colours.badge}`}>{count}</span>
        <div className="ml-auto flex items-center gap-3">
          {count > 0 && (
            <button
              onClick={onToggleOpen}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              {isOpen ? 'Hide' : 'Preview'}
            </button>
          )}
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={enabled}
              onChange={e => onToggle(e.target.checked)}
              disabled={count === 0}
              className="accent-indigo-600"
            />
            <span className="text-xs text-gray-500">Import</span>
          </label>
        </div>
      </div>

      {isOpen && count > 0 && (
        <div className="px-4 py-2 max-h-56 overflow-y-auto bg-white">
          {children}
        </div>
      )}

      {count === 0 && (
        <div className="px-4 py-2 bg-white">
          <p className="text-xs text-gray-400 italic">None found in this material</p>
        </div>
      )}
    </div>
  )
}
