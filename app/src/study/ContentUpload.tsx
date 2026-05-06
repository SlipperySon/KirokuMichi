import { useState, useRef } from 'react'
import { useAppStore } from '../store'
import { SQLiteStorage } from '../db/sqlite'
import { importFromAnki } from '../srs/ankiImport'
import { ClientAIProvider } from '../ai/aiProvider'

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
4. Output must be valid JSON parseable by JSON.parse() — no trailing commas, no comments`

// ---------------------------------------------------------------------------
// PDF extraction
// ---------------------------------------------------------------------------

async function extractPdfText(file: File): Promise<string> {
  const { getDocument, GlobalWorkerOptions } = await import('pdfjs-dist')
  GlobalWorkerOptions.workerSrc = '/node_modules/pdfjs-dist/build/pdf.worker.mjs'

  const arrayBuffer = await file.arrayBuffer()
  const pdf = await getDocument({ data: arrayBuffer }).promise
  const parts: string[] = []

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const pageText = content.items
      .filter((item): item is { str: string; transform: number[] } => 'str' in item)
      .map(item => item.str)
      .join(' ')
    parts.push(`[Page ${i}]\n${pageText}`)
  }

  return parts.join('\n\n')
}

async function extractPdfImages(file: File, maxPages = 8): Promise<{ data: string; mediaType: string }[]> {
  const { getDocument, GlobalWorkerOptions } = await import('pdfjs-dist')
  GlobalWorkerOptions.workerSrc = '/node_modules/pdfjs-dist/build/pdf.worker.mjs'

  const arrayBuffer = await file.arrayBuffer()
  const pdf = await getDocument({ data: arrayBuffer }).promise
  const images: { data: string; mediaType: string }[] = []

  for (let i = 1; i <= Math.min(pdf.numPages, maxPages); i++) {
    const page = await pdf.getPage(i)
    const viewport = page.getViewport({ scale: 1.5 })
    const canvas = document.createElement('canvas')
    canvas.width = viewport.width
    canvas.height = viewport.height
    const ctx = canvas.getContext('2d')!
    await page.render({ canvasContext: ctx, viewport }).promise
    const dataUrl = canvas.toDataURL('image/jpeg', 0.75)
    images.push({ data: dataUrl.split(',')[1], mediaType: 'image/jpeg' })
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
  const { settings, activeUserId } = useAppStore()
  const [storage] = useState(() => new SQLiteStorage())
  const userId = activeUserId ?? 1

  // Anki
  const [ankiStatus, setAnkiStatus] = useState<string | null>(null)
  const [ankiLoading, setAnkiLoading] = useState(false)

  // Content import
  const [inputMode, setInputMode] = useState<InputMode>('text')
  const [rawText, setRawText] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [extractImages, setExtractImages] = useState(false)

  const [step, setStep] = useState<Step>('input')
  const [statusMsg, setStatusMsg] = useState('')
  const [preview, setPreview] = useState<ExtractionResult | null>(null)
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Per-category enable toggles in preview
  const [importVocab, setImportVocab] = useState(true)
  const [importGrammar, setImportGrammar] = useState(true)
  const [importLessons, setImportLessons] = useState(true)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // -------------------------------------------------------------------------
  // Anki import
  // -------------------------------------------------------------------------

  async function handleAnkiFile(file: File) {
    setAnkiLoading(true)
    setAnkiStatus(null)
    try {
      const result = await importFromAnki(file, storage, userId)
      const audioNote = result.audioExtracted > 0 ? `, ${result.audioExtracted} with audio` : ''
      setAnkiStatus(`Imported ${result.imported} cards${audioNote}, skipped ${result.skipped} duplicates`)
    } catch (e) {
      setAnkiStatus(`Import failed: ${e instanceof Error ? e.message : 'unknown error'}`)
    } finally {
      setAnkiLoading(false)
    }
  }

  // -------------------------------------------------------------------------
  // Extract
  // -------------------------------------------------------------------------

  async function handleExtract() {
    setStep('extracting')
    setError(null)
    setPreview(null)
    setImportSummary(null)

    try {
      const ai = new ClientAIProvider(settings.sessionToken)
      let userContent: unknown

      if (inputMode === 'file' && selectedFile) {
        const isPdf = selectedFile.type === 'application/pdf' || selectedFile.name.endsWith('.pdf')

        if (isPdf) {
          setStatusMsg('Extracting text from PDF…')
          const text = await extractPdfText(selectedFile)

          if (extractImages) {
            setStatusMsg('Rendering page images…')
            const images = await extractPdfImages(selectedFile)
            setStatusMsg('Sending to AI…')
            userContent = [
              { type: 'text', text: `Extract all Japanese learning content from these PDF pages.\n\nExtracted text:\n${text}` },
              ...images.map(img => ({
                type: 'image',
                source: { type: 'base64', media_type: img.mediaType, data: img.data },
              })),
            ]
          } else {
            setStatusMsg('Sending to AI…')
            userContent = `Extract all Japanese learning content from this PDF text:\n\n${text}`
          }
        } else {
          setStatusMsg('Reading file…')
          const text = await selectedFile.text()
          setStatusMsg('Sending to AI…')
          userContent = text
        }
      } else {
        setStatusMsg('Sending to AI…')
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
      setStep('preview')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Extraction failed')
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
    const sourceDoc = preview.source_title ?? selectedFile?.name ?? null
    const summary = await importExtracted(filtered, storage, userId, sourceDoc)
    setImportSummary(summary)
    setStep('done')
  }

  function reset() {
    setStep('input')
    setRawText('')
    setSelectedFile(null)
    setPreview(null)
    setImportSummary(null)
    setError(null)
  }

  const canExtract = inputMode === 'text' ? rawText.trim().length > 0 : selectedFile !== null
  const isPdf = selectedFile && (selectedFile.type === 'application/pdf' || selectedFile.name.endsWith('.pdf'))

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="flex flex-col gap-8 p-6 max-w-2xl mx-auto w-full">

      {/* Anki */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-gray-900">Import Anki Deck</h2>
        <p className="text-sm text-gray-500">Upload a .apkg file to import vocabulary cards with pre-recorded audio.</p>
        <label className={`flex items-center justify-center px-4 py-3 border-2 border-dashed border-gray-300 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer ${ankiLoading ? 'opacity-50 pointer-events-none' : ''}`}>
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
                    ${selectedFile ? 'border-indigo-400 bg-indigo-50' : 'border-gray-300 hover:bg-gray-50'}`}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <span className="text-3xl mb-2">{selectedFile ? '📄' : '⬆️'}</span>
                  {selectedFile
                    ? <span className="text-sm font-medium text-indigo-700">{selectedFile.name}</span>
                    : <span className="text-sm text-gray-600">Click to choose a file</span>}
                  <span className="text-xs text-gray-400 mt-1">.pdf · .txt · .md · .csv</span>
                  <input ref={fileInputRef} type="file" accept=".pdf,.txt,.md,.csv,.text" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) { setSelectedFile(f); setError(null) } }} />
                </label>

                {isPdf && (
                  <label className="flex items-start gap-3 cursor-pointer select-none">
                    <input type="checkbox" checked={extractImages} onChange={e => setExtractImages(e.target.checked)} className="mt-0.5 accent-indigo-600" />
                    <div>
                      <p className="text-sm font-medium text-gray-800">Also extract page images</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Renders up to 8 PDF pages as images alongside the text — useful for tables, diagrams, or
                        mixed layouts. Uses a vision-capable model and more credits.
                      </p>
                    </div>
                  </label>
                )}
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                <p className="text-sm text-red-700 font-medium">Extraction failed</p>
                <p className="text-xs text-red-500 mt-1">{error}</p>
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
