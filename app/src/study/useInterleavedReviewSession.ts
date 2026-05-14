import { useState, useCallback, useEffect } from 'react'
import type { Rating } from '../core/providers'
import { SRSService } from '../srs/srsService'
import type { ReviewCard, SessionStats } from './types'

/**
 * Interleaved Review Session Hook for Immersion Mode
 * Manages a queue of cards that cycles through naturally with replay mechanics
 * Cards are shown multiple times based on difficulty (harder cards appear more often)
 */

interface InterleavedReviewState {
  activeQueue: ReviewCard[]
  replayQueue: ReviewCard[]
  currentCard: ReviewCard | null
  phase: 'front' | 'back'
  stats: SessionStats
  progress: { reviewed: number; total: number }
  isComplete: boolean
  currentRating: Rating | null
  nextQueuePreview: string[]
}

interface InterleavedReviewActions {
  reveal: () => void
  rate: (rating: Rating) => Promise<void>
}

export function useInterleavedReviewSession(
  userId: number,
  service: SRSService,
  initialQueue: ReviewCard[],
  sessionId: number | string
): InterleavedReviewState & InterleavedReviewActions {
  const [activeQueue, setActiveQueue] = useState<ReviewCard[]>([])
  const [replayQueue, setReplayQueue] = useState<ReviewCard[]>([])
  const [phase, setPhase] = useState<'front' | 'back'>('front')
  const [currentRating, setCurrentRating] = useState<Rating | null>(null)
  const [stats, setStats] = useState<SessionStats>({
    cardsReviewed: 0,
    correctCount: 0,
    startedAt: Date.now(),
    replayCount: 0,
    totalReplays: 0,
    improvementCount: 0,
  })

  // Sync activeQueue when initialQueue changes (fixes initialization bug)
  useEffect(() => {
    setActiveQueue(initialQueue || [])
  }, [initialQueue])

  // Derive currentCard from state rather than computing on render (fixes non-determinism)
  const hasCards = activeQueue.length > 0 || replayQueue.length > 0
  const isComplete = !hasCards && stats.cardsReviewed > 0

  // Determine which card to show based on queue state
  const currentCard = (() => {
    if (isComplete) return null
    if (replayQueue.length > 0 && replayQueue.length > activeQueue.length * 0.3) {
      return replayQueue[0] ?? null
    }
    if (activeQueue.length > 0) return activeQueue[0] ?? null
    if (replayQueue.length > 0) return replayQueue[0] ?? null
    return null
  })()

  /**
   * Build preview of next cards for UI display
   */
  const nextQueuePreview = (() => {
    const preview: string[] = []
    if (activeQueue.length > 0) {
      preview.push(activeQueue[0].front)
      if (activeQueue.length > 1) preview.push(activeQueue[1].front)
    }
    if (replayQueue.length > 0) {
      preview.push(`Review: ${replayQueue[0].front}`)
    }
    return preview
  })()

  const reveal = useCallback(() => setPhase('back'), [])

  /**
   * Rate a card and manage queue mechanics
   * Uses functional updaters to avoid stale closure issues
   */
  const rate = useCallback(
    async (rating: Rating) => {
      if (!currentCard || isComplete) return

      setCurrentRating(rating)
      const isCorrect = rating !== 'again'

      // Clone card to avoid mutation (bug fix #5)
      const ratedCard: ReviewCard = {
        ...currentCard,
        isReplay: currentCard.isReplay,
        originalRating: currentCard.isReplay ? currentCard.originalRating : rating,
        replayRating: currentCard.isReplay ? rating : currentCard.replayRating,
      }

      // Update SRS state
      try {
        await service.reviewCard(userId, currentCard.cardStateId, rating)

        if (!isCorrect && !currentCard.isReplay) {
          const numSessionId = typeof sessionId === 'string' ? parseInt(sessionId, 10) : sessionId
          await service.logMistake(userId, currentCard.cardId, null, currentCard.front, numSessionId)
        }
      } catch (error) {
        console.error('Error rating card:', error)
      }

      // Update stats using functional updater (fixes stale closure)
      setStats((prev) => {
        const newStats: SessionStats = {
          ...prev,
          cardsReviewed: prev.cardsReviewed + 1,
          correctCount: prev.correctCount + (isCorrect ? 1 : 0),
          replayCount: (prev.replayCount ?? 0) + (currentCard.isReplay ? 1 : 0),
          totalReplays: (prev.totalReplays ?? 0) + (currentCard.isReplay ? 1 : 0),
          improvementCount:
            (prev.improvementCount ?? 0) +
            (currentCard.isReplay && currentCard.originalRating === 'again' && isCorrect ? 1 : 0),
        }
        return newStats
      })

      // Manage queue using functional updaters (fixes stale closure)
      if (currentCard.isReplay) {
        setReplayQueue((prev) => prev.slice(1))
      } else {
        setActiveQueue((prev) => prev.slice(1))
      }

      // Add to replay queue with probability based on difficulty
      const replayProbability =
        rating === 'again' ? 0.9 : rating === 'hard' ? 0.7 : rating === 'good' ? 0.4 : 0.1

      if (Math.random() < replayProbability) {
        setReplayQueue((prev) => [...prev, ratedCard])
      }

      // Move to next card
      setPhase('front')
      setCurrentRating(null)
    },
    [currentCard, isComplete, service, userId, sessionId]
  )

  return {
    activeQueue,
    replayQueue,
    currentCard,
    phase,
    stats,
    progress: { reviewed: stats.cardsReviewed, total: activeQueue.length + replayQueue.length },
    isComplete,
    currentRating,
    nextQueuePreview,
    reveal,
    rate,
  }
}
