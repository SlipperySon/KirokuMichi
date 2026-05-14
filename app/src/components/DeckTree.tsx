/**
 * Deck Tree - Hierarchical deck navigation component
 * Displays deck tree with collapsible sections and statistics
 */

import React, { useCallback } from 'react'
import type { DeckNode } from '../types/deck'
import type { DeckId } from '../types/card'
import { useDeckStore, useDeckStats } from '../store/deckStore'

interface DeckTreeProps {
  tree: DeckNode
  onDeckSelect?: (deckId: DeckId) => void
  compact?: boolean
}

interface DeckNodeProps {
  node: DeckNode
  level: number
  onDeckSelect?: (deckId: DeckId) => void
  compact?: boolean
}

const DeckNodeItem: React.FC<DeckNodeProps> = ({
  node,
  level,
  onDeckSelect,
  compact = false,
}) => {
  const currentDeckId = useDeckStore((state) => state.currentDeckId)
  const isExpanded = useDeckStore((state) => state.expandedDecks.has(node.id))
  const toggleExpanded = useDeckStore((state) => state.toggleDeckExpanded)
  const stats = useDeckStats(node.id)

  const handleClick = useCallback(() => {
    if (onDeckSelect) {
      onDeckSelect(node.id)
    } else {
      useDeckStore.getState().setCurrentDeck(node.id)
    }
  }, [node.id, onDeckSelect])

  const handleToggleExpand = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    toggleExpanded(node.id)
  }, [node.id, toggleExpanded])

  const isSelected = currentDeckId === node.id
  const hasChildren = node.children && node.children.length > 0
  const paddingLeft = compact ? `${level * 1}rem` : `${level * 1.5}rem`

  return (
    <div className="deck-node-item" key={node.id}>
      <div
        className={`deck-node-header ${isSelected ? 'selected' : ''}`}
        style={{ paddingLeft }}
        onClick={handleClick}
      >
        {hasChildren && (
          <button
            className={`expand-button ${isExpanded ? 'expanded' : ''}`}
            onClick={handleToggleExpand}
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            ▶
          </button>
        )}
        {!hasChildren && <span className="expand-spacer" />}

        <span className="deck-name">{node.name}</span>

        {!compact && stats && (
          <span className="deck-counts">
            {stats.newCount > 0 && (
              <span className="count-badge new">{stats.newCount}</span>
            )}
            {stats.learningCount > 0 && (
              <span className="count-badge learning">{stats.learningCount}</span>
            )}
            {stats.reviewCount > 0 && (
              <span className="count-badge review">{stats.reviewCount}</span>
            )}
          </span>
        )}
      </div>

      {isExpanded && hasChildren && (
        <div className="deck-children">
          {node.children.map((child) => (
            <DeckNodeItem
              key={child.id}
              node={child}
              level={level + 1}
              onDeckSelect={onDeckSelect}
              compact={compact}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export const DeckTree: React.FC<DeckTreeProps> = ({
  tree,
  onDeckSelect,
  compact = false,
}) => {
  return (
    <div className={`deck-tree ${compact ? 'compact' : 'full'}`}>
      <div className="deck-tree-content">
        <DeckNodeItem
          node={tree}
          level={0}
          onDeckSelect={onDeckSelect}
          compact={compact}
        />
      </div>
    </div>
  )
}

export default DeckTree
