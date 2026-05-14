/**
 * Lesson Detail Page
 * Shows curriculum content, unlocked cards, and navigation for a specific lesson
 * Route: /study/lessons/:cefr/:lessonNumber
 */

import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAppStore } from '../store'
import { CEFR_BASE_TEXTBOOK, TEXTBOOK_LESSON_COUNTS, CEFR_SUPPLEMENTAL, type CEFRLevel } from '../content/cefrMapping'
import { lessonStructureService, type LessonStructure } from '../content/lessonNormalization'
import { curriculumService } from '../content/curriculumService'
import { SRSService } from '../srs/srsService'
import { SQLiteStorage } from '../db/sqlite'
import { FSRSScheduler, SM2Scheduler } from '../core/scheduler'
import type { ReviewCard } from './types'

interface LessonPageState {
  lesson: LessonStructure | null
  vocab: Array<{ surface: string; english: string }> | null
  grammar: Array<{ pattern: string; meaning: string }> | null
  exercises: Array<{ question: string }> | null
  unlockedCards: ReviewCard[]
  loading: boolean
  error: string | null
}

export function LessonPage() {
  const { cefr, lessonNumber } = useParams<{ cefr: string; lessonNumber: string }>()
  const navigate = useNavigate()
  const { settings } = useAppStore()
  const [state, setState] = useState<LessonPageState>({
    lesson: null,
    vocab: null,
    grammar: null,
    exercises: null,
    unlockedCards: [],
    loading: true,
    error: null
  })

  // Initialize SRS service
  const [storage] = useState(() => new SQLiteStorage())
  const scheduler = settings.schedulerAlgorithm === 'fsrs' ? new FSRSScheduler() : new SM2Scheduler()
  const [srsService] = useState(() => new SRSService(storage, scheduler))

  const markComplete = useAppStore(s => s.markLessonComplete)
  const lessonsCompleted = useAppStore(s => s.lessonsCompleted)
  const activeUserId = useAppStore(s => s.activeUserId)

  const cefrLevel = cefr as CEFRLevel
  const baseTextbook = CEFR_BASE_TEXTBOOK[cefrLevel]
  const lessonNum = parseInt(lessonNumber || '1', 10)

  // Build the lesson ID (e.g., "genki_1_1")
  const seriesPrefix = baseTextbook.split('_').slice(0, -1).join('_')
  const lessonId = `${seriesPrefix}_${lessonNum}`

  useEffect(() => {
    const loadLesson = async () => {
      try {
        setState(prev => ({ ...prev, loading: true, error: null }))

        // Load lesson structure
        const lesson = await lessonStructureService.getLesson(lessonId)
        if (!lesson) {
          setState(prev => ({ ...prev, error: `Lesson not found: ${lessonId}`, loading: false }))
          return
        }

        // Load curriculum
        const curriculum = await curriculumService.getTextbookCurriculum(baseTextbook)
        if (!curriculum) {
          setState(prev => ({ ...prev, error: `Curriculum not found for ${baseTextbook}`, loading: false }))
          return
        }

        // Get content for this lesson
        const lessonNumStr = lessonNum.toString()
        const vocab = curriculum.vocabulary.filter(v => v.lesson === lessonNumStr)
        const grammar = curriculum.grammar.filter(g => g.lesson === lessonNumStr)
        const exercises = curriculum.exercises.filter(e => e.lesson === lessonNumStr)

        // Load unlocked cards for this lesson
        let unlockedCards: ReviewCard[] = []
        if (activeUserId) {
          unlockedCards = await srsService.getCardsForLesson(activeUserId, lessonId, 20)
        }

        setState(prev => ({
          ...prev,
          lesson,
          vocab,
          grammar,
          exercises,
          unlockedCards,
          loading: false
        }))
      } catch (error) {
        setState(prev => ({
          ...prev,
          error: `Error loading lesson: ${String(error)}`,
          loading: false
        }))
      }
    }

    loadLesson()
  }, [lessonId, baseTextbook, lessonNum, activeUserId])

  if (state.loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-blue-500" />
          <p className="text-slate-600">Loading lesson...</p>
        </div>
      </div>
    )
  }

  if (state.error || !state.lesson) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <p className="mb-4 text-red-600">{state.error || 'Lesson not found'}</p>
          <button
            onClick={() => navigate('/study/lessons')}
            className="rounded-lg bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
          >
            Back to Lessons
          </button>
        </div>
      </div>
    )
  }

  const isCompleted = lessonsCompleted.includes(lessonId)
  const totalLessons = TEXTBOOK_LESSON_COUNTS[baseTextbook] || 1
  const hasNextLesson = lessonNum < totalLessons
  const hasPreviousLesson = lessonNum > 1

  const handleStudyCards = async () => {
    // Start a review session with lesson cards
    if (!activeUserId) {
      setState(prev => ({ ...prev, error: 'No user ID found' }))
      return
    }

    try {
      // Start a new session
      const sessionId = await srsService.startSession(activeUserId, 'lesson')

      // Navigate to review session with lesson context
      navigate('/study/review', {
        state: {
          queue: state.unlockedCards,
          grammarEntries: [],
          sessionId,
          userId: activeUserId,
          lessonId
        }
      })
    } catch (error) {
      setState(prev => ({ ...prev, error: `Failed to start review: ${String(error)}` }))
    }
  }

  const handleMarkComplete = () => {
    markComplete(lessonId)
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="mx-auto max-w-4xl px-6 py-8">
          <div className="mb-6 flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-3xl font-bold text-slate-900">
                  {state.lesson.series} - Lesson {state.lesson.lesson_number}
                </h1>
                {isCompleted && (
                  <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-semibold text-green-800">
                    ✓ Completed
                  </span>
                )}
              </div>
              <p className="mt-2 text-slate-600">
                {state.lesson.content.vocab} vocab • {state.lesson.content.grammar} grammar •{' '}
                {state.lesson.content.exercises} exercises
              </p>
            </div>
          </div>

          {/* Navigation and Actions */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => navigate('/study/lessons')}
              className="rounded-lg border border-slate-300 px-4 py-2 text-slate-700 hover:bg-slate-50"
            >
              ← Back to Lessons
            </button>

            {hasPreviousLesson && (
              <button
                onClick={() => navigate(`/study/lessons/${cefr}/${lessonNum - 1}`)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-slate-700 hover:bg-slate-50"
              >
                ← Previous Lesson
              </button>
            )}

            {hasNextLesson && (
              <button
                onClick={() => navigate(`/study/lessons/${cefr}/${lessonNum + 1}`)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-slate-700 hover:bg-slate-50"
              >
                Next Lesson →
              </button>
            )}

            {!isCompleted && (
              <button
                onClick={handleMarkComplete}
                className="ml-auto rounded-lg bg-green-500 px-4 py-2 text-white hover:bg-green-600"
              >
                Mark as Complete
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-4xl px-6 py-8">
        {/* Vocabulary Section */}
        {state.vocab && state.vocab.length > 0 && (
          <div className="mb-8 rounded-lg bg-white p-6 shadow">
            <h2 className="mb-4 text-xl font-bold text-slate-900">Vocabulary ({state.vocab.length})</h2>
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
              {state.vocab.slice(0, 15).map((item, idx) => (
                <div key={idx} className="rounded bg-blue-50 p-3">
                  <div className="font-semibold text-slate-900">{item.surface}</div>
                  <div className="text-sm text-slate-600">{item.english}</div>
                </div>
              ))}
              {state.vocab.length > 15 && (
                <div className="flex items-center justify-center rounded bg-slate-100 p-3 text-sm text-slate-600">
                  +{state.vocab.length - 15} more
                </div>
              )}
            </div>
          </div>
        )}

        {/* Grammar Section */}
        {state.grammar && state.grammar.length > 0 && (
          <div className="mb-8 rounded-lg bg-white p-6 shadow">
            <h2 className="mb-4 text-xl font-bold text-slate-900">Grammar ({state.grammar.length})</h2>
            <div className="space-y-3">
              {state.grammar.slice(0, 10).map((item, idx) => (
                <div key={idx} className="rounded bg-purple-50 p-3">
                  <div className="font-semibold text-slate-900">{item.pattern}</div>
                  <div className="text-sm text-slate-600">{item.meaning}</div>
                </div>
              ))}
              {state.grammar.length > 10 && (
                <div className="rounded bg-slate-100 p-3 text-center text-sm text-slate-600">
                  +{state.grammar.length - 10} more grammar patterns
                </div>
              )}
            </div>
          </div>
        )}

        {/* Unlocked Cards Section */}
        <div className="mb-8 rounded-lg bg-white p-6 shadow">
          <h2 className="mb-4 text-xl font-bold text-slate-900">
            Anki Cards ({state.unlockedCards.length} unlocked)
          </h2>

          {state.unlockedCards.length > 0 ? (
            <>
              <div className="mb-4 grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                {state.unlockedCards.slice(0, 6).map(card => (
                  <div key={card.cardStateId} className="rounded bg-slate-100 p-3">
                    <div className="truncate font-semibold text-slate-900">{card.front}</div>
                    <div className="truncate text-xs text-slate-600">{card.back}</div>
                  </div>
                ))}
              </div>
              <button
                onClick={handleStudyCards}
                className="w-full rounded-lg bg-blue-500 px-4 py-3 font-semibold text-white hover:bg-blue-600"
              >
                Study These {state.unlockedCards.length} Cards
              </button>
            </>
          ) : (
            <div className="rounded bg-yellow-50 p-4 text-center text-yellow-800">
              <p>No Anki cards match this lesson yet.</p>
              <p className="mt-1 text-sm">Import an Anki deck to start studying with cards.</p>
            </div>
          )}
        </div>

        {/* Supplemental Materials */}
        {CEFR_SUPPLEMENTAL[cefrLevel].length > 0 && (
          <div className="rounded-lg bg-white p-6 shadow">
            <h2 className="mb-4 text-xl font-bold text-slate-900">Supplemental Materials</h2>
            <div className="flex flex-wrap gap-2">
              {CEFR_SUPPLEMENTAL[cefrLevel].map(textbook => (
                <button
                  key={textbook}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  title={`View ${textbook}`}
                >
                  {textbook.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
