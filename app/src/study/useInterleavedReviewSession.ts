import { useState, useCallback } from 'react'
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
  getNextCard: () => ReviewCard | null
}

export function useInterleavedReviewSession(
  userId: number,
  service: SRSService,
  initialQueue: ReviewCard[],
  sessionId: number | string
): InterleavedReviewState & InterleavedReviewActions {
  const [activeQueue, setActiveQueue] = useState<ReviewCard[]>(initialQueue || [])
  const [replayQueue, setReplayQueue] = useState<ReviewCard[]>([])
  const [phase, setPhase] = useState<'front' | 'back'>('front')
  const [isComplete, setIsComplete] = useState(initialQueue?.length === 0)
  const [currentRating, setCurrentRating] = useState<Rating | null>(null)
  const [stats, setStats] = useState<SessionStats>({
    cardsReviewed: 0,
    correctCount: 0,
    startedAt: Date.now(),
    replayCount: 0,
    totalReplays: 0,
    improvementCount: 0,
  })

  /**
   * Get the next card to show
   * Prioritizes replay queue, then cycles back to active queue
   */
  const getNextCard = useCallback((): ReviewCard | null => {
    // If we have cards in replay queue and it's time to show one
    if (replayQueue.length > 0) {
      // Show a replay card with some probability based on queue sizes
      // More replays when replay queue is large
      const showReplay = replayQueue.length > activeQueue.length * 0.3
      if (showReplay) {
        return replayQueue[0] ?? null
      }
    }

    // Otherwise, show from active queue
    if (activeQueue.length > 0) {
      return activeQueue[0] ?? null
    }

    // Fallback: try replay queue if active is empty
    if (replayQueue.length > 0) {
      return replayQueue[0] ?? null
    }

    return null
  }, [activeQueue, replayQueue])

  const currentCard = isComplete ? null : getNextCard()

  /**
   * Build preview of next ~5 cards in queue for UI display
   */
  const nextQueuePreview = (() => {
    const preview: string[] = []
    // Show 1-2 from active queue
    if (activeQueue.length > 0) {
      preview.push(activeQueue[0].front)
      if (activeQueue.length > 1) preview.push(activeQueue[1].front)
    }
    // Show indicator if replays coming
    if (replayQueue.length > 0) {
      preview.push(`Review: ${replayQueue[0].front}`)
    }
    return preview
  })()

  const reveal = useCallback(() => setPhase('back'), [])

  /**
   * Rate a card and manage queue mechanics
   * Higher difficulty cards are added to replay queue more often
   */
  const rate = useCallback(
    async (rating: Rating) => {
      if (!currentCard || isComplete) return

      setCurrentRating(rating)
      const isCorrect = rating !== 'again'

      // Track the rating on the card for later analysis
      if (currentCard.isReplay) {
        currentCard.replayRating = rating
      } else {
        currentCard.originalRating = rating
      }

      // Update SRS state
      try {
        await service.reviewCard(userId, currentCard.cardStateId, rating)

        if (!isCorrect && !currentCard.isReplay) {
          // sessionId can be a string or number, coerce to number for logging
          const numSessionId = typeof sessionId === 'string' ? parseInt(sessionId, 10) : sessionId
          await service.logMistake(userId, currentCard.cardId, null, currentCard.front, numSessionId)
        }
      } catch (error) {
        console.error('Error rating card:', error)
      }

      // Update stats
      const newStats: SessionStats = {
        ...stats,
        cardsReviewed: stats.cardsReviewed + 1,
        correctCount: stats.correctCount + (isCorrect ? 1 : 0),
        replayCount: (stats.replayCount ?? 0) + (currentCard.isReplay ? 1 : 0),
        totalReplays: (stats.totalReplays ?? 0) + (currentCard.isReplay ? 1 : 0),
        improvementCount:
          (stats.improvementCount ?? 0) +
          (currentCard.isReplay && currentCard.originalRating === 'again' && isCorrect ? 1 : 0),
      }
      setStats(newStats)

      // Manage queue mechanics
      // Remove from current queue
      if (currentCard.isReplay) {
        setReplayQueue((prev) => prev.slice(1))
      } else {
        setActiveQueue((prev) => prev.slice(1))
      }

      // Add to replay queue with probability based on difficulty (rating)
      // Harder cards (rating 1-2) appear 3-4x, medium cards (rating 3) appear 2x, easy cards (rating 4) appear 1x
      const replayProbability =
        rating === 'again' ? 0.9 : rating === 'hard' ? 0.7 : rating === 'good' ? 0.4 : 0.1

      if (Math.random() < replayProbability) {
        const replayCard = { ...currentCard, isReplay: true }
        setReplayQueue((prev) => [...prev, replayCard])
      }

      // Check if we're done (all cards reviewed and no replays left)
      const remainingActive = activeQueue.slice(1).length
      if (remainingActive === 0 && replayQueue.length === 0) {
        setIsComplete(true)
      } else {
        // Move to next card
        setPhase('front')
        setCurrentRating(null)
      }
    },
    [currentCard, isComplete, stats, service, userId, sessionId, activeQueue, replayQueue]
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
    getNextCard,
  }
}
