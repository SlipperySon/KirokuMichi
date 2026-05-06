import { useState, useEffect, useMemo } from 'react'
import type { JlptLevel } from '../content/contentTypes'
import type { GrammarPoint } from '../content/contentTypes'
import type { JlptTab, LevelProgress } from './types'
import { GrammarService } from '../content/grammarService'
import { VocabService } from '../content/vocabService'
import { LevelPicker } from './LevelPicker'
import { GrammarBrowser } from './GrammarBrowser'
import { GrammarLesson } from './GrammarLesson'
import { VocabBrowser } from './VocabBrowser'
import { KeigoBrowser } from './KeigoBrowser'
import { PracticeTest } from './PracticeTest'
import { SimulatedTest } from './SimulatedTest'
import { useAppStore } from '../store'
import { SQLiteStorage } from '../db/sqlite'

const TABS: { id: JlptTab; label: string }[] = [
  { id: 'grammar', label: 'Grammar' },
  { id: 'vocab', label: 'Vocabulary' },
  { id: 'practice', label: 'Practice' },
  { id: 'test', label: 'Test' },
  { id: 'keigo', label: 'Keigo' },
]

export function JLPTSection() {
  const jlptTarget = useAppStore(s => s.settings.jlptTarget)
  const userId = useAppStore(s => s.activeUserId) ?? 1

  const storage = useMemo(() => new SQLiteStorage(), [])
  const grammarService = useMemo(() => new GrammarService(storage), [storage])
  const vocabService = useMemo(() => new VocabService(storage), [storage])

  const [level, setLevel] = useState<JlptLevel>(jlptTarget as JlptLevel)
  const [tab, setTab] = useState<JlptTab>('grammar')
  const [selectedGrammar, setSelectedGrammar] = useState<GrammarPoint | null>(null)
  const [progress, setProgress] = useState<LevelProgress[]>([])

  useEffect(() => {
    const LEVELS: JlptLevel[] = ['N5', 'N4', 'N3', 'N2', 'N1']
    Promise.all(
      LEVELS.map(async l => {
        const [gt, vt] = await Promise.all([
          grammarService.getCountByLevel(l),
          vocabService.getCountByLevel(l),
        ])
        return { level: l, grammarTotal: gt, vocabTotal: vt, learnedCount: 0 }
      })
    ).then(setProgress)
  }, [grammarService, vocabService])

  function handleTabChange(t: JlptTab) {
    setTab(t)
    setSelectedGrammar(null)
  }

  function renderContent() {
    switch (tab) {
      case 'grammar':
        if (selectedGrammar) {
          return <GrammarLesson point={selectedGrammar} onBack={() => setSelectedGrammar(null)} />
        }
        return <GrammarBrowser service={grammarService} level={level} onSelect={setSelectedGrammar} />

      case 'vocab':
        return <VocabBrowser service={vocabService} level={level} userId={userId} />

      case 'keigo':
        return <KeigoBrowser service={grammarService} level={level} />

      case 'practice':
        return (
          <PracticeTest
            service={grammarService}
            level={level}
            questionCount={10}
            onDone={() => setTab('grammar')}
          />
        )

      case 'test':
        return (
          <SimulatedTest
            service={grammarService}
            level={level}
            onDone={() => setTab('grammar')}
          />
        )
    }
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="border-b border-gray-100 px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold">JLPT Study</h1>
          <a href="/study" className="text-sm text-indigo-600 hover:text-indigo-800">← Dashboard</a>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 flex flex-col gap-5">
        {/* Level picker */}
        <LevelPicker selected={level} progress={progress} onSelect={l => { setLevel(l); setSelectedGrammar(null) }} />

        {/* Tab bar */}
        <div className="flex gap-1 border-b border-gray-100">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => handleTabChange(t.id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
                tab === t.id
                  ? 'border-indigo-500 text-indigo-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {renderContent()}
      </div>
    </div>
  )
}
