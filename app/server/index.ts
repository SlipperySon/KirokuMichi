import express from 'express'
import cors from 'cors'
import crypto from 'crypto'

const app = express()
const PORT = 3001
const HOST = '127.0.0.1'

const sessionTokens = new Set<string>()

app.use(express.json())
app.use(cors({ origin: ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:5174', 'http://127.0.0.1:5174'] }))

// Issue a session token
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
  const {
    messages,
    system,
    tier,
    provider,
    fastModel = 'gpt-3.5-turbo',
    powerfulModel = 'gpt-4',
    // Backward compat: legacy `prompt` string
    prompt,
  } = req.body as {
    messages?: Array<{ role: string; content: string }>
    system?: string
    tier: 'fast' | 'reasoning'
    provider: 'anthropic' | 'openai' | 'openrouter' | 'ollama' | 'custom'
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

  try {
    if (provider === 'anthropic') {
      await handleAnthropicRequest(res, finalMessages, system, model, tier)
    } else if (provider === 'openai') {
      await handleOpenAIRequest(res, finalMessages, system, model, tier)
    } else if (provider === 'openrouter') {
      await handleOpenRouterRequest(res, finalMessages, system, model, tier)
    } else if (provider === 'ollama') {
      await handleOllamaRequest(res, finalMessages, system, model)
    } else if (provider === 'custom') {
      res.status(501).json({ error: 'Custom provider endpoint not yet implemented' })
    } else {
      res.status(400).json({ error: `Unknown provider: ${provider}` })
    }
  } catch (err) {
    console.error('AI request error:', err)
    res.status(500).json({ error: 'AI request failed' })
  }
})

type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }

type MessageContent = string | ContentBlock[]

async function handleAnthropicRequest(
  res: express.Response,
  messages: Array<{ role: string; content: MessageContent }>,
  system: string | undefined,
  model: string,
  tier: string
) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    res.status(503).json({ error: 'Anthropic API key not configured' })
    return
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: tier === 'reasoning' ? 8192 : 2048,
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

async function handleOpenAIRequest(
  res: express.Response,
  messages: Array<{ role: string; content: MessageContent }>,
  system: string | undefined,
  model: string,
  tier: string
) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    res.status(503).json({ error: 'OpenAI API key not configured' })
    return
  }

  const systemMsg = system ? [{ role: 'system', content: system }] : []
  const openAiMessages = messages.map(m => ({ role: m.role, content: toOpenAIContent(m.content) }))
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'authorization': `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: tier === 'reasoning' ? 8192 : 2048,
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
  tier: string
) {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    res.status(503).json({ error: 'OpenRouter API key not configured' })
    return
  }

  const systemMsg = system ? [{ role: 'system', content: system }] : []
  const openAiMessages = messages.map(m => ({ role: m.role, content: toOpenAIContent(m.content) }))
  const response = await fetch('https://openrouter.io/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'authorization': `Bearer ${apiKey}`,
      'http-referer': 'http://localhost:5173',
      'x-title': 'KirokuMichi',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: tier === 'reasoning' ? 8192 : 2048,
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

async function handleOllamaRequest(
  res: express.Response,
  messages: Array<{ role: string; content: string }>,
  system: string | undefined,
  model: string
) {
  const endpoint = process.env.OLLAMA_ENDPOINT || 'http://localhost:11434'

  const response = await fetch(`${endpoint}/api/chat`, {
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

app.listen(PORT, HOST, () => {
  console.log(`KirokuMichi server running at http://${HOST}:${PORT}`)
})
