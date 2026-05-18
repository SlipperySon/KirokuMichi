/**
 * Lesson Detail Page
 * Shows curriculum content, unlocked cards, and navigation for a specific lesson
 * Route: /study/lessons/:cefr/:lessonNumber
 */

import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, CheckCircle2, ListChecks } from 'lucide-react'
import { useAppStore } from '../store'
import { CEFR_BASE_TEXTBOOK, TEXTBOOK_LESSON_COUNTS, CEFR_SUPPLEMENTAL, type CEFRLevel } from '../content/cefrMapping'
import { lessonStructureService, type LessonStructure } from '../content/lessonNormalization'
import { curriculumService, type Exercise, type GrammarItem, type VocabItem } from '../content/curriculumService'
import { buildLessonIntent, type LessonIntent } from '../content/lessonIntentService'
import { createLessonMatcher } from '../content/lessonContentUtils'
import { applyGenkiLessonOneFoundation, applyGenkiLessonOneGrammarScope } from '../content/genkiFoundation'
import { unlockScenariosForLesson } from '../content/scenarioUnlockService'
import { getSupplementalScenarios } from '../content/supplementalScenarioService'
import { getWorkbookPracticeTasks, type WorkbookPracticeTask } from '../content/workbookPracticeService'
import { textbookAssetService, type TextbookAsset } from '../content/textbookAssetService'
import { SRSService } from '../srs/srsService'
import { SQLiteStorage } from '../db/sqlite'
import { FSRSScheduler, SM2Scheduler } from '../core/scheduler'
import type { ReviewCard } from './types'

interface LessonPageState {
  lesson: LessonStructure | null
  vocab: VocabItem[] | null
  grammar: GrammarItem[] | null
  exercises: Exercise[] | null
  intent: LessonIntent | null
  workbookPractice: WorkbookPracticeTask[]
  textbookAssets: TextbookAsset[]
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
    intent: null,
    workbookPractice: [],
    textbookAssets: [],
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

  const cefrLevel = (cefr?.toLowerCase() ?? 'a1') as CEFRLevel
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
        // Curriculum data uses various lesson ID formats:
        //   normalized: 'genki_1_1', 'quartet_1_3'
        //   original:   '1_textbook_genki_1_1'
        //   plain:      '1'
        // Match against all of them.
        const matchesLesson = createLessonMatcher(lessonId, lessonNum)

        const rawVocab = curriculum.vocabulary.filter(v => matchesLesson(v.lesson))
        const rawGrammar = curriculum.grammar.filter(g => matchesLesson(g.lesson))
        const vocab = applyGenkiLessonOneFoundation(lessonId, rawVocab)
        const grammar = applyGenkiLessonOneGrammarScope(lessonId, rawGrammar)
        const exercises = curriculum.exercises.filter(e => matchesLesson(e.lesson))
        const assetSourceKeys = [baseTextbook, ...CEFR_SUPPLEMENTAL[cefrLevel]]
        const [scenarios, workbookPractice, textbookAssets] = await Promise.all([
          getSupplementalScenarios({ cefr: cefrLevel, coreLessonId: lessonId }),
          getWorkbookPracticeTasks({ cefr: cefrLevel, lessonId, lessonNum }),
          textbookAssetService.getAssetsForLessonSources(assetSourceKeys, lessonId),
        ])
        const intent = buildLessonIntent({
          cefr: cefrLevel,
          lessonNum,
          lessonId,
          vocab,
          grammar,
          scenarios,
          workbookPractice,
        })

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
          intent,
          workbookPractice,
          textbookAssets,
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
  }, [lessonId, baseTextbook, lessonNum, activeUserId, srsService])

  if (state.loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-500" />
          <p className="text-gray-600">Loading lesson...</p>
        </div>
      </div>
    )
  }

  if (state.error || !state.lesson) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="mb-4 text-red-600">{state.error || 'Lesson not found'}</p>
          <button
            onClick={() => navigate('/learn/lessons')}
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
  const teachableVocabCount = state.vocab?.length ?? 0
  const teachableGrammarCount = state.grammar?.length ?? 0
  const practiceTaskCount = state.workbookPractice.length

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

  const handleMarkComplete = async () => {
    markComplete(lessonId)
    // Unlock corresponding scenarios when lesson is completed
    if (activeUserId) {
      try {
        const result = await unlockScenariosForLesson(lessonId, activeUserId, storage)
        if (result.unlockedCount > 0) {
          console.log(`Unlocked ${result.unlockedCount} scenarios from ${result.practiceBookName}`)
        }
      } catch (error) {
        console.error('Failed to unlock scenarios:', error)
      }
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
                  {state.lesson.series} - Lesson {state.lesson.lesson_number}
                </h1>
                {isCompleted && (
                  <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-semibold text-green-800">
                    ✓ Completed
                  </span>
                )}
              </div>
              <p className="mt-2 text-gray-600">
                {teachableVocabCount} vocab • {teachableGrammarCount} grammar •{' '}
                {practiceTaskCount} practice tasks
              </p>
            </div>
          </div>

          {/* Start Lesson Button — prominent CTA */}
          {(state.vocab && state.vocab.length > 0) || (state.grammar && state.grammar.length > 0) ? (
            <button
              onClick={() => {
                navigate('/learn/study', {
                  state: {
                    vocab: state.vocab || [],
                    grammar: state.grammar || [],
                    lessonId,
                    lessonTitle: `${state.lesson!.series} - Lesson ${state.lesson!.lesson_number}`,
                    cefrLevel: cefr,
                    intent: state.intent ?? undefined,
                    workbookPractice: state.workbookPractice,
                  }
                })
              }}
              className="w-full rounded-xl bg-indigo-600 px-6 py-4 text-base sm:text-lg font-bold text-white hover:bg-indigo-700 transition-colors shadow-md mb-4"
            >
              Start Lesson ({teachableVocabCount + teachableGrammarCount} items)
            </button>
          ) : null}

          {/* Navigation and Actions */}
          <div className="grid grid-cols-1 gap-3 sm:flex sm:flex-wrap sm:items-center">
            <button
              onClick={() => navigate('/learn/lessons')}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2 font-semibold text-indigo-800 shadow-sm transition-colors hover:bg-indigo-100"
            >
              <ListChecks className="h-4 w-4" aria-hidden="true" />
              Return to Lesson Menu
            </button>

            {hasPreviousLesson && (
              <button
                onClick={() => navigate(`/learn/lessons/${cefr}/${lessonNum - 1}`)}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-gray-700 transition-colors hover:bg-gray-50"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Previous Lesson
              </button>
            )}

            {hasNextLesson && (
              <button
                onClick={() => navigate(`/learn/lessons/${cefr}/${lessonNum + 1}`)}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-gray-700 transition-colors hover:bg-gray-50"
              >
                Next Lesson
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            )}

            {!isCompleted && (
              <button
                onClick={handleMarkComplete}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2 font-semibold text-white transition-colors hover:bg-green-700 sm:ml-auto"
              >
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                Mark as Complete
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
        {state.intent && (
          <div className="mb-8 rounded-lg bg-white p-4 shadow sm:p-6">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-indigo-600">Lesson intent</p>
                <h2 className="mt-1 text-xl font-bold text-gray-900">{state.intent.objective}</h2>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                {state.intent.pageRange}
              </span>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <IntentBlock title="Prerequisite" body={state.intent.prerequisite} />
              <IntentBlock title="Output skill" body={state.intent.outputSkill} />
              <IntentBlock title="Target grammar" body={state.intent.targetGrammar.join(' / ') || 'No grammar assigned yet'} />
              <IntentBlock title="Target vocab" body={state.intent.targetVocab.join('、') || 'No vocab assigned yet'} />
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border border-indigo-100 bg-indigo-50 p-3 text-sm text-indigo-950">
                <div className="font-semibold">Maynard coverage</div>
                <div className="mt-1">{state.intent.maynardMatchCount}/{state.grammar?.length ?? 0} grammar points have Maynard deep explanations.</div>
              </div>
              <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-950">
                <div className="font-semibold">Matching scenarios</div>
                <div className="mt-1">{state.intent.matchingScenarios.length} scenario links for output practice.</div>
              </div>
            </div>
            {state.intent.matchingScenarios.length > 0 && (
              <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Matching scenarios</div>
                <div className="mt-2 grid gap-2 md:grid-cols-2">
                  {state.intent.matchingScenarios.map(scenario => (
                  <div key={scenario.id} className="rounded bg-white p-2 text-sm">
                      <div className="font-semibold text-gray-900">{scenario.title}</div>
                      <div className="text-xs text-gray-500">{scenario.source} {scenario.page > 0 ? `p. ${scenario.page}` : ''}</div>
                      <div className="mt-1 text-gray-600">{scenario.canDo}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {state.workbookPractice.length > 0 && (
          <div className="mb-8 rounded-lg bg-white p-4 shadow sm:p-6">
            <h2 className="mb-4 text-xl font-bold text-gray-900">Workbook Practice ({state.workbookPractice.length})</h2>
            <div className="space-y-3">
              {state.workbookPractice.map(task => (
                <div key={task.id} className="rounded-lg border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-950">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold capitalize">{task.type.replace(/_/g, ' ')}</span>
                    <span className="text-xs text-emerald-800">{task.source} {task.page > 0 ? `p. ${task.page}` : ''}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs">
                    <span className="rounded bg-white px-2 py-0.5 font-semibold uppercase tracking-wide text-emerald-800">{task.practiceMode}</span>
                    <span className="rounded bg-white px-2 py-0.5 text-emerald-800">{task.focus}</span>
                  </div>
                  <p className="mt-2 text-gray-900">{task.prompt}</p>
                  {task.sourcePrompt && (
                    <p className="mt-1 text-xs text-emerald-800">Source cue: {task.sourcePrompt}</p>
                  )}
                  <p className="mt-1 text-emerald-900">{task.support}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mb-8 rounded-lg bg-white p-4 shadow sm:p-6">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Textbook Image Assets</h2>
              <p className="mt-1 text-sm text-gray-600">
                Page photos and cropped figures can appear here once a user-unlocked asset manifest is generated.
              </p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
              state.textbookAssets.length > 0
                ? 'bg-green-100 text-green-800'
                : 'bg-slate-100 text-slate-700'
            }`}>
              {state.textbookAssets.length > 0 ? `${state.textbookAssets.length} ready` : 'pending'}
            </span>
          </div>
          {state.textbookAssets.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {state.textbookAssets.slice(0, 4).map(asset => (
                <figure key={asset.id} className="overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
                  <img src={asset.src} alt={asset.alt} className="aspect-video w-full object-cover" loading="lazy" />
                  <figcaption className="p-3 text-sm text-gray-700">
                    <div className="font-semibold capitalize">{asset.kind} · p. {asset.page}</div>
                    {asset.caption && <div className="mt-1 text-gray-600">{asset.caption}</div>}
                  </figcaption>
                </figure>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              No image manifest is available for this lesson yet. When textbook extraction provides cropped page/photo assets,
              this lesson already has the hook to display them with page references.
            </div>
          )}
        </div>

        {/* Vocabulary Section */}
        {state.vocab && state.vocab.length > 0 && (
          <div className="mb-8 rounded-lg bg-white p-4 shadow sm:p-6">
            <h2 className="mb-4 text-xl font-bold text-gray-900">Vocabulary ({state.vocab.length})</h2>
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
              {state.vocab.slice(0, 15).map((item, idx) => (
                <div key={idx} className="rounded bg-blue-50 p-3">
                  <div className="font-semibold text-gray-900">{item.surface}</div>
                  <div className="text-sm text-gray-600">{item.english}</div>
                  <div className="mt-1 text-[11px] font-medium text-blue-800">
                    {item.source.replace(/_/g, ' ')} {item.page > 0 ? `p. ${item.page}` : 'foundation'}
                  </div>
                </div>
              ))}
              {state.vocab.length > 15 && (
                <div className="flex items-center justify-center rounded bg-gray-50 p-3 text-sm text-gray-600">
                  +{state.vocab.length - 15} more
                </div>
              )}
            </div>
          </div>
        )}

        {/* Grammar Section */}
        {state.grammar && state.grammar.length > 0 && (
          <div className="mb-8 rounded-lg bg-white p-4 shadow sm:p-6">
            <h2 className="mb-4 text-xl font-bold text-gray-900">Grammar ({state.grammar.length})</h2>
            <div className="space-y-3">
              {state.grammar.slice(0, 10).map((item, idx) => (
                <div key={idx} className="rounded bg-purple-50 p-3">
                  <div className="font-semibold text-gray-900">{item.pattern}</div>
                  <div className="text-sm text-gray-600">{item.meaning}</div>
                  {item.explanation && (
                    <div className="mt-1 text-xs text-gray-500 line-clamp-2">{item.explanation}</div>
                  )}
                  <div className="mt-1 text-[11px] font-medium text-purple-800">
                    {item.source.replace(/_/g, ' ')} {item.page > 0 ? `p. ${item.page}` : 'generated grammar'}
                  </div>
                </div>
              ))}
              {state.grammar.length > 10 && (
                <div className="rounded bg-gray-50 p-3 text-center text-sm text-gray-600">
                  +{state.grammar.length - 10} more grammar patterns
                </div>
              )}
            </div>
          </div>
        )}

        {/* Unlocked Cards Section */}
        <div className="mb-8 rounded-lg bg-white p-4 shadow sm:p-6">
          <h2 className="mb-4 text-xl font-bold text-gray-900">
            Anki Cards ({state.unlockedCards.length} unlocked)
          </h2>

          {state.unlockedCards.length > 0 ? (
            <>
              <div className="mb-4 grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                {state.unlockedCards.slice(0, 6).map(card => (
                  <div key={card.cardStateId} className="rounded bg-gray-50 p-3">
                    <div className="truncate font-semibold text-gray-900">{card.front}</div>
                    <div className="truncate text-xs text-gray-600">{card.back}</div>
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
          <div className="rounded-lg bg-white p-4 shadow sm:p-6">
            <h2 className="mb-4 text-xl font-bold text-gray-900">Supplemental Materials</h2>
            <div className="flex flex-wrap gap-2">
              {CEFR_SUPPLEMENTAL[cefrLevel].map(textbook => (
                <button
                  key={textbook}
                  onClick={() => navigate(`/scenarios?level=${cefrLevel.toUpperCase()}&source=${textbook}`)}
                  className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  title={`Practice scenarios from ${textbook}`}
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

function IntentBlock({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</div>
      <div className="mt-1 text-sm leading-relaxed text-gray-900">{body}</div>
    </div>
  )
}
