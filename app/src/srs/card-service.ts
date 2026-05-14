/**
 * Card Service - CRUD operations for cards
 * Handles database operations for creating, reading, updating cards
 */

import type { Card, CardId, CardResponse, CardType, CardQueue, ScheduleResult, ReviewLogEntry } from '../types/card'
import type { DeckConfig } from '../types/deck'
import { scheduleCard } from './sm2-scheduler'

/**
 * Mock database interface (would be replaced with actual DB in production)
 */
export interface CardDatabase {
  // Create
  insertCard(card: Omit<Card, 'id'>): Promise<Card>

  // Read
  getCard(cardId: CardId): Promise<Card | null>
  getCardsByDeck(deckId: number): Promise<Card[]>
  getCardsByNote(noteId: number): Promise<Card[]>
  getAllCards(): Promise<Card[]>
  getCardsByState(type: CardType): Promise<Card[]>
  getCardsByQueue(queue: CardQueue): Promise<Card[]>

  // Update
  updateCard(card: Card): Promise<void>
  updateCards(cards: Card[]): Promise<void>

  // Delete
  deleteCard(cardId: CardId): Promise<void>
  deleteCardsByNote(noteId: number): Promise<void>

  // Batch operations
  getCardCount(deckId: number): Promise<number>
  getCardCountByType(deckId: number, type: CardType): Promise<number>
}

/**
 * Card Service - business logic layer for cards
 */
export class CardService {
  constructor(private db: CardDatabase) {}

  /**
   * Create a new card
   */
  async createCard(
    noteId: number,
    deckId: number,
    templateIdx: number
  ): Promise<Card> {
    const card = await this.db.insertCard({
      noteId: noteId as any,
      deckId: deckId as any,
      templateIdx,
      type: 0, // New
      queue: 0, // New queue
      due: 0,
      interval: 0,
      easeFactor: 2500, // 2.5
      reps: 0,
      lapses: 0,
      remainingSteps: 0,
      originalDue: 0,
      originalDeckId: deckId as any,
      flags: 0,
      mtime: Math.floor(Date.now() / 1000),
      usn: -1,
      customData: '',
    })

    return card
  }

  /**
   * Get a card by ID
   */
  async getCard(cardId: CardId): Promise<Card | null> {
    return this.db.getCard(cardId)
  }

  /**
   * Get all cards in a deck (including child decks)
   */
  async getCardsByDeck(deckId: number): Promise<Card[]> {
    return this.db.getCardsByDeck(deckId)
  }

  /**
   * Get all cards for a note
   */
  async getCardsByNote(noteId: number): Promise<Card[]> {
    return this.db.getCardsByNote(noteId)
  }

  /**
   * Update a single card
   */
  async updateCard(card: Card): Promise<void> {
    card.mtime = Math.floor(Date.now() / 1000)
    card.usn = -1 // Unsynchronized
    await this.db.updateCard(card)
  }

  /**
   * Update multiple cards in batch
   */
  async updateCards(cards: Card[]): Promise<void> {
    const now = Math.floor(Date.now() / 1000)
    cards.forEach(card => {
      card.mtime = now
      card.usn = -1
    })
    await this.db.updateCards(cards)
  }

  /**
   * Answer a card and schedule it
   */
  async answerCard(
    card: Card,
    response: CardResponse,
    config: DeckConfig,
    reviewTime: number // milliseconds
  ): Promise<{ updated: Card; logEntry: ReviewLogEntry }> {
    const now = new Date()

    // Schedule the card using SM2
    const updated = scheduleCard(card, response, config, now)

    // Create review log entry
    const logEntry: ReviewLogEntry = {
      id: Math.floor(Date.now()),
      cardId: card.id,
      usn: -1,
      ease: response,
      interval: updated.interval,
      lastInterval: card.interval,
      factor: updated.easeFactor,
      time: reviewTime,
      type: card.type as 0 | 1 | 2,
    }

    // Save updated card
    await this.updateCard(updated)

    return { updated, logEntry }
  }

  /**
   * Move a card to a different deck
   */
  async moveCardToDeck(cardId: CardId, toDeckId: number): Promise<Card> {
    const card = await this.db.getCard(cardId)
    if (!card) throw new Error(`Card ${cardId} not found`)

    card.deckId = toDeckId as any
    card.originalDeckId = toDeckId as any
    await this.updateCard(card)

    return card
  }

  /**
   * Suspend a card
   */
  async suspendCard(cardId: CardId): Promise<Card> {
    const card = await this.db.getCard(cardId)
    if (!card) throw new Error(`Card ${cardId} not found`)

    card.queue = -1 // Suspended
    await this.updateCard(card)

    return card
  }

  /**
   * Unsuspend a card
   */
  async unsuspendCard(cardId: CardId): Promise<Card> {
    const card = await this.db.getCard(cardId)
    if (!card) throw new Error(`Card ${cardId} not found`)

    // Reset to appropriate queue based on type
    if (card.type === 0) {
      card.queue = 0 // New
    } else if (card.type === 1 || card.type === 3) {
      card.queue = 1 // Learn
    } else {
      card.queue = 2 // Review
    }

    await this.updateCard(card)
    return card
  }

  /**
   * Bury a card (by user)
   */
  async buryCard(cardId: CardId): Promise<Card> {
    const card = await this.db.getCard(cardId)
    if (!card) throw new Error(`Card ${cardId} not found`)

    card.queue = -3 // User buried
    await this.updateCard(card)

    return card
  }

  /**
   * Unbury a card
   */
  async unburyCard(cardId: CardId): Promise<Card> {
    const card = await this.db.getCard(cardId)
    if (!card) throw new Error(`Card ${cardId} not found`)

    // Reset to appropriate queue based on type
    if (card.type === 0) {
      card.queue = 0 // New
    } else if (card.type === 1 || card.type === 3) {
      card.queue = 1 // Learn
    } else {
      card.queue = 2 // Review
    }

    await this.updateCard(card)
    return card
  }

  /**
   * Reset a card to new state
   */
  async resetCard(cardId: CardId): Promise<Card> {
    const card = await this.db.getCard(cardId)
    if (!card) throw new Error(`Card ${cardId} not found`)

    card.type = 0 // New
    card.queue = 0 // New queue
    card.due = 0
    card.interval = 0
    card.easeFactor = 2500 // Reset to initial ease
    card.reps = 0
    card.lapses = 0
    card.remainingSteps = 0

    await this.updateCard(card)
    return card
  }

  /**
   * Delete a card
   */
  async deleteCard(cardId: CardId): Promise<void> {
    await this.db.deleteCard(cardId)
  }

  /**
   * Delete all cards for a note
   */
  async deleteCardsByNote(noteId: number): Promise<void> {
    await this.db.deleteCardsByNote(noteId)
  }

  /**
   * Get card statistics for a deck
   */
  async getDeckStats(deckId: number): Promise<{
    total: number
    new: number
    learning: number
    review: number
    suspended: number
  }> {
    const cards = await this.db.getCardsByDeck(deckId)

    const stats = {
      total: cards.length,
      new: 0,
      learning: 0,
      review: 0,
      suspended: 0,
    }

    for (const card of cards) {
      if (card.queue === -1 || card.queue === -2 || card.queue === -3) {
        stats.suspended++
      } else if (card.queue === 0) {
        stats.new++
      } else if (card.queue === 1 || card.queue === 3) {
        stats.learning++
      } else if (card.queue === 2) {
        stats.review++
      }
    }

    return stats
  }

  /**
   * Bulk suspend cards
   */
  async suspendCards(cardIds: CardId[]): Promise<void> {
    const cards = await Promise.all(cardIds.map(id => this.db.getCard(id)))
    const validCards = cards.filter((c): c is Card => c !== null)

    validCards.forEach(card => {
      card.queue = -1 // Suspended
    })

    await this.updateCards(validCards)
  }

  /**
   * Bulk unsuspend cards
   */
  async unsuspendCards(cardIds: CardId[]): Promise<void> {
    const cards = await Promise.all(cardIds.map(id => this.db.getCard(id)))
    const validCards = cards.filter((c): c is Card => c !== null)

    validCards.forEach(card => {
      // Reset to appropriate queue based on type
      if (card.type === 0) {
        card.queue = 0 // New
      } else if (card.type === 1 || card.type === 3) {
        card.queue = 1 // Learn
      } else {
        card.queue = 2 // Review
      }
    })

    await this.updateCards(validCards)
  }

  /**
   * Rescheduled a card to a specific interval
   */
  async rescheduleCard(cardId: CardId, days: number): Promise<Card> {
    const card = await this.db.getCard(cardId)
    if (!card) throw new Error(`Card ${cardId} not found`)

    const now = new Date()
    const ankilEpoch = new Date(2011, 0, 1).getTime()
    const currentDay = Math.floor((now.getTime() - ankilEpoch) / (24 * 60 * 60 * 1000))

    card.due = currentDay + days
    card.interval = days
    card.type = 2 // Review
    card.queue = 2 // Review queue

    await this.updateCard(card)
    return card
  }
}
