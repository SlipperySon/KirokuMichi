/**
 * Deck Store - Zustand store for managing deck state and operations
 * Handles deck switching, navigation, and UI state
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Deck, DeckNode, DeckCounts } from '../types/deck'
import type { DeckId } from '../types/card'
import { makeDeckId } from '../types/card'

interface DeckStats {
  id: DeckId
  name: string
  cardCount: number
  newCount: number
  learningCount: number
  reviewCount: number
}

interface DeckStoreState {
  // Current state
  currentDeckId: DeckId | null
  allDecks: Deck[]
  deckTree: DeckNode | null
  deckStats: Map<DeckId, DeckStats>
  expandedDecks: Set<DeckId>

  // UI state
  isLoading: boolean
  selectedDeckIds: Set<DeckId>
  searchQuery: string

  // Deck operations
  setCurrentDeck: (deckId: DeckId) => void
  setAllDecks: (decks: Deck[]) => void
  setDeckTree: (tree: DeckNode) => void
  addDeck: (deck: Deck) => void
  removeDeck: (deckId: DeckId) => void
  updateDeck: (deck: Deck) => void
  updateDeckStats: (deckId: DeckId, stats: Partial<DeckStats>) => void

  // Navigation
  toggleDeckExpanded: (deckId: DeckId) => void
  toggleDeckSelected: (deckId: DeckId) => void
  selectMultipleDeckIds: (deckIds: DeckId[]) => void
  clearSelection: () => void

  // Search
  setSearchQuery: (query: string) => void
  getFilteredDecks: () => Deck[]

  // UI
  setLoading: (isLoading: boolean) => void
  reset: () => void
}

const initialState = {
  currentDeckId: null,
  allDecks: [],
  deckTree: null,
  deckStats: new Map(),
  expandedDecks: new Set(),
  isLoading: false,
  selectedDeckIds: new Set(),
  searchQuery: '',
}

export const useDeckStore = create<DeckStoreState>()(
  persist(
    (set, get) => ({
      ...initialState,

      setCurrentDeck: (deckId: DeckId) => {
        set({ currentDeckId: deckId })
      },

      setAllDecks: (decks: Deck[]) => {
        set({ allDecks: decks })
      },

      setDeckTree: (tree: DeckNode) => {
        set({ deckTree: tree })
      },

      addDeck: (deck: Deck) => {
        set((state) => ({
          allDecks: [...state.allDecks, deck],
        }))
      },

      removeDeck: (deckId: DeckId) => {
        set((state) => ({
          allDecks: state.allDecks.filter(d => d.id !== deckId),
          currentDeckId: state.currentDeckId === deckId ? null : state.currentDeckId,
        }))
      },

      updateDeck: (deck: Deck) => {
        set((state) => ({
          allDecks: state.allDecks.map(d => (d.id === deck.id ? deck : d)),
        }))
      },

      updateDeckStats: (deckId: DeckId, stats: Partial<DeckStats>) => {
        set((state) => {
          const newStats = new Map(state.deckStats)
          const existing = newStats.get(deckId) || {
            id: deckId,
            name: '',
            cardCount: 0,
            newCount: 0,
            learningCount: 0,
            reviewCount: 0,
          }
          newStats.set(deckId, { ...existing, ...stats })
          return { deckStats: newStats }
        })
      },

      toggleDeckExpanded: (deckId: DeckId) => {
        set((state) => {
          const newExpanded = new Set(state.expandedDecks)
          if (newExpanded.has(deckId)) {
            newExpanded.delete(deckId)
          } else {
            newExpanded.add(deckId)
          }
          return { expandedDecks: newExpanded }
        })
      },

      toggleDeckSelected: (deckId: DeckId) => {
        set((state) => {
          const newSelected = new Set(state.selectedDeckIds)
          if (newSelected.has(deckId)) {
            newSelected.delete(deckId)
          } else {
            newSelected.add(deckId)
          }
          return { selectedDeckIds: newSelected }
        })
      },

      selectMultipleDeckIds: (deckIds: DeckId[]) => {
        set({ selectedDeckIds: new Set(deckIds) })
      },

      clearSelection: () => {
        set({ selectedDeckIds: new Set() })
      },

      setSearchQuery: (query: string) => {
        set({ searchQuery: query })
      },

      getFilteredDecks: () => {
        const state = get()
        if (!state.searchQuery) return state.allDecks

        const query = state.searchQuery.toLowerCase()
        return state.allDecks.filter(deck =>
          deck.name.toLowerCase().includes(query)
        )
      },

      setLoading: (isLoading: boolean) => {
        set({ isLoading })
      },

      reset: () => {
        set(initialState)
      },
    }),
    {
      name: 'deck-store',
      partialize: (state) => ({
        currentDeckId: state.currentDeckId,
        selectedDeckIds: Array.from(state.selectedDeckIds),
        expandedDecks: Array.from(state.expandedDecks),
        searchQuery: state.searchQuery,
      }),
      merge: (persistedState, currentState) => {
        return {
          ...currentState,
          ...(persistedState as any),
          selectedDeckIds: new Set((persistedState as any)?.selectedDeckIds || []),
          expandedDecks: new Set((persistedState as any)?.expandedDecks || []),
        }
      },
    }
  )
)

/**
 * Get deck by ID from store
 */
export function useDeckById(deckId: DeckId | null) {
  const allDecks = useDeckStore((state) => state.allDecks)
  if (!deckId) return null
  return allDecks.find(d => d.id === deckId) || null
}

/**
 * Get current deck from store
 */
export function useCurrentDeck() {
  const currentDeckId = useDeckStore((state) => state.currentDeckId)
  return useDeckById(currentDeckId)
}

/**
 * Get deck stats from store
 */
export function useDeckStats(deckId: DeckId) {
  return useDeckStore((state) => state.deckStats.get(deckId) || null)
}
