import { useState } from 'react'
import { useAppStore, type LearningPath as LearningPathData, type LearningPathWeek } from '../store'
import { SQLiteStorage } from '../db/sqlite'
import { FSRSScheduler, SM2Scheduler } from '../core/scheduler'
import { SRSService } from '../srs/srsService'
import { ClientAIProvider } from '../ai/aiProvider'
import { Navigation } from '../components/Navigation'
import { toast } from '../components/toastStore'

const WEEK_COLORS = [
  { bg: 'bg-indigo-50', border: 'border-indigo-200', badge: 'bg-indigo-100 text-indigo-700', milestone: 'text-indigo-900' },
  { bg: 'bg-blue-50', border: 'border-blue-200', badge: 'bg-blue-100 text-blue-700', milestone: 'text-blue-900' },
  { bg: 'bg-violet-50', border: 'border-violet-200', badge: 'bg-violet-100 text-violet-700', milestone: 'text-violet-900' },
  { bg: 'bg-emerald-50', border: 'border-emerald-200', badge: 'bg-emerald-100 text-emerald-700', milestone: 'text-emerald-900' },
]

function WeekCard({ week, index }: { week: LearningPathWeek; index: number }) {
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
          <li key={i} className="text-xs text-gray-700 flex items-start gap-1.5">
            <span className="text-gray-400 mt-0.5 flex-shrink-0">•</span>
            {activity}
          </li>
        ))}
      </ul>
      <div className={`pt-3 border-t border-current/10`}>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Milestone</p>
        <p className={`text-sm font-medium ${colors.milestone} mt-0.5`}>{week.milestone}</p>
      </div>
    </div>
  )
}

export function LearningPath() {
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

  async function generatePath() {
    if (!settings.aiProvider) {
      toast.error('No AI provider configured. Please set one in Settings.')
      return
    }

    setIsGenerating(true)
    try {
      const snapshot = await service.getLearningSnapshot(userId)
      snapshot.lessonsCompleted = lessonsCompleted

      const ai = new ClientAIProvider(settings.sessionToken)
      const response = await ai.completeWithMessages(
        [{ role: 'user', content: JSON.stringify(snapshot, null, 2) }],
        `You are a Japanese learning advisor. Given the learner's stats, generate a personalised 4-week study plan with daily goals.
Output ONLY valid JSON in this exact format (no markdown, no explanation):
{ "weeks": [{ "week": 1, "focus": "string", "dailyGoal": number, "activities": ["string", "string", "string"], "milestone": "string" }] }
Ensure activities array has 3-4 items per week. Make the plan realistic and progressive.`,
        'reasoning'
      )

      // Parse JSON from response (handle potential markdown code blocks)
      let jsonStr = response.trim()
      const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
      if (codeBlockMatch) {
        jsonStr = codeBlockMatch[1].trim()
      }
      const parsed = JSON.parse(jsonStr) as { weeks: LearningPathWeek[] }

      if (!parsed.weeks || !Array.isArray(parsed.weeks)) {
        throw new Error('Invalid response format')
      }

      const path: LearningPathData = {
        weeks: parsed.weeks.slice(0, 4),
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
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Learning Path</h1>
            <p className="text-sm text-gray-500 mt-1">
              AI-generated 4-week study plan based on your progress
            </p>
          </div>
          <div className="flex gap-2 items-center">
            {generatedDate && (
              <p className="text-xs text-gray-400">Generated {generatedDate}</p>
            )}
            <button
              onClick={() => void generatePath()}
              disabled={isGenerating}
              className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {isGenerating ? (
                <>
                  <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Generating…
                </>
              ) : learningPath ? (
                'Regenerate'
              ) : (
                'Generate Path'
              )}
            </button>
          </div>
        </div>

        {!settings.aiProvider && !learningPath && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 mb-6 text-sm text-amber-800">
            Configure an AI provider in Settings to generate a personalised learning path.
          </div>
        )}

        {!learningPath && !isGenerating && (
          <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center shadow-sm">
            <div className="text-5xl mb-4">🗺️</div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">No learning path yet</h2>
            <p className="text-gray-500 text-sm max-w-sm mx-auto mb-6">
              Click "Generate Path" to get a personalised 4-week study plan based on your current stats and progress.
            </p>
            {settings.aiProvider && (
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
            {/* Week cards — horizontal scroll on mobile */}
            <div className="flex gap-4 overflow-x-auto pb-4 -mx-1 px-1">
              {learningPath.weeks.map((week, i) => (
                <WeekCard key={week.week} week={week} index={i} />
              ))}
            </div>

            {/* Summary grid */}
            <div className="mt-6 bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
              <h2 className="text-base font-semibold text-gray-800 mb-4">4-Week Overview</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {learningPath.weeks.map((week, i) => {
                  const colors = WEEK_COLORS[i % WEEK_COLORS.length]
                  return (
                    <div key={week.week} className={`rounded-xl p-3 ${colors.bg} border ${colors.border}`}>
                      <p className={`text-xs font-bold ${colors.badge.split(' ')[1]}`}>Week {week.week}</p>
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
