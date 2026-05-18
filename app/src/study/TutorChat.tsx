import { useState, useRef, useEffect } from 'react'
import { Send } from 'lucide-react'
import { useAppStore } from '../store'
import { ClientAIProvider } from '../ai/aiProvider'
import { buildTutorSystemPrompt } from '../ai/systemPrompts'
import { getCachedWeakPoints, buildWeakPointContext } from '../ai/weakPointSummary'
import { SQLiteStorage } from '../db/sqlite'
import { Navigation } from '../components/Navigation'
import { AutoGrowTextarea } from '../components/AutoGrowTextarea'
import { toast } from '../components/toastStore'
import { ContentUpload } from './ContentUpload'
import { ConversationPartner } from './ConversationPartner'
import type { AIMessage } from '../core/providers'

type Tab = 'tutor' | 'conversation' | 'upload'

const TAB_LABELS: Record<Tab, string> = {
  tutor: 'AI Tutor',
  conversation: 'Conversation',
  upload: 'Upload Content',
}

const STARTER_PROMPTS = [
  'What does は do?',
  "How do you say 'to eat'?",
  'When do I use に vs で?',
  "Can you fix my sentence?",
]

const TUTOR_CHAT_STORAGE_KEY = 'kiroku-tutor-chat'
const MAX_PERSISTED_MESSAGES = 50

function loadPersistedMessages(): AIMessage[] {
  try {
    const raw = localStorage.getItem(TUTOR_CHAT_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (m): m is AIMessage =>
        typeof m === 'object' &&
        m !== null &&
        (((m as AIMessage).role === 'user') || ((m as AIMessage).role === 'assistant')) &&
        typeof (m as AIMessage).content === 'string'
    )
  } catch {
    return []
  }
}

function persistMessages(messages: AIMessage[]) {
  try {
    const tail = messages.slice(-MAX_PERSISTED_MESSAGES)
    localStorage.setItem(TUTOR_CHAT_STORAGE_KEY, JSON.stringify(tail))
  } catch {
    // Storage full or disabled — silently degrade
  }
}

export function TutorChat() {
  const { settings, activeUserId } = useAppStore()
  const [storage] = useState(() => new SQLiteStorage())
  const [tab, setTab] = useState<Tab>('tutor')
  const [messages, setMessages] = useState<AIMessage[]>(() => loadPersistedMessages())
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
    persistMessages(messages)
  }, [messages])

  const clearChat = () => {
    setMessages([])
    setError(null)
    try {
      localStorage.removeItem(TUTOR_CHAT_STORAGE_KEY)
    } catch {
      // ignore
    }
  }

  const handleSend = async () => {
    if (!input.trim() || loading) return

    const userMessage: AIMessage = { role: 'user', content: input }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setLoading(true)
    setError(null)

    // Append a placeholder assistant message we'll grow as chunks arrive.
    setMessages(prev => [...prev, { role: 'assistant', content: '' }])

    try {
      const aiProvider = new ClientAIProvider(settings.sessionToken)
      await aiProvider.completeWithMessagesStream(
        [...messages, userMessage],
        systemPrompt,
        'fast',
        (delta: string) => {
          setMessages(prev => {
            const next = [...prev]
            const last = next[next.length - 1]
            if (last && last.role === 'assistant') {
              next[next.length - 1] = { role: 'assistant', content: last.content + delta }
            }
            return next
          })
        }
      )
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Connection failed'
      setError(message)
      toast.error(`AI tutor failed: ${message}`)
      // Remove the user message AND placeholder assistant on error
      setMessages(prev => prev.slice(0, -2))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Navigation />
      <main className="flex flex-col h-full w-full max-w-2xl mx-auto flex-1" aria-label="Practice">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-2xl font-bold text-gray-900">Practice</h1>
            {tab === 'tutor' && messages.length > 0 && (
              <button
                onClick={clearChat}
                className="text-xs text-gray-500 hover:text-red-600 transition-colors"
                aria-label="Clear chat"
              >
                Clear chat
              </button>
            )}
          </div>
          <div className="flex gap-1 mt-3 overflow-x-auto pb-1">
            {(['tutor', 'conversation', 'upload'] as Tab[]).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`shrink-0 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  tab === t ? 'bg-indigo-100 text-indigo-700' : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                {TAB_LABELS[t]}
              </button>
            ))}
          </div>
        </div>

        {tab === 'upload' ? (
          <div className="flex-1 overflow-y-auto">
            <ContentUpload />
          </div>
        ) : tab === 'conversation' ? (
          <div className="flex-1 flex flex-col min-h-0">
            <ConversationPartner />
          </div>
        ) : (
          <>

      <div className="flex-1 overflow-y-auto p-4 space-y-4" role="log" aria-live="polite" aria-label="Chat messages">
        {messages.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <p className="text-gray-500 text-center">Ask your first question</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-sm">
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
              className={`max-w-[85%] lg:max-w-md px-4 py-2 rounded-lg ${
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
        <div className="flex items-end gap-2">
          <AutoGrowTextarea
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
            className="flex-1 min-h-11 max-h-40 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            aria-label="Send message"
            className="h-11 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
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
