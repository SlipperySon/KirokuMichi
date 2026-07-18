import type { AIProvider, AIMessage } from '../core/providers'
import { useAppStore } from '../store'

/**
 * Client-side AI proxy. All requests go through the Express server at /api/ai/complete,
 * which handles the actual API calls to any configured provider (Anthropic, OpenAI, custom, etc).
 * Hosted provider keys may come from server env vars, or from a session-only
 * user-supplied key passed through this proxy request.
 */
export class ClientAIProvider implements AIProvider {
  private sessionToken: string | null = null
  private aiProvider: string | null = null
  private apiKey: string | null = null
  private apiEndpoint: string | null = null
  private fastModel: string
  private powerfulModel: string

  constructor(sessionToken?: string | null) {
    const store = useAppStore.getState()
    this.sessionToken = sessionToken || store.settings.sessionToken
    this.aiProvider = store.settings.aiProvider
    this.apiKey = store.settings.apiKey
    this.apiEndpoint = store.settings.apiEndpoint
    this.fastModel = store.settings.fastModel
    this.powerfulModel = store.settings.powerfulModel
  }

  async complete(prompt: string, tier: 'fast' | 'reasoning'): Promise<string> {
    return this.completeWithMessages([{ role: 'user', content: prompt }], undefined, tier)
  }

  async completeWithMessages(
    messages: AIMessage[],
    system?: string,
    tier: 'fast' | 'reasoning' = 'fast'
  ): Promise<string> {
    if (!this.sessionToken) {
      throw new Error('No session token available. Please configure AI in Settings.')
    }

    if (!this.aiProvider) {
      throw new Error('No AI provider configured. Please set one in Settings.')
    }

    let response = await this.requestCompletion(messages, system, tier)
    if (response.status === 401) {
      await this.refreshSessionToken()
      response = await this.requestCompletion(messages, system, tier)
    }

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`AI request failed: ${error}`)
    }

    const data = await response.json() as { text: string }
    return data.text
  }

  private async refreshSessionToken() {
    const response = await fetch('/api/session', { method: 'POST', credentials: 'include' })
    if (!response.ok) return
    const data = await response.json() as { token: string }
    this.sessionToken = data.token
    useAppStore.getState().setSessionToken(data.token)
  }

  private requestCompletion(messages: AIMessage[], system: string | undefined, tier: 'fast' | 'reasoning', stream = false) {
    if (!this.sessionToken) {
      throw new Error('No session token available. Please configure AI in Settings.')
    }

    return fetch('/api/ai/complete', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'content-type': 'application/json',
        'x-session-token': this.sessionToken,
      },
      body: JSON.stringify({
        messages,
        system,
        tier,
        stream,
        provider: this.aiProvider,
        apiKey: this.apiKey,
        apiEndpoint: this.apiEndpoint,
        fastModel: this.fastModel,
        powerfulModel: this.powerfulModel,
      }),
    })
  }

  /**
   * Stream a chat completion via SSE. The `onChunk` callback fires for each
   * text delta. The returned Promise resolves with the full concatenated text
   * once the stream ends. Falls back to a non-streaming request and emits the
   * full result as a single chunk if the provider doesn't support streaming.
   */
  async completeWithMessagesStream(
    messages: AIMessage[],
    system: string | undefined,
    tier: 'fast' | 'reasoning',
    onChunk: (delta: string) => void
  ): Promise<string> {
    if (!this.sessionToken) {
      throw new Error('No session token available. Please configure AI in Settings.')
    }
    if (!this.aiProvider) {
      throw new Error('No AI provider configured. Please set one in Settings.')
    }

    let response = await this.requestCompletion(messages, system, tier, true)
    if (response.status === 401) {
      await this.refreshSessionToken()
      response = await this.requestCompletion(messages, system, tier, true)
    }

    if (!response.ok) {
      // Provider may not support streaming (e.g., Ollama) — gracefully fall back
      if (response.status === 400) {
        const text = await this.completeWithMessages(messages, system, tier)
        onChunk(text)
        return text
      }
      const err = await response.text()
      throw new Error(`AI request failed: ${err}`)
    }

    const contentType = response.headers.get('content-type') ?? ''
    if (!contentType.includes('text/event-stream') || !response.body) {
      // Server replied non-streaming despite our request — handle as JSON
      const data = (await response.json()) as { text?: string }
      const text = data.text ?? ''
      onChunk(text)
      return text
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let full = ''

    try {
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        let nl
        while ((nl = buffer.indexOf('\n\n')) !== -1) {
          const event = buffer.slice(0, nl)
          buffer = buffer.slice(nl + 2)
          for (const line of event.split('\n')) {
            if (!line.startsWith('data: ')) continue
            const payload = line.slice(6)
            if (payload === '[DONE]') return full
            try {
              const parsed = JSON.parse(payload) as { delta?: string; error?: string }
              if (parsed.error) throw new Error(parsed.error)
              if (parsed.delta) {
                full += parsed.delta
                onChunk(parsed.delta)
              }
            } catch (err) {
              // If JSON parse failed but the line was a control marker, ignore
              if (err instanceof Error && err.message !== payload) throw err
            }
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
    return full
  }

  async *completeStream(): AsyncIterable<string> {
    throw new Error('Streaming not yet implemented')
  }
}
