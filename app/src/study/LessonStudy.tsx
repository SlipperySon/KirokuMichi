import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { FileText, ListChecks, LogOut } from 'lucide-react'
import { useAppStore } from '../store'
import { buildLessonPlan, type LessonStudyState, type QuizQuestion, type TeachItem } from './lessonStudyPlanner'

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
  const { state: routeState } = useLocation() as { state?: LessonStudyState }
  const markComplete = useAppStore(s => s.markLessonComplete)
  const state = useMemo<LessonStudyState>(() => routeState ?? {
    vocab: [],
    grammar: [],
    lessonId: '',
    lessonTitle: 'Lesson',
    cefrLevel: 'a1',
  }, [routeState])
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
  const [showSummary, setShowSummary] = useState(false)

  const currentStep = plan[stepIndex]
  const totalQuestions = answers.length
  const correctAnswers = answers.filter(answer => answer.isCorrect).length
  const percentage = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 100
  const missedAnswers = answers.filter(answer => !answer.isCorrect)
  const selfMarkedAgain = selfAssessments.filter(item => item.rating === 'again')
  const completedWorkbookTasks = Object.values(workbookResponses).filter(response => response.completed).length
  const lessonNumber = state.lessonId.split('_').pop() ?? '1'
  const lessonPagePath = `/learn/lessons/${state.cefrLevel}/${lessonNumber}`

  if (!routeState) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
        <button onClick={() => navigate('/learn/lessons')} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-3 font-semibold text-white hover:bg-indigo-700">
          <ListChecks className="h-5 w-5" aria-hidden="true" />
          Return to Lesson Menu
        </button>
      </div>
    )
  }

  function moveToStep(nextStepIndex: number) {
    if (nextStepIndex >= plan.length) {
      setShowSummary(true)
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
    setAnswers(previous => [
      ...previous,
      {
        itemId: question.itemId,
        prompt: question.prompt,
        correctAnswer: question.correctAnswer,
        selectedAnswer: answer,
        isCorrect: answer === question.correctAnswer,
      },
    ])
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
    setStepIndex(0)
    setTeachIndex(0)
    setQuestionIndex(0)
    setSelectedAnswer(null)
    setIsTeachRevealed(false)
    setAnswers([])
    setSelfAssessments([])
    setWorkbookResponses({})
    setShowSummary(false)
  }

  function rateTeachItem(item: TeachItem, rating: SelfAssessment['rating']) {
    setSelfAssessments(previous => [
      ...previous.filter(record => record.itemId !== item.id),
      { itemId: item.id, title: item.title, body: item.body, type: item.type, rating },
    ])
  }

  if (showSummary) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
        <div className="w-full max-w-xl rounded-xl bg-white p-8 shadow-lg">
          <p className="text-sm font-semibold text-indigo-600">Lesson complete</p>
          <h1 className="mt-2 text-2xl font-bold text-gray-900">{state.lessonTitle}</h1>
          <p className="mt-2 text-gray-600">
            {totalQuestions > 0
              ? `${correctAnswers}/${totalQuestions} recall checks correct (${percentage}%).`
              : 'You reviewed the lesson material.'}
          </p>

          <div className="mt-6 grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
            <SummaryStat label="Vocab" value={state.vocab.length.toString()} tone="blue" />
            <SummaryStat label="Grammar" value={state.grammar.length.toString()} tone="purple" />
            <SummaryStat label="Recall" value={totalQuestions > 0 ? `${percentage}%` : 'Done'} tone="green" />
            <SummaryStat label="Workbook" value={state.workbookPractice?.length ? `${completedWorkbookTasks}/${state.workbookPractice.length}` : '0'} tone="emerald" />
          </div>

          {state.workbookPractice && state.workbookPractice.length > 0 && (
            <div className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
              <h2 className="font-semibold text-emerald-950">Workbook output practice</h2>
              <div className="mt-3 space-y-2">
                {state.workbookPractice.slice(0, 5).map(task => {
                  const response = workbookResponses[task.id]
                  return (
                  <div key={task.id} className="rounded bg-white px-3 py-2 text-sm">
                    <div className="mb-1 flex flex-wrap gap-2 text-xs">
                      <span className="rounded bg-emerald-50 px-2 py-0.5 font-semibold uppercase tracking-wide text-emerald-800">{task.practiceMode}</span>
                      <span className="rounded bg-emerald-50 px-2 py-0.5 text-emerald-800">{task.focus}</span>
                      {response?.completed && (
                        <span className="rounded bg-green-50 px-2 py-0.5 font-semibold text-green-700">done</span>
                      )}
                    </div>
                    <div className="font-medium text-gray-900">{task.prompt}</div>
                    {response?.response && (
                      <div className="mt-1 rounded bg-gray-50 px-2 py-1 text-gray-700">
                        Your output: {response.response}
                      </div>
                    )}
                    {task.sourcePrompt && (
                      <div className="text-xs text-emerald-800">Source cue: {task.sourcePrompt}</div>
                    )}
                    <div className="text-gray-600">{task.support}</div>
                  </div>
                  )
                })}
              </div>
            </div>
          )}

          {missedAnswers.length > 0 && (
            <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
              <h2 className="font-semibold text-amber-900">Weak points to review</h2>
              <div className="mt-3 space-y-2">
                {missedAnswers.slice(0, 5).map((answer, index) => (
                  <div key={`${answer.itemId}-${index}`} className="rounded bg-white px-3 py-2 text-sm">
                    <div className="font-medium text-gray-900">{answer.prompt}</div>
                    <div className="text-gray-600">Answer: {answer.correctAnswer}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {selfMarkedAgain.length > 0 && (
            <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
              <h2 className="font-semibold text-blue-900">Marked for another pass</h2>
              <div className="mt-3 space-y-2">
                {selfMarkedAgain.slice(0, 5).map(item => (
                  <div key={item.itemId} className="rounded bg-white px-3 py-2 text-sm">
                    <div className="font-medium text-gray-900" lang={item.type === 'vocab' ? 'ja' : undefined}>{item.title}</div>
                    <div className="text-gray-600">{item.body}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6 flex flex-col gap-3">
            {/* Drill weak points — immediate reinforcement */}
            {(missedAnswers.length > 0 || selfMarkedAgain.length > 0) && (
              <button
                onClick={() => {
                  const weakIds = new Set([
                    ...missedAnswers.map(a => a.itemId),
                    ...selfMarkedAgain.map(a => a.itemId),
                  ])
                  const weakVocab = state.vocab.filter(v => weakIds.has(`vocab:${v.id}`))
                  const weakGrammar = state.grammar.filter(g => weakIds.has(`grammar:${g.id}`))
                  navigate('/learn/study', {
                    state: {
                      vocab: weakVocab,
                      grammar: weakGrammar,
                      lessonId: `${state.lessonId}_drill`,
                      lessonTitle: `${state.lessonTitle} — Weak Points`,
                      cefrLevel: state.cefrLevel,
                    },
                    replace: true,
                  })
                  restartLesson()
                }}
                className="rounded-lg bg-amber-500 px-4 py-3 font-semibold text-white hover:bg-amber-600"
              >
                Drill {missedAnswers.length + selfMarkedAgain.length} Weak Points Now
              </button>
            )}
            <button
              onClick={() => {
                markComplete(state.lessonId)
                navigate(lessonPagePath)
              }}
              className="rounded-lg bg-green-600 px-4 py-3 font-semibold text-white hover:bg-green-700"
            >
              Mark Complete and Return to Lesson Page
            </button>
            <button onClick={restartLesson} className="rounded-lg border border-gray-200 px-4 py-3 font-semibold text-gray-700 hover:bg-gray-50">
              Study Again
            </button>
            <button onClick={() => navigate(lessonPagePath)} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50">
              <FileText className="h-4 w-4" aria-hidden="true" />
              Return to Lesson Page
            </button>
          </div>
        </div>
      </div>
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
          : 'Finish Lesson'

    return (
      <LessonShell
        lessonTitle={state.lessonTitle}
        stepTitle={currentStep.title}
        goal={currentStep.goal}
        progress={progress}
        progressLabel={`Item ${globalItemIndex} of ${totalTeachItems} (${item?.type === 'grammar' ? 'Grammar' : 'Vocab'})`}
        onExit={() => navigate(lessonPagePath)}
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
        lessonTitle={state.lessonTitle}
        stepTitle={currentStep.title}
        goal={currentStep.goal}
        progress={95}
        progressLabel={`${completedCount} of ${currentStep.tasks.length} workbook tasks`}
        onExit={() => navigate(lessonPagePath)}
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
                  {task.sourcePrompt && (
                    <details className="mt-2 text-xs text-emerald-800">
                      <summary className="cursor-pointer font-semibold">Source cue</summary>
                      <p className="mt-1">{task.sourcePrompt}</p>
                    </details>
                  )}
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
            Finish Lesson
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
        lessonTitle={state.lessonTitle}
        stepTitle={currentStep.title}
        goal="This checkpoint has no available recall questions."
        progress={100}
        onExit={() => navigate(lessonPagePath)}
      >
        <div className="rounded-xl bg-white p-8 text-center shadow-lg">
          <p className="text-gray-600">No recall questions were generated for this set.</p>
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
      lessonTitle={state.lessonTitle}
      stepTitle={currentStep.title}
      goal={currentStep.goal}
      progress={progress}
      onExit={() => navigate(lessonPagePath)}
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
  onExit,
  children,
}: {
  lessonTitle: string
  stepTitle: string
  goal: string
  progress: number
  progressLabel?: string
  onExit: () => void
  children: ReactNode
}) {
  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <div className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-xl items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-indigo-600">{stepTitle}</p>
            <h1 className="text-lg font-bold text-gray-900">{lessonTitle}</h1>
            <p className="mt-1 text-sm text-gray-500">{goal}</p>
          </div>
          <button onClick={onExit} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50">
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Exit to Lesson Page
          </button>
        </div>
      </div>
      <div className="relative h-1.5 w-full bg-gray-200">
        <div className="h-1.5 bg-indigo-500 transition-all" style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} />
        {progressLabel && (
          <p className="absolute right-2 top-2.5 text-xs text-gray-400">{progressLabel}</p>
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
            Source: {item.source.replace(/_/g, ' ')} {item.page && item.page > 0 ? `· p. ${item.page}` : '· generated foundation'}
          </div>
        )}
      </div>
    </div>
  )
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
