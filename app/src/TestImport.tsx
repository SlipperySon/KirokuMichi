/**
 * Test Import Page
 * Simple test UI for the deck importer
 */

import React, { useState } from 'react'
import DeckImporter from './components/DeckImporter'
import DeckTree from './components/DeckTree'
import DeckStats from './components/DeckStats'
import { useDeckStore, useCurrentDeck } from './store/deckStore'
import type { ImportResult } from './srs/import-deck'

export function TestImport() {
  const [imported, setImported] = useState<ImportResult | null>(null)
  const [showTree, setShowTree] = useState(false)

  const allDecks = useDeckStore((state) => state.allDecks)
  const deckTree = useDeckStore((state) => state.deckTree)
  const currentDeck = useCurrentDeck()

  const handleImportComplete = (result: ImportResult) => {
    setImported(result)
    setShowTree(true)
    console.log('✅ Import complete:', result)
  }

  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <h1>🧪 Anki Deck Importer Test</h1>

      {!imported ? (
        <div style={{ maxWidth: '600px' }}>
          <h2>Step 1: Import a Deck</h2>
          <DeckImporter onImportComplete={handleImportComplete} />
        </div>
      ) : (
        <div>
          <div style={{ backgroundColor: '#f0f8f0', padding: '1rem', borderRadius: '8px', marginBottom: '2rem' }}>
            <h2>✅ Import Successful!</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '1rem' }}>
              <div>
                <strong>Deck:</strong>
                <p>{imported.deckName}</p>
              </div>
              <div>
                <strong>Cards:</strong>
                <p>{imported.cardCount}</p>
              </div>
              <div>
                <strong>Notes:</strong>
                <p>{imported.noteCount}</p>
              </div>
              <div>
                <strong>Queued:</strong>
                <p>{imported.cardsQueued}</p>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
            {/* Deck Tree */}
            {showTree && deckTree && (
              <div style={{ border: '1px solid #e0e0e0', borderRadius: '8px', padding: '1rem' }}>
                <h3>📚 Deck Tree</h3>
                <p style={{ color: '#666', fontSize: '0.9rem' }}>
                  {allDecks.length} deck(s) loaded
                </p>
                <DeckTree tree={deckTree} />
              </div>
            )}

            {/* Deck Stats */}
            {currentDeck && (
              <div style={{ border: '1px solid #e0e0e0', borderRadius: '8px', padding: '1rem' }}>
                <h3>📊 Deck Stats</h3>
                <p style={{ color: '#666', fontSize: '0.9rem' }}>
                  Current: {currentDeck.name}
                </p>
                <DeckStats deckId={currentDeck.id} compact={true} />
              </div>
            )}
          </div>

          <div style={{ marginTop: '2rem', padding: '1rem', backgroundColor: '#f9f9f9', borderRadius: '8px' }}>
            <h3>📋 Debug Info</h3>
            <pre style={{
              backgroundColor: '#f0f0f0',
              padding: '1rem',
              borderRadius: '4px',
              overflow: 'auto',
              fontSize: '0.85rem'
            }}>
{JSON.stringify({
  imported: {
    deckName: imported.deckName,
    cardCount: imported.cardCount,
    noteCount: imported.noteCount,
    cardsQueued: imported.cardsQueued,
  },
  currentDeck: currentDeck ? {
    id: currentDeck.id,
    name: currentDeck.name,
    desc: currentDeck.desc,
  } : null,
  totalDecks: allDecks.length,
}, null, 2)}
            </pre>
          </div>

          <div style={{ marginTop: '2rem' }}>
            <button
              onClick={() => {
                setImported(null)
                setShowTree(false)
                useDeckStore.getState().reset()
              }}
              style={{
                padding: '0.75rem 1.5rem',
                fontSize: '1rem',
                backgroundColor: '#f44336',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              Clear & Import Another
            </button>
          </div>
        </div>
      )}

      {/* Info */}
      <div style={{ marginTop: '3rem', padding: '1rem', backgroundColor: '#e3f2fd', borderRadius: '8px' }}>
        <h3>ℹ️ How to Test</h3>
        <ol>
          <li>
            <strong>Option 1 (Genki deck):</strong> The test fixtures include a real Genki deck with 6,193 cards
          </li>
          <li>
            <strong>Option 2 (Any deck):</strong> Download from <a href="https://ankiweb.net" target="_blank" rel="noopener">AnkiWeb.net</a>
          </li>
          <li>
            <strong>Option 3 (Your deck):</strong> Export from Anki Desktop
          </li>
        </ol>
        <p style={{ color: '#666' }}>
          Just drag and drop the .apkg file above, or click to select it
        </p>
      </div>
    </div>
  )
}

export default TestImport
