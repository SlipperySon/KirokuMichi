import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store'
import { Navigation } from '../components/Navigation'
import {
  buildDailySchedule,
  findCurrentBlock,
  findNextBlock,
  minutesUntilBlock,
  formatMinutes,
  formatMinuteOfDay,
  accuracyRating,
} from '../core/immersionSchedule'
import type { AccuracySnapshot } from '../core/immersionSchedule'

type TimerPhase = 'idle' | 'study' | 'break' | 'done'

export function ImmersionMode() {
  const navigate = useNavigate()
  const { settings, updateSettings } = useAppStore()

  const {
    immersionSessionMinutes,
    immersionBreakMinutes,
    immersionSessionsPerDay,
    immersionEnabled,
  } = settings

  const schedule = buildDailySchedule(
    immersionSessionsPerDay,
    immersionSessionMinutes,
    immersionBreakMinutes
  )

  const currentBlock = findCurrentBlock(schedule)
  const nextBlock = findNextBlock(schedule)

  // Timer state
  const [phase, setPhase] = useState<TimerPhase>('idle')
  const [secondsLeft, setSecondsLeft] = useState(immersionSessionMinutes * 60)
  const [completedSessions, setCompletedSessions] = useState(0)
  const [accuracy, setAccuracy] = useState<AccuracySnapshot[]>([])
  const [sessionCorrect, setSessionCorrect] = useState(0)
  const [sessionTotal, setSessionTotal] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Settings edit state
  const [editingSettings, setEditingSettings] = useState(false)
  const [draftSession, setDraftSession] = useState(immersionSessionMinutes)
  const [draftBreak, setDraftBreak] = useState(immersionBreakMinutes)
  const [draftSessions, setDraftSessions] = useState(immersionSessionsPerDay)

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  const startStudy = useCallback(() => {
    setPhase('study')
    setSecondsLeft(immersionSessionMinutes * 60)
    setSessionCorrect(0)
    setSessionTotal(0)
  }, [immersionSessionMinutes])

  const startBreak = useCallback(() => {
    setPhase('break')
    setSecondsLeft(immersionBreakMinutes * 60)
  }, [immersionBreakMinutes])

  const finishSession = useCallback(() => {
    const snap: AccuracySnapshot = {
      sessionIndex: completedSessions,
      correct: sessionCorrect,
      total: sessionTotal,
      accuracyPercent: sessionTotal > 0 ? Math.round((sessionCorrect / sessionTotal) * 100) : 0,
      takenAt: new Date().toISOString(),
    }
    setAccuracy(prev => [...prev, snap])
    setCompletedSessions(prev => prev + 1)

    if (completedSessions + 1 >= immersionSessionsPerDay) {
      setPhase('done')
    } else {
      startBreak()
    }
  }, [completedSessions, sessionCorrect, sessionTotal, immersionSessionsPerDay, startBreak])

  useEffect(() => {
    if (phase === 'idle' || phase === 'done') {
      clearTimer()
      return
    }

    intervalRef.current = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          clearTimer()
          if (phase === 'study') finishSession()
          else if (phase === 'break') startStudy()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return clearTimer
  }, [phase, clearTimer, finishSession, startStudy])

  function handleStart() {
    startStudy()
  }

  function handleSkipBreak() {
    clearTimer()
    startStudy()
  }

  function handlePause() {
    clearTimer()
    setPhase('idle')
  }

  function handleSaveSettings() {
    updateSettings({
      immersionSessionMinutes: draftSession,
      immersionBreakMinutes: draftBreak,
      immersionSessionsPerDay: draftSessions,
    })
    setEditingSettings(false)
  }

  const mins = Math.floor(secondsLeft / 60)
  const secs = secondsLeft % 60
  const timerDisplay = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`

  const sessionProgress = immersionSessionsPerDay > 0
    ? Math.round((completedSessions / immersionSessionsPerDay) * 100)
    : 0

  const todayAccuracy = accuracy.length > 0
    ? Math.round(accuracy.reduce((s, a) => s + a.accuracyPercent, 0) / accuracy.length)
    : null

  return (
    <div className="flex flex-col min-h-screen">
      <Navigation />
      <div className="flex flex-col gap-6 p-6 max-w-2xl mx-auto flex-1 w-full">

        <div>
          <h1 className="text-3xl font-bold text-gray-900">Immersion Mode</h1>
          <p className="text-gray-600">Structured study sessions with timed breaks</p>
        </div>

        {/* Enable toggle */}
        <div className="flex items-center justify-between bg-white border border-gray-200 rounded-xl p-4">
          <div>
            <p className="font-semibold text-gray-900">Immersion schedule</p>
            <p className="text-sm text-gray-500">
              {immersionSessionsPerDay}× {immersionSessionMinutes}min sessions with {immersionBreakMinutes}min breaks
            </p>
          </div>
          <button
            onClick={() => updateSettings({ immersionEnabled: !immersionEnabled })}
            className={`w-12 h-6 rounded-full transition-colors ${immersionEnabled ? 'bg-indigo-600' : 'bg-gray-300'}`}
          >
            <span className={`block w-5 h-5 bg-white rounded-full shadow transition-transform mx-0.5 ${immersionEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
          </button>
        </div>

        {/* Daily schedule overview — only when enabled */}
        {!immersionEnabled && (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 text-center text-gray-500 text-sm">
            Enable immersion schedule above to see your daily study blocks and start timed sessions.
          </div>
        )}
        {immersionEnabled && <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900">Today's schedule</h2>
            <button
              onClick={() => setEditingSettings(!editingSettings)}
              className="text-xs text-indigo-600 hover:text-indigo-700"
            >
              {editingSettings ? 'Cancel' : 'Edit'}
            </button>
          </div>

          {editingSettings ? (
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Session length (minutes)</label>
                <input
                  type="number"
                  min={5} max={120}
                  value={draftSession}
                  onChange={e => setDraftSession(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Break length (minutes)</label>
                <input
                  type="number"
                  min={1} max={60}
                  value={draftBreak}
                  onChange={e => setDraftBreak(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Sessions per day</label>
                <input
                  type="number"
                  min={1} max={12}
                  value={draftSessions}
                  onChange={e => setDraftSessions(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <button
                onClick={handleSaveSettings}
                className="w-full py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700"
              >
                Save
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {schedule.blocks.map((block, i) => (
                <div
                  key={i}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm ${
                    block.type === 'study'
                      ? 'bg-indigo-50 text-indigo-800'
                      : 'bg-gray-50 text-gray-600'
                  }`}
                >
                  <span>{block.type === 'study' ? `Session ${block.index + 1}` : 'Break'}</span>
                  <span>
                    {formatMinuteOfDay(block.startMinuteOfDay)} · {block.durationMinutes}min
                  </span>
                </div>
              ))}
              <p className="text-xs text-gray-400 pt-1">
                Total: {formatMinutes(schedule.totalStudyMinutes)} study, {formatMinutes(schedule.totalBreakMinutes)} breaks
              </p>
            </div>
          )}
        </div>}

        {/* Schedule context + timer — only when enabled */}
        {immersionEnabled && <>
        {/* Schedule context — what's happening now */}
        {phase === 'idle' && (currentBlock || nextBlock) && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm">
            {currentBlock ? (
              <p className="text-amber-800">
                <span className="font-semibold">Now:</span>{' '}
                {currentBlock.type === 'study' ? `Session ${currentBlock.index + 1}` : 'Break time'} —{' '}
                {formatMinutes(currentBlock.durationMinutes)}
              </p>
            ) : nextBlock ? (
              <p className="text-amber-800">
                <span className="font-semibold">Next session</span> in{' '}
                {formatMinutes(minutesUntilBlock(nextBlock))} ({formatMinuteOfDay(nextBlock.startMinuteOfDay)})
              </p>
            ) : null}
          </div>
        )}

        {/* Timer display */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 text-center space-y-4">
          {phase === 'done' ? (
            <div className="space-y-2">
              <p className="text-4xl">🎉</p>
              <p className="text-2xl font-bold text-gray-900">All sessions complete!</p>
              {todayAccuracy !== null && (
                <p className={`text-lg font-semibold ${accuracyRating(todayAccuracy).color}`}>
                  Today's accuracy: {todayAccuracy}% — {accuracyRating(todayAccuracy).label}
                </p>
              )}
            </div>
          ) : (
            <>
              <div className={`text-6xl font-mono font-bold tabular-nums ${
                phase === 'break' ? 'text-green-600' : phase === 'study' ? 'text-indigo-600' : 'text-gray-400'
              }`}>
                {timerDisplay}
              </div>

              <p className="text-gray-500 text-sm">
                {phase === 'study' && `Session ${completedSessions + 1} of ${immersionSessionsPerDay}`}
                {phase === 'break' && 'Break — relax your eyes'}
                {phase === 'idle' && 'Ready to start'}
              </p>

              <div className="flex gap-3 justify-center">
                {phase === 'idle' && (
                  <button
                    onClick={handleStart}
                    className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors"
                  >
                    Start Session
                  </button>
                )}
                {phase === 'study' && (
                  <>
                    <button
                      onClick={() => navigate('/study/review')}
                      className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors"
                    >
                      Go to Review
                    </button>
                    <button
                      onClick={handlePause}
                      className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
                    >
                      Pause
                    </button>
                  </>
                )}
                {phase === 'break' && (
                  <button
                    onClick={handleSkipBreak}
                    className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
                  >
                    Skip Break
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        {/* Session progress */}
        {(phase !== 'idle' || completedSessions > 0) && (
          <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Sessions today</span>
              <span className="text-sm text-gray-500">{completedSessions} / {immersionSessionsPerDay}</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-500 rounded-full transition-all"
                style={{ width: `${sessionProgress}%` }}
              />
            </div>

            {/* Per-session accuracy */}
            {accuracy.length > 0 && (
              <div className="pt-2 space-y-1">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Accuracy per session</p>
                {accuracy.map((snap, i) => {
                  const rating = accuracyRating(snap.accuracyPercent)
                  return (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Session {snap.sessionIndex + 1}</span>
                      <span className={`font-semibold ${rating.color}`}>
                        {snap.total > 0 ? `${snap.accuracyPercent}%` : 'No cards reviewed'}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Accuracy input for current session */}
        {phase === 'study' && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
            <p className="text-sm font-medium text-indigo-800 mb-3">Log accuracy (optional)</p>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-xs text-indigo-600 mb-1">Correct</label>
                <input
                  type="number"
                  min={0}
                  value={sessionCorrect}
                  onChange={e => setSessionCorrect(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-indigo-200 rounded-lg text-sm bg-white"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-indigo-600 mb-1">Total</label>
                <input
                  type="number"
                  min={0}
                  value={sessionTotal}
                  onChange={e => setSessionTotal(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-indigo-200 rounded-lg text-sm bg-white"
                />
              </div>
            </div>
            {sessionTotal > 0 && (
              <p className={`text-sm font-semibold mt-2 ${accuracyRating(Math.round((sessionCorrect / sessionTotal) * 100)).color}`}>
                {Math.round((sessionCorrect / sessionTotal) * 100)}% — {accuracyRating(Math.round((sessionCorrect / sessionTotal) * 100)).label}
              </p>
            )}
          </div>
        )}

        </>}

      </div>
    </div>
  )
}
