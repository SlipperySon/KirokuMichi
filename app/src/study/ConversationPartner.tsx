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
import { Send, ChevronDown } from 'lucide-react'
import { useAppStore } from '../store'
import { ClientAIProvider } from '../ai/aiProvider'
import {
  buildCustomConversationSystemPrompt,
  buildConversationSystemPrompt,
  CONVERSATION_SCENARIOS,
  type ConversationScenario,
} from '../ai/systemPrompts'
import { SQLiteStorage } from '../db/sqlite'
import { FSRSScheduler, SM2Scheduler } from '../core/scheduler'
import { SRSService } from '../srs/srsService'
import { Ruby } from '../components/Ruby'
import { AutoGrowTextarea } from '../components/AutoGrowTextarea'
import { toast } from '../components/toastStore'
import { getTextbookScenarios, type TextbookScenario } from './textbookDialogues'
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

function storageKey(scenarioId: string, isTextbook: boolean = false) {
  const prefix = isTextbook ? 'kiroku-conversation-textbook' : 'kiroku-conversation'
  return `${prefix}-${scenarioId}`
}

function loadPersistedTurns(scenarioId: string, isTextbook: boolean = false): Turn[] {
  try {
    const raw = localStorage.getItem(storageKey(scenarioId, isTextbook))
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

function persistTurns(scenarioId: string, turns: Turn[], isTextbook: boolean = false) {
  try {
    localStorage.setItem(storageKey(scenarioId, isTextbook), JSON.stringify(turns.slice(-MAX_PERSISTED_TURNS)))
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
  const [textbookScenarios, setTextbookScenarios] = useState<TextbookScenario[]>([])
  const [selectedTextbookScenario, setSelectedTextbookScenario] = useState<TextbookScenario | null>(null)
  const [isCustomScenario, setIsCustomScenario] = useState(false)
  const [customScenarioDescription, setCustomScenarioDescription] = useState('')
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
  const [savedCorrections, setSavedCorrections] = useState<Set<string>>(new Set())

  async function saveCorrection(c: Correction) {
    if (!activeUserId) return
    const key = `${c.original}→${c.corrected}`
    if (savedCorrections.has(key)) return
    await service.createCardFromCorrection(
      activeUserId,
      c.original,
      `${c.corrected}\n${c.explanation}`,
      c.corrected
    )
    setSavedCorrections(prev => new Set(prev).add(key))
    toast.success('Saved correction to drill')
  }

  // Load textbook scenarios on mount
  useEffect(() => {
    void getTextbookScenarios().then(scenarios => {
      setTextbookScenarios(scenarios)
    })
  }, [])

  // Reload chat when scenario changes
  useEffect(() => {
    const key = isCustomScenario
      ? 'custom'
      : selectedTextbookScenario
      ? selectedTextbookScenario.id
      : scenario.id
    const isTextbook = !!selectedTextbookScenario && !isCustomScenario
    setTurns(loadPersistedTurns(key, isTextbook))
    setError(null)
    setSessionId(null)
  }, [scenario.id, selectedTextbookScenario, isCustomScenario])

  // Persist on change + autoscroll
  useEffect(() => {
    const key = isCustomScenario
      ? 'custom'
      : selectedTextbookScenario
      ? selectedTextbookScenario.id
      : scenario.id
    const isTextbook = !!selectedTextbookScenario && !isCustomScenario
    persistTurns(key, turns, isTextbook)
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [turns, scenario.id, selectedTextbookScenario, isCustomScenario])

  const systemPrompt = useMemo(() => {
    if (isCustomScenario) {
      return buildCustomConversationSystemPrompt(customScenarioDescription, cefrLevel)
    }

    if (selectedTextbookScenario) {
      // Build a dynamic system prompt for textbook scenarios
      return `You are practicing Japanese conversation from a textbook dialogue (${selectedTextbookScenario.textbook}, level ${selectedTextbookScenario.level}).

Scenario goal: ${selectedTextbookScenario.canDo}
Source sample: ${selectedTextbookScenario.sampleDialogue}
Practice prompts:
${selectedTextbookScenario.practicePrompts.map(prompt => `- ${prompt}`).join('\n')}

The learner will practice natural conversation at their level. Use the scenario goal and prompts as the situation. Do not quote the source mechanically; turn it into a natural roleplay. Respond naturally in Japanese, and after each exchange, provide corrections in structured JSON format if their Japanese has errors.

**Important:**
- Respond naturally and stay in conversational context
- Correct only real errors (grammar, vocabulary, particles)
- Keep the roleplay anchored to the textbook scenario
- Ask follow-up questions when the learner gives a short answer
- Be encouraging and supportive
- Use simple Japanese for lower levels (A1-A2), more complex for higher levels (B1+)
- Include furigana (kanji(kana)) for characters the learner might not know yet

**Response format:**
\`\`\`json
{
  "reply": "your Japanese response here",
  "romaji": "optional romaji if helpful",
  "corrections": [
    {"original": "user's mistake", "corrected": "correct version", "explanation": "brief explanation"}
  ]
}
\`\`\``
    } else {
      return buildConversationSystemPrompt(scenario, cefrLevel)
    }
  }, [isCustomScenario, customScenarioDescription, selectedTextbookScenario, scenario, cefrLevel])

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
      const message = err instanceof Error ? err.message : 'Conversation failed'
      setError(message)
      toast.error(`Conversation failed: ${message}`)
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
      const key = isCustomScenario
        ? 'custom'
        : selectedTextbookScenario
        ? selectedTextbookScenario.id
        : scenario.id
      const isTextbook = !!selectedTextbookScenario && !isCustomScenario
      localStorage.removeItem(storageKey(key, isTextbook))
    } catch {
      // ignore
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header: scenario picker */}
      <div className="border-b border-gray-200 p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            {CONVERSATION_SCENARIOS.map(s => (
              <button
                key={s.id}
                onClick={() => {
                  setScenario(s)
                  setSelectedTextbookScenario(null)
                  setIsCustomScenario(false)
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  scenario.id === s.id && !selectedTextbookScenario && !isCustomScenario
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
                title={s.description}
              >
                {s.title}
              </button>
            ))}
            <button
              onClick={() => {
                setSelectedTextbookScenario(null)
                setIsCustomScenario(true)
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                isCustomScenario
                  ? 'bg-teal-100 text-teal-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
              title="Start an open conversation or describe your own situation"
            >
              Custom
            </button>
          </div>

          {/* Textbook scenario dropdown */}
          {textbookScenarios.length > 0 && (
            <div className="relative group">
              <button className="px-3 py-1.5 rounded-lg text-xs font-medium bg-purple-100 text-purple-700 hover:bg-purple-200 transition-colors flex items-center gap-1">
                📚 Textbook
                <ChevronDown className="w-3 h-3" />
              </button>
              <div className="hidden group-hover:block absolute right-0 mt-0 w-[min(20rem,calc(100vw-2rem))] bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-[28rem] overflow-y-auto">
                {/* Group by level then textbook */}
                {(() => {
                  const levels = ['A1', 'A2', 'B1', 'B2'] as const
                  const grouped = new Map<string, Map<string, typeof textbookScenarios>>()
                  for (const level of levels) grouped.set(level, new Map())
                  for (const ts of textbookScenarios) {
                    const levelMap = grouped.get(ts.level) ?? new Map()
                    const existing = levelMap.get(ts.textbook) ?? []
                    existing.push(ts)
                    levelMap.set(ts.textbook, existing)
                    grouped.set(ts.level, levelMap)
                  }
                  return levels.map(level => {
                    const levelMap = grouped.get(level)
                    if (!levelMap || levelMap.size === 0) return null
                    return (
                      <div key={level}>
                        <div className="sticky top-0 bg-gray-100 px-4 py-1.5 text-xs font-bold text-gray-700 border-b border-gray-200">
                          {level}
                        </div>
                        {[...levelMap.entries()].map(([textbook, scenarios]) => (
                          <div key={textbook}>
                            <div className="px-4 py-1 text-[10px] font-semibold uppercase tracking-wider text-purple-600 bg-purple-50/50">
                              {textbook}
                            </div>
                            {scenarios.map(ts => (
                              <button
                                key={ts.id}
                                onClick={() => {
                                  setSelectedTextbookScenario(ts)
                                  setIsCustomScenario(false)
                                }}
                                className="w-full text-left px-4 py-1.5 hover:bg-purple-50 border-b border-gray-50 last:border-b-0 transition-colors"
                              >
                                <div className="text-xs text-gray-700 truncate">{ts.title}</div>
                                <div className="text-[10px] text-gray-400 truncate">{ts.description}</div>
                              </button>
                            ))}
                          </div>
                        ))}
                      </div>
                    )
                  })
                })()}
              </div>
            </div>
          )}

          {turns.length > 0 && (
            <button
              onClick={clearChat}
              className="text-xs text-gray-500 hover:text-red-600 transition-colors shrink-0"
            >
              Clear
            </button>
          )}
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-gray-500">
          <span>
            {isCustomScenario ? (
              <>
                <strong className="text-teal-700">Custom conversation</strong> ·{' '}
                {customScenarioDescription.trim()
                  ? 'Use your description as the scene.'
                  : 'Start talking freely or describe a scene below.'}
              </>
            ) : selectedTextbookScenario ? (
              <>
                <strong className="text-purple-700">{selectedTextbookScenario.textbook}</strong> ·{' '}
                {selectedTextbookScenario.description} · <span className="text-gray-400">page {selectedTextbookScenario.page}</span>
              </>
            ) : (
              <>
                <strong className="text-gray-700">{scenario.title}</strong> · {scenario.description}
              </>
            )}
          </span>
          <div className="flex flex-wrap items-center gap-3">
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
        {isCustomScenario && (
          <div className="rounded-lg border border-teal-200 bg-teal-50 p-3">
            <label className="block text-xs font-semibold text-teal-800 mb-1" htmlFor="custom-conversation-description">
              Conversation setup
            </label>
            <AutoGrowTextarea
              id="custom-conversation-description"
              value={customScenarioDescription}
              onChange={e => setCustomScenarioDescription(e.target.value)}
              placeholder="Optional: describe the scene, roleplay, topic, or register. Example: I am checking into a hotel and the staff speaks politely."
              maxHeight={120}
              className="w-full min-h-10 max-h-32 px-3 py-2 border border-teal-200 rounded-lg bg-white text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3" role="log" aria-live="polite">
        {turns.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6">
            {isCustomScenario ? (
              <>
                <p className="text-teal-700 font-semibold">Custom conversation</p>
                <p className="text-sm text-gray-500 max-w-md">
                  {customScenarioDescription.trim()
                    ? customScenarioDescription.trim()
                    : 'Start with any Japanese sentence, or describe the situation above first.'}
                </p>
              </>
            ) : selectedTextbookScenario ? (
              <>
                <p className="text-purple-700 font-semibold">
                  {selectedTextbookScenario.title}
                </p>
                <p className="text-xs text-purple-600 font-medium">
                  {selectedTextbookScenario.textbook} ({selectedTextbookScenario.level})
                </p>
                <p className="text-sm text-gray-500 max-w-md">{selectedTextbookScenario.description}</p>
              </>
            ) : (
              <>
                <p className="text-gray-700 font-semibold">
                  {scenario.title}
                </p>
                <p className="text-sm text-gray-500 max-w-md">{scenario.description}</p>
              </>
            )}
            <p className="text-xs text-gray-400">Type your first message in Japanese to start the conversation.</p>
          </div>
        )}

        {turns.map((turn, i) => {
          if (turn.role === 'user') {
            const u = turn as UserTurn
            return (
              <div key={i} className="flex flex-col items-end">
                <div className="max-w-[85%] sm:max-w-md px-4 py-2 rounded-2xl bg-indigo-600 text-white text-sm break-words">
                  {u.content}
                </div>
                {u.corrections && u.corrections.length > 0 && (
                  <details className="mt-1 max-w-md w-full">
                    <summary className="text-xs text-amber-600 cursor-pointer hover:text-amber-700 list-none flex items-center gap-1">
                      <span>✏️ {u.corrections.length} correction{u.corrections.length === 1 ? '' : 's'}</span>
                    </summary>
                    <div className="mt-2 flex flex-col gap-2">
                      {u.corrections.map((c, j) => {
                        const corrKey = `${c.original}→${c.corrected}`
                        const isSaved = savedCorrections.has(corrKey)
                        return (
                          <div
                            key={j}
                            className="bg-amber-50 border border-amber-200 rounded-lg p-2 text-xs"
                          >
                            <div className="flex items-baseline justify-between gap-1">
                              <div className="flex flex-wrap items-baseline gap-1">
                                <span className="line-through text-red-600" lang="ja">
                                  {c.original}
                                </span>
                                <span className="text-amber-700">→</span>
                                <span className="text-green-700 font-semibold" lang="ja">
                                  {c.corrected}
                                </span>
                              </div>
                              <button
                                onClick={() => void saveCorrection(c)}
                                disabled={isSaved}
                                className="shrink-0 px-1.5 py-0.5 rounded text-xs font-medium transition-colors disabled:opacity-50"
                                title={isSaved ? 'Saved to SRS' : 'Save to drill'}
                              >
                                {isSaved ? '✓' : '+'}
                              </button>
                            </div>
                            <p className="text-gray-700 mt-1">{c.explanation}</p>
                          </div>
                        )
                      })}
                    </div>
                  </details>
                )}
              </div>
            )
          }
          const a = turn as AssistantTurn
          return (
            <div key={i} className="flex flex-col items-start">
              <div className="max-w-[85%] sm:max-w-md px-4 py-2 rounded-2xl bg-gray-100 text-gray-900 text-sm break-words">
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

      {/* Session stats chip */}
      {(() => {
        const userTurns = turns.filter(t => t.role === 'user') as UserTurn[]
        if (userTurns.length < 5) return null
        const totalChars = userTurns.reduce((sum, t) => sum + t.content.length, 0)
        const totalCorrections = userTurns.reduce((sum, t) => sum + (t.corrections?.length ?? 0), 0)
        const correctionFree = userTurns.reduce((acc, t) => {
          if (!t.corrections || t.corrections.length === 0) return acc + 1
          return 0
        }, 0)
        return (
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 px-4 py-1.5 border-t border-gray-100 bg-gray-50 text-xs text-gray-500">
            <span>{totalChars} chars written</span>
            <span className="text-gray-300">·</span>
            <span>{totalCorrections} correction{totalCorrections === 1 ? '' : 's'}</span>
            {correctionFree >= 2 && (
              <>
                <span className="text-gray-300">·</span>
                <span className="text-green-600 font-medium">{correctionFree} perfect in a row</span>
              </>
            )}
          </div>
        )
      })()}

      {/* Input */}
      <div className="p-4 border-t border-gray-200 bg-white">
        <div className="flex items-end gap-2">
          <AutoGrowTextarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void handleSend()
              }
            }}
            placeholder={isCustomScenario ? 'Start talking in Japanese...' : 'Type in Japanese...'}
            lang="ja"
            disabled={loading}
            className="flex-1 min-h-11 max-h-40 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
          />
          <button
            onClick={() => void handleSend()}
            disabled={!input.trim() || loading}
            aria-label="Send"
            className="h-11 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            <Send className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  )
}
