/**
 * Deck Stats - Display deck statistics and progress
 * Shows card counts, retention rate, and study progress
 */

import React, { useMemo } from 'react'
import type { Deck } from '../types/deck'
import type { DeckId } from '../types/card'
import { useDeckStats } from '../store/deckStore'

interface DeckStatsProps {
  deckId: DeckId
  compact?: boolean
}

interface ProgressMetrics {
  totalCards: number
  newCards: number
  learningCards: number
  reviewCards: number
  suspendedCards: number
  estimatedStudyTime: number // in minutes
  progressPercent: number
}

/**
 * Calculate progress metrics for a deck
 */
function calculateMetrics(stats: any): ProgressMetrics {
  const total =
    (stats?.cardCount || 0) +
    (stats?.newCount || 0) +
    (stats?.learningCount || 0) +
    (stats?.reviewCount || 0)

  const readyCards =
    (stats?.newCount || 0) +
    (stats?.learningCount || 0) +
    (stats?.reviewCount || 0)

  // Estimate: 10 seconds per new, 15 per learning, 25 per review
  const estimatedTime = Math.round(
    ((stats?.newCount || 0) * 10 +
      (stats?.learningCount || 0) * 15 +
      (stats?.reviewCount || 0) * 25) /
      60
  )

  const progressPercent = total > 0 ? Math.round((readyCards / total) * 100) : 0

  return {
    totalCards: total,
    newCards: stats?.newCount || 0,
    learningCards: stats?.learningCount || 0,
    reviewCards: stats?.reviewCount || 0,
    suspendedCards: 0, // Would be tracked separately
    estimatedStudyTime: estimatedTime,
    progressPercent,
  }
}

export const DeckStats: React.FC<DeckStatsProps> = ({
  deckId,
  compact = false,
}) => {
  const stats = useDeckStats(deckId)
  const metrics = useMemo(() => calculateMetrics(stats), [stats])

  if (!stats) {
    return (
      <div className="deck-stats loading">
        <p>Loading statistics...</p>
      </div>
    )
  }

  if (compact) {
    return (
      <div className="deck-stats compact">
        <div className="stat-item">
          <span className="stat-label">New:</span>
          <span className="stat-value">{metrics.newCards}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Learning:</span>
          <span className="stat-value">{metrics.learningCards}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Review:</span>
          <span className="stat-value">{metrics.reviewCards}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="deck-stats full">
      {/* Overview Cards */}
      <div className="stats-overview">
        <div className="stat-card">
          <div className="stat-icon new">📚</div>
          <div className="stat-content">
            <div className="stat-value">{metrics.newCards}</div>
            <div className="stat-label">New Cards</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon learning">📖</div>
          <div className="stat-content">
            <div className="stat-value">{metrics.learningCards}</div>
            <div className="stat-label">Learning</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon review">✅</div>
          <div className="stat-content">
            <div className="stat-value">{metrics.reviewCards}</div>
            <div className="stat-label">To Review</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon total">📊</div>
          <div className="stat-content">
            <div className="stat-value">{metrics.totalCards}</div>
            <div className="stat-label">Total Cards</div>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="stats-progress">
        <div className="progress-header">
          <span className="progress-label">Study Progress</span>
          <span className="progress-percent">{metrics.progressPercent}%</span>
        </div>
        <div className="progress-bar-container">
          <div className="progress-bar">
            {metrics.newCards > 0 && (
              <div
                className="progress-segment new"
                style={{
                  width: `${(metrics.newCards / metrics.totalCards) * 100}%`,
                }}
                title={`New: ${metrics.newCards}`}
              />
            )}
            {metrics.learningCards > 0 && (
              <div
                className="progress-segment learning"
                style={{
                  width: `${(metrics.learningCards / metrics.totalCards) * 100}%`,
                }}
                title={`Learning: ${metrics.learningCards}`}
              />
            )}
            {metrics.reviewCards > 0 && (
              <div
                className="progress-segment review"
                style={{
                  width: `${(metrics.reviewCards / metrics.totalCards) * 100}%`,
                }}
                title={`Review: ${metrics.reviewCards}`}
              />
            )}
          </div>
        </div>
      </div>

      {/* Time Estimate */}
      {metrics.estimatedStudyTime > 0 && (
        <div className="stats-time">
          <div className="time-icon">⏱️</div>
          <div className="time-content">
            <div className="time-label">Estimated Study Time</div>
            <div className="time-value">
              {metrics.estimatedStudyTime < 60
                ? `${metrics.estimatedStudyTime} min`
                : `${Math.round(metrics.estimatedStudyTime / 60)} hr`}
            </div>
            <div className="time-note">
              For all due cards today
            </div>
          </div>
        </div>
      )}

      {/* Details Table */}
      <div className="stats-details">
        <h4>Card Status</h4>
        <table className="stats-table">
          <tbody>
            <tr>
              <td className="detail-label">New Cards</td>
              <td className="detail-value">{metrics.newCards}</td>
            </tr>
            <tr>
              <td className="detail-label">Learning Cards</td>
              <td className="detail-value">{metrics.learningCards}</td>
            </tr>
            <tr>
              <td className="detail-label">Review Cards</td>
              <td className="detail-value">{metrics.reviewCards}</td>
            </tr>
            <tr className="total-row">
              <td className="detail-label">Total</td>
              <td className="detail-value">{metrics.totalCards}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default DeckStats
