/**
 * Lesson Detail Page
 * Shows curriculum content, unlocked cards, and navigation for a specific lesson
 * Route: /study/lessons/:cefr/:lessonNumber
 */

import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2, Dumbbell, FileImage, Layers, ListChecks, ScrollText } from 'lucide-react'
import { useAppStore } from '../store'
import { CEFR_BASE_TEXTBOOK, TEXTBOOK_LESSON_COUNTS, CEFR_SUPPLEMENTAL, type CEFRLevel } from '../content/cefrMapping'
import { lessonStructureService, type LessonStructure } from '../content/lessonNormalization'
import { curriculumService, type Exercise, type GrammarItem, type VocabItem } from '../content/curriculumService'
import { createLessonMatcher, pageRangeFromPages } from '../content/lessonContentUtils'
import { hasMaynardSupport } from '../content/maynardSupport'
import { unlockScenariosForLesson } from '../content/scenarioUnlockService'
import { repairLessonCardLinks } from '../content/lessonUnlockService'
import { getWorkbookPracticeTasks, type WorkbookPracticeTask } from '../content/workbookPracticeService'
import { textbookAssetService, type TextbookAsset } from '../content/textbookAssetService'
import { SRSService } from '../srs/srsService'
import { importBundledGenkiTestDeck } from '../srs/bundledGenkiImport'
import { SQLiteStorage } from '../db/sqlite'
import { FSRSScheduler, SM2Scheduler } from '../core/scheduler'
import { toast } from '../components/toastStore'
import type { ReviewCard } from './types'
import { AddToDeckButton } from './AddToDeckButton'
import { hasResumableLessonSession } from './lessonSessionPersistence'

interface LessonPageState {
  lesson: LessonStructure | null
  vocab: VocabItem[] | null
  grammar: GrammarItem[] | null
  exercises: Exercise[] | null
  overview: ExtractedLessonOverview | null
  workbookPractice: WorkbookPracticeTask[]
  textbookAssets: TextbookAsset[]
  unlockedCards: ReviewCard[]
  repairedCardLinks: number
  totalUserCards: number
  importingBundledGenki: boolean
  loading: boolean
  error: string | null
}

interface ExtractedLessonOverview {
  pageRange: string
  targetGrammar: string[]
  targetVocab: string[]
  maynardMatchCount: number
}

export function LessonPage() {
  const { cefr, lessonNumber } = useParams<{ cefr: string; lessonNumber: string }>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { settings } = useAppStore()
  const autostartConsumed = useRef(false)
  const [state, setState] = useState<LessonPageState>({
    lesson: null,
    vocab: null,
    grammar: null,
    exercises: null,
    overview: null,
    workbookPractice: [],
    textbookAssets: [],
    unlockedCards: [],
    repairedCardLinks: 0,
    totalUserCards: 0,
    importingBundledGenki: false,
    loading: true,
    error: null
  })
  const [reloadToken, setReloadToken] = useState(0)

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

        const vocab = curriculum.vocabulary.filter(v => matchesLesson(v.lesson))
        const grammar = curriculum.grammar.filter(g => matchesLesson(g.lesson))
        const exercises = curriculum.exercises.filter(e => matchesLesson(e.lesson))
        const assetSourceKeys = [baseTextbook, ...CEFR_SUPPLEMENTAL[cefrLevel]]
        const [workbookPractice, textbookAssets] = await Promise.all([
          getWorkbookPracticeTasks({ cefr: cefrLevel, lessonId, lessonNum }),
          textbookAssetService.getAssetsForLessonSources(assetSourceKeys, lessonId),
        ])
        const overview: ExtractedLessonOverview = {
          pageRange: pageRangeFromPages([
            ...vocab.map(item => item.page),
            ...grammar.map(item => item.page),
            ...workbookPractice.map(item => item.page),
          ]),
          targetGrammar: grammar.slice(0, 6).map(item => item.pattern),
          targetVocab: vocab.slice(0, 8).map(item => item.surface),
          maynardMatchCount: grammar.filter(hasMaynardSupport).length,
        }

        // Load unlocked cards for this lesson
        let unlockedCards: ReviewCard[] = []
        let repairedCardLinks = 0
        let totalUserCards = 0
        if (activeUserId) {
          const cardCountRows = await storage.query<{ count: number }>(
            `SELECT COUNT(*) AS count FROM card_states WHERE user_id = ?`,
            [activeUserId]
          )
          totalUserCards = cardCountRows[0]?.count ?? 0
          const repairResult = await repairLessonCardLinks(lessonId, activeUserId, storage, vocab, grammar)
          repairedCardLinks = repairResult.unlockedCount
          if (repairResult.errors.length > 0) {
            console.warn('Lesson card link repair warnings:', repairResult.errors)
          }
          unlockedCards = await srsService.getCardsForLesson(activeUserId, lessonId, 20)
        }

        setState(prev => ({
          ...prev,
          lesson,
          vocab,
          grammar,
          exercises,
          overview,
          workbookPractice,
          textbookAssets,
          unlockedCards,
          repairedCardLinks,
          totalUserCards,
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
  }, [lessonId, baseTextbook, lessonNum, activeUserId, srsService, storage, reloadToken])

  useEffect(() => {
    if (autostartConsumed.current) return
    if (searchParams.get('autostart') !== '1') return
    if (state.loading || state.error || !state.lesson) return
    const hasContent = (state.vocab?.length ?? 0) > 0 || (state.grammar?.length ?? 0) > 0
    if (!hasContent) return

    autostartConsumed.current = true
    const next = new URLSearchParams(searchParams)
    next.delete('autostart')
    setSearchParams(next, { replace: true })
    navigate('/learn/study', {
      state: {
        vocab: state.vocab || [],
        grammar: state.grammar || [],
        lessonId,
        lessonTitle: `${state.lesson.series} - Lesson ${state.lesson.lesson_number}`,
        cefrLevel: cefrLevel,
        workbookPractice: state.workbookPractice,
      },
      replace: true,
    })
  }, [
    searchParams,
    setSearchParams,
    state.loading,
    state.error,
    state.lesson,
    state.vocab,
    state.grammar,
    state.workbookPractice,
    lessonId,
    cefrLevel,
    navigate,
  ])

  const canImportBundledGenki = baseTextbook.startsWith('genki_')

  const handleImportBundledGenki = async () => {
    if (!activeUserId) {
      toast.error('No active user is available yet. Return to Study once, then try again.')
      return
    }

    setState(prev => ({ ...prev, importingBundledGenki: true, error: null }))
    try {
      const result = await importBundledGenkiTestDeck(storage, activeUserId)
      toast.success(`Imported ${result.imported} Genki cards; ${result.linked}/${result.cards} linked to lessons`, 7000)
      setReloadToken(token => token + 1)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not import bundled Genki cards'
      toast.error(message)
      setState(prev => ({ ...prev, error: message }))
    } finally {
      setState(prev => ({ ...prev, importingBundledGenki: false }))
    }
  }

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
            onClick={() => navigate('/learn')}
            className="rounded-lg bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
          >
            Back to Course
          </button>
        </div>
      </div>
    )
  }

  const isCompleted = lessonsCompleted.includes(lessonId)
  const canResumeRail = hasResumableLessonSession(lessonId)
  const totalLessons = TEXTBOOK_LESSON_COUNTS[baseTextbook] || 1
  const hasNextLesson = lessonNum < totalLessons
  const hasPreviousLesson = lessonNum > 1
  const teachableVocabCount = state.vocab?.length ?? 0
  const teachableGrammarCount = state.grammar?.length ?? 0
  const practiceTaskCount = state.workbookPractice.length
  const sectionLinks = [
    { id: 'lesson-intent', label: 'Overview', count: state.overview ? 1 : 0, icon: ScrollText },
    { id: 'lesson-vocab', label: 'Vocab', count: teachableVocabCount, icon: BookOpen },
    { id: 'lesson-grammar', label: 'Grammar', count: teachableGrammarCount, icon: Layers },
    { id: 'lesson-practice', label: 'Practice', count: practiceTaskCount, icon: Dumbbell },
    { id: 'lesson-assets', label: 'Images', count: state.textbookAssets.length, icon: FileImage },
    { id: 'lesson-cards', label: 'Cards', count: state.unlockedCards.length, icon: ListChecks },
  ].filter(section => section.count > 0 || section.id === 'lesson-cards')

  const jumpToSection = (sectionId: string) => {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

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
              <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">Lesson reference</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
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
                Optional overview while studying. Start opens the continuous lesson rail — you do not need to scroll this page first.
              </p>
              <p className="mt-1 text-sm text-gray-500">
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
                    workbookPractice: state.workbookPractice,
                  }
                })
              }}
              className="w-full rounded-xl bg-indigo-600 px-6 py-4 text-base sm:text-lg font-bold text-white hover:bg-indigo-700 transition-colors shadow-md mb-4"
            >
              {canResumeRail
                ? 'Resume Lesson Rail'
                : `Start Lesson (${teachableVocabCount + teachableGrammarCount} items)`}
            </button>
          ) : null}

          {/* Navigation and Actions */}
          <div className="grid grid-cols-1 gap-3 sm:flex sm:flex-wrap sm:items-center">
            <button
              onClick={() => navigate('/learn')}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2 font-semibold text-indigo-800 shadow-sm transition-colors hover:bg-indigo-100"
            >
              <ListChecks className="h-4 w-4" aria-hidden="true" />
              Return to Course
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

          <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-600">Lesson sections</div>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
              {sectionLinks.map(section => {
                const Icon = section.icon
                return (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => jumpToSection(section.id)}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm transition-colors hover:border-indigo-300 hover:bg-indigo-50"
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    <span>{section.label}</span>
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">{section.count}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
        {state.overview && (
          <div id="lesson-intent" className="scroll-mt-24 mb-8 rounded-lg border border-gray-200 bg-white p-4 shadow sm:p-6">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-indigo-700">Extracted lesson overview</p>
                <h2 className="mt-1 text-xl font-bold text-gray-900">{state.lesson.series} Lesson {state.lesson.lesson_number}</h2>
              </div>
              <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-bold text-slate-800">
                {state.overview.pageRange}
              </span>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <IntentBlock title="Target grammar" body={state.overview.targetGrammar.join(' / ') || 'No grammar assigned yet'} />
              <IntentBlock title="Target vocab" body={state.overview.targetVocab.join('、') || 'No vocab assigned yet'} />
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-sm text-indigo-950">
                <div className="font-semibold">Maynard coverage</div>
                <div className="mt-1">{state.overview.maynardMatchCount}/{state.grammar?.length ?? 0} grammar points have Maynard deep explanations.</div>
              </div>
            </div>
          </div>
        )}

        {state.workbookPractice.length > 0 && (
          <div id="lesson-practice" className="scroll-mt-24 mb-8 rounded-lg bg-white p-4 shadow sm:p-6">
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
                  <p className="mt-1 text-emerald-900">{task.support}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div id="lesson-assets" className="scroll-mt-24 mb-8 rounded-lg bg-white p-4 shadow sm:p-6">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Textbook Image Assets</h2>
              <p className="mt-1 text-sm text-gray-600">
                Page photos and cropped figures appear here when extracted textbook assets are available.
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
              No extracted image assets are available for this lesson yet. When textbook extraction provides cropped page/photo assets,
              this lesson already has the hook to display them with page references.
            </div>
          )}
        </div>

        {/* Vocabulary Section */}
        {state.vocab && state.vocab.length > 0 && (
          <div id="lesson-vocab" className="scroll-mt-24 mb-8 rounded-lg bg-white p-4 shadow sm:p-6">
            <h2 className="mb-4 text-xl font-bold text-gray-900">Vocabulary ({state.vocab.length})</h2>
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
              {state.vocab.slice(0, 15).map((item, idx) => (
                <div key={idx} className="rounded bg-blue-50 p-3">
                  <div className="font-semibold text-gray-900">{item.surface}</div>
                  <div className="text-sm text-gray-600">{item.english}</div>
                  <div className="mt-1 text-[11px] font-medium text-blue-800">
                    {item.source.replace(/_/g, ' ')} {item.page > 0 ? `p. ${item.page}` : 'extracted content'}
                  </div>
                  <div className="mt-2">
                    <AddToDeckButton front={item.surface} back={item.english} lessonId={lessonId} originRef={item.id} />
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
          <div id="lesson-grammar" className="scroll-mt-24 mb-8 rounded-lg bg-white p-4 shadow sm:p-6">
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
                    {item.source.replace(/_/g, ' ')} {item.page > 0 ? `p. ${item.page}` : 'extracted content'}
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
        <div id="lesson-cards" className="scroll-mt-24 mb-8 rounded-lg bg-white p-4 shadow sm:p-6">
          <h2 className="mb-4 text-xl font-bold text-gray-900">
            Anki Cards ({state.unlockedCards.length} unlocked)
          </h2>
          {state.repairedCardLinks > 0 && (
            <p className="mb-4 rounded-lg border border-indigo-100 bg-indigo-50 p-3 text-sm font-medium text-indigo-900">
              Linked {state.repairedCardLinks} matching card{state.repairedCardLinks === 1 ? '' : 's'} to this lesson.
            </p>
          )}

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
            <div className="rounded border border-yellow-200 bg-yellow-50 p-4 text-center text-yellow-900">
              {activeUserId && state.totalUserCards === 0 ? (
                <>
                  <p className="font-semibold">No Anki cards are imported yet.</p>
                  <p className="mt-1 text-sm">
                    This lesson has extracted textbook content, but the card review section needs an imported deck or starter cards.
                  </p>
                  {canImportBundledGenki && (
                    <button
                      type="button"
                      onClick={handleImportBundledGenki}
                      disabled={state.importingBundledGenki}
                      className="mt-3 inline-flex items-center justify-center rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {state.importingBundledGenki ? 'Importing Genki cards…' : 'Import Genki starter cards'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => navigate('/my-content')}
                    className="mt-3 inline-flex items-center justify-center rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100 sm:ml-2"
                  >
                    Import your own deck
                  </button>
                </>
              ) : (
                <>
                  <p className="font-semibold">No imported cards match this lesson yet.</p>
                  <p className="mt-1 text-sm">
                    {state.totalUserCards > 0
                      ? `${state.totalUserCards} card${state.totalUserCards === 1 ? '' : 's'} exist in your review database, but none are linked to ${lessonId}.`
                      : 'Open Study once to initialize a learner profile, then import cards.'}
                  </p>
                  <button
                    type="button"
                    onClick={() => navigate('/my-content')}
                    className="mt-3 inline-flex items-center justify-center rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100"
                  >
                    Import or inspect cards
                  </button>
                </>
              )}
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
      <div className="text-xs font-bold uppercase tracking-wide text-gray-600">{title}</div>
      <div className="mt-1 text-sm leading-relaxed text-gray-900">{body}</div>
    </div>
  )
}
