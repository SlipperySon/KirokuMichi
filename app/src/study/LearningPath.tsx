import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore, type LearningPath as LearningPathData, type LearningPathWeek, type AssignedLesson } from '../store'
import { SQLiteStorage } from '../db/sqlite'
import { FSRSScheduler, SM2Scheduler } from '../core/scheduler'
import { SRSService } from '../srs/srsService'
import { ClientAIProvider } from '../ai/aiProvider'
import { Navigation } from '../components/Navigation'
import { toast } from '../components/toastStore'
import { assignLessonsToWeeks } from './lessonSequencer'
import { lessonRouteFromId } from './studyPathPlanner'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WEEK_COLORS = [
  { bg: 'bg-white', border: 'border-indigo-300', badge: 'bg-indigo-600 text-white', milestone: 'text-indigo-700' },
  { bg: 'bg-white', border: 'border-blue-300', badge: 'bg-blue-600 text-white', milestone: 'text-blue-700' },
  { bg: 'bg-white', border: 'border-violet-300', badge: 'bg-violet-600 text-white', milestone: 'text-violet-700' },
  { bg: 'bg-white', border: 'border-emerald-300', badge: 'bg-emerald-600 text-white', milestone: 'text-emerald-700' },
]

const JLPT_TO_CEFR: Record<string, CefrLevel> = {
  N5: 'A1', N4: 'A2', N3: 'B1', N2: 'B2', N1: 'C1',
}

type CefrLevel = 'Beginner' | 'A1' | 'A2' | 'B1' | 'B2' | 'C1'

const CEFR_LEVELS: CefrLevel[] = ['Beginner', 'A1', 'A2', 'B1', 'B2', 'C1']
const CEFR_GOAL_LEVELS: CefrLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1']

const LEVEL_LABELS: Record<CefrLevel, string> = {
  Beginner: 'Complete beginner',
  A1: 'A1 — Survival phrases',
  A2: 'A2 — Everyday conversation',
  B1: 'B1 — Independent speaker',
  B2: 'B2 — Advanced user',
  C1: 'C1 — Proficient user',
}

// Months needed to advance one stage at 30 min/day baseline
const STAGE_MONTHS_AT_BASELINE: Record<string, number> = {
  'Beginner→A1': 2.5,
  'A1→A2': 4,
  'A2→B1': 7,
  'B1→B2': 11,
  'B2→C1': 16,
}

const STAGE_ORDER: CefrLevel[] = ['Beginner', 'A1', 'A2', 'B1', 'B2', 'C1']

// ---------------------------------------------------------------------------
// Time / realism helpers
// ---------------------------------------------------------------------------

function estimateMonths(from: CefrLevel, to: CefrLevel, dailyMinutes: number): number | null {
  const fromIdx = STAGE_ORDER.indexOf(from)
  const toIdx = STAGE_ORDER.indexOf(to)
  if (toIdx <= fromIdx) return null

  let totalMonths = 0
  for (let i = fromIdx; i < toIdx; i++) {
    const key = `${STAGE_ORDER[i]}→${STAGE_ORDER[i + 1]}`
    totalMonths += (STAGE_MONTHS_AT_BASELINE[key] ?? 8) * (30 / dailyMinutes)
  }
  return Math.round(totalMonths)
}

function formatTimeEstimate(months: number | null): string {
  if (months === null) return '—'
  if (months < 1) return 'less than a month'
  if (months === 1) return '~1 month'
  if (months < 12) return `~${months} months`
  const years = Math.floor(months / 12)
  const rem = months % 12
  if (rem === 0) return `~${years} year${years > 1 ? 's' : ''}`
  return `~${years}y ${rem}m`
}

type Realism = 'very-achievable' | 'achievable' | 'challenging' | 'ambitious' | 'unrealistic'

interface RealismRating {
  label: string
  description: string
  color: string
  barColor: string
  score: number // 1-5 (5 = very achievable)
}

function getRealismRating(
  from: CefrLevel,
  to: CefrLevel,
  dailyMinutes: number,
  matureCards: number,
  retention: number,
): RealismRating {
  const fromIdx = STAGE_ORDER.indexOf(from)
  const toIdx = STAGE_ORDER.indexOf(to)
  const gap = toIdx - fromIdx

  // Baseline score from gap + daily minutes
  let score = 5
  if (gap === 0) score = 5
  else if (gap === 1) score = dailyMinutes >= 30 ? 4 : 3
  else if (gap === 2) score = dailyMinutes >= 45 ? 3 : 2
  else if (gap === 3) score = dailyMinutes >= 60 ? 2 : 1
  else score = 1

  // Bump up if user already has solid foundation
  if (matureCards >= 300 && retention >= 80) score = Math.min(5, score + 1)
  // Nudge down if very low commitment
  if (dailyMinutes < 15) score = Math.max(1, score - 1)

  const ratings: Record<number, RealismRating> = {
    5: { label: 'Very achievable', description: 'Solid pace for your target — keep it up.', color: 'text-emerald-700', barColor: 'bg-emerald-500', score: 5 },
    4: { label: 'Achievable', description: 'Realistic with consistent daily practice.', color: 'text-blue-700', barColor: 'bg-blue-500', score: 4 },
    3: { label: 'Challenging', description: 'Possible but will require real discipline.', color: 'text-indigo-700', barColor: 'bg-indigo-500', score: 3 },
    2: { label: 'Ambitious', description: 'A big ask — consider a closer interim goal.', color: 'text-amber-700', barColor: 'bg-amber-500', score: 2 },
    1: { label: 'Unrealistic', description: 'Too large a gap for the time available. Set a step-by-step target instead.', color: 'text-red-700', barColor: 'bg-red-500', score: 1 },
  }
  return ratings[score]
}

// ---------------------------------------------------------------------------
// CEFR stage gate (auto-detection from progress)
// ---------------------------------------------------------------------------

interface CefrStageGate {
  currentStage: 'A1' | 'A2' | 'B1' | 'B2'
  targetStage: 'A1' | 'A2' | 'B1' | 'B2' | 'C1'
  guidance: string
  nextUnlock: string
}

const STAGE_SEQUENCE = ['A1', 'A2', 'B1', 'B2'] as const

function inferCefrStageGate(
  lessonsCompleted: string[],
  jlptTarget: string,
  totalCards: number,
  matureCards: number,
  averageRetention: number
): CefrStageGate {
  const completed = new Set(lessonsCompleted)
  const completedA1 = lessonsCompleted.filter(id => id.startsWith('genki_1_') || id.startsWith('marugoto_a1_')).length
  const completedA2 = lessonsCompleted.filter(id => id.startsWith('genki_2_') || id.startsWith('marugoto_a2_')).length
  const completedB1 = lessonsCompleted.filter(id => id.startsWith('quartet_1_') || id.startsWith('marugoto_b1_')).length
  const completedB2 = lessonsCompleted.filter(id => id.startsWith('quartet_2_') || id.startsWith('tobira_')).length

  let currentStage: CefrStageGate['currentStage'] = 'A1'
  if (completedB2 >= 2 || (matureCards >= 900 && averageRetention >= 80)) currentStage = 'B2'
  else if (completedB1 >= 2 || (matureCards >= 550 && averageRetention >= 78)) currentStage = 'B1'
  else if (completedA2 >= 2 || completed.has('genki_1_12') || (matureCards >= 250 && averageRetention >= 75)) currentStage = 'A2'
  else if (completedA1 >= 2 || totalCards >= 80) currentStage = 'A1'

  const targetStage = (JLPT_TO_CEFR[jlptTarget] ?? 'A1') as CefrStageGate['targetStage']
  const stageIndex = STAGE_SEQUENCE.indexOf(currentStage)
  const nextStage = STAGE_SEQUENCE[Math.min(stageIndex + 1, STAGE_SEQUENCE.length - 1)]

  const guidanceByStage: Record<CefrStageGate['currentStage'], string> = {
    A1: 'Secure survival phrases, core particles, kana confidence, and simple sentence output before expanding volume.',
    A2: 'Build everyday narration, comparisons, requests, giving/receiving, and controlled roleplay output.',
    B1: 'Prioritise opinion structure, reasons, concessions, and paragraph-length answers with targeted review.',
    B2: 'Focus on nuance, evidence-based explanation, formal register, and longer synthesis tasks.',
  }

  return {
    currentStage,
    targetStage,
    guidance: guidanceByStage[currentStage],
    nextUnlock: currentStage === 'B2'
      ? 'Maintain B2 depth with Tobira/Quartet output tasks; post-B2 expansion is tracked externally.'
      : `Unlock ${nextStage} once current lessons are stable and review retention stays above 75%.`,
  }
}

// ---------------------------------------------------------------------------
// WeekCard
// ---------------------------------------------------------------------------

function WeekCard({
  week,
  index,
  onStartLesson,
}: {
  week: LearningPathWeek
  index: number
  onStartLesson?: (lessonId: string) => void
}) {
  const colors = WEEK_COLORS[index % WEEK_COLORS.length]
  return (
    <div className={`flex-shrink-0 w-64 rounded-2xl border ${colors.border} ${colors.bg} p-5 flex flex-col gap-3`}>
      <div className="flex items-center justify-between">
        <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${colors.badge}`}>
          Week {week.week}
        </span>
        <span className="text-xs text-gray-500 font-medium">{week.dailyGoal} cards/day</span>
      </div>
      <div>
        <p className="font-bold text-gray-900 text-sm leading-tight">{week.focus}</p>
      </div>
      <ul className="space-y-1.5 flex-1">
        {week.activities.map((activity, i) => (
          <li key={i} className="text-xs text-gray-800 flex items-start gap-1.5">
            <span className="text-gray-500 mt-0.5 flex-shrink-0">•</span>
            {activity}
          </li>
        ))}
      </ul>
      {week.lessons && week.lessons.length > 0 && (
        <div className="pt-3 border-t border-gray-100">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1.5">Lessons</p>
          <ul className="space-y-1">
            {week.lessons.map(l => (
              <li key={l.id}>
                <button
                  type="button"
                  onClick={() => onStartLesson?.(l.id)}
                  className="flex w-full items-center gap-1.5 rounded-md px-1 py-1 text-left text-xs text-indigo-800 hover:bg-indigo-50"
                >
                  <span className="w-4 h-4 rounded bg-indigo-100 text-indigo-700 text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                    {l.lessonNumber}
                  </span>
                  <span className="truncate">{l.series} — Lesson {l.lessonNumber}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="pt-3 border-t border-gray-200">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Milestone</p>
        <p className={`text-sm font-semibold ${colors.milestone} mt-0.5`}>{week.milestone}</p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

const DAILY_MINUTE_OPTIONS = [10, 15, 20, 30, 45, 60, 90]

export function LearningPath() {
  const navigate = useNavigate()
  const settings = useAppStore(s => s.settings)
  const activeUserId = useAppStore(s => s.activeUserId)
  const lessonsCompleted = useAppStore(s => s.lessonsCompleted)
  const learningPath = useAppStore(s => s.learningPath)
  const setLearningPath = useAppStore(s => s.setLearningPath)

  const [storage] = useState(() => new SQLiteStorage())
  const scheduler = settings.schedulerAlgorithm === 'fsrs' ? new FSRSScheduler() : new SM2Scheduler()
  const [service] = useState(() => new SRSService(storage, scheduler))

  const userId = activeUserId ?? 1
  const [isGenerating, setIsGenerating] = useState(false)
  const updateSettings = useAppStore(s => s.updateSettings)
  const includeTextbookLessons = settings.includeTextbookLessons

  // Auto-detected stage gate (used as default for manual pickers)
  const stageGate = useMemo(
    () => inferCefrStageGate(lessonsCompleted, settings.jlptTarget, 0, 0, 0),
    [lessonsCompleted, settings.jlptTarget]
  )

  // Manual overrides
  const autoCurrentLevel: CefrLevel = stageGate.currentStage === 'A1' && lessonsCompleted.length === 0
    ? 'Beginner'
    : stageGate.currentStage as CefrLevel
  const autoGoalLevel: CefrLevel = (JLPT_TO_CEFR[settings.jlptTarget] ?? 'B1') as CefrLevel

  const [currentLevel, setCurrentLevel] = useState<CefrLevel>(autoCurrentLevel)
  const [goalLevel, setGoalLevel] = useState<CefrLevel>(autoGoalLevel)
  const [dailyMinutes, setDailyMinutes] = useState(30)

  const timeEstimate = useMemo(
    () => estimateMonths(currentLevel, goalLevel, dailyMinutes),
    [currentLevel, goalLevel, dailyMinutes]
  )

  const realism = useMemo(
    () => getRealismRating(currentLevel, goalLevel, dailyMinutes, 0, 0),
    [currentLevel, goalLevel, dailyMinutes]
  )

  const goalIsValid = STAGE_ORDER.indexOf(goalLevel) > STAGE_ORDER.indexOf(currentLevel)

  async function generatePath() {
    if (!settings.aiProvider) {
      toast.error('No AI provider configured. Please set one in Settings.')
      return
    }
    if (!goalIsValid) {
      toast.error('Goal level must be higher than current level.')
      return
    }

    setIsGenerating(true)
    try {
      const snapshot = await service.getLearningSnapshot(userId)
      snapshot.lessonsCompleted = lessonsCompleted

      const generatedStageGate = inferCefrStageGate(
        lessonsCompleted,
        settings.jlptTarget,
        snapshot.totalCards,
        snapshot.matureCards,
        snapshot.averageRetention
      )

      const realismRating = getRealismRating(
        currentLevel, goalLevel, dailyMinutes,
        snapshot.matureCards, snapshot.averageRetention
      )

      // Optionally pre-assign textbook lessons to weeks
      let weeklyLessons: AssignedLesson[][] = Array.from({ length: 4 }, () => [])
      if (includeTextbookLessons) {
        try {
          weeklyLessons = await assignLessonsToWeeks(currentLevel, goalLevel, lessonsCompleted)
        } catch {
          // Non-fatal — continue without lesson assignments
        }
      }

      const lessonContext = includeTextbookLessons && weeklyLessons.some(w => w.length > 0)
        ? `\nTextbook lesson assignments for each week:\n${weeklyLessons.map((wl, i) =>
            `Week ${i + 1}: ${wl.length > 0 ? wl.map(l => `${l.series} Lesson ${l.lessonNumber}`).join(', ') : 'no new lessons'}`
          ).join('\n')}\nInclude these lessons in the activities and adjust dailyGoal to also account for lesson time (+5 cards/day per lesson).`
        : ''

      const ai = new ClientAIProvider(settings.sessionToken)
      const response = await ai.completeWithMessages(
        [{
          role: 'user',
          content: JSON.stringify({
            ...snapshot,
            cefrStageGate: generatedStageGate,
            manualCurrentLevel: currentLevel,
            manualGoalLevel: goalLevel,
            dailyStudyMinutes: dailyMinutes,
            estimatedTimeToGoal: formatTimeEstimate(estimateMonths(currentLevel, goalLevel, dailyMinutes)),
            realism: realismRating.label,
            includeTextbookLessons,
          }, null, 2),
        }],
        `You are a Japanese learning advisor. Given the learner's stats, generate a personalised 4-week study plan.
The learner has self-reported their current level as "${currentLevel}" and their goal as "${goalLevel}".
They can study ${dailyMinutes} minutes per day. Reaching their goal is estimated to take ${formatTimeEstimate(estimateMonths(currentLevel, goalLevel, dailyMinutes))} at this pace.
Realism rating: ${realismRating.label} — ${realismRating.description}
${lessonContext}
Output ONLY valid JSON in this exact format (no markdown, no explanation):
{ "weeks": [{ "week": 1, "focus": "string", "dailyGoal": number, "activities": ["string", "string", "string"], "milestone": "string" }] }

Use the manual current/goal levels as the primary framing. Respect the CEFR stage gate: do not skip stages.
If the realism rating is "Ambitious" or "Unrealistic", acknowledge this in week 1's focus and set an intermediate milestone.
Ensure activities array has 3-4 items per week. Make the plan realistic and progressive for ${dailyMinutes} min/day.`,
        'reasoning'
      )

      let jsonStr = response.trim()
      const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
      if (codeBlockMatch) jsonStr = codeBlockMatch[1].trim()
      const parsed = JSON.parse(jsonStr) as { weeks: LearningPathWeek[] }

      if (!parsed.weeks || !Array.isArray(parsed.weeks)) throw new Error('Invalid response format')

      const weeksWithLessons = parsed.weeks.slice(0, 4).map((w, i) => ({
        ...w,
        ...(includeTextbookLessons && weeklyLessons[i]?.length > 0
          ? { lessons: weeklyLessons[i] }
          : {}),
      }))

      const path: LearningPathData = {
        weeks: weeksWithLessons,
        generatedAt: new Date().toISOString(),
      }
      setLearningPath(path)
      toast.success('Learning path generated!')
    } catch (err) {
      console.error('Failed to generate learning path:', err)
      toast.error('Failed to generate learning path. Check your AI settings.')
    } finally {
      setIsGenerating(false)
    }
  }

  const generatedDate = learningPath
    ? new Date(learningPath.generatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <div className="max-w-4xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Learning Path</h1>
            <p className="text-sm text-gray-500 mt-1">
              AI-generated 4-week study plan based on your level and goals
            </p>
          </div>
          <div className="flex gap-2 items-center">
            {generatedDate && (
              <p className="text-xs text-gray-400">Generated {generatedDate}</p>
            )}
            <button
              onClick={() => void generatePath()}
              disabled={isGenerating || !goalIsValid}
              className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {isGenerating ? (
                <>
                  <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Generating…
                </>
              ) : learningPath ? 'Regenerate' : 'Generate Path'}
            </button>
          </div>
        </div>

        {!settings.aiProvider && !learningPath && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 mb-6 text-sm text-amber-800">
            Configure an AI provider in Settings to generate a personalised learning path.
          </div>
        )}

        {/* Level + commitment picker */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm mb-4">
          <h2 className="text-sm font-bold text-gray-900 mb-4">Your level &amp; goal</h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Current level */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Current level</label>
              <select
                value={currentLevel}
                onChange={e => setCurrentLevel(e.target.value as CefrLevel)}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {CEFR_LEVELS.map(l => (
                  <option key={l} value={l}>{LEVEL_LABELS[l]}</option>
                ))}
              </select>
            </div>

            {/* Goal level */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Goal level</label>
              <select
                value={goalLevel}
                onChange={e => setGoalLevel(e.target.value as CefrLevel)}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {CEFR_GOAL_LEVELS.map(l => (
                  <option key={l} value={l}>{LEVEL_LABELS[l]}</option>
                ))}
              </select>
              {!goalIsValid && (
                <p className="text-xs text-red-500 mt-1">Goal must be higher than current level</p>
              )}
            </div>

            {/* Daily commitment */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                Daily commitment — <span className="text-indigo-700">{dailyMinutes} min/day</span>
              </label>
              <div className="flex gap-1 flex-wrap">
                {DAILY_MINUTE_OPTIONS.map(m => (
                  <button
                    key={m}
                    onClick={() => setDailyMinutes(m)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                      dailyMinutes === m
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    {m}m
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Include textbook lessons toggle */}
          <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-gray-800">Include textbook lessons</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Assign specific Genki / Quartet / Tobira lessons to each week of the plan
              </p>
            </div>
            <button
              role="switch"
              aria-checked={includeTextbookLessons}
              onClick={() => updateSettings({ includeTextbookLessons: !includeTextbookLessons })}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                includeTextbookLessons ? 'bg-indigo-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform ${
                  includeTextbookLessons ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Time estimate + realism */}
          {goalIsValid && (
            <div className="mt-5 pt-4 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-2 gap-4">

              {/* Time estimate */}
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0 text-lg">🗓️</div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Estimated time</p>
                  <p className="text-xl font-bold text-gray-900 mt-0.5">{formatTimeEstimate(timeEstimate)}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {currentLevel} → {goalLevel} at {dailyMinutes} min/day
                  </p>
                </div>
              </div>

              {/* Realism rating */}
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-gray-50 flex items-center justify-center flex-shrink-0 text-lg">
                  {realism.score >= 4 ? '✅' : realism.score === 3 ? '⚡' : realism.score === 2 ? '⚠️' : '🔴'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Realism</p>
                  <p className={`text-base font-bold mt-0.5 ${realism.color}`}>{realism.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{realism.description}</p>
                  {/* 5-bar meter */}
                  <div className="flex gap-0.5 mt-2">
                    {[1, 2, 3, 4, 5].map(i => (
                      <div
                        key={i}
                        className={`h-1.5 flex-1 rounded-full transition-colors ${
                          i <= realism.score ? realism.barColor : 'bg-gray-200'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>

            </div>
          )}
        </div>

        {/* CEFR Stage Gate (auto-detected from progress) */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm mb-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-gray-900">CEFR Stage Gate <span className="font-normal text-gray-400 text-xs ml-1">auto-detected from your progress</span></h2>
              <p className="text-sm text-gray-600 mt-1">{stageGate.guidance}</p>
            </div>
            <div className="flex items-center gap-2 text-xs font-bold">
              <span className="rounded-full bg-indigo-100 px-3 py-1 text-indigo-800">Current {stageGate.currentStage}</span>
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-800">Target {stageGate.targetStage}</span>
            </div>
          </div>
          <p className="mt-3 text-xs text-gray-500">{stageGate.nextUnlock}</p>
        </div>

        {!learningPath && !isGenerating && (
          <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center shadow-sm">
            <div className="text-5xl mb-4">🗺️</div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">No learning path yet</h2>
            <p className="text-gray-500 text-sm max-w-sm mx-auto mb-6">
              Set your level and goal above, then generate a personalised 4-week plan.
            </p>
            {settings.aiProvider && goalIsValid && (
              <button
                onClick={() => void generatePath()}
                className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors"
              >
                Generate My Learning Path
              </button>
            )}
          </div>
        )}

        {isGenerating && (
          <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center shadow-sm">
            <div className="inline-block w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4" />
            <p className="text-gray-600 font-medium">Analysing your progress and generating your plan…</p>
            <p className="text-gray-400 text-sm mt-1">This may take a few seconds</p>
          </div>
        )}

        {learningPath && !isGenerating && (
          <>
            {/* Week cards */}
            <div className="flex gap-4 overflow-x-auto pb-4 -mx-1 px-1">
              {learningPath.weeks.map((week, i) => (
                <WeekCard
                  key={week.week}
                  week={week}
                  index={i}
                  onStartLesson={(lessonId) => navigate(lessonRouteFromId(lessonId, { autostart: true }))}
                />
              ))}
            </div>

            {/* Summary grid */}
            <div className="mt-6 bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
              <h2 className="text-base font-semibold text-gray-800 mb-4">4-Week Overview</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {learningPath.weeks.map((week, i) => {
                  const colors = WEEK_COLORS[i % WEEK_COLORS.length]
                  return (
                    <div key={week.week} className={`rounded-xl p-3 border ${colors.border}`}>
                      <p className={`text-xs font-bold ${colors.milestone}`}>Week {week.week}</p>
                      <p className="text-sm font-medium text-gray-900 mt-1 leading-tight">{week.focus}</p>
                      <p className="text-xs text-gray-500 mt-1">{week.dailyGoal} cards/day</p>
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )}

      </div>
    </div>
  )
}
