import { useState, useRef, useEffect } from 'react'
import { Send } from 'lucide-react'
import { useAppStore } from '../store'
import { ClientAIProvider } from '../ai/aiProvider'
import { buildTutorSystemPrompt } from '../ai/systemPrompts'
import { getCachedWeakPoints, buildWeakPointContext } from '../ai/weakPointSummary'
import { SQLiteStorage } from '../db/sqlite'
import { Navigation } from '../components/Navigation'
import { ContentUpload } from './ContentUpload'
import type { AIMessage } from '../core/providers'

type Tab = 'tutor' | 'upload'

const STARTER_PROMPTS = [
  'What does は do?',
  "How do you say 'to eat'?",
  'When do I use に vs で?',
  "Can you fix my sentence?",
]

export function TutorChat() {
  const { settings, activeUserId } = useAppStore()
  const [storage] = useState(() => new SQLiteStorage())
  const [tab, setTab] = useState<Tab>('tutor')
  const [messages, setMessages] = useState<AIMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [systemPrompt, setSystemPrompt] = useState(buildTutorSystemPrompt(''))
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const userId = activeUserId ?? 1
    getCachedWeakPoints(storage, userId).then(summary => {
      const ctx = buildWeakPointContext(summary)
      setSystemPrompt(buildTutorSystemPrompt(ctx))
    })
  }, [activeUserId, storage])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSend = async () => {
    if (!input.trim() || loading) return

    const userMessage: AIMessage = { role: 'user', content: input }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setLoading(true)
    setError(null)

    try {
      const aiProvider = new ClientAIProvider(settings.sessionToken)
      const response = await aiProvider.completeWithMessages(
        [...messages, userMessage],
        systemPrompt,
        'fast'
      )
      setMessages(prev => [...prev, { role: 'assistant', content: response }])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed')
      setMessages(prev => prev.slice(0, -1)) // Remove user message on error
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Navigation />
      <main className="flex flex-col h-full max-w-2xl mx-auto flex-1" aria-label="Practice">
        <div className="p-4 border-b border-gray-200">
          <h1 className="text-2xl font-bold text-gray-900">Practice</h1>
          <div className="flex gap-1 mt-3">
            {(['tutor', 'upload'] as Tab[]).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  tab === t ? 'bg-indigo-100 text-indigo-700' : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                {t === 'tutor' ? 'AI Tutor' : 'Upload Content'}
              </button>
            ))}
          </div>
        </div>

        {tab === 'upload' ? (
          <div className="flex-1 overflow-y-auto">
            <ContentUpload />
          </div>
        ) : (
          <>

      <div className="flex-1 overflow-y-auto p-4 space-y-4" role="log" aria-live="polite" aria-label="Chat messages">
        {messages.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <p className="text-gray-500 text-center">Ask your first question</p>
            <div className="grid grid-cols-2 gap-2 w-full max-w-sm">
              {STARTER_PROMPTS.map(prompt => (
                <button
                  key={prompt}
                  onClick={() => {
                    setInput(prompt)
                  }}
                  className="p-3 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors text-left"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-900'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 text-gray-900 px-4 py-2 rounded-lg">
              <p className="text-sm text-gray-600">Thinking…</p>
            </div>
          </div>
        )}

        {error && (
          <div className="flex justify-center">
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg max-w-xs">
              <p className="text-sm">{error}</p>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t border-gray-200 bg-white">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            placeholder="Ask your question…"
            aria-label="Ask a question about Japanese"
            disabled={loading}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            aria-label="Send message"
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            <Send className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </div>
        </>
        )}
    </main>
    </div>
  )
}
