/**
 * Card Browser - Search, filter, and bulk edit cards
 * Implements advanced card management and discovery
 */

import React, { useState, useCallback, useMemo } from 'react'
import type { Card } from '../types/card'
import type { DeckId } from '../types/card'
import { useCurrentDeck } from '../store/deckStore'

interface CardBrowserProps {
  cards: Card[]
  onCardSelected?: (cardId: number) => void
  onBulkUpdate?: (cardIds: number[], updates: Partial<Card>) => void
}

interface SearchFilters {
  query: string
  cardType?: 0 | 1 | 2 | 3 | null
  cardQueue?: number | null
  minInterval?: number
  maxInterval?: number
  minEase?: number
  tags?: string[]
  hasLapses?: boolean
  isLeech?: boolean
}

interface SortOption {
  field: keyof Card
  direction: 'asc' | 'desc'
}

interface CardViewRow {
  card: Card
  selected: boolean
  fieldDisplay: string
}

export const CardBrowser: React.FC<CardBrowserProps> = ({
  cards,
  onCardSelected,
  onBulkUpdate,
}) => {
  const [filters, setFilters] = useState<SearchFilters>({
    query: '',
    cardType: null,
    cardQueue: null,
    minInterval: 0,
    maxInterval: 36500,
    minEase: 1.3,
    tags: [],
    hasLapses: false,
    isLeech: false,
  })

  const [sort, setSort] = useState<SortOption>({
    field: 'due',
    direction: 'asc',
  })

  const [selectedCards, setSelectedCards] = useState<Set<number>>(new Set())
  const [bulkAction, setBulkAction] = useState<string | null>(null)

  // Filter cards based on criteria
  const filteredCards = useMemo(() => {
    return cards.filter((card) => {
      // Query filter - search in card content
      if (filters.query) {
        const queryLower = filters.query.toLowerCase()
        // In real implementation, would search card fields
        // For now, just search card metadata
        if (!card.id.toString().includes(queryLower)) {
          return false
        }
      }

      // Card type filter
      if (filters.cardType !== null && card.type !== filters.cardType) {
        return false
      }

      // Card queue filter
      if (filters.cardQueue !== null && card.queue !== filters.cardQueue) {
        return false
      }

      // Interval range filter
      if (card.interval < filters.minInterval || card.interval > filters.maxInterval) {
        return false
      }

      // Ease factor filter
      const easeFactor = card.easeFactor / 1000
      if (easeFactor < filters.minEase) {
        return false
      }

      // Lapse filter
      if (filters.hasLapses && card.lapses === 0) {
        return false
      }

      // Leech filter
      if (filters.isLeech && card.lapses < 8) {
        return false
      }

      return true
    })
  }, [cards, filters])

  // Sort filtered cards
  const sortedCards = useMemo(() => {
    const sorted = [...filteredCards]
    sorted.sort((a, b) => {
      const aValue = a[sort.field]
      const bValue = b[sort.field]

      if (aValue === undefined || bValue === undefined) return 0
      if (aValue < bValue) return sort.direction === 'asc' ? -1 : 1
      if (aValue > bValue) return sort.direction === 'asc' ? 1 : -1
      return 0
    })
    return sorted
  }, [filteredCards, sort])

  // Toggle card selection
  const toggleCardSelection = useCallback((cardId: number) => {
    setSelectedCards((prev) => {
      const next = new Set(prev)
      if (next.has(cardId)) {
        next.delete(cardId)
      } else {
        next.add(cardId)
      }
      return next
    })
  }, [])

  // Select all visible cards
  const selectAllVisible = useCallback(() => {
    const allIds = new Set(sortedCards.map((c) => c.id))
    setSelectedCards(allIds)
  }, [sortedCards])

  // Clear selection
  const clearSelection = useCallback(() => {
    setSelectedCards(new Set())
  }, [])

  // Handle bulk actions
  const handleBulkAction = useCallback(async () => {
    if (!bulkAction || selectedCards.size === 0 || !onBulkUpdate) {
      return
    }

    const cardIds = Array.from(selectedCards)

    try {
      switch (bulkAction) {
        case 'suspend':
          onBulkUpdate(cardIds, { queue: -1 })
          break
        case 'unsuspend':
          onBulkUpdate(cardIds, { queue: 2 }) // Review queue
          break
        case 'bury':
          onBulkUpdate(cardIds, { queue: -3 })
          break
        case 'delete':
          if (confirm(`Delete ${cardIds.length} cards?`)) {
            // Would trigger deletion
            clearSelection()
          }
          break
        case 'reset':
          onBulkUpdate(cardIds, {
            type: 0,
            queue: 0,
            due: 0,
            interval: 0,
            easeFactor: 2500,
            lapses: 0,
          })
          break
        case 'reschedule':
          const days = prompt('Reschedule to how many days from now?')
          if (days) {
            // Would reschedule to specific interval
          }
          break
      }
    } catch (error) {
      console.error('Bulk action failed:', error)
    }
  }, [bulkAction, selectedCards, onBulkUpdate, clearSelection])

  const cardTypeNames: Record<number, string> = {
    0: 'New',
    1: 'Learning',
    2: 'Review',
    3: 'Relearning',
  }

  const cardQueueNames: Record<number, string> = {
    0: 'New',
    1: 'Learning',
    2: 'Review',
    3: 'Day Learn',
    4: 'Preview',
    '-1': 'Suspended',
    '-2': 'Buried (Scheduler)',
    '-3': 'Buried (User)',
  }

  return (
    <div className="card-browser">
      {/* Filter Panel */}
      <div className="browser-filters">
        <div className="filter-section">
          <label>Search</label>
          <input
            type="text"
            placeholder="Search cards..."
            value={filters.query}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, query: e.target.value }))
            }
          />
        </div>

        <div className="filter-section">
          <label>Card Type</label>
          <select
            value={filters.cardType ?? ''}
            onChange={(e) =>
              setFilters((prev) => ({
                ...prev,
                cardType: e.target.value ? (Number(e.target.value) as any) : null,
              }))
            }
          >
            <option value="">All</option>
            <option value="0">New</option>
            <option value="1">Learning</option>
            <option value="2">Review</option>
            <option value="3">Relearning</option>
          </select>
        </div>

        <div className="filter-section">
          <label>Interval Range</label>
          <input
            type="number"
            placeholder="Min"
            value={filters.minInterval}
            onChange={(e) =>
              setFilters((prev) => ({
                ...prev,
                minInterval: Number(e.target.value),
              }))
            }
          />
          <span>-</span>
          <input
            type="number"
            placeholder="Max"
            value={filters.maxInterval}
            onChange={(e) =>
              setFilters((prev) => ({
                ...prev,
                maxInterval: Number(e.target.value),
              }))
            }
          />
        </div>

        <div className="filter-section">
          <label>
            <input
              type="checkbox"
              checked={filters.hasLapses}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  hasLapses: e.target.checked,
                }))
              }
            />
            Cards with Lapses
          </label>
        </div>

        <div className="filter-section">
          <label>
            <input
              type="checkbox"
              checked={filters.isLeech}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  isLeech: e.target.checked,
                }))
              }
            />
            Leeches Only
          </label>
        </div>
      </div>

      {/* Selection Bar */}
      {selectedCards.size > 0 && (
        <div className="selection-bar">
          <span>{selectedCards.size} card(s) selected</span>
          <button onClick={clearSelection}>Clear</button>
          <button onClick={selectAllVisible}>Select All Visible</button>

          <select
            value={bulkAction ?? ''}
            onChange={(e) => setBulkAction(e.target.value || null)}
          >
            <option value="">-- Action --</option>
            <option value="suspend">Suspend</option>
            <option value="unsuspend">Unsuspend</option>
            <option value="bury">Bury</option>
            <option value="reset">Reset</option>
            <option value="reschedule">Reschedule</option>
            <option value="delete">Delete</option>
          </select>

          <button onClick={handleBulkAction} disabled={!bulkAction}>
            Apply
          </button>
        </div>
      )}

      {/* Card Table */}
      <div className="card-table">
        <table>
          <thead>
            <tr>
              <th width="40">
                <input
                  type="checkbox"
                  checked={selectedCards.size === sortedCards.length}
                  onChange={(e) => {
                    if (e.target.checked) {
                      selectAllVisible()
                    } else {
                      clearSelection()
                    }
                  }}
                />
              </th>
              <th onClick={() => setSort({ field: 'id', direction: 'asc' })}>
                ID {sort.field === 'id' ? (sort.direction === 'asc' ? '↑' : '↓') : ''}
              </th>
              <th onClick={() => setSort({ field: 'type', direction: 'asc' })}>
                Type {sort.field === 'type' ? (sort.direction === 'asc' ? '↑' : '↓') : ''}
              </th>
              <th onClick={() => setSort({ field: 'queue', direction: 'asc' })}>
                Queue {sort.field === 'queue' ? (sort.direction === 'asc' ? '↑' : '↓') : ''}
              </th>
              <th onClick={() => setSort({ field: 'due', direction: 'asc' })}>
                Due {sort.field === 'due' ? (sort.direction === 'asc' ? '↑' : '↓') : ''}
              </th>
              <th onClick={() => setSort({ field: 'interval', direction: 'asc' })}>
                Interval {sort.field === 'interval' ? (sort.direction === 'asc' ? '↑' : '↓') : ''}
              </th>
              <th onClick={() => setSort({ field: 'easeFactor', direction: 'asc' })}>
                Ease {sort.field === 'easeFactor' ? (sort.direction === 'asc' ? '↑' : '↓') : ''}
              </th>
              <th onClick={() => setSort({ field: 'reps', direction: 'asc' })}>
                Reps {sort.field === 'reps' ? (sort.direction === 'asc' ? '↑' : '↓') : ''}
              </th>
              <th onClick={() => setSort({ field: 'lapses', direction: 'asc' })}>
                Lapses {sort.field === 'lapses' ? (sort.direction === 'asc' ? '↑' : '↓') : ''}
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedCards.map((card) => (
              <tr
                key={card.id}
                className={selectedCards.has(card.id) ? 'selected' : ''}
                onClick={() => {
                  onCardSelected?.(card.id)
                }}
              >
                <td>
                  <input
                    type="checkbox"
                    checked={selectedCards.has(card.id)}
                    onChange={(e) => {
                      e.stopPropagation()
                      toggleCardSelection(card.id)
                    }}
                  />
                </td>
                <td>{card.id}</td>
                <td>{cardTypeNames[card.type]}</td>
                <td>{cardQueueNames[card.queue.toString() as any]}</td>
                <td>{card.due}</td>
                <td>{card.interval}</td>
                <td>{(card.easeFactor / 1000).toFixed(2)}</td>
                <td>{card.reps}</td>
                <td>
                  {card.lapses > 0 && (
                    <span className={card.lapses >= 8 ? 'leech' : 'warning'}>
                      {card.lapses}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {sortedCards.length === 0 && (
          <div className="no-results">
            <p>No cards match the current filters</p>
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="browser-summary">
        <span>Showing {sortedCards.length} of {cards.length} cards</span>
      </div>
    </div>
  )
}

export default CardBrowser
