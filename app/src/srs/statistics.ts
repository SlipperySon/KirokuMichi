/**
 * Statistics & Analytics Service
 * Tracks study performance and generates insights
 */

import type { Card, ReviewLogEntry } from '../types/card'

export interface DailyStats {
  date: string
  cardsReviewed: number
  newCards: number
  newLearnedCount: number
  reviews: number
  relearns: number
  timeSpent: number // milliseconds
  passRate: number
  correctCount: number
  errorCount: number
}

export interface SessionStats {
  sessionId: string
  startTime: Date
  endTime?: Date
  cardsReviewed: number
  correctCount: number
  errorCount: number
  timeSpent: number // milliseconds
  averageTimePerCard: number
  passRate: number
  easeFactor: number
}

export interface RetentionMetrics {
  daysPassed: number
  passRate: number // percentage
  intervalProgression: number[] // intervals seen
  easeHistory: number[] // ease factors over time
  lapseRate: number // percentage of reviews that failed
}

export interface PerformanceMetrics {
  totalCards: number
  masteredCards: number // interval >= 30 days
  competentCards: number // interval >= 7 days
  learningCards: number
  newCards: number
  averageEase: number
  averageInterval: number
  totalReviewTime: number // milliseconds
  averageReviewTime: number // milliseconds per card
  totalLapses: number
  leeches: number // cards with 8+ lapses
}

export interface GrowthMetrics {
  daysSinceStart: number
  totalCards: number
  cardsPerDay: number
  reviewsPerDay: number
  suspendedCards: number
  deletedCards: number
}

/**
 * Calculate daily statistics
 */
export function calculateDailyStats(
  logs: ReviewLogEntry[],
  date: Date
): DailyStats {
  const dayStart = new Date(date)
  dayStart.setHours(0, 0, 0, 0)
  const dayEnd = new Date(date)
  dayEnd.setHours(23, 59, 59, 999)

  const dayLogs = logs.filter((log) => {
    const logDate = new Date(log.id)
    return logDate >= dayStart && logDate <= dayEnd
  })

  let newCount = 0
  let newLearned = 0
  let reviewCount = 0
  let relearnCount = 0
  let correctCount = 0
  let totalTime = 0

  for (const log of dayLogs) {
    totalTime += log.time

    if (log.ease >= 2) {
      correctCount++
    }

    if (log.type === 0) {
      newCount++
      if (log.ease >= 3) {
        newLearned++
      }
    } else if (log.type === 1) {
      reviewCount++
    } else if (log.type === 2) {
      relearnCount++
    }
  }

  const passRate =
    dayLogs.length > 0 ? Math.round((correctCount / dayLogs.length) * 100) : 0

  return {
    date: date.toISOString().split('T')[0],
    cardsReviewed: dayLogs.length,
    newCards: newCount,
    newLearnedCount: newLearned,
    reviews: reviewCount,
    relearns: relearnCount,
    timeSpent: totalTime,
    passRate,
    correctCount,
    errorCount: dayLogs.length - correctCount,
  }
}

/**
 * Calculate session statistics
 */
export function calculateSessionStats(
  logs: ReviewLogEntry[],
  sessionId: string
): SessionStats {
  let correctCount = 0
  let totalTime = 0

  for (const log of logs) {
    totalTime += log.time
    if (log.ease >= 2) {
      correctCount++
    }
  }

  const errorCount = logs.length - correctCount
  const passRate = logs.length > 0 ? Math.round((correctCount / logs.length) * 100) : 0
  const averageTime = logs.length > 0 ? Math.round(totalTime / logs.length) : 0

  const avgEase =
    logs.length > 0
      ? logs.reduce((sum, log) => sum + log.ease, 0) / logs.length
      : 0

  return {
    sessionId,
    startTime: new Date(),
    cardsReviewed: logs.length,
    correctCount,
    errorCount,
    timeSpent: totalTime,
    averageTimePerCard: averageTime,
    passRate,
    easeFactor: Math.round(avgEase * 100) / 100,
  }
}

/**
 * Calculate retention metrics for a card
 */
export function calculateRetention(
  card: Card,
  logs: ReviewLogEntry[]
): RetentionMetrics {
  const cardLogs = logs.filter((log) => log.cardId === card.id)

  let correctCount = 0
  let lapseCount = 0
  const intervalProgression: number[] = []
  const easeHistory: number[] = []

  for (const log of cardLogs) {
    if (log.ease >= 2) {
      correctCount++
    } else {
      lapseCount++
    }
    intervalProgression.push(log.interval)
    easeHistory.push(log.factor / 1000)
  }

  const passRate =
    cardLogs.length > 0 ? Math.round((correctCount / cardLogs.length) * 100) : 0
  const lapseRate =
    cardLogs.length > 0 ? Math.round((lapseCount / cardLogs.length) * 100) : 0

  const daysSinceEpoch = Math.floor((Date.now() - new Date(2011, 0, 1).getTime()) / (24 * 60 * 60 * 1000))
  const daysPassed = Math.max(0, daysSinceEpoch - card.due)

  return {
    daysPassed,
    passRate,
    intervalProgression,
    easeHistory,
    lapseRate,
  }
}

/**
 * Calculate overall performance metrics
 */
export function calculatePerformanceMetrics(
  cards: Card[]
): PerformanceMetrics {
  let masteredCount = 0
  let competentCount = 0
  let learningCount = 0
  let newCount = 0
  let totalEase = 0
  let totalInterval = 0
  let totalReviewTime = 0
  let leeches = 0
  let totalLapses = 0

  const reviewCount = cards.filter((c) => c.type === 2).length

  for (const card of cards) {
    totalEase += card.easeFactor / 1000
    totalInterval += card.interval
    totalLapses += card.lapses

    if (card.lapses >= 8) {
      leeches++
    }

    // Categorize by state
    if (card.type === 0) {
      newCount++
    } else if (card.type === 1 || card.type === 3) {
      learningCount++
    } else if (card.type === 2) {
      if (card.interval >= 30) {
        masteredCount++
      } else if (card.interval >= 7) {
        competentCount++
      }
    }
  }

  const validCardCount = Math.max(1, cards.length)
  const validReviewCount = Math.max(1, reviewCount)

  return {
    totalCards: cards.length,
    masteredCards: masteredCount,
    competentCards: competentCount,
    learningCards: learningCount,
    newCards: newCount,
    averageEase: Math.round((totalEase / validCardCount) * 100) / 100,
    averageInterval: Math.round(totalInterval / validCardCount),
    totalReviewTime: totalReviewTime,
    averageReviewTime: Math.round(totalReviewTime / validReviewCount),
    totalLapses: totalLapses,
    leeches,
  }
}

/**
 * Calculate growth metrics
 */
export function calculateGrowthMetrics(
  cards: Card[],
  deckCreationDate: Date
): GrowthMetrics {
  const now = new Date()
  const daysSinceStart = Math.floor((now.getTime() - deckCreationDate.getTime()) / (24 * 60 * 60 * 1000))

  const suspendedCards = cards.filter((c) => c.queue === -1).length
  const deletedCards = 0 // Would need to track separately

  const cardsPerDay = daysSinceStart > 0 ? Math.round(cards.length / daysSinceStart) : 0
  const reviewsPerDay = daysSinceStart > 0 ? Math.round(cards.filter((c) => c.type === 2).length / daysSinceStart) : 0

  return {
    daysSinceStart,
    totalCards: cards.length,
    cardsPerDay,
    reviewsPerDay,
    suspendedCards,
    deletedCards,
  }
}

/**
 * Get study streak information
 */
export interface StudyStreak {
  currentStreak: number
  longestStreak: number
  lastStudyDate: Date | null
}

export function calculateStudyStreak(dailyStats: DailyStats[]): StudyStreak {
  if (dailyStats.length === 0) {
    return {
      currentStreak: 0,
      longestStreak: 0,
      lastStudyDate: null,
    }
  }

  const sorted = [...dailyStats].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  let currentStreak = 0
  let longestStreak = 0
  let lastDate: Date | null = null

  for (const stat of sorted) {
    const date = new Date(stat.date)

    if (lastDate === null) {
      lastDate = date
    }

    if (stat.cardsReviewed > 0) {
      currentStreak++

      // Check if consecutive day
      const dayDiff = Math.floor((lastDate.getTime() - date.getTime()) / (24 * 60 * 60 * 1000))
      if (dayDiff > 1) {
        break
      }

      longestStreak = Math.max(longestStreak, currentStreak)
      lastDate = date
    }
  }

  return {
    currentStreak,
    longestStreak,
    lastStudyDate: lastDate,
  }
}

/**
 * Calculate recommended daily limit
 */
export interface RecommendedLimit {
  newCardsPerDay: number
  reviewsPerDay: number
  reasoning: string
}

export function calculateRecommendedLimit(
  metrics: PerformanceMetrics
): RecommendedLimit {
  // Base recommendation
  let newCardsPerDay = 20
  let reviewsPerDay = 200
  let reasoning = 'Default Anki settings'

  // Adjust based on mastery level
  if (metrics.masteredCards > metrics.newCards) {
    newCardsPerDay = 10
    reviewsPerDay = 300
    reasoning = 'High mastery: reduce new, increase review load'
  } else if (metrics.newCards > metrics.masteredCards * 2) {
    newCardsPerDay = 30
    reviewsPerDay = 100
    reasoning = 'High new card load: increase new, reduce review'
  }

  // Adjust based on leeches
  if (metrics.leeches > metrics.totalCards * 0.1) {
    reasoning += '; Consider addressing leeches'
  }

  return {
    newCardsPerDay,
    reviewsPerDay,
    reasoning,
  }
}
