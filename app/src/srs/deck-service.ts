/**
 * Deck Service - CRUD and management operations for decks
 * Handles deck creation, merging, switching, and configuration
 */

import type { Deck, DeckNode, DeckConfig, DeckCounts, CreateDeckRequest, UpdateDeckRequest } from '../types/deck'
import type { DeckId } from '../types/card'
import { makeDeckId } from '../types/card'

/**
 * Mock database interface for deck operations
 */
export interface DeckDatabase {
  // Create
  insertDeck(deck: Omit<Deck, 'id'>): Promise<Deck>
  insertDeckConfig(config: DeckConfig): Promise<DeckConfig>

  // Read
  getDeck(deckId: DeckId): Promise<Deck | null>
  getDeckConfig(deckId: DeckId): Promise<DeckConfig | null>
  getAllDecks(): Promise<Deck[]>
  getAllDeckConfigs(): Promise<DeckConfig[]>
  getDeckChildren(parentId: DeckId): Promise<Deck[]>

  // Update
  updateDeck(deck: Deck): Promise<void>
  updateDeckConfig(config: DeckConfig): Promise<void>

  // Delete
  deleteDeck(deckId: DeckId): Promise<void>
  deleteDeckConfig(configId: DeckId): Promise<void>

  // Hierarchy
  getFullDeckTree(): Promise<DeckNode>
}

/**
 * Deck Service - business logic for deck operations
 */
export class DeckService {
  constructor(private db: DeckDatabase) {}

  /**
   * Create a new deck
   */
  async createDeck(req: CreateDeckRequest): Promise<Deck> {
    const id = makeDeckId(Math.floor(Math.random() * 1e10))

    // Get or create config
    let configId = req.configId
    if (!configId) {
      const config = await this.db.insertDeckConfig(this.getDefaultDeckConfig())
      configId = config.id
    }

    const deck: Omit<Deck, 'id'> = {
      name: req.name,
      desc: '',
      conf: configId,
      collapsed: false,
      dyn: 0, // normal deck
    }

    return this.db.insertDeck(deck)
  }

  /**
   * Get a deck by ID
   */
  async getDeck(deckId: DeckId): Promise<Deck | null> {
    return this.db.getDeck(deckId)
  }

  /**
   * Get deck with full tree structure
   */
  async getDeckWithChildren(deckId: DeckId): Promise<DeckNode | null> {
    const deck = await this.db.getDeck(deckId)
    if (!deck) return null

    const children = await this.db.getDeckChildren(deckId)
    const childNodes = await Promise.all(
      children.map(c => this.getDeckWithChildren(c.id))
    )

    return {
      ...deck,
      children: childNodes.filter((c): c is DeckNode => c !== null),
      level: 0,
      newCount: 0,
      learnCount: 0,
      reviewCount: 0,
    }
  }

  /**
   * Get full deck tree
   */
  async getDeckTree(): Promise<DeckNode> {
    return this.db.getFullDeckTree()
  }

  /**
   * Update deck metadata
   */
  async updateDeck(req: UpdateDeckRequest): Promise<Deck> {
    const deck = await this.db.getDeck(req.deckId)
    if (!deck) throw new Error(`Deck ${req.deckId} not found`)

    if (req.name !== undefined) {
      deck.name = req.name
    }
    if (req.configId !== undefined) {
      deck.conf = req.configId
    }
    if (req.collapsed !== undefined) {
      deck.collapsed = req.collapsed
    }

    await this.db.updateDeck(deck)
    return deck
  }

  /**
   * Update deck configuration
   */
  async updateDeckConfig(deckId: DeckId, config: Partial<DeckConfig>): Promise<DeckConfig> {
    const deck = await this.db.getDeck(deckId)
    if (!deck) throw new Error(`Deck ${deckId} not found`)

    const existing = await this.db.getDeckConfig(deck.conf)
    if (!existing) throw new Error(`Config ${deck.conf} not found`)

    const updated = { ...existing, ...config, id: existing.id }
    await this.db.updateDeckConfig(updated)
    return updated
  }

  /**
   * Delete a deck
   */
  async deleteDeck(deckId: DeckId): Promise<void> {
    const deck = await this.db.getDeck(deckId)
    if (!deck) throw new Error(`Deck ${deckId} not found`)

    // Check for child decks - would need to be moved or deleted
    const children = await this.db.getDeckChildren(deckId)
    if (children.length > 0) {
      throw new Error(
        `Cannot delete deck with child decks. Move or delete children first.`
      )
    }

    await this.db.deleteDeck(deckId)
  }

  /**
   * Rename a deck
   */
  async renameDeck(deckId: DeckId, newName: string): Promise<Deck> {
    const deck = await this.db.getDeck(deckId)
    if (!deck) throw new Error(`Deck ${deckId} not found`)

    // Don't allow invalid names
    if (!newName || newName.trim().length === 0) {
      throw new Error('Deck name cannot be empty')
    }

    deck.name = newName
    await this.db.updateDeck(deck)
    return deck
  }

  /**
   * Get deck description
   */
  async getDeckDescription(deckId: DeckId): Promise<string> {
    const deck = await this.db.getDeck(deckId)
    if (!deck) throw new Error(`Deck ${deckId} not found`)
    return deck.desc
  }

  /**
   * Update deck description
   */
  async updateDeckDescription(deckId: DeckId, description: string): Promise<void> {
    const deck = await this.db.getDeck(deckId)
    if (!deck) throw new Error(`Deck ${deckId} not found`)

    deck.desc = description
    await this.db.updateDeck(deck)
  }

  /**
   * Get default deck configuration
   */
  getDefaultDeckConfig(): DeckConfig {
    const id = makeDeckId(Math.floor(Math.random() * 1e10)) as any
    return {
      id,
      name: 'Default',
      new: {
        delays: [1, 10], // 1 min, 10 min
        ints: [1, 4], // graduating: 1 day, easy: 4 days
        initialFactor: 2500, // 2.5
        separate: true,
        perDay: 20,
        order: 0, // random
      },
      review: {
        perDay: 200,
        ease4: 1.3, // bonus for easy
        fuzz: 0.05, // 5% randomization
      },
      lapse: {
        delays: [10], // 10 minutes
        mult: 0.5, // 50% of original interval
        minInt: 1, // minimum 1 day
        leechFails: 8, // leech after 8 lapses
      },
    }
  }

  /**
   * Clone deck configuration
   */
  async cloneDeckConfig(configId: DeckId): Promise<DeckConfig> {
    const original = await this.db.getDeckConfig(configId)
    if (!original) throw new Error(`Config ${configId} not found`)

    const cloned: Omit<DeckConfig, 'id'> = {
      name: `${original.name} (copy)`,
      new: { ...original.new },
      review: { ...original.review },
      lapse: { ...original.lapse },
    }

    return this.db.insertDeckConfig(cloned as DeckConfig)
  }

  /**
   * Get all decks
   */
  async getAllDecks(): Promise<Deck[]> {
    return this.db.getAllDecks()
  }

  /**
   * Get child decks
   */
  async getChildDecks(parentId: DeckId): Promise<Deck[]> {
    return this.db.getDeckChildren(parentId)
  }

  /**
   * Merge two decks
   * Moves all cards from source deck to target deck
   * Note: This is a database-level operation in actual implementation
   */
  async mergeDecksWith(sourceDeckId: DeckId, targetDeckId: DeckId): Promise<void> {
    const source = await this.db.getDeck(sourceDeckId)
    if (!source) throw new Error(`Source deck ${sourceDeckId} not found`)

    const target = await this.db.getDeck(targetDeckId)
    if (!target) throw new Error(`Target deck ${targetDeckId} not found`)

    if (sourceDeckId === targetDeckId) {
      throw new Error('Cannot merge deck with itself')
    }

    // In actual implementation, this would:
    // 1. Update all cards in source deck to target deck
    // 2. Update card counts
    // 3. Delete source deck

    // Placeholder for actual merge logic
    await this.db.deleteDeck(sourceDeckId)
  }

  /**
   * Export deck to APKG format info
   * Returns metadata for export
   */
  async getExportInfo(deckId: DeckId): Promise<{
    name: string
    cardCount: number
    noteCount: number
    config: DeckConfig
  }> {
    const deck = await this.db.getDeck(deckId)
    if (!deck) throw new Error(`Deck ${deckId} not found`)

    const config = await this.db.getDeckConfig(deck.conf)
    if (!config) throw new Error(`Config ${deck.conf} not found`)

    // These would be fetched from actual database
    return {
      name: deck.name,
      cardCount: 0, // would be counted from database
      noteCount: 0, // would be counted from database
      config,
    }
  }

  /**
   * Get deck statistics
   */
  async getDeckStats(deckId: DeckId): Promise<DeckCounts> {
    // In actual implementation, would query database for current counts
    // For now, return empty counts
    return {
      new: 0,
      learning: 0,
      review: 0,
    }
  }

  /**
   * Toggle deck collapse state
   */
  async toggleDeckCollapse(deckId: DeckId): Promise<Deck> {
    const deck = await this.db.getDeck(deckId)
    if (!deck) throw new Error(`Deck ${deckId} not found`)

    deck.collapsed = !deck.collapsed
    await this.db.updateDeck(deck)
    return deck
  }

  /**
   * Get deck path (e.g., "Parent::Child::Deck")
   */
  async getDeckPath(deckId: DeckId): Promise<string> {
    const deck = await this.db.getDeck(deckId)
    if (!deck) return ''

    // In actual implementation, would traverse parent chain
    // For now, just return the deck name
    return deck.name
  }

  /**
   * Create a subdeck
   */
  async createSubdeck(parentDeckId: DeckId, name: string): Promise<Deck> {
    const parent = await this.db.getDeck(parentDeckId)
    if (!parent) throw new Error(`Parent deck ${parentDeckId} not found`)

    // Create with parent's config by default
    return this.createDeck({
      name: `${parent.name}::${name}`,
      configId: parent.conf,
    })
  }

  /**
   * Search decks by name
   */
  async searchDecks(query: string): Promise<Deck[]> {
    const allDecks = await this.db.getAllDecks()
    const lowerQuery = query.toLowerCase()
    return allDecks.filter(d => d.name.toLowerCase().includes(lowerQuery))
  }

  /**
   * Validate deck name
   */
  validateDeckName(name: string): { valid: boolean; reason?: string } {
    if (!name || name.trim().length === 0) {
      return { valid: false, reason: 'Deck name cannot be empty' }
    }

    if (name.length > 100) {
      return { valid: false, reason: 'Deck name cannot exceed 100 characters' }
    }

    // Disallow certain characters
    if (/[<>:"\/\\|?*]/.test(name)) {
      return { valid: false, reason: 'Deck name contains invalid characters' }
    }

    return { valid: true }
  }
}
