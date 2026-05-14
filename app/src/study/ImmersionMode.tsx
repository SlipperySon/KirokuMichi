import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store'
import { Navigation } from '../components/Navigation'
import { SQLiteStorage } from '../db/sqlite'
import { FSRSScheduler, SM2Scheduler } from '../core/scheduler'
import { SRSService } from '../srs/srsService'
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
import type { ReviewCard } from './types'
import { useInterleavedReviewSession } from './useInterleavedReviewSession'
import { ImmersionCardReview } from './ImmersionCardReview'

type TimerPhase = 'idle' | 'study' | 'break' | 'done'
type ImmersionModeType = 'standard' | 'interleaved'

export function ImmersionMode() {
  const navigate = useNavigate()
  const { settings, updateSettings } = useAppStore()
  const activeUserId = useAppStore(s => s.activeUserId)

  // Initialize SRS service for card reviews
  const [storage] = useState(() => new SQLiteStorage())
  const scheduler = settings.schedulerAlgorithm === 'fsrs' ? new FSRSScheduler() : new SM2Scheduler()
  const [srsService] = useState(() => new SRSService(storage, scheduler))
  const [dueCards, setDueCards] = useState<ReviewCard[]>([])
  const [newCards, setNewCards] = useState<ReviewCard[]>([])
  const [cardsReviewedThisSession, setCardsReviewedThisSession] = useState(0)

  // Immersion mode type: standard timer or interleaved review
  const [immersionMode, setImmersionMode] = useState<ImmersionModeType>('standard')
  const [interleavedSessionId] = useState(() => Date.now())

  // Interleaved review session state - only initialize with cards when mode is interleaved
  const cardsForInterleaved = useMemo(
    () =>
      immersionMode === 'interleaved' && (dueCards.length > 0 || newCards.length > 0)
        ? dueCards.length > 0 ? dueCards : newCards
        : [],
    [immersionMode, dueCards, newCards]
  )

  const interleavedSession = useInterleavedReviewSession(
    activeUserId ?? 0,
    srsService,
    cardsForInterleaved,
    interleavedSessionId
  )

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

  // Load due cards for review
  useEffect(() => {
    async function loadCards() {
      if (!activeUserId) return
      try {
        const due = await srsService.getDueCards(activeUserId, 100)
        const newC = await srsService.getNewCards(activeUserId, 100)
        setDueCards(due)
        setNewCards(newC)
      } catch (error) {
        console.error('Failed to load cards:', error)
      }
    }
    void loadCards()
  }, [activeUserId, srsService])

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
    setCardsReviewedThisSession(0)
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

  function startReview() {
    // Navigate to review with due cards during immersion session
    if (dueCards.length === 0 && newCards.length === 0) {
      alert('No cards available for review.')
      return
    }
    navigate('/study/review', {
      state: {
        queue: dueCards.length > 0 ? dueCards : newCards,
        grammarEntries: [],
        sessionId: null,
        userId: activeUserId,
        immersionSessionActive: true, // Flag to indicate user is in immersion mode
        onReturn: () => {
          // When user returns from review, update card count
          setCardsReviewedThisSession(prev => prev + (dueCards.length > 0 ? Math.min(10, dueCards.length) : Math.min(10, newCards.length)))
        }
      }
    })
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

        {/* Mode selector tabs */}
        <div className="flex gap-2 bg-gray-100 p-1 rounded-xl w-full">
          <button
            onClick={() => setImmersionMode('standard')}
            className={`flex-1 px-4 py-2 rounded-lg font-semibold transition-colors ${
              immersionMode === 'standard'
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            ⏱️ Standard Timer
          </button>
          <button
            onClick={() => setImmersionMode('interleaved')}
            className={`flex-1 px-4 py-2 rounded-lg font-semibold transition-colors ${
              immersionMode === 'interleaved'
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            🔄 Interleaved Review
          </button>
        </div>

        {/* STANDARD TIMER MODE */}
        {immersionMode === 'standard' && <>

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
        {/* Card Review Summary — show available cards */}
        {(dueCards.length > 0 || newCards.length > 0) && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <p className="text-sm font-medium text-blue-900 mb-2">📋 Cards due for review</p>
            <div className="flex items-center gap-4">
              {dueCards.length > 0 && (
                <div>
                  <span className="text-xl font-bold text-blue-700">{dueCards.length}</span>
                  <p className="text-xs text-blue-600">cards due</p>
                </div>
              )}
              {newCards.length > 0 && (
                <div>
                  <span className="text-xl font-bold text-green-700">{newCards.length}</span>
                  <p className="text-xs text-green-600">new cards</p>
                </div>
              )}
              <p className="text-xs text-blue-600 ml-auto flex-1">
                {dueCards.length > 0
                  ? '✓ You have cards overdue for review. Review them during this session to stay on schedule.'
                  : 'No cards overdue. Great job staying on top of your reviews!'}
              </p>
            </div>
          </div>
        )}

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
                      onClick={startReview}
                      disabled={dueCards.length === 0 && newCards.length === 0}
                      className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Review Cards ({dueCards.length > 0 ? dueCards.length : newCards.length})
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

            {/* Card reviews in this session */}
            {(phase === 'study' || cardsReviewedThisSession > 0) && (
              <div className="pt-2 border-t border-gray-200 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Cards reviewed</span>
                <span className="text-sm font-semibold text-indigo-600">{cardsReviewedThisSession}</span>
              </div>
            )}

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
        </>}

        {/* INTERLEAVED REVIEW MODE */}
        {immersionMode === 'interleaved' && (
          <div className="space-y-6">
            {/* Show start screen if idle and no session active */}
            {phase === 'idle' && (
              <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center space-y-4">
                <p className="text-4xl">🔄</p>
                <p className="text-2xl font-bold text-gray-900">Interleaved Review</p>
                <p className="text-gray-600">Study with natural card cycling and replay mechanics</p>
                {dueCards.length === 0 && newCards.length === 0 ? (
                  <p className="text-sm text-amber-700 bg-amber-50 rounded-lg p-3">Import an Anki deck to start</p>
                ) : (
                  <button
                    onClick={handleStart}
                    className="mt-4 px-8 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors"
                  >
                    Start Session
                  </button>
                )}
              </div>
            )}

            {/* Header with timer and session info - only show during study */}
            {phase === 'study' && (
              <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4 sticky top-6 z-10 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Session {completedSessions + 1} of {immersionSessionsPerDay}</p>
                    <div className="text-5xl font-mono font-bold tabular-nums text-indigo-600">
                      {timerDisplay}
                    </div>
                  </div>
                  <div className="text-right space-y-1">
                    <p className="text-2xl font-bold text-gray-900">{interleavedSession.stats.cardsReviewed}</p>
                    <p className="text-sm text-gray-500">cards reviewed</p>
                    {interleavedSession.stats.replayCount && interleavedSession.stats.replayCount > 0 && (
                      <>
                        <p className="text-lg font-semibold text-amber-600">{interleavedSession.stats.replayCount}</p>
                        <p className="text-xs text-amber-500">replays</p>
                      </>
                    )}
                  </div>
                </div>

                {/* Accuracy during session */}
                {interleavedSession.stats.cardsReviewed > 0 && (
                  <div className="pt-3 border-t border-gray-200">
                    <p className={`text-sm font-semibold ${
                      interleavedSession.stats.correctCount / interleavedSession.stats.cardsReviewed >= 0.7
                        ? 'text-green-600'
                        : interleavedSession.stats.correctCount / interleavedSession.stats.cardsReviewed >= 0.5
                        ? 'text-amber-600'
                        : 'text-red-600'
                    }`}>
                      Accuracy: {Math.round((interleavedSession.stats.correctCount / interleavedSession.stats.cardsReviewed) * 100)}%
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Card display during study phase */}
            {phase === 'study' && (
              <>
                {interleavedSession.isComplete ? (
                  <div className="rounded-2xl bg-white border border-gray-200 p-8 text-center space-y-4">
                    <p className="text-5xl">🎉</p>
                    <p className="text-2xl font-bold text-gray-900">Session complete!</p>
                    <div className="space-y-2 pt-2">
                      <p className="text-gray-600">
                        <span className="font-semibold">{interleavedSession.stats.cardsReviewed}</span> cards reviewed
                      </p>
                      {interleavedSession.stats.cardsReviewed > 0 && (
                        <p className={`font-semibold ${
                          interleavedSession.stats.correctCount / interleavedSession.stats.cardsReviewed >= 0.7
                            ? 'text-green-600'
                            : 'text-amber-600'
                        }`}>
                          {Math.round((interleavedSession.stats.correctCount / interleavedSession.stats.cardsReviewed) * 100)}% accuracy
                        </p>
                      )}
                      {interleavedSession.stats.improvementCount && interleavedSession.stats.improvementCount > 0 && (
                        <p className="text-green-600 text-sm">
                          {interleavedSession.stats.improvementCount} cards improved on replay ✓
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        finishSession()
                      }}
                      className="mt-4 px-6 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors"
                    >
                      Finish This Session
                    </button>
                  </div>
                ) : interleavedSession.currentCard ? (
                  <ImmersionCardReview
                    card={interleavedSession.currentCard}
                    phase={interleavedSession.phase}
                    onReveal={interleavedSession.reveal}
                    onRate={interleavedSession.rate}
                    nextQueuePreview={interleavedSession.nextQueuePreview}
                  />
                ) : (
                  <div className="rounded-2xl bg-amber-50 border border-amber-200 p-6 text-center">
                    <p className="text-amber-800 font-semibold mb-2">No cards available</p>
                    <p className="text-sm text-amber-700">Import an Anki deck to start studying</p>
                  </div>
                )}

                {/* Pause button during study */}
                {!interleavedSession.isComplete && (
                  <div className="flex gap-2 justify-center">
                    <button
                      onClick={handlePause}
                      className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
                    >
                      Pause
                    </button>
                  </div>
                )}
              </>
            )}

            {/* Session progress */}
            {(phase !== 'idle' || completedSessions > 0) && (
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Sessions today</span>
                  <span className="text-sm text-gray-500">{completedSessions} / {immersionSessionsPerDay}</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 rounded-full transition-all"
                    style={{ width: `${sessionProgress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
