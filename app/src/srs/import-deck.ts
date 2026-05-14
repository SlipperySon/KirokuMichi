/**
 * Import Deck - Main orchestration for importing Anki decks
 * Coordinates APKG parsing, database reading, and store population
 */

import { parseApkg, extractApkgMetadata, getApkgDatabase } from './apkg-parser'
import {
  SqliteCardDatabase,
  SqliteNoteDatabase,
  SqliteDeckDatabase,
} from './sqlite-database'
import { CardService } from './card-service'
import { DeckService } from './deck-service'
import { NoteService } from './note-service'
import { buildDeckQueue, getDeckCounts } from './queue-builder'
import { useDeckStore } from '../store/deckStore'
import type { DeckId } from '../types/card'

export interface ImportProgress {
  phase: 'parsing' | 'reading' | 'loading' | 'complete'
  status: string
  progress: number // 0-100
  error?: string
}

export interface ImportResult {
  deckId: DeckId
  deckName: string
  cardCount: number
  noteCount: number
  cardsQueued: number
}

/**
 * Import an Anki deck from APKG file
 */
export async function importDeck(
  file: File,
  onProgress?: (progress: ImportProgress) => void
): Promise<ImportResult> {
  try {
    // Phase 1: Parse APKG
    onProgress?.({
      phase: 'parsing',
      status: 'Extracting APKG file...',
      progress: 10,
    })

    const parsed = await parseApkg(file)

    // Get metadata
    onProgress?.({
      phase: 'parsing',
      status: 'Reading deck metadata...',
      progress: 20,
    })

    const metadata = await extractApkgMetadata(parsed)

    // Phase 2: Read database
    onProgress?.({
      phase: 'reading',
      status: 'Loading SQLite database...',
      progress: 30,
    })

    const db = await getApkgDatabase(parsed)

    // Create database service implementations
    const cardDb = new SqliteCardDatabase(db)
    const noteDb = new SqliteNoteDatabase(db)
    const deckDb = new SqliteDeckDatabase(db)

    // Create service layer
    const cardService = new CardService(cardDb)
    const deckService = new DeckService(deckDb)
    const noteService = new NoteService(noteDb)

    onProgress?.({
      phase: 'reading',
      status: 'Loading decks...',
      progress: 40,
    })

    // Get all decks from imported database
    const importedDecks = await deckDb.getAllDecks()
    const deckTree = await deckDb.getFullDeckTree()

    onProgress?.({
      phase: 'reading',
      status: 'Loading cards...',
      progress: 60,
    })

    // Get all cards from imported database
    const allCards = await cardDb.getAllCards()
    const allNotes = await noteDb.getAllNotes()

    // Phase 3: Load into store
    onProgress?.({
      phase: 'loading',
      status: 'Building card queue...',
      progress: 75,
    })

    // Get the main deck (usually the first one)
    const mainDeck = importedDecks[0] || {
      id: 1 as any,
      name: metadata.deckName,
      desc: '',
      conf: 1 as any,
      collapsed: false,
      dyn: 0,
    }

    // Get the deck config
    const deckConfig = await deckDb.getDeckConfig(mainDeck.conf)

    // Build queue for the main deck
    const deckCards = allCards.filter((c) => c.deckId === mainDeck.id)
    const queue = buildDeckQueue(deckCards, deckConfig || deckService.getDefaultDeckConfig())
    const counts = getDeckCounts(deckCards, deckConfig || deckService.getDefaultDeckConfig())

    onProgress?.({
      phase: 'loading',
      status: 'Populating store...',
      progress: 85,
    })

    // Update the store
    const store = useDeckStore.getState()
    store.setAllDecks(importedDecks)
    store.setDeckTree(deckTree)
    store.setCurrentDeck(mainDeck.id)

    // Update deck stats
    for (const deck of importedDecks) {
      const deckCardsCount = allCards.filter((c) => c.deckId === deck.id).length
      store.updateDeckStats(deck.id, {
        id: deck.id,
        name: deck.name,
        cardCount: deckCardsCount,
        newCount: counts.new,
        learningCount: counts.learning,
        reviewCount: counts.review,
      })
    }

    onProgress?.({
      phase: 'complete',
      status: 'Import complete!',
      progress: 100,
    })

    db.close()

    return {
      deckId: mainDeck.id,
      deckName: mainDeck.name,
      cardCount: allCards.length,
      noteCount: allNotes.length,
      cardsQueued: queue.length,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    onProgress?.({
      phase: 'parsing',
      status: `Import failed: ${message}`,
      progress: 0,
      error: message,
    })
    throw error
  }
}

/**
 * Validate APKG file before importing
 */
export async function validateApkg(file: File): Promise<{
  valid: boolean
  reason?: string
  metadata?: any
}> {
  try {
    const parsed = await parseApkg(file)
    const metadata = await extractApkgMetadata(parsed)

    if (metadata.cardCount === 0) {
      return {
        valid: false,
        reason: 'Deck contains no cards',
      }
    }

    return {
      valid: true,
      metadata,
    }
  } catch (error) {
    return {
      valid: false,
      reason: error instanceof Error ? error.message : 'Invalid APKG file',
    }
  }
}
