import { useState, useEffect, useRef } from 'react'
import { useAppStore } from '../store'
import { SQLiteStorage } from '../db/sqlite'
import { Navigation } from '../components/Navigation'

interface DialogueLine {
  speaker: string
  text: string
  translation?: string
}

interface Scenario {
  id: number
  title: string
  description: string | null
  lines: DialogueLine[]
}

function speak(text: string) {
  if (!('speechSynthesis' in window)) return
  window.speechSynthesis.cancel()
  const utt = new SpeechSynthesisUtterance(text)
  utt.lang = 'ja-JP'
  utt.rate = 0.85
  window.speechSynthesis.speak(utt)
}

function DialogueView({ scenario }: { scenario: Scenario }) {
  const [step, setStep] = useState(0)
  const [revealed, setRevealed] = useState<Set<number>>(new Set())
  const bottomRef = useRef<HTMLDivElement>(null)

  const visibleLines = scenario.lines.slice(0, step + 1)

  useEffect(() => {
    if (scenario.lines[step]) speak(scenario.lines[step].text)
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [step, scenario])

  function advance() {
    if (step < scenario.lines.length - 1) setStep(s => s + 1)
  }

  function revealTranslation(i: number) {
    setRevealed(prev => new Set([...prev, i]))
  }

  const isLastStep = step === scenario.lines.length - 1

  return (
    <div className="flex flex-col gap-4">
      <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
        {visibleLines.map((line, i) => (
          <div key={i} className={`flex gap-3 ${line.speaker === 'B' ? 'flex-row-reverse' : ''}`}>
            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-sm font-bold text-indigo-600 shrink-0">
              {line.speaker}
            </div>
            <div className={`flex-1 space-y-1 ${line.speaker === 'B' ? 'text-right' : ''}`}>
              <p
                className="text-gray-900 cursor-pointer hover:text-indigo-700 transition-colors"
                lang="ja"
                onClick={() => speak(line.text)}
              >
                {line.text}
              </p>
              {line.translation && (
                revealed.has(i) ? (
                  <p className="text-xs text-gray-400">{line.translation}</p>
                ) : (
                  <button
                    onClick={() => revealTranslation(i)}
                    className="text-xs text-indigo-400 hover:text-indigo-600"
                  >
                    show translation
                  </button>
                )
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <button
        onClick={advance}
        disabled={isLastStep}
        className="w-full px-4 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        {isLastStep ? 'End of scenario' : 'Next line →'}
      </button>
    </div>
  )
}

export function ScenarioMode() {
  const activeUserId = useAppStore(s => s.activeUserId)
  const [storage] = useState(() => new SQLiteStorage())
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [selected, setSelected] = useState<Scenario | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function load() {
      await storage.execute(`
        CREATE TABLE IF NOT EXISTS scenarios (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER,
          title TEXT NOT NULL,
          description TEXT,
          lines TEXT NOT NULL DEFAULT '[]',
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `)

      const rows = await storage.query<{ id: number; title: string; description: string | null; lines: string }>(
        `SELECT id, title, description, lines FROM scenarios
         WHERE user_id = ? OR user_id IS NULL
         ORDER BY id ASC`,
        [activeUserId ?? 0]
      )

      setScenarios(rows.map(r => ({
        ...r,
        lines: (() => { try { return JSON.parse(r.lines) } catch { return [] } })()
      })))
      setIsLoading(false)
    }
    void load()
  }, [activeUserId, storage])

  return (
    <div className="flex flex-col min-h-screen">
      <Navigation />
      <main className="flex flex-col gap-6 p-6 max-w-2xl mx-auto flex-1 w-full">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Scenarios</h1>
          {selected && (
            <button
              onClick={() => setSelected(null)}
              className="text-sm text-indigo-600 hover:text-indigo-800"
            >
              ← All scenarios
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center text-gray-400">Loading…</div>
        ) : selected ? (
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{selected.title}</h2>
              {selected.description && (
                <p className="text-sm text-gray-500 mt-1">{selected.description}</p>
              )}
            </div>
            <div className="bg-white border border-gray-200 rounded-2xl p-6">
              <DialogueView key={selected.id} scenario={selected} />
            </div>
          </div>
        ) : scenarios.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
            <p className="text-4xl">🎭</p>
            <p className="text-lg font-semibold text-gray-700">No scenarios yet</p>
            <p className="text-sm text-gray-500 max-w-xs">
              Import scenario content from the Practice tab — dialogue scripts with A↔B exchanges.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 bg-white border border-gray-200 rounded-2xl overflow-hidden">
            {scenarios.map(s => (
              <button
                key={s.id}
                onClick={() => setSelected(s)}
                className="w-full text-left px-5 py-4 hover:bg-gray-50 transition-colors"
              >
                <div className="font-medium text-gray-900">{s.title}</div>
                {s.description && (
                  <div className="text-sm text-gray-500 mt-0.5">{s.description}</div>
                )}
                <div className="text-xs text-indigo-400 mt-1">{s.lines.length} lines</div>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
