import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { FileText, ListChecks, MessageCircle } from 'lucide-react'
import { useAppStore } from '../store'
import { buildLessonPlan, type LessonStudyState, type MaynardRef, type QuizQuestion, type TeachItem } from './lessonStudyPlanner'
import { AddToDeckButton } from './AddToDeckButton'
import { SQLiteStorage } from '../db/sqlite'
import { FSRSScheduler, SM2Scheduler } from '../core/scheduler'
import { SRSService } from '../srs/srsService'
import {
  buildLessonReviewQueue,
  ensureLessonCards,
  priorityFrontsFromLessonSignals,
} from './lessonCardBridge'
import { toast } from '../components/toastStore'
import { unlockScenariosForLesson } from '../content/scenarioUnlockService'
import {
  clearLessonSession,
  LESSON_RAIL_PHASES,
  loadLessonSession,
  railPhaseFromStepKind,
  saveLessonSession,
  type LessonRailPhase,
  type LessonSessionSnapshot,
} from './lessonSessionPersistence'

interface AnswerRecord {
  itemId: string
  prompt: string
  correctAnswer: string
  selectedAnswer: string
  isCorrect: boolean
}

interface SelfAssessment {
  itemId: string
  title: string
  body: string
  type: 'vocab' | 'grammar'
  rating: 'again' | 'good'
}

interface WorkbookResponse {
  response: string
  completed: boolean
}

export function LessonStudy() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { state: routeState } = useLocation() as { state?: LessonStudyState }
  const markComplete = useAppStore(s => s.markLessonComplete)
  const setCurrentLesson = useAppStore(s => s.setCurrentLesson)
  const settings = useAppStore(s => s.settings)
  const activeUserId = useAppStore(s => s.activeUserId)
  const userId = activeUserId ?? 1

  const [storage] = useState(() => new SQLiteStorage())
  const scheduler = settings.schedulerAlgorithm === 'fsrs' ? new FSRSScheduler() : new SM2Scheduler()
  const [service] = useState(() => new SRSService(storage, scheduler))
  const [isStartingCards, setIsStartingCards] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  const resumeId = searchParams.get('resume')
  const afterCards = searchParams.get('after') === 'cards'

  const initialLesson = useMemo(() => {
    if (routeState?.lessonId) return routeState
    if (resumeId) {
      const snap = loadLessonSession(resumeId)
      if (snap) return snap.lesson
    }
    return null
  }, [routeState, resumeId])

  const state = useMemo<LessonStudyState>(() => initialLesson ?? {
    vocab: [],
    grammar: [],
    lessonId: '',
    lessonTitle: 'Lesson',
    cefrLevel: 'a1',
  }, [initialLesson])

  const plan = useMemo(
    () => buildLessonPlan(state.vocab, state.grammar, state.lessonId, state.workbookPractice ?? []),
    [state]
  )
  const [stepIndex, setStepIndex] = useState(0)
  const [teachIndex, setTeachIndex] = useState(0)
  const [questionIndex, setQuestionIndex] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null)
  const [answers, setAnswers] = useState<AnswerRecord[]>([])
  const [isTeachRevealed, setIsTeachRevealed] = useState(false)
  const [selfAssessments, setSelfAssessments] = useState<SelfAssessment[]>([])
  const [workbookResponses, setWorkbookResponses] = useState<Record<string, WorkbookResponse>>({})
  const [speakResponse, setSpeakResponse] = useState('')
  const [speakCompleted, setSpeakCompleted] = useState(false)
  const [cardsCompleted, setCardsCompleted] = useState(false)
  const [showDone, setShowDone] = useState(false)

  // Hydrate from persistence / after-cards return
  useEffect(() => {
    const lessonId = routeState?.lessonId || resumeId
    if (!lessonId || lessonId.endsWith('_drill')) {
      setHydrated(true)
      return
    }

    const snap = loadLessonSession(lessonId)
    if (snap) {
      setStepIndex(snap.stepIndex)
      setTeachIndex(snap.teachIndex)
      setQuestionIndex(snap.questionIndex)
      setAnswers(snap.answers)
      setSelfAssessments(snap.selfAssessments)
      setWorkbookResponses(snap.workbookResponses)
      setSpeakResponse(snap.speakResponse)
      setSpeakCompleted(snap.speakCompleted)
      setCardsCompleted(snap.cardsCompleted)
    }

    if (afterCards && snap) {
      const speakIdx = buildLessonPlan(
        snap.lesson.vocab,
        snap.lesson.grammar,
        snap.lesson.lessonId,
        snap.lesson.workbookPractice ?? [],
      ).findIndex(step => step.kind === 'speak')
      setCardsCompleted(true)
      if (speakIdx >= 0) setStepIndex(speakIdx)
      const next = new URLSearchParams(searchParams)
      next.delete('after')
      setSearchParams(next, { replace: true })
      toast.success('Cards done — finish with Speak')
    }

    setHydrated(true)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps -- hydrate once on mount

  useEffect(() => {
    if (!state.lessonId || state.lessonId.endsWith('_drill')) return
    setCurrentLesson(state.lessonId)
  }, [state.lessonId, setCurrentLesson])

  // Persist progress
  useEffect(() => {
    if (!hydrated || !state.lessonId || state.lessonId.endsWith('_drill')) return
    const snapshot: LessonSessionSnapshot = {
      version: 1,
      lesson: state,
      stepIndex,
      teachIndex,
      questionIndex,
      answers,
      selfAssessments,
      workbookResponses,
      speakResponse,
      speakCompleted,
      cardsCompleted,
      updatedAt: new Date().toISOString(),
    }
    saveLessonSession(snapshot)
  }, [
    hydrated,
    state,
    stepIndex,
    teachIndex,
    questionIndex,
    answers,
    selfAssessments,
    workbookResponses,
    speakResponse,
    speakCompleted,
    cardsCompleted,
  ])

  const currentStep = plan[stepIndex]
  const totalQuestions = answers.length
  const correctAnswers = answers.filter(answer => answer.isCorrect).length
  const percentage = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 100
  const missedAnswers = answers.filter(answer => !answer.isCorrect)
  const selfMarkedAgain = selfAssessments.filter(item => item.rating === 'again')
  const completedWorkbookTasks = Object.values(workbookResponses).filter(response => response.completed).length
  const lessonNumber = state.lessonId.split('_').pop() ?? '1'
  const lessonPagePath = `/learn/lessons/${state.cefrLevel}/${lessonNumber}`
  const activeRail = currentStep ? railPhaseFromStepKind(currentStep.kind) : 'intro'

  if (!initialLesson) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
        <button onClick={() => navigate('/learn')} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-3 font-semibold text-white hover:bg-indigo-700">
          <ListChecks className="h-5 w-5" aria-hidden="true" />
          Return to Course
        </button>
      </div>
    )
  }

  if (!hydrated || !currentStep) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6 text-sm text-gray-500">
        Loading lesson…
      </div>
    )
  }

  function moveToStep(nextStepIndex: number) {
    if (nextStepIndex >= plan.length) {
      setShowDone(true)
      return
    }
    setStepIndex(nextStepIndex)
    setTeachIndex(0)
    setQuestionIndex(0)
    setSelectedAnswer(null)
    setIsTeachRevealed(false)
  }

  function answerQuestion(question: QuizQuestion, answer: string) {
    if (selectedAnswer !== null) return
    setSelectedAnswer(answer)
    const isCorrect = answer === question.correctAnswer
    setAnswers(previous => [
      ...previous,
      {
        itemId: question.itemId,
        prompt: question.prompt,
        correctAnswer: question.correctAnswer,
        selectedAnswer: answer,
        isCorrect,
      },
    ])
    if (!isCorrect) {
      void service.logMistake(userId, null, answer, question.correctAnswer, null).catch(() => {
        /* non-blocking */
      })
    }
  }

  async function continueToCards() {
    if (isStartingCards) return
    setIsStartingCards(true)
    try {
      await ensureLessonCards(service, userId, state.lessonId, state.vocab, state.grammar)
      const priorityFronts = priorityFrontsFromLessonSignals({
        vocab: state.vocab,
        grammar: state.grammar,
        againItemIds: selfMarkedAgain.map(item => item.itemId),
        missedItemIds: missedAnswers.map(answer => answer.itemId),
      })
      const queue = await buildLessonReviewQueue(service, userId, state.lessonId, { priorityFronts })
      if (queue.length === 0) {
        toast.info('No linked cards — continuing to Speak. Add or import cards later for spacing.')
        setCardsCompleted(true)
        const speakIdx = plan.findIndex(step => step.kind === 'speak')
        moveToStep(speakIdx >= 0 ? speakIdx : stepIndex + 1)
        return
      }
      const sessionId = await service.startSession(userId, 'lesson')
      toast.success(`Reviewing ${queue.length} lesson card${queue.length === 1 ? '' : 's'}`)
      navigate('/study/review', {
        state: {
          queue,
          grammarEntries: [],
          sessionId,
          userId,
          lessonId: state.lessonId,
          markCompleteOnFinish: false,
          returnTo: `/learn/study?resume=${encodeURIComponent(state.lessonId)}&after=cards`,
        },
      })
    } catch (error) {
      toast.error(`Could not start card review: ${String(error)}`)
    } finally {
      setIsStartingCards(false)
    }
  }

  async function finishLesson() {
    markComplete(state.lessonId)
    try {
      await unlockScenariosForLesson(state.lessonId, userId, storage)
    } catch { /* ignore */ }
    clearLessonSession(state.lessonId)
    setShowDone(true)
  }

  function continueQuiz(questions: QuizQuestion[]) {
    if (questionIndex + 1 >= questions.length) {
      moveToStep(stepIndex + 1)
    } else {
      setQuestionIndex(previous => previous + 1)
      setSelectedAnswer(null)
    }
  }

  function restartLesson() {
    clearLessonSession(state.lessonId)
    setStepIndex(0)
    setTeachIndex(0)
    setQuestionIndex(0)
    setSelectedAnswer(null)
    setIsTeachRevealed(false)
    setAnswers([])
    setSelfAssessments([])
    setWorkbookResponses({})
    setSpeakResponse('')
    setSpeakCompleted(false)
    setCardsCompleted(false)
    setShowDone(false)
  }

  function rateTeachItem(item: TeachItem, rating: SelfAssessment['rating']) {
    setSelfAssessments(previous => [
      ...previous.filter(record => record.itemId !== item.id),
      { itemId: item.id, title: item.title, body: item.body, type: item.type, rating },
    ])
  }

  const shellProps = {
    lessonTitle: state.lessonTitle,
    activeRail,
    referencePath: lessonPagePath,
    onExit: () => navigate(lessonPagePath),
  }

  if (showDone) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
        <div className="w-full max-w-xl rounded-xl bg-white p-8 shadow-lg">
          <p className="text-sm font-semibold text-indigo-600">Lesson complete</p>
          <h1 className="mt-2 text-2xl font-bold text-gray-900">{state.lessonTitle}</h1>
          <p className="mt-2 text-gray-600">
            {totalQuestions > 0
              ? `${correctAnswers}/${totalQuestions} recall checks correct (${percentage}%).`
              : 'You finished the lesson rail.'}
            {cardsCompleted ? ' Cards were reviewed in SRS.' : ''}
          </p>
          <div className="mt-6 grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
            <SummaryStat label="Vocab" value={state.vocab.length.toString()} tone="blue" />
            <SummaryStat label="Grammar" value={state.grammar.length.toString()} tone="purple" />
            <SummaryStat label="Recall" value={totalQuestions > 0 ? `${percentage}%` : 'Done'} tone="green" />
            <SummaryStat label="Workbook" value={state.workbookPractice?.length ? `${completedWorkbookTasks}/${state.workbookPractice.length}` : '0'} tone="emerald" />
          </div>
          <div className="mt-6 flex flex-col gap-3">
            <button onClick={() => navigate('/study')} className="rounded-lg bg-indigo-600 px-4 py-3 font-semibold text-white hover:bg-indigo-700">
              Back to Today
            </button>
            <button onClick={() => navigate(lessonPagePath)} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50">
              <FileText className="h-4 w-4" aria-hidden="true" />
              Open lesson reference
            </button>
            <button onClick={restartLesson} className="rounded-lg border border-gray-200 px-4 py-3 font-semibold text-gray-700 hover:bg-gray-50">
              Study Again
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (currentStep.kind === 'intro') {
    return (
      <LessonShell
        {...shellProps}
        stepTitle={currentStep.title}
        goal={currentStep.goal}
        progress={5}
        progressLabel="Orient"
      >
        <div className="rounded-xl bg-white p-6 shadow-lg sm:p-8">
          <p className="text-sm font-semibold text-indigo-600">What you will do</p>
          <h2 className="mt-1 text-xl font-bold text-gray-900">Encode → check → practice → cards → speak</h2>
          <div className="mt-5 grid grid-cols-3 gap-3 text-center">
            <div className="rounded-lg bg-blue-50 p-3">
              <div className="text-2xl font-bold text-blue-700">{currentStep.vocabCount}</div>
              <div className="text-xs text-gray-600">Vocab</div>
            </div>
            <div className="rounded-lg bg-purple-50 p-3">
              <div className="text-2xl font-bold text-purple-700">{currentStep.grammarCount}</div>
              <div className="text-xs text-gray-600">Grammar</div>
            </div>
            <div className="rounded-lg bg-indigo-50 p-3">
              <div className="text-2xl font-bold text-indigo-700">~{currentStep.estimatedCards}</div>
              <div className="text-xs text-gray-600">Cards into SRS</div>
            </div>
          </div>
          {currentStep.targets.length > 0 && (
            <div className="mt-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Targets</p>
              <ul className="mt-2 space-y-1">
                {currentStep.targets.map(target => (
                  <li key={target} className="rounded bg-gray-50 px-3 py-2 text-sm text-gray-900" lang="ja">{target}</li>
                ))}
              </ul>
            </div>
          )}
          <button
            type="button"
            onClick={() => moveToStep(stepIndex + 1)}
            className="mt-6 w-full rounded-lg bg-indigo-600 px-4 py-3 font-semibold text-white hover:bg-indigo-700"
          >
            Start teaching
          </button>
        </div>
      </LessonShell>
    )
  }

  if (currentStep.kind === 'cards') {
    return (
      <LessonShell
        {...shellProps}
        stepTitle={currentStep.title}
        goal={currentStep.goal}
        progress={80}
        progressLabel="Anki SRS"
      >
        <div className="rounded-xl bg-white p-6 shadow-lg sm:p-8">
          <p className="text-sm font-semibold text-indigo-600">Spaced retrieval</p>
          <h2 className="mt-1 text-xl font-bold text-gray-900">Review lesson cards</h2>
          <p className="mt-2 text-sm text-gray-600">
            Uses the existing Anki-style ReviewSession (Again / Hard / Good / Easy). Weak and missed items first, capped for this intro pass.
          </p>
          {(missedAnswers.length > 0 || selfMarkedAgain.length > 0) && (
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {missedAnswers.length + selfMarkedAgain.length} weak item{missedAnswers.length + selfMarkedAgain.length === 1 ? '' : 's'} will be prioritized.
            </p>
          )}
          <button
            type="button"
            disabled={isStartingCards}
            onClick={() => { void continueToCards() }}
            className="mt-6 w-full rounded-lg bg-indigo-600 px-4 py-3 font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {isStartingCards ? 'Preparing cards…' : 'Start Cards review'}
          </button>
          <button
            type="button"
            onClick={() => {
              setCardsCompleted(true)
              moveToStep(stepIndex + 1)
            }}
            className="mt-3 w-full rounded-lg border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Schedule for later today (skip for now)
          </button>
        </div>
      </LessonShell>
    )
  }

  if (currentStep.kind === 'speak') {
    return (
      <LessonShell
        {...shellProps}
        stepTitle={currentStep.title}
        goal={currentStep.goal}
        progress={95}
        progressLabel="Production"
      >
        <div className="rounded-xl bg-white p-6 shadow-lg sm:p-8">
          <p className="text-sm font-semibold text-emerald-700">Pushed output</p>
          <h2 className="mt-1 text-xl font-bold text-gray-900">Produce before you finish</h2>
          <p className="mt-3 font-medium text-gray-900">{currentStep.prompt}</p>
          <p className="mt-1 text-sm text-gray-600">{currentStep.support}</p>
          <textarea
            value={speakResponse}
            onChange={event => setSpeakResponse(event.target.value)}
            placeholder="Type your sentence here…"
            className="mt-4 min-h-28 w-full resize-y rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            lang="ja"
          />
          <label className="mt-3 flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={speakCompleted}
              onChange={event => setSpeakCompleted(event.target.checked)}
            />
            I produced something (even if rough)
          </label>
          <button
            type="button"
            onClick={() => navigate(`/scenarios?lesson=${encodeURIComponent(currentStep.scenarioLessonId)}`)}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900 hover:bg-emerald-100"
          >
            <MessageCircle className="h-4 w-4" aria-hidden />
            Open related scenarios (optional)
          </button>
          <button
            type="button"
            disabled={speakResponse.trim().length === 0 && !speakCompleted}
            onClick={() => {
              setSpeakCompleted(true)
              void finishLesson()
            }}
            className="mt-3 w-full rounded-lg bg-indigo-600 px-4 py-3 font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Mark lesson complete
          </button>
        </div>
      </LessonShell>
    )
  }

  if (currentStep.kind === 'teach') {
    const item = currentStep.items[teachIndex]
    const totalTeachItems = plan.reduce((sum, s) => sum + (s.kind === 'teach' ? s.items.length : 0), 0)
    const itemsBefore = plan.slice(0, stepIndex).reduce((sum, s) => sum + (s.kind === 'teach' ? s.items.length : 0), 0)
    const globalItemIndex = itemsBefore + teachIndex + 1
    const progress = totalTeachItems > 0 ? (globalItemIndex / totalTeachItems) * 100 : 0
    const nextStep = plan[stepIndex + 1]
    const isLastTeachItem = teachIndex + 1 >= currentStep.items.length
    const nextTeachLabel = !isLastTeachItem
      ? 'Next Item'
      : nextStep?.kind === 'checkpoint'
        ? 'Start Checkpoint'
        : nextStep?.kind === 'final'
          ? 'Start Mixed Review'
          : nextStep?.kind === 'workbook'
            ? 'Start Workbook Practice'
            : nextStep?.kind === 'cards'
              ? 'Continue to Cards'
              : nextStep?.kind === 'speak'
                ? 'Continue to Speak'
                : 'Continue'

    return (
      <LessonShell
        {...shellProps}
        stepTitle={currentStep.title}
        goal={currentStep.goal}
        progress={progress}
        progressLabel={`Item ${globalItemIndex} of ${totalTeachItems} (${item?.type === 'grammar' ? 'Grammar' : 'Vocab'})`}
      >
        {item ? (
          <TeachCard
            key={item.id}
            item={item}
            index={teachIndex}
            total={currentStep.items.length}
            revealed={isTeachRevealed}
            onReveal={() => setIsTeachRevealed(true)}
            onRate={rating => rateTeachItem(item, rating)}
            currentRating={selfAssessments.find(record => record.itemId === item.id)?.rating}
          />
        ) : <EmptyLessonCard />}
        <div className="mt-6 flex gap-3">
          <button
            onClick={() => {
              setTeachIndex(previous => Math.max(0, previous - 1))
              setIsTeachRevealed(false)
            }}
            disabled={teachIndex === 0}
            className="flex-1 rounded-lg border border-gray-200 px-4 py-3 font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-30"
          >
            Previous Item
          </button>
          <button
            onClick={() => {
              if (isLastTeachItem) moveToStep(stepIndex + 1)
              else {
                setTeachIndex(previous => previous + 1)
                setIsTeachRevealed(false)
              }
            }}
            disabled={Boolean(item) && (!isTeachRevealed || !selfAssessments.some(record => record.itemId === item.id))}
            className="flex-1 rounded-lg bg-indigo-600 px-4 py-3 font-semibold text-white hover:bg-indigo-700"
          >
            {nextTeachLabel}
          </button>
        </div>
      </LessonShell>
    )
  }

  if (currentStep.kind === 'workbook') {
    const completedCount = currentStep.tasks.filter(task => workbookResponses[task.id]?.completed).length
    return (
      <LessonShell
        {...shellProps}
        stepTitle={currentStep.title}
        goal={currentStep.goal}
        progress={70}
        progressLabel={`${completedCount} of ${currentStep.tasks.length} workbook tasks`}
      >
        <div className="rounded-xl bg-white p-5 shadow-lg sm:p-8">
          <div className="mb-5">
            <p className="text-sm font-semibold text-emerald-700">Output practice</p>
            <h2 className="mt-1 text-xl font-bold text-gray-900">Use the workbook material now</h2>
            <p className="mt-2 text-sm text-gray-600">
              Write or say an answer, then mark the task done. These are production tasks, so rough output is better than silent recognition.
            </p>
          </div>

          <div className="space-y-4">
            {currentStep.tasks.map((task, index) => {
              const response = workbookResponses[task.id] ?? { response: '', completed: false }
              return (
                <div key={task.id} className="rounded-lg border border-emerald-100 bg-emerald-50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="rounded bg-white px-2 py-0.5 font-semibold uppercase tracking-wide text-emerald-800">
                        {index + 1}. {task.practiceMode}
                      </span>
                      <span className="rounded bg-white px-2 py-0.5 text-emerald-800">{task.focus}</span>
                    </div>
                    <span className="text-xs font-medium text-emerald-800">
                      {task.source} {task.page > 0 ? `p. ${task.page}` : ''}
                    </span>
                  </div>
                  <p className="mt-3 font-semibold text-gray-900">{task.prompt}</p>
                  <p className="mt-1 text-sm text-emerald-900">{task.support}</p>
                  <textarea
                    value={response.response}
                    onChange={event => {
                      const value = event.target.value
                      setWorkbookResponses(previous => ({
                        ...previous,
                        [task.id]: { response: value, completed: previous[task.id]?.completed ?? false },
                      }))
                    }}
                    placeholder="Write your answer, roleplay line, correction, or checkpoint response..."
                    className="mt-3 min-h-20 w-full resize-y rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  />
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs text-emerald-800">
                      {task.type === 'correction_target'
                        ? 'Name the error after correcting it.'
                        : task.type === 'roleplay'
                          ? 'Add one follow-up line if you can.'
                          : 'One clean sentence is enough.'}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setWorkbookResponses(previous => ({
                          ...previous,
                          [task.id]: { response: previous[task.id]?.response ?? '', completed: !response.completed },
                        }))
                      }}
                      className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                        response.completed
                          ? 'bg-green-600 text-white hover:bg-green-700'
                          : 'bg-white text-emerald-800 ring-1 ring-emerald-200 hover:bg-emerald-100'
                      }`}
                    >
                      {response.completed ? 'Done' : 'Mark Done'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          <button
            onClick={() => moveToStep(stepIndex + 1)}
            disabled={completedCount === 0}
            className="mt-5 w-full rounded-lg bg-indigo-600 px-4 py-3 font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Continue to Cards
          </button>
        </div>
      </LessonShell>
    )
  }

  if (currentStep.kind !== 'checkpoint' && currentStep.kind !== 'final') {
    return (
      <LessonShell
        {...shellProps}
        stepTitle="Lesson"
        goal="Unexpected step — continue or exit to reference."
        progress={0}
      >
        <div className="rounded-xl bg-white p-8 text-center shadow-lg">
          <button onClick={() => moveToStep(stepIndex + 1)} className="rounded-lg bg-indigo-600 px-4 py-3 font-semibold text-white hover:bg-indigo-700">
            Continue
          </button>
        </div>
      </LessonShell>
    )
  }

  const questions = currentStep.questions
  const question = questions[questionIndex]
  if (!question) {
    return (
      <LessonShell
        {...shellProps}
        stepTitle={currentStep.title}
        goal="This checkpoint has no available recall questions."
        progress={100}
      >
        <div className="rounded-xl bg-white p-8 text-center shadow-lg">
          <p className="text-gray-600">No recall questions are available for this set.</p>
          <button onClick={() => moveToStep(stepIndex + 1)} className="mt-5 rounded-lg bg-indigo-600 px-4 py-3 font-semibold text-white hover:bg-indigo-700">
            Continue
          </button>
        </div>
      </LessonShell>
    )
  }

  const hasAnswered = selectedAnswer !== null
  const isCorrect = selectedAnswer === question.correctAnswer
  const progress = plan.length > 0 ? ((stepIndex + 1) / plan.length) * 100 : 0

  return (
    <LessonShell
      {...shellProps}
      stepTitle={currentStep.title}
      goal={currentStep.goal}
      progress={progress}
      progressLabel={`${questionIndex + 1}/${questions.length}`}
    >
      <div className="rounded-xl bg-white p-8 shadow-lg">
        <div className="text-center">
          <p className="text-sm text-gray-500">{question.promptLabel}</p>
          <p className="mt-2 text-3xl font-bold text-gray-900" lang="ja">{question.prompt}</p>
          <p className="mt-2 text-xs text-gray-400">{questionIndex + 1}/{questions.length}</p>
        </div>

        <div className="mt-6 space-y-3">
          {question.options.map((option, index) => {
            const tone = !hasAnswered
              ? 'border-gray-200 text-gray-900 hover:border-indigo-400 hover:bg-indigo-50'
              : option === question.correctAnswer
                ? 'border-green-500 bg-green-50 text-green-800'
                : option === selectedAnswer
                  ? 'border-red-500 bg-red-50 text-red-800'
                  : 'border-gray-200 text-gray-500 opacity-50'

            return (
              <button
                key={`${option}-${index}`}
                onClick={() => answerQuestion(question, option)}
                disabled={hasAnswered}
                className={`w-full rounded-lg border-2 px-4 py-3 text-left font-medium transition-colors ${tone}`}
              >
                <span className="mr-2 text-xs text-gray-500">{index + 1}.</span>
                {option}
              </button>
            )
          })}
        </div>

        {hasAnswered && (
          <div className={`mt-5 rounded-lg p-4 text-center ${isCorrect ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
            <p className="font-bold">{isCorrect ? 'Correct' : 'Not quite'}</p>
            {!isCorrect && <p className="mt-1 text-sm">Answer: {question.correctAnswer}</p>}
          </div>
        )}

        {hasAnswered && (
          <button onClick={() => continueQuiz(questions)} className="mt-5 w-full rounded-lg bg-indigo-600 px-4 py-3 font-semibold text-white hover:bg-indigo-700">
            {questionIndex + 1 >= questions.length ? 'Continue' : 'Next Question'}
          </button>
        )}
      </div>
    </LessonShell>
  )
}

function LessonShell({
  lessonTitle,
  stepTitle,
  goal,
  progress,
  progressLabel,
  activeRail,
  onExit,
  children,
}: {
  lessonTitle: string
  stepTitle: string
  goal: string
  progress: number
  progressLabel?: string
  activeRail: LessonRailPhase
  referencePath?: string
  onExit: () => void
  children: ReactNode
}) {
  const railIndex = LESSON_RAIL_PHASES.findIndex(phase => phase.id === activeRail)

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <div className="border-b border-gray-200 bg-white px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-xl items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-indigo-600">{stepTitle}</p>
            <h1 className="text-lg font-bold text-gray-900">{lessonTitle}</h1>
            <p className="mt-1 text-sm text-gray-500">{goal}</p>
          </div>
          <button
            type="button"
            onClick={onExit}
            className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <FileText className="h-4 w-4" aria-hidden="true" />
            Reference
          </button>
        </div>
        <nav aria-label="Lesson progress" className="mx-auto mt-4 max-w-xl">
          <ol className="flex items-center gap-1">
            {LESSON_RAIL_PHASES.map((phase, index) => {
              const done = index < railIndex
              const current = index === railIndex
              return (
                <li key={phase.id} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                  <div
                    className={`h-1.5 w-full rounded-full ${
                      done || current ? 'bg-indigo-500' : 'bg-gray-200'
                    }`}
                    aria-hidden
                  />
                  <span
                    className={`truncate text-[10px] font-semibold uppercase tracking-wide sm:text-xs ${
                      current ? 'text-indigo-700' : done ? 'text-indigo-500' : 'text-gray-400'
                    }`}
                  >
                    {phase.label}
                  </span>
                </li>
              )
            })}
          </ol>
        </nav>
      </div>
      <div className="relative h-1 w-full bg-gray-200">
        <div className="h-1 bg-indigo-400 transition-all" style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} />
        {progressLabel && (
          <p className="absolute right-2 top-2 text-xs text-gray-400">{progressLabel}</p>
        )}
      </div>
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-xl">{children}</div>
      </div>
    </div>
  )
}

function TeachCard({
  item,
  index,
  total,
  revealed,
  currentRating,
  onReveal,
  onRate,
}: {
  item: TeachItem
  index: number
  total: number
  revealed: boolean
  currentRating?: SelfAssessment['rating']
  onReveal: () => void
  onRate: (rating: SelfAssessment['rating']) => void
}) {
  const isVocab = item.type === 'vocab'
  const [showMaynard, setShowMaynard] = useState(false)
  return (
    <div className="overflow-hidden rounded-xl bg-white shadow-lg">
      <div className={`flex items-center justify-between px-6 py-3 ${isVocab ? 'bg-blue-50' : 'bg-purple-50'}`}>
        <span className={`text-xs font-bold uppercase tracking-wider ${isVocab ? 'text-blue-700' : 'text-purple-700'}`}>
          {isVocab ? 'Vocabulary' : 'Grammar'}
        </span>
        <span className={`text-xs ${isVocab ? 'text-blue-600' : 'text-purple-600'}`}>{index + 1}/{total}</span>
      </div>
      <div className="space-y-5 p-8">
        <div className="text-center">
          <div className={`${isVocab ? 'text-5xl' : 'text-3xl'} font-bold text-gray-900`} lang="ja">{item.title}</div>
          {isVocab && (
            <div className="mt-3 flex justify-center">
              <AddToDeckButton front={item.title} back={item.body} lessonId={item.lessonId} originRef={item.id} />
            </div>
          )}
        </div>

        <div className="rounded-lg border border-indigo-100 bg-indigo-50 p-4 text-sm text-indigo-950">
          <div className="font-semibold">Step 1: Predict</div>
          <p className="mt-1">
            {isVocab
              ? 'Before revealing the meaning, say the word out loud and make your best guess. Look for kanji, kana shape, or anything familiar.'
              : 'Before revealing the use, identify the fixed part of the pattern and imagine what kind of sentence it might create.'}
          </p>
        </div>

        {!revealed ? (
          <button onClick={onReveal} className="w-full rounded-lg bg-indigo-600 px-4 py-3 font-semibold text-white hover:bg-indigo-700">
            Reveal Teaching
          </button>
        ) : (
          <>
            <div className="rounded-xl bg-gray-50 p-4">
              <div className="mb-1 text-xs uppercase tracking-wider text-gray-500">{isVocab ? 'Step 2: Meaning' : 'Step 2: Function'}</div>
              <div className="text-lg font-semibold leading-relaxed text-gray-900">{item.body}</div>
            </div>

            {!isVocab && (
              <div className="rounded-xl border border-purple-100 bg-purple-50/50 p-4 text-sm text-gray-800">
                <div className="mb-2 text-xs font-bold uppercase tracking-wider text-purple-700">Grammar Explanation Engine</div>
                <div className="space-y-3">
                  <ExplanationRow label="Basic explanation" value={item.explanationPlan.basicExplanation} />
                  {item.explanationPlan.contrastWithNearbyGrammar && (
                    <ExplanationRow label="Contrast" value={item.explanationPlan.contrastWithNearbyGrammar} />
                  )}
                  <ExplanationRow label="Common mistake" value={item.explanationPlan.commonMistake} />
                  <ExplanationRow label="Example pattern" value={item.explanationPlan.examplePattern} lang="ja" />
                </div>
                {item.examples && item.examples.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {item.examples.slice(0, 3).map((ex, i) => (
                      <div key={i} className="rounded-lg bg-white/80 p-2">
                        <div className="font-medium text-gray-900" lang="ja">{ex.japanese}</div>
                        {ex.reading && <div className="text-xs text-gray-500">{ex.reading}</div>}
                        <div className="text-sm text-gray-600">{ex.english}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {!isVocab && item.explanationPlan.maynardDeepExplanation && (
              <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-950">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-indigo-700">Maynard Available</div>
                    <div className="font-semibold text-indigo-950">{item.explanationPlan.maynardTitle}</div>
                    {item.maynardRef && (
                      <div className="mt-1 text-xs font-semibold text-indigo-800">{formatMaynardSource(item.maynardRef)}</div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowMaynard(value => !value)}
                    className="rounded-lg border border-indigo-300 bg-white px-3 py-2 text-xs font-semibold text-indigo-800 hover:bg-indigo-100"
                  >
                    {showMaynard ? 'Hide Deep Explanation' : 'Show Deep Explanation'}
                  </button>
                </div>
                {showMaynard && (
                  <div className="mt-3">
                    <p className="leading-relaxed">
                      {item.explanationPlan.maynardDeepExplanation}
                    </p>
                    {item.maynardRef && item.maynardRef.examples.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {item.maynardRef.examples.slice(0, 2).map((example, i) => (
                          <div key={i} className="rounded-lg bg-white/80 p-2">
                            <div className="font-medium text-gray-900" lang="ja">{example.japanese}</div>
                            {example.english && <div className="text-sm text-gray-600">{example.english}</div>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="rounded-lg border border-gray-200 p-4 text-sm text-gray-700">
              <div className="font-semibold text-gray-900">Step 3: Build The Hook</div>
              <p className="mt-1">
                {isVocab
                  ? `Connect "${item.title}" to one concrete image or situation. Then say: "${item.title} means ${item.body}."`
                  : `Use the pattern as a sentence tool: ${item.title} = ${item.body}. Think of one tiny example where you would need this.`}
              </p>
            </div>

            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
              <div className="font-semibold">Step 4: Micro Practice</div>
              <p className="mt-1">
                {isVocab
                  ? `Cover the meaning and answer: what does ${item.title} mean?`
                  : `Cover the meaning and answer: what job does ${item.title} do in a sentence?`}
              </p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <button
                  onClick={() => onRate('again')}
                  className={`rounded-lg border px-3 py-2 font-semibold ${currentRating === 'again' ? 'border-amber-500 bg-amber-100 text-amber-900' : 'border-white bg-white text-gray-700 hover:bg-amber-50'}`}
                >
                  Need Review
                </button>
                <button
                  onClick={() => onRate('good')}
                  className={`rounded-lg border px-3 py-2 font-semibold ${currentRating === 'good' ? 'border-emerald-500 bg-emerald-100 text-emerald-900' : 'border-white bg-white text-gray-700 hover:bg-emerald-50'}`}
                >
                  I Can Explain It
                </button>
              </div>
            </div>
          </>
        )}

        {!revealed && (
          <div className="rounded-lg border border-gray-200 p-4 text-sm text-gray-500">
            The next button unlocks after you reveal the teaching steps.
          </div>
        )}

        {revealed && !currentRating && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Pick a self-check rating before moving on, even if it is a rough guess.
          </div>
        )}

        {revealed && currentRating && (
          <div className="rounded-lg border border-gray-200 p-4 text-sm text-gray-600">
            {currentRating === 'again'
              ? 'This will be listed as a weak point at the end so you can give it another pass.'
              : 'Good. The checkpoint will test whether that confidence survives recall.'}
          </div>
        )}
        {item.source && (
          <div className="text-center text-xs text-gray-500">
            Source: {item.source.replace(/_/g, ' ')} {item.page && item.page > 0 ? `· p. ${item.page}` : '· extracted content'}
          </div>
        )}
      </div>
    </div>
  )
}

function formatMaynardSource(ref: MaynardRef) {
  if (ref.sourceKind === 'curated-support') return 'Curated bridge'
  if (ref.pageStart && ref.pageEnd && ref.pageStart !== ref.pageEnd) return `Maynard pp. ${ref.pageStart}-${ref.pageEnd}`
  if (ref.pageStart) return `Maynard p. ${ref.pageStart}`
  return ref.sourceKind === 'direct' ? 'Maynard source reference' : 'Maynard support'
}

function ExplanationRow({ label, value, lang }: { label: string; value: string; lang?: string }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-purple-700">{label}</div>
      <div className="mt-1 leading-relaxed text-gray-800" lang={lang}>{value}</div>
    </div>
  )
}

function EmptyLessonCard() {
  return (
    <div className="rounded-xl bg-white p-8 text-center shadow-lg">
      <h1 className="text-xl font-bold text-gray-900">No lesson items yet</h1>
      <p className="mt-2 text-gray-600">This lesson needs vocabulary or grammar content before the teaching flow can run.</p>
    </div>
  )
}

function SummaryStat({ label, value, tone }: { label: string; value: string; tone: 'blue' | 'purple' | 'green' | 'emerald' }) {
  const classes = {
    blue: 'bg-blue-50 text-blue-700',
    purple: 'bg-purple-50 text-purple-700',
    green: 'bg-green-50 text-green-700',
    emerald: 'bg-emerald-50 text-emerald-700',
  }
  return (
    <div className={`rounded-lg p-3 ${classes[tone]}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs font-medium">{label}</div>
    </div>
  )
}
