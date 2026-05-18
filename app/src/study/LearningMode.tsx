import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store'
import { SQLiteStorage } from '../db/sqlite'
import { Navigation } from '../components/Navigation'
import { EmptyState } from '../components/EmptyState'
import { SkeletonList } from '../components/Skeleton'
import { LessonsHub } from './LessonsHub'

type ContentType = 'text_passage' | 'word_list' | 'grammar_point' | 'sentence_pair' | 'dialogue_script' | 'unknown'
type SectionFilter = 'all' | 'vocabulary' | 'grammar' | 'reading' | 'dialogue'

interface LearningItem {
  id: number
  content_type: ContentType
  title: string
  body: string
  translation: string | null
  sequence: number
  source_document: string | null
  jlpt_level: string | null
}

// ─── Item renderers ───────────────────────────────────────────

function TextPassageRenderer({ item }: { item: LearningItem }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="text-xl font-bold text-gray-900">{item.title}</h2>
        {item.jlpt_level && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">{item.jlpt_level}</span>
        )}
      </div>
      <div className="text-lg leading-relaxed text-gray-800 whitespace-pre-wrap" lang="ja">{item.body}</div>
      {item.translation && (
        <div className="border-t border-gray-200 pt-4 text-gray-500 text-sm leading-relaxed">{item.translation}</div>
      )}
    </div>
  )
}

function WordListRenderer({ item }: { item: LearningItem }) {
  let words: { word: string; reading?: string; meaning?: string }[] = []
  try { words = JSON.parse(item.body) } catch { words = [] }
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="text-xl font-bold text-gray-900">{item.title}</h2>
        {item.jlpt_level && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-medium">{item.jlpt_level}</span>
        )}
      </div>
      <div className="divide-y divide-gray-100">
        {words.map((w, i) => (
          <div key={i} className="py-3 flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-4">
            <span className="text-2xl font-bold text-gray-900" lang="ja">{w.word}</span>
            {w.reading && <span className="text-sm text-indigo-600" lang="ja">{w.reading}</span>}
            {w.meaning && <span className="text-sm text-gray-500 sm:ml-auto">{w.meaning}</span>}
          </div>
        ))}
      </div>
    </div>
  )
}

function GrammarPointRenderer({ item }: { item: LearningItem }) {
  let examples: { ja: string; reading?: string; en: string }[] = []
  try { examples = JSON.parse(item.translation ?? '[]') } catch { examples = [] }
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="text-xl font-bold text-gray-900">{item.title}</h2>
        {item.jlpt_level && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium">{item.jlpt_level}</span>
        )}
      </div>
      <div className="bg-indigo-50 rounded-xl p-4">
        <p className="font-mono text-indigo-800 text-lg">{item.body}</p>
      </div>
      {examples.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Examples</p>
          {examples.map((ex, i) => (
            <div key={i} className="space-y-1">
              <p className="text-gray-900" lang="ja">{ex.ja}</p>
              <p className="text-sm text-gray-500">{ex.en}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function SentencePairRenderer({ item }: { item: LearningItem }) {
  const [revealed, setRevealed] = useState(false)
  return (
    <div className="space-y-6 text-center">
      <div className="flex items-center justify-center gap-3 flex-wrap">
        <h2 className="text-xl font-bold text-gray-900">{item.title}</h2>
        {item.jlpt_level && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">{item.jlpt_level}</span>
        )}
      </div>
      <div className="text-3xl font-bold text-gray-900" lang="ja">{item.body}</div>
      {revealed ? (
        <div className="text-lg text-gray-600">{item.translation}</div>
      ) : (
        <button
          onClick={() => setRevealed(true)}
          className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700"
        >
          Show Translation
        </button>
      )}
    </div>
  )
}

function DialogueScriptRenderer({ item }: { item: LearningItem }) {
  let lines: { speaker: string; text: string; translation?: string }[] = []
  try { lines = JSON.parse(item.body) } catch { lines = [] }
  const [revealed, setRevealed] = useState<Set<number>>(new Set())
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="text-xl font-bold text-gray-900">{item.title}</h2>
        {item.jlpt_level && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">{item.jlpt_level}</span>
        )}
      </div>
      <div className="space-y-3">
        {lines.map((line, i) => (
          <div key={i} className={`flex gap-3 ${line.speaker === 'B' ? 'flex-row-reverse' : ''}`}>
            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-sm font-bold text-indigo-600 shrink-0">
              {line.speaker}
            </div>
            <div className={`flex-1 space-y-1 ${line.speaker === 'B' ? 'text-right' : ''}`}>
              <p className="text-gray-900" lang="ja">{line.text}</p>
              {line.translation && (
                revealed.has(i) ? (
                  <p className="text-xs text-gray-400">{line.translation}</p>
                ) : (
                  <button
                    onClick={() => setRevealed(prev => new Set([...prev, i]))}
                    className="text-xs text-indigo-400 hover:text-indigo-600"
                  >
                    show translation
                  </button>
                )
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ContentRenderer({ item }: { item: LearningItem }) {
  switch (item.content_type) {
    case 'text_passage': return <TextPassageRenderer item={item} />
    case 'word_list': return <WordListRenderer item={item} />
    case 'grammar_point': return <GrammarPointRenderer item={item} />
    case 'sentence_pair': return <SentencePairRenderer item={item} />
    case 'dialogue_script': return <DialogueScriptRenderer item={item} />
    default: return <TextPassageRenderer item={item} />
  }
}

// ─── Section metadata ─────────────────────────────────────────

const SECTION_DEFS: { key: SectionFilter; label: string; icon: string; types: ContentType[] }[] = [
  { key: 'all',       label: 'All',        icon: '📚', types: ['text_passage', 'word_list', 'grammar_point', 'sentence_pair', 'dialogue_script'] },
  { key: 'vocabulary', label: 'Vocabulary', icon: '📝', types: ['word_list'] },
  { key: 'grammar',    label: 'Grammar',    icon: '📐', types: ['grammar_point'] },
  { key: 'reading',    label: 'Reading',    icon: '📖', types: ['text_passage', 'sentence_pair'] },
  { key: 'dialogue',   label: 'Dialogues',  icon: '💬', types: ['dialogue_script'] },
]

const CONTENT_TYPE_LABELS: Record<string, string> = {
  text_passage: 'Reading', word_list: 'Vocabulary', grammar_point: 'Grammar',
  sentence_pair: 'Sentences', dialogue_script: 'Dialogue', unknown: 'Other',
}
const CONTENT_TYPE_ICONS: Record<string, string> = {
  text_passage: '📖', word_list: '📝', grammar_point: '📐',
  sentence_pair: '📋', dialogue_script: '💬', unknown: '❓',
}

// ─── Main component ───────────────────────────────────────────

export function LearningMode() {
  const activeUserId = useAppStore(s => s.activeUserId)
  const [storage] = useState(() => new SQLiteStorage())
  const [allItems, setAllItems] = useState<LearningItem[]>([])
  const [index, setIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [sectionFilter, setSectionFilter] = useState<SectionFilter>('all')
  const [sourceFilter, setSourceFilter] = useState<string | null>(null)
  const [learningMode, setLearningMode] = useState<'lesson' | 'browse'>('lesson')

  useEffect(() => {
    async function load() {
      await storage.execute(`
        CREATE TABLE IF NOT EXISTS learning_content (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER,
          content_type TEXT NOT NULL DEFAULT 'text_passage',
          title TEXT NOT NULL,
          body TEXT NOT NULL,
          translation TEXT,
          sequence INTEGER NOT NULL DEFAULT 0,
          source_document TEXT,
          jlpt_level TEXT,
          last_seen_at TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `)

      // Idempotent migration: add missing columns if they don't exist
      try {
        await storage.execute(`ALTER TABLE learning_content ADD COLUMN source_document TEXT`)
      } catch {
        // Column already exists
      }

      try {
        await storage.execute(`ALTER TABLE learning_content ADD COLUMN jlpt_level TEXT`)
      } catch {
        // Column already exists
      }

      const rows = await storage.query<LearningItem>(
        `SELECT id, content_type, title, body, translation, sequence, source_document, jlpt_level
         FROM learning_content
         WHERE user_id = ? OR user_id IS NULL
         ORDER BY source_document ASC, sequence ASC, id ASC`,
        [activeUserId ?? 0]
      )
      setAllItems(rows)
      setIsLoading(false)
    }
    void load()
  }, [activeUserId, storage])

  // Derived: filtered items
  const filteredItems = useMemo(() => {
    const section = SECTION_DEFS.find(s => s.key === sectionFilter)!
    let items = allItems.filter(i => section.types.includes(i.content_type))
    if (sourceFilter) {
      items = items.filter(i => (i.source_document ?? '(no source)') === sourceFilter)
    }
    return items
  }, [allItems, sectionFilter, sourceFilter])

  // Available sources for filter dropdown
  const availableSources = useMemo(() => {
    const sources = new Map<string, number>()
    for (const item of allItems) {
      const key = item.source_document ?? '(no source)'
      sources.set(key, (sources.get(key) ?? 0) + 1)
    }
    return Array.from(sources.entries())
      .sort((a, b) => b[1] - a[1])
  }, [allItems])

  // Section counts
  const sectionCounts = useMemo(() => {
    return SECTION_DEFS.map(s => ({
      ...s,
      count: allItems.filter(i => s.types.includes(i.content_type)).length,
    }))
  }, [allItems])

  // Reset index when filter changes
  useEffect(() => {
    setIndex(0)
  }, [sectionFilter, sourceFilter])

  async function markSeen(id: number) {
    await storage.execute(
      `UPDATE learning_content SET last_seen_at = datetime('now') WHERE id = ?`, [id]
    )
  }

  function goNext() {
    if (filteredItems[index]) void markSeen(filteredItems[index].id)
    setIndex(i => Math.min(i + 1, filteredItems.length - 1))
  }

  function goPrev() {
    setIndex(i => Math.max(i - 1, 0))
  }

  // Group items by source for the "sections" overview
  const sourceGroups = useMemo(() => {
    const groups: { source: string; items: LearningItem[] }[] = []
    const seen = new Map<string, LearningItem[]>()
    for (const item of filteredItems) {
      const key = item.source_document ?? '(no source)'
      if (!seen.has(key)) {
        seen.set(key, [])
        groups.push({ source: key, items: seen.get(key)! })
      }
      seen.get(key)!.push(item)
    }
    return groups
  }, [filteredItems])

  // Flattened index for global position within source group
  const groupGlobalOffset = useMemo(() => {
    const offsets: number[] = []
    let offset = 0
    for (const group of sourceGroups) {
      offsets.push(offset)
      offset += group.items.length
    }
    return offsets
  }, [sourceGroups])

  // Find which group the current index falls into
  const currentGroupInfo = useMemo(() => {
    for (let g = 0; g < sourceGroups.length; g++) {
      const start = groupGlobalOffset[g]
      const end = start + sourceGroups[g].items.length
      if (index >= start && index < end) {
        return {
          groupIndex: g,
          localIndex: index - start,
          source: sourceGroups[g].source,
        }
      }
    }
    return { groupIndex: 0, localIndex: 0, source: sourceGroups[0]?.source ?? '' }
  }, [index, sourceGroups, groupGlobalOffset])

  const current = filteredItems[index]

  const navigate = useNavigate()

  return (
    <div className="flex flex-col min-h-screen">
      <Navigation />
      <main className="flex flex-col gap-6 px-4 py-6 sm:p-6 max-w-4xl mx-auto flex-1 w-full">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Learn</h1>
          {/* Tab Toggle */}
          <div className="flex gap-2 bg-gray-100 rounded-xl p-1 w-full sm:w-fit overflow-x-auto">
            <button
              onClick={() => setLearningMode('lesson')}
              className={`flex shrink-0 items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                learningMode === 'lesson'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <span>📚</span>
              <span>Study by Lesson</span>
            </button>
            <button
              onClick={() => setLearningMode('browse')}
              className={`flex shrink-0 items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                learningMode === 'browse'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <span>📖</span>
              <span>Browse Content</span>
            </button>
          </div>
        </div>

        {learningMode === 'lesson' ? (
          // Study by Lesson mode - show LessonsHub
          <LessonsHub embedded />
        ) : (
          // Browse Content mode
          <>
        {isLoading ? (
          <SkeletonList count={4} />
        ) : allItems.length === 0 ? (
          <EmptyState
            icon="📖"
            title="No learning content yet"
            description="Import content from Practice, or open Study by Lesson to use the packaged textbook curriculum."
            action={
              <button
                onClick={() => navigate('/practice')}
                className="px-4 py-2 text-sm font-semibold text-indigo-800 bg-indigo-50 rounded-lg hover:bg-indigo-100"
              >
                Open Practice
              </button>
            }
          />
        ) : (
          <>
            {/* Section Filter Tabs */}
            <div className="flex gap-1 bg-gray-100 rounded-xl p-1 overflow-x-auto">
              {sectionCounts.map(s => (
                <button
                  key={s.key}
                  onClick={() => setSectionFilter(s.key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors
                    ${sectionFilter === s.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  <span>{s.icon}</span>
                  <span>{s.label}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-mono
                    ${sectionFilter === s.key ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-200 text-gray-400'}`}>
                    {s.count}
                  </span>
                </button>
              ))}
            </div>

            {/* Source Filter */}
            {availableSources.length > 1 && (
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Source</span>
                <select
                  value={sourceFilter ?? ''}
                  onChange={e => setSourceFilter(e.target.value || null)}
                  className="text-sm border border-gray-200 rounded-lg px-2 py-1 bg-white text-gray-700"
                >
                  <option value="">All sources</option>
                  {availableSources.map(([src, count]) => (
                    <option key={src} value={src}>{src} ({count})</option>
                  ))}
                </select>
              </div>
            )}

            {/* Source group indicator */}
            {currentGroupInfo.source && filteredItems.length > 0 && (
              <div className="text-xs text-gray-400 flex items-center gap-2">
                <span>📂 {currentGroupInfo.source}</span>
                <span className="text-gray-300">|</span>
                <span>{CONTENT_TYPE_ICONS[current?.content_type] ?? '📄'} {CONTENT_TYPE_LABELS[current?.content_type] ?? 'Content'}</span>
              </div>
            )}

            {/* Content area */}
            <div className="flex-1 bg-white border border-gray-200 rounded-2xl p-6 min-h-64">
              {filteredItems.length === 0 ? (
                <EmptyState
                  compact
                  icon="📚"
                  title="No items in this section"
                  description="Try a different content type or source filter."
                />
              ) : (
                <ContentRenderer key={current.id} item={current} />
              )}
            </div>

            {/* Progress bar */}
            {filteredItems.length > 0 && (
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full transition-all"
                  style={{ width: `${((index + 1) / filteredItems.length) * 100}%` }}
                />
              </div>
            )}

            {/* Navigation */}
            {filteredItems.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={goPrev}
                  disabled={index === 0}
                  className="flex-1 px-4 py-3 border border-gray-200 rounded-xl font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  ← Previous
                </button>
                <button
                  onClick={goNext}
                  disabled={index === filteredItems.length - 1}
                  className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  Next →
                </button>
              </div>
            )}
          </>
        )}
          </>
        )}
      </main>
    </div>
  )
}
