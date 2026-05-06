import { useState, useCallback } from 'react'
import { Trash2, Plus } from 'lucide-react'
import { useAppStore } from '../store'
import { SQLiteStorage } from '../db/sqlite'
import { UserContentService } from '../content/userContentService'
import { ClientAIProvider } from '../ai/aiProvider'
import { Navigation } from '../components/Navigation'
import { GENERATE_CONTENT_PROMPT } from '../ai/systemPrompts'
import type { VocabItem, GrammarPoint, QuizItem } from '../content/contentTypes'

type ContentType = 'cards' | 'grammar' | 'quiz' | 'lessons'

interface LearningItem {
  id: number
  content_type: string
  title: string
  body: string
  translation: string | null
  sequence: number
  source_document: string | null
  jlpt_level: string | null
}

export function MyContent() {
  const { activeUserId, settings } = useAppStore()
  const [cards, setCards] = useState<VocabItem[]>([])
  const [grammar, setGrammar] = useState<GrammarPoint[]>([])
  const [quizzes, setQuizzes] = useState<QuizItem[]>([])
  const [lessons, setLessons] = useState<LearningItem[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<ContentType>('cards')
  const [showAddForm, setShowAddForm] = useState(false)
  const [showGenerateForm, setShowGenerateForm] = useState(false)
  const [generatePrompt, setGeneratePrompt] = useState('')
  const [generating, setGenerating] = useState(false)
  const [generatedContent, setGeneratedContent] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const loadContent = useCallback(async () => {
    setLoading(true)
    try {
      const storage = new SQLiteStorage()
      const service = new UserContentService(storage)

      const [loadedCards, loadedGrammar, loadedQuizzes, loadedLessons] = await Promise.all([
        service.getUserCards(activeUserId || 1),
        service.getUserGrammar(),
        service.getUserQuizzes(),
        storage.query<LearningItem>(
          `SELECT id, content_type, title, body, translation, sequence, source_document, jlpt_level
           FROM learning_content WHERE user_id = ? ORDER BY sequence ASC, id ASC`,
          [activeUserId || 1]
        ),
      ])

      setCards(loadedCards)
      setGrammar(loadedGrammar)
      setQuizzes(loadedQuizzes)
      setLessons(loadedLessons)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load content')
    } finally {
      setLoading(false)
    }
  }, [activeUserId])

  useState(() => {
    loadContent()
  })

  const handleDeleteCard = async (id: number) => {
    try {
      const storage = new SQLiteStorage()
      const service = new UserContentService(storage)
      await service.deleteCard(id)
      setCards(cards.filter(c => c.id !== id))
    } catch (err) {
      setError('Failed to delete card')
    }
  }

  const handleDeleteGrammar = async (id: number) => {
    try {
      const storage = new SQLiteStorage()
      const service = new UserContentService(storage)
      await service.deleteGrammarPoint(id)
      setGrammar(grammar.filter(g => g.id !== id))
    } catch (err) {
      setError('Failed to delete grammar point')
    }
  }

  const handleDeleteLesson = async (id: number) => {
    try {
      const storage = new SQLiteStorage()
      await storage.execute('DELETE FROM learning_content WHERE id = ?', [id])
      setLessons(lessons.filter(l => l.id !== id))
    } catch (err) {
      setError('Failed to delete lesson')
    }
  }

  const handleDeleteQuiz = async (id: number) => {
    try {
      const storage = new SQLiteStorage()
      const service = new UserContentService(storage)
      await service.deleteQuizQuestion(id)
      setQuizzes(quizzes.filter(q => q.id !== id))
    } catch (err) {
      setError('Failed to delete quiz')
    }
  }

  const handleGenerateContent = async () => {
    if (!generatePrompt.trim() || generating) return

    setGenerating(true)
    setError(null)

    try {
      const aiProvider = new ClientAIProvider(settings.sessionToken)
      const response = await aiProvider.completeWithMessages(
        [{ role: 'user', content: generatePrompt }],
        GENERATE_CONTENT_PROMPT,
        'fast'
      )

      const json = JSON.parse(response)
      setGeneratedContent(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed')
    } finally {
      setGenerating(false)
    }
  }

  const handleImportGenerated = async () => {
    if (!generatedContent) return

    try {
      const storage = new SQLiteStorage()
      const service = new UserContentService(storage)
      const result = await service.importGeneratedContent(generatedContent, activeUserId || 1)

      // Reload content
      await loadContent()
      setGeneratedContent(null)
      setGeneratePrompt('')
      setShowGenerateForm(false)
    } catch (err) {
      setError('Failed to import content')
    }
  }

  if (loading) {
    return <div className="text-center py-8 text-gray-500">Loading your content…</div>
  }

  const isEmpty = cards.length === 0 && grammar.length === 0 && quizzes.length === 0 && lessons.length === 0

  return (
    <div className="flex flex-col min-h-screen">
      <Navigation />
      <div className="space-y-6 max-w-4xl mx-auto p-6 flex-1">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">My Content</h1>
        <p className="text-gray-600">Your custom cards, grammar, and quizzes</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          <p className="text-sm">{error}</p>
        </div>
      )}

      {isEmpty ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-600 mb-4">You haven't added any custom content yet</p>
          <button
            onClick={() => setShowGenerateForm(true)}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-semibold"
          >
            Generate with AI
          </button>
        </div>
      ) : (
        <>
          <div className="flex gap-2 border-b border-gray-200">
            {(['cards', 'grammar', 'quiz', 'lessons'] as ContentType[]).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 font-semibold transition-colors ${
                  activeTab === tab
                    ? 'text-indigo-600 border-b-2 border-indigo-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {tab === 'cards' && `Cards (${cards.length})`}
                {tab === 'grammar' && `Grammar (${grammar.length})`}
                {tab === 'quiz' && `Quizzes (${quizzes.length})`}
                {tab === 'lessons' && `Lessons (${lessons.length})`}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-semibold"
            >
              <Plus className="w-4 h-4" />
              Add {activeTab === 'cards' ? 'Card' : activeTab === 'grammar' ? 'Grammar' : activeTab === 'quiz' ? 'Quiz' : 'Lesson'}
            </button>

            <button
              onClick={() => setShowGenerateForm(!showGenerateForm)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-semibold"
            >
              <Plus className="w-4 h-4" />
              Generate with AI
            </button>
          </div>

          {activeTab === 'cards' && (
            <div className="space-y-2">
              {cards.map(card => (
                <div key={card.id} className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg">
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900">{card.front}</p>
                    <p className="text-sm text-gray-600">{card.reading}</p>
                    <p className="text-gray-700">{card.back}</p>
                  </div>
                  <button
                    onClick={() => handleDeleteCard(card.id)}
                    className="ml-4 p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'grammar' && (
            <div className="space-y-2">
              {grammar.map(point => (
                <div key={point.id} className="flex items-start justify-between p-4 bg-white border border-gray-200 rounded-lg">
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900">{point.title}</p>
                    <p className="text-sm text-gray-600 font-mono">{point.pattern}</p>
                    <p className="text-gray-700">{point.meaning}</p>
                  </div>
                  <button
                    onClick={() => handleDeleteGrammar(point.id)}
                    className="ml-4 p-2 text-red-600 hover:bg-red-50 rounded transition-colors flex-shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'quiz' && (
            <div className="space-y-2">
              {quizzes.map(quiz => (
                <div key={quiz.id} className="flex items-start justify-between p-4 bg-white border border-gray-200 rounded-lg">
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900">{quiz.prompt}</p>
                    <p className="text-sm text-gray-600">Answer: {quiz.answer}</p>
                  </div>
                  <button
                    onClick={() => handleDeleteQuiz(quiz.id)}
                    className="ml-4 p-2 text-red-600 hover:bg-red-50 rounded transition-colors flex-shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'lessons' && (
            <div className="space-y-2">
              {lessons.map(lesson => (
                <div key={lesson.id} className="flex items-start justify-between p-4 bg-white border border-gray-200 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                        ${lesson.content_type === 'word_list' ? 'bg-indigo-100 text-indigo-700' :
                          lesson.content_type === 'grammar_point' ? 'bg-purple-100 text-purple-700' :
                          lesson.content_type === 'dialogue_script' ? 'bg-amber-100 text-amber-700' :
                          'bg-gray-100 text-gray-600'}`}>
                        {lesson.content_type.replace(/_/g, ' ')}
                      </span>
                      {lesson.jlpt_level && (
                        <span className="text-xs text-gray-400">{lesson.jlpt_level}</span>
                      )}
                    </div>
                    <p className="font-semibold text-gray-900 mt-1 truncate">{lesson.title}</p>
                    <p className="text-sm text-gray-500 truncate">{lesson.body.length > 100 ? lesson.body.slice(0, 100) + '…' : lesson.body}</p>
                    {lesson.source_document && (
                      <p className="text-xs text-gray-400 mt-0.5">Source: {lesson.source_document}</p>
                    )}
                  </div>
                  <button
                    onClick={() => handleDeleteLesson(lesson.id)}
                    className="ml-4 p-2 text-red-600 hover:bg-red-50 rounded transition-colors flex-shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {showGenerateForm && (
        <div className="bg-gray-50 rounded-lg p-4 space-y-3">
          <h3 className="font-semibold text-gray-900">Generate Content</h3>
          <textarea
            value={generatePrompt}
            onChange={e => setGeneratePrompt(e.target.value)}
            placeholder="e.g. 10 N2 grammar points about conditional forms"
            rows={3}
            disabled={generating}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
          />
          <div className="flex gap-2">
            <button
              onClick={handleGenerateContent}
              disabled={!generatePrompt.trim() || generating}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors font-semibold"
            >
              {generating ? 'Creating…' : 'Generate'}
            </button>
            <button
              onClick={() => setShowGenerateForm(false)}
              className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {generatedContent && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
          <h3 className="font-semibold text-blue-900">Review Generated Content</h3>
          <pre className="bg-white p-3 rounded text-xs overflow-x-auto max-h-64 text-gray-700">
            {JSON.stringify(generatedContent, null, 2)}
          </pre>
          <div className="flex gap-2">
            <button
              onClick={handleImportGenerated}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold"
            >
              Import All
            </button>
            <button
              onClick={() => setGeneratedContent(null)}
              className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      </div>
    </div>
  )
}
