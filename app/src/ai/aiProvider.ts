import type { AIProvider, AIMessage } from '../core/providers'
import { useAppStore } from '../store'

/**
 * Client-side AI proxy. All requests go through the Express server at /api/ai/complete,
 * which handles the actual API calls to any configured provider (Anthropic, OpenAI, custom, etc).
 * This keeps API keys server-side only.
 */
export class ClientAIProvider implements AIProvider {
  private sessionToken: string | null = null
  private aiProvider: string | null = null
  private fastModel: string
  private powerfulModel: string

  constructor(sessionToken?: string | null) {
    const store = useAppStore()
    this.sessionToken = sessionToken || store.settings.sessionToken
    this.aiProvider = store.settings.aiProvider
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

    const response = await fetch('/api/ai/complete', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-session-token': this.sessionToken,
      },
      body: JSON.stringify({
        messages,
        system,
        tier,
        provider: this.aiProvider,
        fastModel: this.fastModel,
        powerfulModel: this.powerfulModel,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`AI request failed: ${error}`)
    }

    const data = await response.json() as { text: string }
    return data.text
  }

  async *completeStream(): AsyncIterable<string> {
    throw new Error('Streaming not yet implemented')
  }
}
