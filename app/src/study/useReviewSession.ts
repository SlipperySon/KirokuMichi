import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import type { Rating, CardState } from '../core/providers'
import { SRSService, type CardStateSnapshot } from '../srs/srsService'
import { SessionRecovery } from '../srs/sessionRecovery'
import { getKeyboardShortcutManager } from '../utils/keyboard-shortcuts'
import { toast } from '../components/toastStore'
import type { ReviewCard, GrammarQuestion, IntervalPreview, SessionStats } from './types'

interface UndoEntry {
  snapshot: CardStateSnapshot
  cardId: number
  wasAgainRating: boolean
  /** Index in the queue the user was on when they rated. */
  previousIndex: number
  /** Stats snapshot to restore on undo. */
  previousStats: SessionStats
  /** Was the rated card a new leech? (so we can clear that flag.) */
  becameLeech: boolean
  /** Queue before Again requeue (if any). */
  previousQueue?: ReviewCard[]
  /** cardStateId whose requeue count was incremented (if any). */
  requeuedCardStateId?: number
}

export type CardVariant = 'reading' | 'meaning' | 'writing' | 'grammar' | 'listening'

/** Max times a single card may be re-inserted after Again in one session. */
export const MAX_AGAIN_REQUEUES = 2

/** Default positions ahead to re-insert an Again card (clamped to end). */
export const AGAIN_REQUEUE_OFFSET = 4

/**
 * Plan where to re-insert the current card after an Again rating.
 * Returns an absolute splice index in the *current* queue (before insert),
 * or null when requeue should be skipped (cap reached / nowhere useful).
 */
export function planAgainRequeue(
  index: number,
  length: number,
  requeueCount: number,
  offset = AGAIN_REQUEUE_OFFSET,
): number | null {
  if (requeueCount >= MAX_AGAIN_REQUEUES) return null
  if (length <= 0 || index < 0 || index >= length) return null
  const steps = Math.max(1, offset)
  return Math.min(index + steps, length)
}

export function resolveCardVariant(card: ReviewCard): CardVariant {
  if (card.type === 'grammar') return 'grammar'
  if (card.type === 'sentence') return 'listening'
  const bucket = card.cardStateId % 7
  if (bucket === 0) return 'writing'
  if (bucket <= 4) return 'reading'
  return 'meaning'
}

function resolveVariant(card: ReviewCard): CardVariant {
  return resolveCardVariant(card)
}

function cardStateFrom(card: ReviewCard): CardState {
  return {
    due: new Date(card.due),
    stability: card.stability,
    difficulty: card.difficulty,
    retrievability: 0,
    state: card.state,
    reps: 0,
    lapses: card.lapses,
  }
}

interface ReviewSessionState {
  currentCard: ReviewCard | null
  currentVariant: CardVariant
  currentGrammar: GrammarQuestion | null
  phase: 'front' | 'back'
  stats: SessionStats
  isNewLeech: boolean
  intervalPreviews: IntervalPreview | null
  progress: { current: number; total: number }
  isComplete: boolean
  grammarAnswerCorrect: boolean | null
}

interface ReviewSessionActions {
  reveal: () => void
  rate: (rating: Rating) => Promise<void>
  suspendCurrentCard: () => Promise<void>
  buryCurrentCard: () => Promise<void>
  dismissLeechWarning: () => void
  handleGrammarAnswer: (isCorrect: boolean) => void
  undoLastRating: () => Promise<void>
  canUndo: boolean
}

export function useReviewSession(
  userId: number,
  service: SRSService,
  initialQueue: ReviewCard[],
  grammarMap: Map<number, GrammarQuestion>,
  sessionId: number,
  cramMode = false
): ReviewSessionState & ReviewSessionActions {
  const [queue, setQueue] = useState<ReviewCard[]>(initialQueue)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [phase, setPhase] = useState<'front' | 'back'>('front')
  const [isNewLeech, setIsNewLeech] = useState(false)
  const [isComplete, setIsComplete] = useState(false)
  const [grammarAnswerCorrect, setGrammarAnswerCorrect] = useState<boolean | null>(null)
  const [stats, setStats] = useState<SessionStats>({
    cardsReviewed: 0,
    correctCount: 0,
    startedAt: Date.now(),
  })
  /** One-deep undo buffer — only the most-recent rating is undoable. */
  const undoBufferRef = useRef<UndoEntry | null>(null)
  const [canUndo, setCanUndo] = useState(false)
  /** Per-card Again requeue counts for this session (keyed by cardStateId). */
  const requeueCountsRef = useRef<Map<number, number>>(new Map())

  const currentCard = isComplete ? null : (queue[currentIndex] ?? null)
  const currentVariant = currentCard ? resolveVariant(currentCard) : 'reading'
  const currentGrammar = currentCard ? (grammarMap.get(currentCard.cardStateId) ?? null) : null

  const intervalPreviews = useMemo(() => {
    if (!currentCard || phase !== 'back') return null
    return service.getIntervalPreviews(cardStateFrom(currentCard))
  }, [currentCard, phase, service])

  const reveal = useCallback(() => setPhase('back'), [])

  const handleGrammarAnswer = useCallback((isCorrect: boolean) => {
    setGrammarAnswerCorrect(isCorrect)
    setPhase('back')
  }, [])

  const advance = useCallback(async (
    newStats: SessionStats,
    newIndex: number,
    activeQueue: ReviewCard[] = queue,
  ) => {
    if (newIndex >= activeQueue.length) {
      await service.endSession(sessionId, newStats)
      SessionRecovery.clear()
      setIsComplete(true)
    } else {
      setCurrentIndex(newIndex)
      setPhase('front')
      setGrammarAnswerCorrect(null)
      SessionRecovery.save({
        sessionId, userId, mode: 'srs',
        queue: activeQueue, currentIndex: newIndex, stats: newStats, savedAt: Date.now(),
      })
    }
  }, [queue, service, sessionId, userId])

  const rate = useCallback(async (rating: Rating) => {
    if (!currentCard || isNewLeech) return

    let becameLeech = false
    let snapshot: import('../srs/srsService').CardStateSnapshot | null = null

    if (cramMode) {
      // Cram mode: don't update scheduling, just advance
    } else {
      // Snapshot before the SRS service mutates the row — used by undo.
      snapshot = await service.snapshotCardState(userId, currentCard.cardStateId)
      const result = await service.reviewCard(userId, currentCard.cardStateId, rating)
      becameLeech = result.isNewLeech
    }

    const isCorrect = rating !== 'again'
    if (!cramMode && !isCorrect) {
      await service.logMistake(userId, currentCard.cardId, null, currentCard.front, sessionId)
    }

    const newStats: SessionStats = {
      ...stats,
      cardsReviewed: stats.cardsReviewed + 1,
      correctCount: stats.correctCount + (isCorrect ? 1 : 0),
    }
    setStats(newStats)

    let nextQueue = queue
    let requeuedCardStateId: number | undefined
    if (!cramMode && rating === 'again') {
      const priorCount = requeueCountsRef.current.get(currentCard.cardStateId) ?? 0
      const insertAt = planAgainRequeue(currentIndex, queue.length, priorCount)
      if (insertAt !== null) {
        nextQueue = [...queue]
        nextQueue.splice(insertAt, 0, currentCard)
        requeueCountsRef.current.set(currentCard.cardStateId, priorCount + 1)
        requeuedCardStateId = currentCard.cardStateId
        setQueue(nextQueue)
      }
    }

    // Stash undo entry (cap 1) — only in normal mode
    if (!cramMode && snapshot) {
      undoBufferRef.current = {
        snapshot,
        cardId: currentCard.cardId,
        wasAgainRating: !isCorrect,
        previousIndex: currentIndex,
        previousStats: stats,
        becameLeech,
        previousQueue: requeuedCardStateId !== undefined ? queue : undefined,
        requeuedCardStateId,
      }
      setCanUndo(true)
    }

    if (becameLeech) {
      setIsNewLeech(true)
      return
    }

    await advance(newStats, currentIndex + 1, nextQueue)
  }, [currentCard, currentIndex, isNewLeech, cramMode, queue, service, sessionId, stats, userId, advance])

  const undoLastRating = useCallback(async () => {
    const entry = undoBufferRef.current
    if (!entry) {
      toast.info('Nothing to undo')
      return
    }
    // Restore card state in DB
    await service.revertCardState(userId, entry.snapshot)
    if (entry.wasAgainRating) {
      // Best-effort: drop the mistake log we just inserted
      await service.deleteLatestMistakeForCard(userId, entry.cardId)
    }
    const restoredQueue = entry.previousQueue ?? queue
    if (entry.previousQueue) {
      setQueue(entry.previousQueue)
    }
    if (entry.requeuedCardStateId !== undefined) {
      const counts = requeueCountsRef.current
      const n = counts.get(entry.requeuedCardStateId) ?? 0
      if (n <= 1) counts.delete(entry.requeuedCardStateId)
      else counts.set(entry.requeuedCardStateId, n - 1)
    }
    // Restore UI state
    setStats(entry.previousStats)
    setCurrentIndex(entry.previousIndex)
    setPhase('back') // Show the card revealed so the user can re-rate
    setIsNewLeech(false)
    if (isComplete) setIsComplete(false)
    undoBufferRef.current = null
    setCanUndo(false)
    SessionRecovery.save({
      sessionId,
      userId,
      mode: 'srs',
      queue: restoredQueue,
      currentIndex: entry.previousIndex,
      stats: entry.previousStats,
      savedAt: Date.now(),
    })
    toast.success('Undone — rate again')
  }, [isComplete, queue, service, sessionId, userId])

  // Wire Ctrl/Cmd+Z to the manager's 'undo' action
  useEffect(() => {
    const manager = getKeyboardShortcutManager()
    const unsubscribe = manager.on('undo', () => {
      void undoLastRating()
    })
    return unsubscribe
  }, [undoLastRating])

  const suspendCurrentCard = useCallback(async () => {
    if (!currentCard) return
    await service.suspendCard(userId, currentCard.cardStateId)
    setIsNewLeech(false)
    const newStats = { ...stats, cardsReviewed: stats.cardsReviewed + 1 }
    setStats(newStats)
    await advance(newStats, currentIndex + 1)
  }, [currentCard, currentIndex, service, stats, userId, advance])

  const buryCurrentCard = useCallback(async () => {
    if (!currentCard) return
    await service.buryCard(userId, currentCard.cardStateId)
    setIsNewLeech(false)
    const newStats = { ...stats, cardsReviewed: stats.cardsReviewed + 1 }
    setStats(newStats)
    await advance(newStats, currentIndex + 1)
  }, [currentCard, currentIndex, service, stats, userId, advance])

  const dismissLeechWarning = useCallback(async () => {
    setIsNewLeech(false)
    const newStats = { ...stats, cardsReviewed: stats.cardsReviewed + 1 }
    setStats(newStats)
    await advance(newStats, currentIndex + 1)
  }, [advance, currentIndex, stats])

  return {
    currentCard,
    currentVariant,
    currentGrammar,
    phase,
    stats,
    isNewLeech,
    intervalPreviews,
    progress: { current: currentIndex + 1, total: queue.length },
    isComplete,
    grammarAnswerCorrect,
    reveal,
    rate,
    suspendCurrentCard,
    buryCurrentCard,
    dismissLeechWarning,
    handleGrammarAnswer,
    undoLastRating,
    canUndo,
  }
}
