import express from 'express'
import cors from 'cors'
import crypto from 'crypto'
import { access, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { PDFParse } from 'pdf-parse'
import { execFile } from 'node:child_process'
import { tmpdir } from 'node:os'
import { promisify } from 'node:util'

const app = express()
const PORT = 3001
const HOST = '127.0.0.1'
const AI_REQUEST_TIMEOUT_MS = 60000
const OCR_REQUEST_TIMEOUT_MS = 180000
const execFileAsync = promisify(execFile)

const sessionTokens = new Set<string>()

const corsMiddleware = cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:5174', 'http://127.0.0.1:5174'],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['content-type', 'x-session-token'],
})

app.use((req, _res, next) => {
  console.log(`[http] ${req.method} ${req.path} origin=${req.headers.origin ?? 'none'}`)
  next()
})
app.use(corsMiddleware)
app.options(/.*/, corsMiddleware)
app.use(express.json())

// Serve curriculum data folder (lesson structures, textbook content, etc.)
// Use process.cwd() since we run from app/ directory (npm run server)
const dataPath = path.join(process.cwd(), 'data')
console.log(`[server] Serving /data from ${dataPath}`)
try {
  access(dataPath).then(() => {
    app.use('/data', express.static(dataPath))
    console.log(`[server] ✓ Data folder accessible and served`)
  }).catch(() => {
    console.error(`[server] ✗ Data folder not found at ${dataPath}`)
  })
} catch (err) {
  console.error(`[server] Error setting up data folder: ${err}`)
}

// Issue a session token
// Health check — no auth required, used by uptime monitors and load balancers
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version ?? '0.1.0',
  })
})

app.post('/api/session', (_req, res) => {
  const token = crypto.randomBytes(32).toString('hex')
  sessionTokens.add(token)
  res.json({ token })
})

function requireToken(req: express.Request, res: express.Response, next: express.NextFunction) {
  const token = req.headers['x-session-token']
  if (typeof token !== 'string' || !sessionTokens.has(token)) {
    res.status(401).json({ error: 'Unauthorised' })
    return
  }
  next()
}

// AI proxy — routes to configured provider, keeps API keys server-side only
app.post('/api/ai/complete', requireToken, async (req, res) => {
  const startedAt = Date.now()
  const {
    messages,
    system,
    tier,
    provider,
    apiKey,
    apiEndpoint,
    maxTokens,
    stream = false,
    fastModel = 'gpt-3.5-turbo',
    powerfulModel = 'gpt-4',
    // Backward compat: legacy `prompt` string
    prompt,
  } = req.body as {
    messages?: Array<{ role: string; content: string }>
    system?: string
    tier: 'fast' | 'reasoning'
    provider: 'anthropic' | 'openai' | 'openrouter' | 'deepseek' | 'ollama' | 'custom'
    apiKey?: string
    apiEndpoint?: string
    maxTokens?: number
    stream?: boolean
    fastModel?: string
    powerfulModel?: string
    prompt?: string
  }

  // Build messages: use provided messages array, or legacy prompt->user message
  const finalMessages = messages || (prompt ? [{ role: 'user', content: prompt }] : [])
  if (!finalMessages.length) {
    res.status(400).json({ error: 'No messages provided' })
    return
  }

  const model = tier === 'reasoning' ? powerfulModel : fastModel
  console.log(`[ai] request provider=${provider} model=${model} tier=${tier} messages=${finalMessages.length} stream=${stream}`)

  try {
    if (stream) {
      // Streaming code path — supported for Anthropic + OpenAI-compatible providers.
      if (provider === 'anthropic') {
        await streamAnthropicRequest(res, finalMessages, system, model, tier, apiKey, maxTokens)
      } else if (provider === 'openai') {
        await streamOpenAICompatible(res, finalMessages, system, model, tier, {
          apiKey: apiKey || process.env.OPENAI_API_KEY,
          endpoint: 'https://api.openai.com/v1/chat/completions',
          maxTokens,
          missingKeyError: 'OpenAI API key not configured',
        })
      } else if (provider === 'openrouter') {
        await streamOpenAICompatible(res, finalMessages, system, model, tier, {
          apiKey: apiKey || process.env.OPENROUTER_API_KEY,
          endpoint: 'https://openrouter.io/api/v1/chat/completions',
          maxTokens,
          extraHeaders: {
            'http-referer': 'http://localhost:5173',
            'x-title': 'KirokuMichi',
          },
          missingKeyError: 'OpenRouter API key not configured',
        })
      } else if (provider === 'deepseek') {
        await streamOpenAICompatible(res, finalMessages, system, model, tier, {
          apiKey: apiKey || process.env.DEEPSEEK_API_KEY,
          endpoint: 'https://api.deepseek.com/chat/completions',
          maxTokens,
          extraBody:
            tier === 'fast'
              ? { thinking: { type: 'disabled' } }
              : { thinking: { type: 'enabled' }, reasoning_effort: 'high' },
          missingKeyError: 'DeepSeek API key not configured',
        })
      } else if (provider === 'custom') {
        await streamOpenAICompatible(res, finalMessages, system, model, tier, {
          apiKey,
          endpoint: apiEndpoint,
          maxTokens,
          missingKeyError: 'Custom provider API key not configured',
          missingEndpointError: 'Custom provider endpoint not configured',
        })
      } else {
        // Ollama (or unknown) — gracefully fall back to non-streaming.
        res.status(400).json({ error: `Streaming not supported for provider: ${provider}` })
      }
      return
    }

    if (provider === 'anthropic') {
      await handleAnthropicRequest(res, finalMessages, system, model, tier, apiKey, maxTokens)
    } else if (provider === 'openai') {
      await handleOpenAIRequest(res, finalMessages, system, model, tier, apiKey, maxTokens)
    } else if (provider === 'openrouter') {
      await handleOpenRouterRequest(res, finalMessages, system, model, tier, apiKey, maxTokens)
    } else if (provider === 'deepseek') {
      await handleDeepSeekRequest(res, finalMessages, system, model, tier, apiKey, maxTokens)
    } else if (provider === 'ollama') {
      await handleOllamaRequest(res, finalMessages, system, model)
    } else if (provider === 'custom') {
      await handleOpenAICompatibleRequest(res, finalMessages, system, model, tier, {
        apiKey,
        endpoint: apiEndpoint,
        maxTokens,
        missingKeyError: 'Custom provider API key not configured',
        missingEndpointError: 'Custom provider endpoint not configured',
      })
    } else {
      res.status(400).json({ error: `Unknown provider: ${provider}` })
    }
  } catch (err) {
    console.error('AI request error:', err)
    const isAbort = err instanceof Error && err.name === 'AbortError'
    if (res.headersSent) {
      // Streaming already started — emit an error event and close.
      try {
        res.write(`event: error\ndata: ${JSON.stringify({ error: 'AI request failed' })}\n\n`)
      } catch {
        // ignore
      }
      res.end()
      return
    }
    res.status(isAbort ? 504 : 500).json({
      error: isAbort
        ? `AI request timed out after ${Math.round((Date.now() - startedAt) / 1000)}s`
        : 'AI request failed',
    })
  }
})

// --- Streaming helpers --------------------------------------------------

function setupSSE(res: express.Response) {
  res.status(200).set({
    'content-type': 'text/event-stream',
    'cache-control': 'no-cache, no-transform',
    'connection': 'keep-alive',
    'x-accel-buffering': 'no',
  })
  res.flushHeaders?.()
}

function writeDelta(res: express.Response, text: string) {
  if (!text) return
  // SSE: data lines per chunk
  res.write(`data: ${JSON.stringify({ delta: text })}\n\n`)
}

function writeDone(res: express.Response) {
  res.write('data: [DONE]\n\n')
  res.end()
}

/**
 * Iterate Server-Sent-Events lines (data: ...) from an upstream Response body.
 * Yields each `data:` payload as a string. Stops on `[DONE]`.
 */
async function* iterateSSEPayloads(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      let nl
      // Process whole SSE events (separated by \n\n)
      while ((nl = buffer.indexOf('\n\n')) !== -1) {
        const event = buffer.slice(0, nl)
        buffer = buffer.slice(nl + 2)
        for (const line of event.split('\n')) {
          if (line.startsWith('data: ')) {
            const payload = line.slice(6)
            if (payload === '[DONE]') return
            yield payload
          }
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}

async function streamAnthropicRequest(
  res: express.Response,
  messages: Array<{ role: string; content: MessageContent }>,
  system: string | undefined,
  model: string,
  tier: string,
  providedApiKey?: string,
  maxTokens?: number
) {
  const apiKey = providedApiKey || process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    res.status(503).json({ error: 'Anthropic API key not configured' })
    return
  }

  const upstream = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens ?? (tier === 'reasoning' ? 8192 : 2048),
      system,
      messages,
      stream: true,
    }),
  })

  if (!upstream.ok || !upstream.body) {
    const err = await upstream.text()
    res.status(upstream.status).json({ error: err })
    return
  }

  setupSSE(res)
  for await (const payload of iterateSSEPayloads(upstream.body)) {
    try {
      const evt = JSON.parse(payload) as {
        type?: string
        delta?: { type?: string; text?: string }
      }
      if (evt.type === 'content_block_delta' && evt.delta?.type === 'text_delta' && evt.delta.text) {
        writeDelta(res, evt.delta.text)
      }
    } catch {
      // Ignore non-JSON events (e.g., ping)
    }
  }
  writeDone(res)
}

async function streamOpenAICompatible(
  res: express.Response,
  messages: Array<{ role: string; content: MessageContent }>,
  system: string | undefined,
  model: string,
  tier: string,
  options: {
    apiKey?: string
    endpoint?: string
    maxTokens?: number
    extraBody?: Record<string, unknown>
    extraHeaders?: Record<string, string>
    missingKeyError: string
    missingEndpointError?: string
  }
) {
  if (!options.apiKey) {
    res.status(503).json({ error: options.missingKeyError })
    return
  }
  if (!options.endpoint) {
    res.status(503).json({ error: options.missingEndpointError ?? 'Provider endpoint not configured' })
    return
  }

  const systemMsg = system ? [{ role: 'system', content: system }] : []
  const openAiMessages = messages.map(m => ({ role: m.role, content: toOpenAIContent(m.content) }))
  const upstream = await fetchWithTimeout(options.endpoint, {
    method: 'POST',
    headers: {
      'authorization': `Bearer ${options.apiKey}`,
      'content-type': 'application/json',
      ...(options.extraHeaders ?? {}),
    },
    body: JSON.stringify({
      model,
      max_tokens: options.maxTokens ?? (tier === 'reasoning' ? 8192 : 2048),
      messages: [...systemMsg, ...openAiMessages],
      stream: true,
      ...options.extraBody,
    }),
  })

  if (!upstream.ok || !upstream.body) {
    const err = await upstream.text()
    res.status(upstream.status).json({ error: err })
    return
  }

  setupSSE(res)
  for await (const payload of iterateSSEPayloads(upstream.body)) {
    try {
      const evt = JSON.parse(payload) as {
        choices?: Array<{ delta?: { content?: string } }>
      }
      const delta = evt.choices?.[0]?.delta?.content
      if (delta) writeDelta(res, delta)
    } catch {
      // Ignore non-JSON keepalives
    }
  }
  writeDone(res)
}

type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }

type MessageContent = string | ContentBlock[]

interface UploadedFilePart {
  fieldName: string
  filename: string
  contentType: string
  data: Buffer
}

interface PdfExtractSummary {
  name: string
  sizeMB: number
  pages: number
  extractedPages: number
  extractedChars: number
  charsPerPage: number
  textSparse: boolean
  ocrUsed?: boolean
  ocrError?: string
}

const MIN_EXTRACTED_CHARS_PER_PAGE = 100
const OCR_HELPER_PATH = path.resolve(process.cwd(), 'tools/ocr/pdf-vision-ocr')
const EXTRACTION_CACHE_VERSION = 'pdf-ocr-extraction-v2'
const extractionCache = new Map<string, { result: ExtractedContentResult; files: PdfExtractSummary[] }>()

interface ExtractedContentResult {
  source_title?: string | null
  vocab?: Array<Record<string, unknown>>
  grammar?: Array<Record<string, unknown>>
  lessons?: Array<Record<string, unknown>>
}

interface PdfFileRange {
  filename: string
  startPage: number
  pageLimit: number
}

function buildExtractionCacheKey(options: {
  files: UploadedFilePart[]
  provider: string
  model: string
  fileRanges: PdfFileRange[]
  ocrMode: string
  system: string
}) {
  const hash = crypto.createHash('sha256')
  hash.update(EXTRACTION_CACHE_VERSION)
  hash.update(options.provider)
  hash.update(options.model)
  hash.update(options.ocrMode)
  hash.update(options.system)
  for (const file of options.files) {
    const range = options.fileRanges.find(item => item.filename === file.filename)
    hash.update(file.filename)
    hash.update(String(file.data.length))
    hash.update(String(range?.startPage ?? 1))
    hash.update(String(range?.pageLimit ?? 10))
    hash.update(crypto.createHash('sha256').update(file.data).digest('hex'))
  }
  return hash.digest('hex')
}

function parsePdfFileRanges(raw: string | undefined, files: UploadedFilePart[], fallbackStart: number, fallbackLimit: number) {
  const parsed = raw ? JSON.parse(raw) as Array<Partial<PdfFileRange>> : []
  return files.map(file => {
    const configured = parsed.find(item => item.filename === file.filename)
    return {
      filename: file.filename,
      startPage: Math.max(1, Number(configured?.startPage ?? fallbackStart) || fallbackStart),
      pageLimit: Math.max(1, Number(configured?.pageLimit ?? fallbackLimit) || fallbackLimit),
    }
  })
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = AI_REQUEST_TIMEOUT_MS) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  const startedAt = Date.now()
  try {
    const response = await fetch(url, { ...init, signal: controller.signal })
    console.log(`[ai] upstream ${url} status=${response.status} in ${Date.now() - startedAt}ms`)
    return response
  } finally {
    clearTimeout(timeoutId)
  }
}

async function readResponseTextWithTimeout(response: Response, timeoutMs = AI_REQUEST_TIMEOUT_MS) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      response.text(),
      new Promise<string>((_resolve, reject) => {
        timeoutId = setTimeout(() => reject(new Error(`AI response body timed out after ${Math.round(timeoutMs / 1000)}s`)), timeoutMs)
      }),
    ])
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
  }
}

async function handleAnthropicRequest(
  res: express.Response,
  messages: Array<{ role: string; content: MessageContent }>,
  system: string | undefined,
  model: string,
  tier: string,
  providedApiKey?: string,
  maxTokens?: number
) {
  const apiKey = providedApiKey || process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    res.status(503).json({ error: 'Anthropic API key not configured' })
    return
  }

  const response = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens ?? (tier === 'reasoning' ? 8192 : 2048),
      system,
      messages,
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    res.status(response.status).json({ error: err })
    return
  }

  const data = await response.json() as { content: { type: string; text: string }[] }
  const textBlock = data.content.find(b => b.type === 'text')
  res.json({ text: textBlock?.text ?? '' })
}

// Convert Anthropic-style image blocks to OpenAI vision format
function toOpenAIContent(content: MessageContent): unknown {
  if (typeof content === 'string') return content
  return content.map(block => {
    if (block.type === 'text') return { type: 'text', text: block.text }
    if (block.type === 'image') {
      return {
        type: 'image_url',
        image_url: { url: `data:${block.source.media_type};base64,${block.source.data}` },
      }
    }
    return block
  })
}

function splitBuffer(buffer: Buffer, separator: Buffer): Buffer[] {
  const parts: Buffer[] = []
  let start = 0
  let index = buffer.indexOf(separator, start)
  while (index !== -1) {
    parts.push(buffer.subarray(start, index))
    start = index + separator.length
    index = buffer.indexOf(separator, start)
  }
  parts.push(buffer.subarray(start))
  return parts
}

function parseMultipartFormData(contentType: string | undefined, body: Buffer) {
  const boundaryMatch = contentType?.match(/boundary=(?:"([^"]+)"|([^;]+))/i)
  const boundary = boundaryMatch?.[1] || boundaryMatch?.[2]
  if (!boundary) throw new Error('Missing multipart boundary')

  const delimiter = Buffer.from(`--${boundary}`)
  const fields: Record<string, string> = {}
  const files: UploadedFilePart[] = []

  for (const rawPart of splitBuffer(body, delimiter)) {
    let part = rawPart
    if (part.length === 0) continue
    if (part.subarray(0, 2).equals(Buffer.from('\r\n'))) part = part.subarray(2)
    if (part.subarray(0, 2).equals(Buffer.from('--'))) continue

    const headerEnd = part.indexOf(Buffer.from('\r\n\r\n'))
    if (headerEnd === -1) continue

    const headerText = part.subarray(0, headerEnd).toString('utf8')
    let content = part.subarray(headerEnd + 4)
    if (content.subarray(content.length - 2).equals(Buffer.from('\r\n'))) {
      content = content.subarray(0, content.length - 2)
    }

    const disposition = headerText.match(/content-disposition:\s*form-data;([^\r\n]+)/i)?.[1] ?? ''
    const name = disposition.match(/name="([^"]+)"/i)?.[1]
    if (!name) continue

    const filename = disposition.match(/filename="([^"]*)"/i)?.[1]
    if (filename) {
      const contentTypeHeader = headerText.match(/content-type:\s*([^\r\n]+)/i)?.[1]?.trim() ?? 'application/octet-stream'
      files.push({ fieldName: name, filename, contentType: contentTypeHeader, data: Buffer.from(content) })
    } else {
      fields[name] = content.toString('utf8')
    }
  }

  return { fields, files }
}

interface VisionOcrCliResult {
  file: string
  pages: number
  extractedPages: number
  extractedChars: number
  results: Array<{ page: number; text: string; charCount: number }>
}

async function runVisionOcr(file: UploadedFilePart, pageLimit: number, startPage = 1) {
  await access(OCR_HELPER_PATH)
  const tempDir = await mkdtemp(path.join(tmpdir(), 'kiroku-pdf-ocr-'))
  const tempPdfPath = path.join(tempDir, file.filename.replace(/[^\w.-]+/g, '_') || 'upload.pdf')

  try {
    await writeFile(tempPdfPath, file.data)
    console.log(`[content] OCR start ${file.filename} start=${startPage} pages=${pageLimit}`)
    const { stdout } = await execFileAsync(
      OCR_HELPER_PATH,
      [tempPdfPath, String(startPage), String(pageLimit)],
      {
        timeout: OCR_REQUEST_TIMEOUT_MS,
        maxBuffer: 50 * 1024 * 1024,
      }
    )
    const parsed = JSON.parse(stdout) as VisionOcrCliResult
    console.log(`[content] OCR done ${file.filename} pages=${parsed.extractedPages}/${parsed.pages} chars=${parsed.extractedChars}`)
    return parsed
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
}

function buildOcrExtraction(file: UploadedFilePart, ocr: VisionOcrCliResult) {
  const ocrText = ocr.results
    .map(page => `[Page ${page.page}]\n${page.text}`)
    .join('\n\n')
  const ocrCharsPerPage = ocr.extractedPages > 0 ? ocr.extractedChars / ocr.extractedPages : 0
  const note = ocr.extractedPages < ocr.pages
    ? `\n\n[Import note]\nOnly the first ${ocr.extractedPages} of ${ocr.pages} pages were OCR-extracted from ${file.filename}.`
    : ''

  return {
    text: `${ocrText}${note}`,
    summary: {
      name: file.filename,
      sizeMB: Number((file.data.length / 1024 / 1024).toFixed(1)),
      pages: ocr.pages,
      extractedPages: ocr.extractedPages,
      extractedChars: ocr.extractedChars,
      charsPerPage: Math.round(ocrCharsPerPage),
      textSparse: ocrCharsPerPage < MIN_EXTRACTED_CHARS_PER_PAGE,
      ocrUsed: true,
    } satisfies PdfExtractSummary,
  }
}

function extractJsonCandidate(text: string) {
  const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
  const start = stripped.indexOf('{')
  const end = stripped.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) return stripped
  return stripped.slice(start, end + 1)
}

function parseJsonObject(text: string) {
  const candidate = extractJsonCandidate(text)
    .replace(/,\s*([}\]])/g, '$1')
  return JSON.parse(candidate) as unknown
}

function firstString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function dedupeBy<T extends Record<string, unknown>>(items: unknown, keyFor: (item: T) => string) {
  if (!Array.isArray(items)) return []
  const seen = new Set<string>()
  const result: T[] = []
  for (const raw of items) {
    if (!raw || typeof raw !== 'object') continue
    const item = raw as T
    const key = keyFor(item).toLowerCase()
    if (!key || seen.has(key)) continue
    seen.add(key)
    result.push(item)
  }
  return result
}

function normalizeExtractionResult(parsed: unknown): ExtractedContentResult {
  const source = parsed && typeof parsed === 'object' ? parsed as ExtractedContentResult : {}
  const vocab = dedupeBy(source.vocab, item =>
    `${firstString(item.word)}|${firstString(item.reading)}|${firstString(item.meaning)}`
  )
  const grammar = dedupeBy(source.grammar, item =>
    `${firstString(item.pattern)}|${firstString(item.title)}`
  )
  const lessons = dedupeBy(source.lessons, item =>
    `${firstString(item.content_type)}|${firstString(item.title)}|${firstString(item.body).slice(0, 200)}`
  ).map((lesson, index) => ({ ...lesson, sequence: index + 1 }))

  return {
    source_title: source.source_title ?? null,
    vocab,
    grammar,
    lessons,
  }
}

async function repairJsonResponse(options: {
  endpoint: string
  apiKey: string
  model: string
  responseText: string
}) {
  return await callOpenAICompatibleText({
    endpoint: options.endpoint,
    apiKey: options.apiKey,
    model: options.model,
    system: 'You repair malformed JSON. Return only valid JSON. Do not add commentary or markdown fences.',
    userText: `Convert this malformed extraction response into valid JSON with exactly these top-level keys: source_title, vocab, grammar, lessons. Preserve the extracted items, but remove anything that prevents JSON.parse from succeeding.\n\n${options.responseText}`,
    maxTokens: 8192,
    extraBody: { thinking: { type: 'disabled' } },
  })
}

async function extractPdfTextFromBuffer(file: UploadedFilePart, pageLimit: number, ocrMode: string, pageStart = 1) {
  if (ocrMode === 'prefer') {
    const ocr = await runVisionOcr(file, Math.max(1, pageLimit), Math.max(1, pageStart))
    return buildOcrExtraction(file, ocr)
  }

  const parser = new PDFParse({ data: file.data })
  try {
    const info = await parser.getInfo()
    const cappedPages = Math.min(Math.max(1, pageLimit), info.total)
    const partial = Array.from({ length: cappedPages }, (_v, i) => i + 1)
    const text = await parser.getText({ partial })
    const textCharsPerPage = text.text.length / cappedPages
    const textSparse = textCharsPerPage < MIN_EXTRACTED_CHARS_PER_PAGE

    if (textSparse && ocrMode === 'auto') {
      try {
        console.log(`[content] PDF text sparse for ${file.filename}; trying local Vision OCR`)
        const ocr = await runVisionOcr(file, cappedPages, Math.max(1, pageStart))
        return buildOcrExtraction(file, ocr)
      } catch (err) {
        const ocrError = err instanceof Error ? err.message : 'OCR failed'
        console.warn(`[content] OCR failed for ${file.filename}: ${ocrError}`)
        const note = cappedPages < info.total
          ? `\n\n[Import note]\nOnly the first ${cappedPages} of ${info.total} pages were extracted from ${file.filename}.`
          : ''
        return {
          text: `${text.text}${note}`,
          summary: {
            name: file.filename,
            sizeMB: Number((file.data.length / 1024 / 1024).toFixed(1)),
            pages: info.total,
            extractedPages: cappedPages,
            extractedChars: text.text.length,
            charsPerPage: Math.round(textCharsPerPage),
            textSparse: true,
            ocrError,
          } satisfies PdfExtractSummary,
        }
      }
    }

    const note = cappedPages < info.total
      ? `\n\n[Import note]\nOnly the first ${cappedPages} of ${info.total} pages were extracted from ${file.filename}.`
      : ''
    return {
      text: `${text.text}${note}`,
      summary: {
        name: file.filename,
        sizeMB: Number((file.data.length / 1024 / 1024).toFixed(1)),
        pages: info.total,
        extractedPages: cappedPages,
        extractedChars: text.text.length,
        charsPerPage: Math.round(textCharsPerPage),
        textSparse,
      } satisfies PdfExtractSummary,
    }
  } finally {
    await parser.destroy()
  }
}

async function handleOpenAIRequest(
  res: express.Response,
  messages: Array<{ role: string; content: MessageContent }>,
  system: string | undefined,
  model: string,
  tier: string,
  providedApiKey?: string,
  maxTokens?: number
) {
  const apiKey = providedApiKey || process.env.OPENAI_API_KEY
  if (!apiKey) {
    res.status(503).json({ error: 'OpenAI API key not configured' })
    return
  }

  const systemMsg = system ? [{ role: 'system', content: system }] : []
  const openAiMessages = messages.map(m => ({ role: m.role, content: toOpenAIContent(m.content) }))
  const response = await fetchWithTimeout('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'authorization': `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens ?? (tier === 'reasoning' ? 8192 : 2048),
      messages: [...systemMsg, ...openAiMessages],
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    res.status(response.status).json({ error: err })
    return
  }

  const data = await response.json() as { choices: { message: { content: string } }[] }
  res.json({ text: data.choices[0]?.message?.content ?? '' })
}

async function handleOpenRouterRequest(
  res: express.Response,
  messages: Array<{ role: string; content: MessageContent }>,
  system: string | undefined,
  model: string,
  tier: string,
  providedApiKey?: string,
  maxTokens?: number
) {
  const apiKey = providedApiKey || process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    res.status(503).json({ error: 'OpenRouter API key not configured' })
    return
  }

  const systemMsg = system ? [{ role: 'system', content: system }] : []
  const openAiMessages = messages.map(m => ({ role: m.role, content: toOpenAIContent(m.content) }))
  const response = await fetchWithTimeout('https://openrouter.io/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'authorization': `Bearer ${apiKey}`,
      'http-referer': 'http://localhost:5173',
      'x-title': 'KirokuMichi',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens ?? (tier === 'reasoning' ? 8192 : 2048),
      messages: [...systemMsg, ...openAiMessages],
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    res.status(response.status).json({ error: err })
    return
  }

  const data = await response.json() as { choices: { message: { content: string } }[] }
  res.json({ text: data.choices[0]?.message?.content ?? '' })
}

async function handleDeepSeekRequest(
  res: express.Response,
  messages: Array<{ role: string; content: MessageContent }>,
  system: string | undefined,
  model: string,
  tier: string,
  providedApiKey?: string,
  maxTokens?: number
) {
  await handleOpenAICompatibleRequest(res, messages, system, model, tier, {
    apiKey: providedApiKey || process.env.DEEPSEEK_API_KEY,
    endpoint: 'https://api.deepseek.com/chat/completions',
    maxTokens,
    extraBody: tier === 'fast'
      ? { thinking: { type: 'disabled' } }
      : { thinking: { type: 'enabled' }, reasoning_effort: 'high' },
    missingKeyError: 'DeepSeek API key not configured',
  })
}

async function handleOpenAICompatibleRequest(
  res: express.Response,
  messages: Array<{ role: string; content: MessageContent }>,
  system: string | undefined,
  model: string,
  tier: string,
  options: {
    apiKey?: string
    endpoint?: string
    maxTokens?: number
    extraBody?: Record<string, unknown>
    missingKeyError: string
    missingEndpointError?: string
  }
) {
  if (!options.apiKey) {
    res.status(503).json({ error: options.missingKeyError })
    return
  }
  if (!options.endpoint) {
    res.status(503).json({ error: options.missingEndpointError || 'Provider endpoint not configured' })
    return
  }

  const systemMsg = system ? [{ role: 'system', content: system }] : []
  const openAiMessages = messages.map(m => ({ role: m.role, content: toOpenAIContent(m.content) }))
  const response = await fetchWithTimeout(options.endpoint, {
    method: 'POST',
    headers: {
      'authorization': `Bearer ${options.apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: options.maxTokens ?? (tier === 'reasoning' ? 8192 : 2048),
      messages: [...systemMsg, ...openAiMessages],
      ...options.extraBody,
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    res.status(response.status).json({ error: err })
    return
  }

  const data = await response.json() as { choices: { message: { content: string } }[] }
  res.json({ text: data.choices[0]?.message?.content ?? '' })
}

async function handleOllamaRequest(
  res: express.Response,
  messages: Array<{ role: string; content: string }>,
  system: string | undefined,
  model: string
) {
  const endpoint = process.env.OLLAMA_ENDPOINT || 'http://localhost:11434'

  const response = await fetchWithTimeout(`${endpoint}/api/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model,
      system,
      messages,
      stream: false,
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    res.status(response.status).json({ error: err })
    return
  }

  const data = await response.json() as { message: { content: string } }
  res.json({ text: data.message?.content ?? '' })
}

// Azure Cognitive Services TTS proxy
// Simple in-memory cache keyed by sha256(text+voice), capped at 200 entries
const ttsCache = new Map<string, Buffer>()
const ttsCacheOrder: string[] = []
const TTS_CACHE_MAX = 200

app.post('/api/tts', requireToken, async (req, res) => {
  const { text, voice, azureTtsKey, azureTtsRegion } = req.body as {
    text: string
    voice?: string
    azureTtsKey: string
    azureTtsRegion: string
  }

  if (!text || typeof text !== 'string') {
    res.status(400).json({ error: 'text is required' })
    return
  }
  if (!azureTtsKey || typeof azureTtsKey !== 'string') {
    res.status(400).json({ error: 'azureTtsKey is required' })
    return
  }

  const voiceName = voice ?? 'ja-JP-NanamiNeural'
  const region = azureTtsRegion || 'eastus'
  const cacheKey = crypto.createHash('sha256').update(text + voiceName).digest('hex')

  if (ttsCache.has(cacheKey)) {
    const cached = ttsCache.get(cacheKey)!
    res.setHeader('Content-Type', 'audio/mpeg')
    res.end(cached)
    return
  }

  const ssml = `<speak version='1.0' xml:lang='ja-JP'><voice name='${voiceName}'>${text}</voice></speak>`

  try {
    const azureRes = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': azureTtsKey,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-24khz-96kbitrate-mono-mp3',
      },
      body: ssml,
    })

    if (!azureRes.ok) {
      const errText = await azureRes.text().catch(() => '')
      res.status(azureRes.status).json({ error: `Azure TTS error: ${azureRes.status} ${errText}` })
      return
    }

    const arrayBuffer = await azureRes.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Evict oldest if at cap
    if (ttsCache.size >= TTS_CACHE_MAX) {
      const oldest = ttsCacheOrder.shift()
      if (oldest) ttsCache.delete(oldest)
    }
    ttsCache.set(cacheKey, buffer)
    ttsCacheOrder.push(cacheKey)

    res.setHeader('Content-Type', 'audio/mpeg')
    res.end(buffer)
  } catch (err) {
    console.error('[tts] Azure TTS request failed:', err)
    res.status(500).json({ error: `TTS request failed: ${err instanceof Error ? err.message : String(err)}` })
  }
})

// Weak-point analysis trigger — client sends computed summary for logging/future server-side use
app.post('/api/ai/analyze', requireToken, (req, res) => {
  const { userId, summary } = req.body as { userId: number; summary: unknown }
  if (!userId || !summary) {
    res.status(400).json({ error: 'userId and summary required' })
    return
  }
  // In the future this could persist to a remote store or trigger server-side analysis
  console.log(`[analyze] Received weak-point summary for user ${userId}`)
  res.json({ ok: true })
})

app.post('/api/content/extract-pdfs', requireToken, express.raw({ type: 'multipart/form-data', limit: '300mb' }), async (req, res) => {
  const startedAt = Date.now()
  try {
    const { fields, files } = parseMultipartFormData(req.headers['content-type'], req.body as Buffer)
    const pdfFiles = files.filter(file =>
      file.contentType === 'application/pdf' || file.filename.toLowerCase().endsWith('.pdf')
    )
    if (pdfFiles.length === 0) {
      res.status(400).json({ error: 'No PDF files uploaded' })
      return
    }

    const apiKey = fields.apiKey
    if (!apiKey) {
      res.status(400).json({ error: 'AI API key required' })
      return
    }

    const provider = fields.provider || 'deepseek'
    const fastModel = fields.fastModel || 'deepseek-v4-flash'
    const pageLimit = Number(fields.pageLimit || 10)
    const pageStart = Number(fields.pageStart || 1)
    const ocrMode = fields.ocrMode || 'auto'
    const fileRanges = parsePdfFileRanges(fields.fileRanges, pdfFiles, pageStart, pageLimit)
    const system = fields.system || `You are a Japanese learning content extractor. Return valid JSON only with this shape:
{"source_title": string | null, "vocab": [], "grammar": [], "lessons": []}
Extract vocabulary, grammar, and lesson-like reading/dialogue content.`
    const cacheKey = buildExtractionCacheKey({
      files: pdfFiles,
      provider,
      model: fastModel,
      fileRanges,
      ocrMode,
      system,
    })
    const cached = extractionCache.get(cacheKey)
    if (cached) {
      console.log(`[content] cache hit PDFs=${pdfFiles.length} result=${cached.result.vocab?.length ?? 0}/${cached.result.grammar?.length ?? 0}/${cached.result.lessons?.length ?? 0}`)
      res.json(cached)
      return
    }

    const extractedParts: string[] = []
    const summaries: PdfExtractSummary[] = []

    for (const file of pdfFiles) {
      const range = fileRanges.find(item => item.filename === file.filename) ?? { startPage: pageStart, pageLimit }
      const extracted = await extractPdfTextFromBuffer(file, range.pageLimit, ocrMode, range.startPage)
      summaries.push(extracted.summary)
      extractedParts.push(`## ${file.filename}\n\n${extracted.text}`)
    }

    const totalExtractedChars = summaries.reduce((sum, summary) => sum + summary.extractedChars, 0)
    const totalExtractedPages = summaries.reduce((sum, summary) => sum + summary.extractedPages, 0)
    const averageCharsPerPage = totalExtractedPages > 0 ? totalExtractedChars / totalExtractedPages : 0
    if (averageCharsPerPage < MIN_EXTRACTED_CHARS_PER_PAGE) {
      const ocrErrors = summaries.map(summary => summary.ocrError).filter(Boolean)
      res.status(422).json({
        error: ocrErrors.length > 0
          ? `These PDFs appear to be image-based/scanned, and local OCR could not run. Text extraction found only ${Math.round(averageCharsPerPage)} characters per page on average. OCR error: ${ocrErrors[0]}`
          : `These PDFs appear to be image-based/scanned. Text extraction found only ${Math.round(averageCharsPerPage)} characters per page on average, so there is not enough text to extract vocabulary or grammar. Use an OCR/vision import path before AI extraction.`,
        code: 'PDF_TEXT_TOO_SPARSE',
        files: summaries,
      })
      return
    }

    const userText = `Extract all Japanese learning content from these uploaded PDF snippets in document order. Treat related files, such as a textbook and workbook, as one shared context.\n\n${extractedParts.join('\n\n---\n\n')}`

    let responseText: string
    if (provider === 'deepseek') {
      responseText = await callOpenAICompatibleText({
        endpoint: 'https://api.deepseek.com/chat/completions',
        apiKey,
        model: fastModel,
        system,
        userText,
        maxTokens: 8192,
        extraBody: { thinking: { type: 'disabled' } },
      })
    } else {
      res.status(400).json({ error: `Server PDF extraction currently supports DeepSeek only. Received: ${provider}` })
      return
    }

    let parsed: unknown
    try {
      parsed = parseJsonObject(responseText)
    } catch (err) {
      console.warn(`[content] AI response was not valid JSON; attempting repair: ${err instanceof Error ? err.message : 'JSON parse failed'}`)
      try {
        const repaired = await repairJsonResponse({
          endpoint: 'https://api.deepseek.com/chat/completions',
          apiKey,
          model: fastModel,
          responseText,
        })
        parsed = parseJsonObject(repaired)
      } catch (repairErr) {
        res.status(502).json({
          error: 'AI response was not valid JSON, and automatic repair failed. Try a smaller page count.',
          parseError: repairErr instanceof Error ? repairErr.message : 'JSON repair failed',
          files: summaries,
        })
        return
      }
    }

    const normalized = normalizeExtractionResult(parsed)
    console.log(`[content] extracted ${pdfFiles.length} PDFs pages=${summaries.map(s => s.pages).join('+')} chars=${totalExtractedChars} result=${normalized.vocab?.length ?? 0}/${normalized.grammar?.length ?? 0}/${normalized.lessons?.length ?? 0} in ${Date.now() - startedAt}ms`)
    const payload = { result: normalized, files: summaries }
    extractionCache.set(cacheKey, payload)
    res.json(payload)
  } catch (err) {
    console.error('PDF upload extraction failed:', err)
    res.status(500).json({ error: err instanceof Error ? err.message : 'PDF upload extraction failed' })
  }
})

app.post('/api/dev/test-pdf-ocr', requireToken, async (req, res) => {
  const { pageLimit = 2, pageStart = 1 } = req.body as { pageLimit?: number; pageStart?: number }
  const startedAt = Date.now()

  try {
    const fixtureDir = path.resolve(process.cwd(), '..', 'test-fixtures')
    const fixtureNames = (await readdir(fixtureDir)).filter(name => name.toLowerCase().endsWith('.pdf'))
    if (fixtureNames.length === 0) {
      res.status(404).json({ error: 'No PDF fixtures found in test-fixtures' })
      return
    }

    const files: PdfExtractSummary[] = []
    for (const name of fixtureNames) {
      const filePath = path.join(fixtureDir, name)
      const data = await readFile(filePath)
      const extracted = await extractPdfTextFromBuffer({
        fieldName: 'fixture',
        filename: name,
        contentType: 'application/pdf',
        data,
      }, pageLimit, 'prefer', pageStart)
      files.push(extracted.summary)
    }

    res.json({
      ok: true,
      elapsedMs: Date.now() - startedAt,
      files,
      totals: {
        pages: files.reduce((sum, file) => sum + file.extractedPages, 0),
        chars: files.reduce((sum, file) => sum + file.extractedChars, 0),
        charsPerPage: Math.round(
          files.reduce((sum, file) => sum + file.extractedChars, 0) /
          Math.max(1, files.reduce((sum, file) => sum + file.extractedPages, 0))
        ),
      },
    })
  } catch (err) {
    console.error('Dev PDF OCR test failed:', err)
    res.status(500).json({ error: err instanceof Error ? err.message : 'Dev PDF OCR test failed' })
  }
})

app.post('/api/dev/test-pdf-import', requireToken, async (req, res) => {
  const {
    apiKey,
    fastModel = 'deepseek-v4-flash',
    pageLimit = 10,
    pageStart = 1,
  } = req.body as {
    apiKey?: string
    fastModel?: string
    pageLimit?: number
    pageStart?: number
  }

  if (!apiKey) {
    res.status(400).json({ error: 'DeepSeek API key required for dev PDF test' })
    return
  }

  try {
    const fixtureDir = path.resolve(process.cwd(), '..', 'test-fixtures')
    const fixtureNames = (await readdir(fixtureDir)).filter(name => name.toLowerCase().endsWith('.pdf'))
    if (fixtureNames.length === 0) {
      res.status(404).json({ error: 'No PDF fixtures found in test-fixtures' })
      return
    }

    const fixtureFiles: UploadedFilePart[] = []
    for (const name of fixtureNames) {
      const filePath = path.join(fixtureDir, name)
      fixtureFiles.push({
        fieldName: 'fixture',
        filename: name,
        contentType: 'application/pdf',
        data: await readFile(filePath),
      })
    }

    const system = `You are a Japanese learning content extractor. Return valid JSON only:
{"source_title": string | null, "vocab": [], "grammar": [], "lessons": []}
Extract vocabulary, grammar, and lesson-like reading/dialogue content. Keep the response concise for this smoke test.`
    const fileRanges = fixtureFiles.map(file => ({ filename: file.filename, startPage: pageStart, pageLimit }))
    const cacheKey = buildExtractionCacheKey({
      files: fixtureFiles,
      provider: 'deepseek',
      model: fastModel,
      fileRanges,
      ocrMode: 'prefer',
      system,
    })
    const cached = extractionCache.get(cacheKey)
    if (cached) {
      console.log(`[content] dev cache hit result=${cached.result.vocab?.length ?? 0}/${cached.result.grammar?.length ?? 0}/${cached.result.lessons?.length ?? 0}`)
      res.json({
        files: cached.files,
        ai: {
          model: fastModel,
          responseChars: 0,
          validJson: true,
          parseError: null,
          counts: {
            vocab: cached.result.vocab?.length ?? 0,
            grammar: cached.result.grammar?.length ?? 0,
            lessons: cached.result.lessons?.length ?? 0,
          },
          sourceTitle: cached.result.source_title ?? null,
          cached: true,
        },
      })
      return
    }

    const summaries: PdfExtractSummary[] = []
    const combinedParts: string[] = []

    for (const file of fixtureFiles) {
      const extracted = await extractPdfTextFromBuffer(file, pageLimit, 'prefer', pageStart)

      summaries.push(extracted.summary)
      combinedParts.push(`## ${file.filename}\n${extracted.text}`)
    }

    const response = await callOpenAICompatibleText({
      endpoint: 'https://api.deepseek.com/chat/completions',
      apiKey,
      model: fastModel,
      system,
      userText: `Smoke-test extraction from these PDF snippets. Do not include copyrighted source text verbatim beyond short item labels.\n\n${combinedParts.join('\n\n---\n\n')}`,
      maxTokens: 8192,
      extraBody: { thinking: { type: 'disabled' } },
    })

    let parsed: { vocab?: unknown[]; grammar?: unknown[]; lessons?: unknown[]; source_title?: string | null } | null = null
    let parseError: string | null = null
    try {
      parsed = parseJsonObject(response) as { vocab?: unknown[]; grammar?: unknown[]; lessons?: unknown[]; source_title?: string | null }
    } catch (err) {
      try {
        const repaired = await repairJsonResponse({
          endpoint: 'https://api.deepseek.com/chat/completions',
          apiKey,
          model: fastModel,
          responseText: response,
        })
        parsed = normalizeExtractionResult(parseJsonObject(repaired)) as { vocab?: unknown[]; grammar?: unknown[]; lessons?: unknown[]; source_title?: string | null }
      } catch (repairErr) {
        parseError = repairErr instanceof Error ? repairErr.message : err instanceof Error ? err.message : 'JSON parse failed'
      }
    }
    if (parsed) {
      parsed = normalizeExtractionResult(parsed) as { vocab?: unknown[]; grammar?: unknown[]; lessons?: unknown[]; source_title?: string | null }
    }
    if (parsed) {
      extractionCache.set(cacheKey, { result: parsed as ExtractedContentResult, files: summaries })
    }

    res.json({
      files: summaries,
      ai: {
        model: fastModel,
        responseChars: response.length,
        validJson: parsed !== null,
        parseError,
        counts: parsed ? {
          vocab: Array.isArray(parsed.vocab) ? parsed.vocab.length : 0,
          grammar: Array.isArray(parsed.grammar) ? parsed.grammar.length : 0,
          lessons: Array.isArray(parsed.lessons) ? parsed.lessons.length : 0,
        } : null,
        sourceTitle: parsed?.source_title ?? null,
      },
    })
  } catch (err) {
    console.error('Dev PDF import test failed:', err)
    res.status(500).json({ error: err instanceof Error ? err.message : 'Dev PDF import test failed' })
  }
})

async function callOpenAICompatibleText(options: {
  endpoint: string
  apiKey: string
  model: string
  system: string
  userText: string
  maxTokens: number
  extraBody?: Record<string, unknown>
}) {
  const response = await fetchWithTimeout(options.endpoint, {
    method: 'POST',
    headers: {
      'authorization': `Bearer ${options.apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: options.model,
      max_tokens: options.maxTokens,
      temperature: 0,
      top_p: 1,
      seed: 1,
      messages: [
        { role: 'system', content: options.system },
        { role: 'user', content: options.userText },
      ],
      ...options.extraBody,
    }),
  })

  if (!response.ok) {
    throw new Error(await readResponseTextWithTimeout(response))
  }

  const data = await response.json() as { choices: { message: { content: string } }[] }
  return data.choices[0]?.message?.content ?? ''
}

app.listen(PORT, HOST, () => {
  console.log(`KirokuMichi server running at http://${HOST}:${PORT}`)
})
