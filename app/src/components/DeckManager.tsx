/**
 * Deck Manager - Component for managing decks
 * Handles create, delete, rename, and merge operations
 */

import React, { useState, useCallback } from 'react'
import type { Deck, CreateDeckRequest } from '../types/deck'
import type { DeckId } from '../types/card'
import { useDeckStore, useCurrentDeck, useDeckStats } from '../store/deckStore'

interface DeckManagerProps {
  onDeckCreated?: (deck: Deck) => void
  onDeckDeleted?: (deckId: DeckId) => void
  onDeckRenamed?: (deck: Deck) => void
  onDeckMerged?: (targetDeckId: DeckId) => void
}

interface CreateDeckFormState {
  name: string
  isSubmitting: boolean
  error: string | null
}

interface RenameModalState {
  isOpen: boolean
  deckId: DeckId | null
  newName: string
  isSubmitting: boolean
  error: string | null
}

interface MergeModalState {
  isOpen: boolean
  sourceDeckId: DeckId | null
  targetDeckId: DeckId | null
  isSubmitting: boolean
  error: string | null
}

export const DeckManager: React.FC<DeckManagerProps> = ({
  onDeckCreated,
  onDeckDeleted,
  onDeckRenamed,
  onDeckMerged,
}) => {
  const allDecks = useDeckStore((state) => state.allDecks)
  const currentDeck = useCurrentDeck()

  const [createState, setCreateState] = useState<CreateDeckFormState>({
    name: '',
    isSubmitting: false,
    error: null,
  })

  const [renameModal, setRenameModal] = useState<RenameModalState>({
    isOpen: false,
    deckId: null,
    newName: '',
    isSubmitting: false,
    error: null,
  })

  const [mergeModal, setMergeModal] = useState<MergeModalState>({
    isOpen: false,
    sourceDeckId: null,
    targetDeckId: null,
    isSubmitting: false,
    error: null,
  })

  // Create deck
  const handleCreateDeck = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()

      if (!createState.name.trim()) {
        setCreateState((prev) => ({
          ...prev,
          error: 'Deck name cannot be empty',
        }))
        return
      }

      setCreateState((prev) => ({
        ...prev,
        isSubmitting: true,
        error: null,
      }))

      try {
        // In a real app, this would call the API/service
        // For now, just create locally
        const newDeck: Deck = {
          id: Math.floor(Math.random() * 1e10) as any,
          name: createState.name,
          desc: '',
          conf: 1 as any,
          collapsed: false,
          dyn: 0,
        }

        useDeckStore.getState().addDeck(newDeck)
        setCreateState({ name: '', isSubmitting: false, error: null })

        if (onDeckCreated) {
          onDeckCreated(newDeck)
        }
      } catch (error) {
        setCreateState((prev) => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Failed to create deck',
          isSubmitting: false,
        }))
      }
    },
    [createState.name, onDeckCreated]
  )

  // Delete deck
  const handleDeleteDeck = useCallback(
    async (deckId: DeckId) => {
      if (!confirm('Are you sure you want to delete this deck?')) {
        return
      }

      try {
        useDeckStore.getState().removeDeck(deckId)

        if (onDeckDeleted) {
          onDeckDeleted(deckId)
        }
      } catch (error) {
        console.error('Failed to delete deck:', error)
      }
    },
    [onDeckDeleted]
  )

  // Open rename modal
  const handleOpenRename = useCallback((deckId: DeckId, currentName: string) => {
    setRenameModal({
      isOpen: true,
      deckId,
      newName: currentName,
      isSubmitting: false,
      error: null,
    })
  }, [])

  // Close rename modal
  const handleCloseRename = useCallback(() => {
    setRenameModal({
      isOpen: false,
      deckId: null,
      newName: '',
      isSubmitting: false,
      error: null,
    })
  }, [])

  // Submit rename
  const handleSubmitRename = useCallback(async () => {
    if (!renameModal.deckId || !renameModal.newName.trim()) {
      return
    }

    setRenameModal((prev) => ({
      ...prev,
      isSubmitting: true,
      error: null,
    }))

    try {
      const deck = allDecks.find((d) => d.id === renameModal.deckId)
      if (!deck) throw new Error('Deck not found')

      const updated = { ...deck, name: renameModal.newName }
      useDeckStore.getState().updateDeck(updated)

      if (onDeckRenamed) {
        onDeckRenamed(updated)
      }

      handleCloseRename()
    } catch (error) {
      setRenameModal((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to rename deck',
        isSubmitting: false,
      }))
    }
  }, [renameModal, allDecks, onDeckRenamed, handleCloseRename])

  // Open merge modal
  const handleOpenMerge = useCallback((sourceDeckId: DeckId) => {
    setMergeModal({
      isOpen: true,
      sourceDeckId,
      targetDeckId: null,
      isSubmitting: false,
      error: null,
    })
  }, [])

  // Close merge modal
  const handleCloseMerge = useCallback(() => {
    setMergeModal({
      isOpen: false,
      sourceDeckId: null,
      targetDeckId: null,
      isSubmitting: false,
      error: null,
    })
  }, [])

  // Submit merge
  const handleSubmitMerge = useCallback(async () => {
    if (!mergeModal.sourceDeckId || !mergeModal.targetDeckId) {
      return
    }

    setMergeModal((prev) => ({
      ...prev,
      isSubmitting: true,
      error: null,
    }))

    try {
      // In a real app, this would call the API/service to merge decks
      useDeckStore.getState().removeDeck(mergeModal.sourceDeckId)

      if (onDeckMerged) {
        onDeckMerged(mergeModal.targetDeckId)
      }

      handleCloseMerge()
    } catch (error) {
      setMergeModal((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to merge decks',
        isSubmitting: false,
      }))
    }
  }, [mergeModal, onDeckMerged, handleCloseMerge])

  return (
    <div className="deck-manager">
      {/* Create Deck Form */}
      <div className="create-deck-section">
        <h3>Create Deck</h3>
        <form onSubmit={handleCreateDeck} className="create-deck-form">
          <input
            type="text"
            placeholder="Deck name"
            value={createState.name}
            onChange={(e) =>
              setCreateState((prev) => ({
                ...prev,
                name: e.target.value,
                error: null,
              }))
            }
            disabled={createState.isSubmitting}
          />
          <button type="submit" disabled={createState.isSubmitting}>
            {createState.isSubmitting ? 'Creating...' : 'Create'}
          </button>
          {createState.error && (
            <div className="error-message">{createState.error}</div>
          )}
        </form>
      </div>

      {/* Current Deck Actions */}
      {currentDeck && (
        <div className="current-deck-actions">
          <h4>Current Deck: {currentDeck.name}</h4>
          <div className="action-buttons">
            <button
              onClick={() => handleOpenRename(currentDeck.id, currentDeck.name)}
              className="btn-secondary"
            >
              Rename
            </button>
            <button
              onClick={() => handleOpenMerge(currentDeck.id)}
              className="btn-secondary"
            >
              Merge
            </button>
            <button
              onClick={() => handleDeleteDeck(currentDeck.id)}
              className="btn-danger"
            >
              Delete
            </button>
          </div>
        </div>
      )}

      {/* Rename Modal */}
      {renameModal.isOpen && renameModal.deckId && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Rename Deck</h3>
            <input
              type="text"
              value={renameModal.newName}
              onChange={(e) =>
                setRenameModal((prev) => ({
                  ...prev,
                  newName: e.target.value,
                }))
              }
              disabled={renameModal.isSubmitting}
            />
            {renameModal.error && (
              <div className="error-message">{renameModal.error}</div>
            )}
            <div className="modal-actions">
              <button
                onClick={handleCloseRename}
                disabled={renameModal.isSubmitting}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitRename}
                disabled={renameModal.isSubmitting}
              >
                {renameModal.isSubmitting ? 'Renaming...' : 'Rename'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Merge Modal */}
      {mergeModal.isOpen && mergeModal.sourceDeckId && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Merge Deck</h3>
            <p>Select the target deck to merge into:</p>
            <select
              value={mergeModal.targetDeckId || ''}
              onChange={(e) =>
                setMergeModal((prev) => ({
                  ...prev,
                  targetDeckId: Number(e.target.value) as any,
                }))
              }
              disabled={mergeModal.isSubmitting}
            >
              <option value="">-- Select a deck --</option>
              {allDecks
                .filter((d) => d.id !== mergeModal.sourceDeckId)
                .map((deck) => (
                  <option key={deck.id} value={deck.id}>
                    {deck.name}
                  </option>
                ))}
            </select>
            {mergeModal.error && (
              <div className="error-message">{mergeModal.error}</div>
            )}
            <div className="modal-actions">
              <button
                onClick={handleCloseMerge}
                disabled={mergeModal.isSubmitting}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitMerge}
                disabled={mergeModal.isSubmitting || !mergeModal.targetDeckId}
              >
                {mergeModal.isSubmitting ? 'Merging...' : 'Merge'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default DeckManager
