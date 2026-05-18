import { useState, useEffect, useMemo, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ListChecks } from 'lucide-react'
import { useAppStore } from '../store'
import { SQLiteStorage } from '../db/sqlite'
import { Navigation } from '../components/Navigation'
import { Ruby } from '../components/Ruby'
import { annotateBeginnerFurigana, isBeginnerLevel } from '../content/beginnerFurigana'
import {
  getSupplementalScenarios,
  SUPPLEMENTAL_SCENARIO_SOURCES,
  type SupplementalScenario,
} from '../content/supplementalScenarioService'

interface DialogueLine {
  speaker: string
  text: string
  translation?: string
}

interface Scenario {
  id: number | string
  title: string
  description: string | null
  lines: DialogueLine[]
  lesson_id?: string | null  // e.g., "marugoto_a1_1"
  textbook?: string
  textbookKey?: string
  level?: string
  canDo?: string
  sourceKind?: string
}

type ScenarioLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'Imported'

const LEVEL_ORDER: ScenarioLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'Imported']
const IMPORTED_SOURCE_KEY = '__imported__'

function normalizeLevel(level: string | null | undefined): ScenarioLevel | null {
  const normalized = level?.toUpperCase()
  return LEVEL_ORDER.includes(normalized as ScenarioLevel) ? normalized as ScenarioLevel : null
}

function scenarioLevel(scenario: Scenario): ScenarioLevel {
  return normalizeLevel(scenario.level) ?? 'Imported'
}

function sourceKey(scenario: Scenario) {
  return scenario.textbookKey ?? scenario.textbook ?? IMPORTED_SOURCE_KEY
}

function sourceLabel(scenario: Scenario) {
  return scenario.textbook ?? 'Imported Scenarios'
}

function formatSourceKind(sourceKind: string) {
  return sourceKind.replace(/_/g, ' ')
}

function catalogSourceFor(key: string) {
  return SUPPLEMENTAL_SCENARIO_SOURCES.find(source => source.textbookKey === key)
}

function speak(text: string) {
  if (!('speechSynthesis' in window)) return
  window.speechSynthesis.cancel()
  const utt = new SpeechSynthesisUtterance(text)
  utt.lang = 'ja-JP'
  utt.rate = 0.85
  window.speechSynthesis.speak(utt)
}

function DialogueView({ scenario, showFurigana }: { scenario: Scenario; showFurigana: boolean }) {
  const [step, setStep] = useState(0)
  const [revealed, setRevealed] = useState<Set<number>>(new Set())
  const bottomRef = useRef<HTMLDivElement>(null)

  const visibleLines = scenario.lines.slice(0, step + 1)
  const shouldAnnotate = showFurigana && isBeginnerLevel(scenario.level)

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
                <Ruby
                  text={shouldAnnotate ? annotateBeginnerFurigana(line.text) : line.text}
                  showFurigana={shouldAnnotate}
                />
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
  const settings = useAppStore(s => s.settings)
  const [searchParams, setSearchParams] = useSearchParams()
  const [storage] = useState(() => new SQLiteStorage())
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [selected, setSelected] = useState<Scenario | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [activeLevel, setActiveLevel] = useState<ScenarioLevel>(() => normalizeLevel(searchParams.get('level')) ?? 'A1')
  const [activeSourceKey, setActiveSourceKey] = useState(() => searchParams.get('source') ?? '')
  const [showFurigana, setShowFurigana] = useState(settings.furiganaEnabled)

  useEffect(() => {
    async function load() {
      await storage.execute(`
        CREATE TABLE IF NOT EXISTS scenarios (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER,
          title TEXT NOT NULL,
          description TEXT,
          lines TEXT NOT NULL DEFAULT '[]',
          lesson_id TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `)

      // Idempotent migration: add lesson_id column if it doesn't exist
      try {
        await storage.execute(`ALTER TABLE scenarios ADD COLUMN lesson_id TEXT`)
      } catch {
        // Column already exists
      }

      const rows = await storage.query<{ id: number; title: string; description: string | null; lines: string; lesson_id?: string | null }>(
        `SELECT id, title, description, lines, lesson_id FROM scenarios
         WHERE user_id = ? OR user_id IS NULL
         ORDER BY lesson_id ASC, id ASC`,
        [activeUserId ?? 0]
      )

      const databaseScenarios = rows.map(r => ({
        ...r,
        lines: (() => { try { return JSON.parse(r.lines) } catch { return [] } })()
      }))
      setScenarios(prev => {
        const supplementalScenarios = prev.filter(scenario => typeof scenario.id === 'string')
        return [...supplementalScenarios, ...databaseScenarios]
      })
    }
    void load()
  }, [activeUserId, storage])

  useEffect(() => {
    async function loadSupplemental() {
      const coreLessonId = searchParams.get('lesson') ?? undefined
      const supplemental = await getSupplementalScenarios({ coreLessonId })
      setScenarios(prev => {
        const userScenarios = prev.filter(scenario => typeof scenario.id === 'number')
        return [...supplemental.map(toScenario), ...userScenarios]
      })
      setIsLoading(false)
    }
    void loadSupplemental()
  }, [searchParams])

  const levelTabs = useMemo(() => {
    const counts = new Map<ScenarioLevel, number>()
    for (const scenario of scenarios) {
      const level = scenarioLevel(scenario)
      counts.set(level, (counts.get(level) ?? 0) + 1)
    }
    for (const source of SUPPLEMENTAL_SCENARIO_SOURCES) {
      counts.set(source.level, counts.get(source.level) ?? 0)
    }
    return LEVEL_ORDER
      .filter(level => (counts.get(level) ?? 0) > 0 || SUPPLEMENTAL_SCENARIO_SOURCES.some(source => source.level === level))
      .map(level => ({ level, count: counts.get(level) ?? 0 }))
  }, [scenarios])

  const sourceTabs = useMemo(() => {
    const sourceMap = new Map<string, { key: string; label: string; count: number }>()
    for (const source of SUPPLEMENTAL_SCENARIO_SOURCES) {
      if (source.level !== activeLevel) continue
      sourceMap.set(source.textbookKey, { key: source.textbookKey, label: source.textbook, count: 0 })
    }
    for (const scenario of scenarios) {
      if (scenarioLevel(scenario) !== activeLevel) continue
      const key = sourceKey(scenario)
      const existing = sourceMap.get(key)
      if (existing) {
        existing.count += 1
      } else {
        sourceMap.set(key, { key, label: catalogSourceFor(key)?.textbook ?? sourceLabel(scenario), count: 1 })
      }
    }
    return [...sourceMap.values()].sort((a, b) => {
      if (a.key === IMPORTED_SOURCE_KEY) return 1
      if (b.key === IMPORTED_SOURCE_KEY) return -1
      const aIndex = SUPPLEMENTAL_SCENARIO_SOURCES.findIndex(source => source.textbookKey === a.key)
      const bIndex = SUPPLEMENTAL_SCENARIO_SOURCES.findIndex(source => source.textbookKey === b.key)
      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex
      if (aIndex !== -1) return -1
      if (bIndex !== -1) return 1
      return a.label.localeCompare(b.label)
    })
  }, [activeLevel, scenarios])

  useEffect(() => {
    if (levelTabs.length === 0) return
    const requestedLevel = normalizeLevel(searchParams.get('level'))
    const nextLevel = requestedLevel && levelTabs.some(tab => tab.level === requestedLevel)
      ? requestedLevel
      : levelTabs.some(tab => tab.level === activeLevel)
        ? activeLevel
        : levelTabs[0].level

    if (nextLevel !== activeLevel) {
      setActiveLevel(nextLevel)
      setActiveSourceKey('')
    }
  }, [activeLevel, levelTabs, searchParams])

  useEffect(() => {
    if (sourceTabs.length === 0) return
    const requestedSource = searchParams.get('source') ?? ''
    const nextSource = requestedSource && sourceTabs.some(tab => tab.key === requestedSource)
      ? requestedSource
      : sourceTabs.some(tab => tab.key === activeSourceKey)
        ? activeSourceKey
        : sourceTabs[0].key

    if (nextSource !== activeSourceKey) {
      setActiveSourceKey(nextSource)
    }
  }, [activeSourceKey, searchParams, sourceTabs])

  const visibleScenarios = useMemo(() => {
    return scenarios.filter(scenario =>
      scenarioLevel(scenario) === activeLevel &&
      sourceKey(scenario) === activeSourceKey
    )
  }, [activeLevel, activeSourceKey, scenarios])

  function firstSourceKeyForLevel(level: ScenarioLevel) {
    const scenario = scenarios.find(item => scenarioLevel(item) === level)
    return scenario ? sourceKey(scenario) : ''
  }

  function updateScenarioTabs(nextLevel: ScenarioLevel, nextSourceKey = '') {
    setSelected(null)
    setActiveLevel(nextLevel)
    setActiveSourceKey(nextSourceKey)

    const params = new URLSearchParams(searchParams)
    if (nextLevel === 'Imported') {
      params.delete('level')
    } else {
      params.set('level', nextLevel)
    }
    if (nextSourceKey && nextSourceKey !== IMPORTED_SOURCE_KEY) {
      params.set('source', nextSourceKey)
    } else {
      params.delete('source')
    }
    setSearchParams(params, { replace: true })
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Navigation />
      <main className="flex flex-col gap-6 p-6 max-w-2xl mx-auto flex-1 w-full">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Scenarios</h1>
          {selected && (
            <button
              onClick={() => setSelected(null)}
              className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-800 transition-colors hover:bg-indigo-100"
            >
              <ListChecks className="h-4 w-4" aria-hidden="true" />
              Return to Scenario List
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center text-gray-400">Loading…</div>
        ) : selected ? (
          <div className="flex flex-col gap-4">
            <div>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h2 className="text-lg font-semibold text-gray-900">{selected.title}</h2>
                {isBeginnerLevel(selected.level) && (
                  <label className="flex items-center gap-2 rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-900">
                    <input
                      type="checkbox"
                      checked={showFurigana}
                      onChange={event => setShowFurigana(event.target.checked)}
                    />
                    Furigana
                  </label>
                )}
              </div>
              {selected.description && (
                <p className="text-sm text-gray-500 mt-1">{selected.description}</p>
              )}
              {selected.canDo && (
                <p className="mt-2 rounded-lg bg-indigo-50 px-3 py-2 text-sm text-indigo-900">
                  {selected.canDo}
                </p>
              )}
            </div>
            <div className="bg-white border border-gray-200 rounded-2xl p-6">
              <DialogueView key={selected.id} scenario={selected} showFurigana={showFurigana} />
            </div>
          </div>
        ) : scenarios.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
            <p className="text-4xl">🎭</p>
            <p className="text-lg font-semibold text-gray-700">No scenarios yet</p>
            <p className="text-sm text-gray-500 max-w-xs">
              No cleaned supplemental scenarios matched this filter yet. Try all scenarios or import a dialogue script from the Practice tab.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2 border-b border-gray-200">
              {levelTabs.map(tab => (
                <button
                  key={tab.level}
                  onClick={() => updateScenarioTabs(tab.level, firstSourceKeyForLevel(tab.level))}
                  className={`-mb-px px-3 py-2 text-sm font-semibold transition-colors ${
                    activeLevel === tab.level
                      ? 'border-b-2 border-indigo-600 text-indigo-700'
                      : 'border-b-2 border-transparent text-gray-500 hover:text-gray-900'
                  }`}
                >
                  {tab.level}
                  <span className="ml-1 text-xs font-medium text-gray-400">{tab.count}</span>
                </button>
              ))}
            </div>

            {sourceTabs.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {sourceTabs.map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => updateScenarioTabs(activeLevel, tab.key)}
                    className={`shrink-0 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                      activeSourceKey === tab.key
                        ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-900'
                    }`}
                  >
                    {tab.label}
                    <span className="ml-1 text-xs text-gray-400">{tab.count}</span>
                  </button>
                ))}
              </div>
            )}

            {visibleScenarios.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-200 bg-white px-5 py-8 text-center text-sm text-gray-500">
                No scenarios in this textbook tab yet.
              </div>
            ) : (
              <div className="divide-y divide-gray-100 bg-white border border-gray-200 rounded-2xl overflow-hidden">
                {visibleScenarios.map(s => (
                  <button
                    key={s.id}
                    onClick={() => setSelected(s)}
                    className="w-full text-left px-5 py-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="font-medium text-gray-900">{s.title}</div>
                    {s.description && (
                      <div className="text-sm text-gray-500 mt-0.5">{s.description}</div>
                    )}
                    <div className="mt-1 flex flex-wrap gap-2 text-xs text-indigo-500">
                      {s.textbook && <span>{s.textbook}</span>}
                      {s.level && <span>{s.level}</span>}
                      <span>{s.lines.length} lines</span>
                      {s.sourceKind && <span>{formatSourceKind(s.sourceKind)}</span>}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

function toScenario(scenario: SupplementalScenario): Scenario {
  return {
    id: scenario.id,
    title: scenario.title,
    description: scenario.description,
    lines: scenario.lines,
    lesson_id: scenario.coreLessonId ?? scenario.lessonId,
    textbook: scenario.textbook,
    textbookKey: scenario.textbookKey,
    level: scenario.level,
    canDo: scenario.canDo,
    sourceKind: scenario.sourceKind,
  }
}
