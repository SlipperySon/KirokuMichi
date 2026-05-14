/**
 * Conversation Partner
 *
 * Roleplay-driven Japanese practice. The user picks a scenario; the AI stays
 * in character and replies in Japanese. After each user message, the AI also
 * returns structured corrections, which are rendered as collapsible chips
 * below the user's bubble.
 *
 * Mistakes are persisted to mistake_logs so they show up in MistakeReview.
 * Chat history is persisted per-scenario in localStorage.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { Send } from 'lucide-react'
import { useAppStore } from '../store'
import { ClientAIProvider } from '../ai/aiProvider'
import {
  buildConversationSystemPrompt,
  CONVERSATION_SCENARIOS,
  type ConversationScenario,
} from '../ai/systemPrompts'
import { SQLiteStorage } from '../db/sqlite'
import { FSRSScheduler, SM2Scheduler } from '../core/scheduler'
import { SRSService } from '../srs/srsService'
import { Ruby } from '../components/Ruby'
import type { AIMessage } from '../core/providers'

interface Correction {
  original: string
  corrected: string
  explanation: string
}

interface AssistantTurn {
  role: 'assistant'
  content: string // displayed reply (Japanese with inline furigana)
  romaji?: string
  raw?: string // raw JSON for debug
}

interface UserTurn {
  role: 'user'
  content: string
  corrections?: Correction[]
}

type Turn = AssistantTurn | UserTurn

const MAX_PERSISTED_TURNS = 50

function storageKey(scenarioId: string) {
  return `kiroku-conversation-${scenarioId}`
}

function loadPersistedTurns(scenarioId: string): Turn[] {
  try {
    const raw = localStorage.getItem(storageKey(scenarioId))
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (t): t is Turn =>
        t != null &&
        typeof t === 'object' &&
        ((t as Turn).role === 'user' || (t as Turn).role === 'assistant') &&
        typeof (t as Turn).content === 'string'
    )
  } catch {
    return []
  }
}

function persistTurns(scenarioId: string, turns: Turn[]) {
  try {
    localStorage.setItem(storageKey(scenarioId), JSON.stringify(turns.slice(-MAX_PERSISTED_TURNS)))
  } catch {
    // ignore
  }
}

/**
 * The model may return JSON with markdown fences or extra prose despite our
 * instructions — extract the first balanced {...} block as a best-effort.
 */
function parseStructuredReply(raw: string): {
  reply: string
  romaji?: string
  corrections: Correction[]
} | null {
  const stripped = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim()
  const start = stripped.indexOf('{')
  const end = stripped.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) return null
  try {
    const obj = JSON.parse(stripped.slice(start, end + 1)) as Partial<{
      reply: string
      romaji: string
      corrections: Correction[]
    }>
    if (typeof obj.reply !== 'string') return null
    return {
      reply: obj.reply,
      romaji: typeof obj.romaji === 'string' ? obj.romaji : undefined,
      corrections: Array.isArray(obj.corrections)
        ? obj.corrections.filter(
            (c): c is Correction =>
              !!c &&
              typeof c === 'object' &&
              typeof c.original === 'string' &&
              typeof c.corrected === 'string' &&
              typeof c.explanation === 'string'
          )
        : [],
    }
  } catch {
    return null
  }
}

interface ConversationPartnerProps {
  /** CEFR level string passed to the system prompt (e.g. 'a2'). */
  cefrLevel?: string
}

export function ConversationPartner({ cefrLevel = 'a2' }: ConversationPartnerProps) {
  const settings = useAppStore(s => s.settings)
  const activeUserId = useAppStore(s => s.activeUserId)

  const [scenario, setScenario] = useState<ConversationScenario>(CONVERSATION_SCENARIOS[0])
  const [turns, setTurns] = useState<Turn[]>(() => loadPersistedTurns(scenario.id))
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showFurigana, setShowFurigana] = useState(settings.furiganaEnabled)
  const [showRomaji, setShowRomaji] = useState(settings.romajiEnabled)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [storage] = useState(() => new SQLiteStorage())
  const scheduler = useMemo(
    () => (settings.schedulerAlgorithm === 'fsrs' ? new FSRSScheduler() : new SM2Scheduler()),
    [settings.schedulerAlgorithm]
  )
  const [service] = useState(() => new SRSService(storage, scheduler))
  const [sessionId, setSessionId] = useState<number | null>(null)

  // Reload chat when scenario changes
  useEffect(() => {
    setTurns(loadPersistedTurns(scenario.id))
    setError(null)
    setSessionId(null)
  }, [scenario.id])

  // Persist on change + autoscroll
  useEffect(() => {
    persistTurns(scenario.id, turns)
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [turns, scenario.id])

  const systemPrompt = useMemo(
    () => buildConversationSystemPrompt(scenario, cefrLevel),
    [scenario, cefrLevel]
  )

  const handleSend = async () => {
    const text = input.trim()
    if (!text || loading) return

    const userTurn: UserTurn = { role: 'user', content: text }
    setTurns(prev => [...prev, userTurn])
    setInput('')
    setLoading(true)
    setError(null)

    // Lazy-start a session so mistakes get a sessionId
    let sid = sessionId
    if (sid == null && activeUserId != null) {
      try {
        sid = await service.startSession(activeUserId, 'srs')
        setSessionId(sid)
      } catch {
        // continue without sessionId — mistakes will use null
      }
    }

    try {
      const ai = new ClientAIProvider(settings.sessionToken)
      // Build AI message history from prior turns (use raw user input, raw
      // assistant reply text without our annotations)
      const history: AIMessage[] = []
      for (const t of turns) {
        history.push({
          role: t.role,
          content: t.role === 'assistant' ? (t as AssistantTurn).raw ?? t.content : t.content,
        })
      }
      history.push({ role: 'user', content: text })

      const raw = await ai.completeWithMessages(history, systemPrompt, 'fast')
      const parsed = parseStructuredReply(raw)
      if (!parsed) {
        // Treat as plain assistant text; let the user see something useful
        setTurns(prev => [
          ...prev,
          { role: 'assistant', content: raw, raw } as AssistantTurn,
        ])
        return
      }

      // Persist corrections back onto the user turn (so they render below it)
      setTurns(prev => {
        const next = [...prev]
        const lastUserIdx = next.findIndex((t, i) => t.role === 'user' && i === next.length - 1)
        if (lastUserIdx !== -1) {
          next[lastUserIdx] = { ...(next[lastUserIdx] as UserTurn), corrections: parsed.corrections }
        }
        next.push({
          role: 'assistant',
          content: parsed.reply,
          romaji: parsed.romaji,
          raw,
        })
        return next
      })

      // Log mistakes to mistake_logs (cardId=null for free-form)
      if (activeUserId != null && parsed.corrections.length > 0) {
        for (const c of parsed.corrections) {
          try {
            await service.logMistake(activeUserId, null, c.original, c.corrected, sid ?? null)
          } catch {
            // Ignore individual log failures
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Conversation failed')
      // Roll back the user turn so they can retry without duplicating it
      setTurns(prev => prev.slice(0, -1))
      setInput(text)
    } finally {
      setLoading(false)
    }
  }

  const clearChat = () => {
    setTurns([])
    setError(null)
    try {
      localStorage.removeItem(storageKey(scenario.id))
    } catch {
      // ignore
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header: scenario picker */}
      <div className="border-b border-gray-200 p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            {CONVERSATION_SCENARIOS.map(s => (
              <button
                key={s.id}
                onClick={() => setScenario(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  scenario.id === s.id
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
                title={s.description}
              >
                {s.titleJa}
              </button>
            ))}
          </div>
          {turns.length > 0 && (
            <button
              onClick={clearChat}
              className="text-xs text-gray-500 hover:text-red-600 transition-colors shrink-0"
            >
              Clear
            </button>
          )}
        </div>
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>
            <strong className="text-gray-700">{scenario.title}</strong> · {scenario.description}
          </span>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="checkbox"
                checked={showFurigana}
                onChange={e => setShowFurigana(e.target.checked)}
              />
              Furigana
            </label>
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="checkbox"
                checked={showRomaji}
                onChange={e => setShowRomaji(e.target.checked)}
              />
              Romaji
            </label>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3" role="log" aria-live="polite">
        {turns.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6">
            <p className="text-gray-700 font-semibold">
              {scenario.titleJa} — {scenario.title}
            </p>
            <p className="text-sm text-gray-500 max-w-md">{scenario.description}</p>
            <p className="text-xs text-gray-400">Send your first Japanese line to start.</p>
          </div>
        )}

        {turns.map((turn, i) => {
          if (turn.role === 'user') {
            const u = turn as UserTurn
            return (
              <div key={i} className="flex flex-col items-end">
                <div className="max-w-md px-4 py-2 rounded-2xl bg-indigo-600 text-white text-sm">
                  {u.content}
                </div>
                {u.corrections && u.corrections.length > 0 && (
                  <details className="mt-1 max-w-md w-full">
                    <summary className="text-xs text-amber-600 cursor-pointer hover:text-amber-700 list-none flex items-center gap-1">
                      <span>✏️ {u.corrections.length} correction{u.corrections.length === 1 ? '' : 's'}</span>
                    </summary>
                    <div className="mt-2 flex flex-col gap-2">
                      {u.corrections.map((c, j) => (
                        <div
                          key={j}
                          className="bg-amber-50 border border-amber-200 rounded-lg p-2 text-xs"
                        >
                          <div className="flex flex-wrap items-baseline gap-1">
                            <span className="line-through text-red-600" lang="ja">
                              {c.original}
                            </span>
                            <span className="text-amber-700">→</span>
                            <span className="text-green-700 font-semibold" lang="ja">
                              {c.corrected}
                            </span>
                          </div>
                          <p className="text-gray-700 mt-1">{c.explanation}</p>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            )
          }
          const a = turn as AssistantTurn
          return (
            <div key={i} className="flex flex-col items-start">
              <div className="max-w-md px-4 py-2 rounded-2xl bg-gray-100 text-gray-900 text-sm">
                <Ruby text={a.content} showFurigana={showFurigana} />
              </div>
              {showRomaji && a.romaji && (
                <p className="text-xs text-gray-500 ml-2 mt-0.5 italic">{a.romaji}</p>
              )}
            </div>
          )
        })}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 text-gray-900 px-4 py-2 rounded-2xl text-sm">
              <p className="text-gray-600">考え中…</p>
            </div>
          </div>
        )}

        {error && (
          <div className="flex justify-center">
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm max-w-md">
              {error}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-200 bg-white">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void handleSend()
              }
            }}
            placeholder="日本語で書いてみてください…"
            lang="ja"
            disabled={loading}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
          />
          <button
            onClick={() => void handleSend()}
            disabled={!input.trim() || loading}
            aria-label="Send"
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            <Send className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  )
}
