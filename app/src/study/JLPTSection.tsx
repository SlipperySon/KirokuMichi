import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAppStore } from '../store'
import { SQLiteStorage } from '../db/sqlite'
import { GrammarService } from '../content/grammarService'
import { VocabService } from '../content/vocabService'
import { QuizService } from '../srs/quizService'
import { Navigation } from '../components/Navigation'
import type { GrammarPoint, VocabItem, JlptLevel, QuizItem } from '../content/contentTypes'
import { LevelPicker } from './LevelPicker'
import { GrammarList } from './GrammarList'
import { QuizMode } from './QuizMode'
import { QuizResult } from './QuizResult'
import { TestBuilder } from './TestBuilder'

type Tab = 'grammar' | 'vocab' | 'tests'
type TestState = 'list' | 'builder' | 'taking' | 'result'

export function JLPTSection() {
  const activeUserId = useAppStore(s => s.activeUserId)
  const [searchParams, setSearchParams] = useSearchParams()

  const currentLevel = (searchParams.get('level') || 'N5') as JlptLevel
  const currentTab = (searchParams.get('tab') || 'grammar') as Tab

  const [storage] = useState(() => new SQLiteStorage())
  const [grammarService] = useState(() => new GrammarService(storage))
  const [vocabService] = useState(() => new VocabService(storage))
  const [quizService] = useState(() => new QuizService(storage))

  const [grammar, setGrammar] = useState<GrammarPoint[]>([])
  const [vocab, setVocab] = useState<VocabItem[]>([])
  const [quizzes, setQuizzes] = useState<QuizItem[]>([])

  const [counts, setCounts] = useState({ N5: 0, N4: 0, N3: 0 })
  const [isLoading, setIsLoading] = useState(true)

  const [testState, setTestState] = useState<TestState>('list')
  const [currentTest, setCurrentTest] = useState<{
    questions: QuizItem[]
    startTime: number
    responses: Array<{ questionId: number; answer: string | null; correct: boolean }>
  } | null>(null)

  const handleTabChange = (tab: Tab) => {
    setSearchParams({ level: currentLevel, tab })
  }

  const loadContent = useCallback(async () => {
    setIsLoading(true)
    try {
      // Load grammar
      const n5Grammar = await grammarService.getByLevel('N5')
      const n4Grammar = await grammarService.getByLevel('N4')
      const n3Grammar = await grammarService.getByLevel('N3')

      if (currentLevel === 'N5') setGrammar(n5Grammar)
      else if (currentLevel === 'N4') setGrammar(n4Grammar)
      else if (currentLevel === 'N3') setGrammar(n3Grammar)

      // Load vocab
      const userId = activeUserId || 1
      const n5Vocab = await vocabService.getByLevel('N5', userId)
      const n4Vocab = await vocabService.getByLevel('N4', userId)
      const n3Vocab = await vocabService.getByLevel('N3', userId)

      if (currentLevel === 'N5') setVocab(n5Vocab)
      else if (currentLevel === 'N4') setVocab(n4Vocab)
      else if (currentLevel === 'N3') setVocab(n3Vocab)

      // Load quizzes
      const n5Quizzes = await quizService.getByLevel('N5')
      const n4Quizzes = await quizService.getByLevel('N4')
      const n3Quizzes = await quizService.getByLevel('N3')

      if (currentLevel === 'N5') setQuizzes(n5Quizzes)
      else if (currentLevel === 'N4') setQuizzes(n4Quizzes)
      else if (currentLevel === 'N3') setQuizzes(n3Quizzes)

      setCounts({
        N5: n5Grammar.length,
        N4: n4Grammar.length,
        N3: n3Grammar.length,
      })
    } catch (error) {
      console.error('Failed to load JLPT content:', error)
    } finally {
      setIsLoading(false)
    }
  }, [grammarService, vocabService, quizService, currentLevel])

  useEffect(() => {
    loadContent()
  }, [loadContent])

  const handleStartTest = async (size: 20 | 30) => {
    const result = await quizService.createTest(activeUserId || 1, currentLevel, size)
    setCurrentTest({
      questions: result.questions,
      startTime: Date.now(),
      responses: [],
    })
    setTestState('taking')
  }

  const handleCompleteTest = (responses: Array<{ questionId: number; answer: string | null; correct: boolean }>) => {
    if (currentTest) {
      setCurrentTest({
        ...currentTest,
        responses,
      })
      setTestState('result')
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
        <p className="text-sm text-gray-400">Loading JLPT content…</p>
      </div>
    )
  }

  const duration = currentTest ? Date.now() - currentTest.startTime : 0

  return (
    <div className="flex flex-col min-h-screen">
      <Navigation />
      <div className="flex flex-col gap-6 p-6 max-w-4xl mx-auto flex-1">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">JLPT Section</h1>
        <p className="text-gray-600">Study Japanese grammar, vocabulary, and practice tests</p>
      </div>

      <LevelPicker counts={counts} />

      {testState !== 'taking' && testState !== 'result' && (
        <div className="flex gap-2 border-b border-gray-200">
          {(['grammar', 'vocab', 'tests'] as Tab[]).map(tab => (
            <button
              key={tab}
              onClick={() => handleTabChange(tab)}
              className={`px-4 py-2 font-semibold transition-colors ${
                currentTab === tab
                  ? 'text-indigo-600 border-b-2 border-indigo-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      )}

      {testState === 'taking' && currentTest && (
        <QuizMode
          questions={currentTest.questions}
          onComplete={handleCompleteTest}
          onCancel={() => setTestState('list')}
        />
      )}

      {testState === 'result' && currentTest && (
        <QuizResult
          questions={currentTest.questions}
          responses={currentTest.responses}
          duration={duration}
          onBack={() => {
            setCurrentTest(null)
            setTestState('list')
          }}
          onRetake={() => handleStartTest(currentTest.questions.length as 20 | 30)}
        />
      )}

      {testState === 'builder' && (
        <TestBuilder
          level={currentLevel}
          availableQuestions={quizzes.length}
          onStart={handleStartTest}
          onCancel={() => setTestState('list')}
        />
      )}

      {testState === 'list' && currentTab === 'grammar' && <GrammarList grammar={grammar} />}

      {testState === 'list' && currentTab === 'vocab' && (
        <div className="space-y-2">
          {vocab.length > 0 ? (
            vocab.map(v => (
              <div key={v.id} className="p-4 bg-white border border-gray-200 rounded-lg hover:border-indigo-500 transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-gray-900">{v.front}</p>
                    <p className="text-sm text-gray-600">{v.reading}</p>
                  </div>
                  <p className="text-gray-700">{v.back}</p>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-gray-500">No vocabulary found for {currentLevel}</div>
          )}
        </div>
      )}

      {testState === 'list' && currentTab === 'tests' && (
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Practice Tests</h2>
          <p className="text-gray-600 mb-6">
            Available questions: <span className="font-semibold">{quizzes.length}</span>
          </p>
          <button
            onClick={() => setTestState('builder')}
            disabled={quizzes.length < 20}
            className="px-6 py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Start New Test
          </button>
        </div>
      )}
      </div>
    </div>
  )
}
