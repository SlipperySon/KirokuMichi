/**
 * Deck Importer - UI for importing Anki .apkg files
 * Handles file selection, validation, import progress, and results
 */

import React, { useState, useRef, useCallback } from 'react'
import { importDeck, validateApkg, type ImportProgress, type ImportResult } from '../srs/import-deck'
import type { DeckId } from '../types/card'

type ImportState = 'idle' | 'validating' | 'importing' | 'complete' | 'error'

interface ImportStatus {
  state: ImportState
  progress: number
  message: string
  error?: string
  result?: ImportResult
}

interface DeckImporterProps {
  onImportComplete?: (result: ImportResult) => void
}

export const DeckImporter: React.FC<DeckImporterProps> = ({ onImportComplete }) => {
  const [status, setStatus] = useState<ImportStatus>({
    state: 'idle',
    progress: 0,
    message: 'Select an Anki deck file (.apkg)',
  })

  const fileInputRef = useRef<HTMLInputElement>(null)

  // Handle file selection
  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file extension
    if (!file.name.endsWith('.apkg')) {
      setStatus({
        state: 'error',
        progress: 0,
        message: 'Invalid file',
        error: 'Please select a .apkg file (Anki deck)',
      })
      return
    }

    try {
      // Phase 1: Validate
      setStatus({
        state: 'validating',
        progress: 10,
        message: 'Validating deck file...',
      })

      const validation = await validateApkg(file)

      if (!validation.valid) {
        setStatus({
          state: 'error',
          progress: 0,
          message: 'Invalid deck file',
          error: validation.reason || 'Unknown error',
        })
        return
      }

      const metadata = validation.metadata
      setStatus({
        state: 'validating',
        progress: 20,
        message: `Found deck: ${metadata.deckName} (${metadata.cardCount} cards)`,
      })

      // Phase 2: Import
      setStatus({
        state: 'importing',
        progress: 30,
        message: 'Importing deck...',
      })

      const result = await importDeck(file, (progress: ImportProgress) => {
        setStatus({
          state: 'importing',
          progress: progress.progress,
          message: progress.status,
        })
      })

      // Success
      setStatus({
        state: 'complete',
        progress: 100,
        message: `Successfully imported ${result.deckName}`,
        result,
      })

      onImportComplete?.(result)

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      setStatus({
        state: 'error',
        progress: 0,
        message: 'Import failed',
        error: message,
      })
    }
  }, [onImportComplete])

  // Handle drag and drop
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()

    const file = e.dataTransfer.files?.[0]
    if (file && fileInputRef.current) {
      // Create a synthetic change event
      const dataTransfer = new DataTransfer()
      dataTransfer.items.add(file)
      fileInputRef.current.files = dataTransfer.files

      // Trigger change event
      const event = new Event('change', { bubbles: true })
      fileInputRef.current.dispatchEvent(event)
    }
  }, [])

  const handleClickUpload = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleReset = useCallback(() => {
    setStatus({
      state: 'idle',
      progress: 0,
      message: 'Select an Anki deck file (.apkg)',
    })
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [])

  return (
    <div className="deck-importer">
      <div className="importer-container">
        {/* File Upload Area */}
        {status.state === 'idle' && (
          <div
            className="upload-area"
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={handleClickUpload}
          >
            <div className="upload-icon">📦</div>
            <div className="upload-text">
              <p className="upload-title">Drop Anki deck here</p>
              <p className="upload-subtitle">or click to browse</p>
            </div>
            <p className="upload-format">.apkg files only</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".apkg"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
          </div>
        )}

        {/* Validating State */}
        {status.state === 'validating' && (
          <div className="import-progress">
            <div className="progress-icon">🔍</div>
            <div className="progress-text">
              <p className="progress-status">{status.message}</p>
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${status.progress}%` }}
                />
              </div>
              <p className="progress-percent">{status.progress}%</p>
            </div>
          </div>
        )}

        {/* Importing State */}
        {status.state === 'importing' && (
          <div className="import-progress">
            <div className="progress-icon">⏳</div>
            <div className="progress-text">
              <p className="progress-status">{status.message}</p>
              <div className="progress-bar">
                <div
                  className="progress-fill importing"
                  style={{ width: `${status.progress}%` }}
                />
              </div>
              <p className="progress-percent">{status.progress}%</p>
            </div>
          </div>
        )}

        {/* Complete State */}
        {status.state === 'complete' && status.result && (
          <div className="import-complete">
            <div className="complete-icon">✅</div>
            <div className="complete-content">
              <h3>{status.result.deckName}</h3>
              <div className="complete-stats">
                <div className="stat">
                  <span className="stat-label">Cards:</span>
                  <span className="stat-value">{status.result.cardCount}</span>
                </div>
                <div className="stat">
                  <span className="stat-label">Notes:</span>
                  <span className="stat-value">{status.result.noteCount}</span>
                </div>
                <div className="stat">
                  <span className="stat-label">Queued:</span>
                  <span className="stat-value">{status.result.cardsQueued}</span>
                </div>
              </div>
              <p className="complete-message">{status.message}</p>
              <button onClick={handleReset} className="btn-secondary">
                Import Another Deck
              </button>
            </div>
          </div>
        )}

        {/* Error State */}
        {status.state === 'error' && (
          <div className="import-error">
            <div className="error-icon">❌</div>
            <div className="error-content">
              <p className="error-message">{status.message}</p>
              {status.error && (
                <p className="error-detail">{status.error}</p>
              )}
              <button onClick={handleReset} className="btn-primary">
                Try Again
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Styling */}
      <style>{`
        .deck-importer {
          width: 100%;
          max-width: 500px;
          margin: 0 auto;
        }

        .importer-container {
          padding: 2rem;
          border: 2px solid #e0e0e0;
          border-radius: 8px;
          background: #fafafa;
        }

        /* Upload Area */
        .upload-area {
          text-align: center;
          padding: 3rem 2rem;
          cursor: pointer;
          border: 2px dashed #ccc;
          border-radius: 8px;
          background: white;
          transition: all 0.3s ease;
        }

        .upload-area:hover {
          border-color: #4CAF50;
          background: #f0f8f0;
        }

        .upload-icon {
          font-size: 3rem;
          margin-bottom: 1rem;
        }

        .upload-title {
          font-size: 1.2rem;
          font-weight: 600;
          color: #333;
          margin: 0.5rem 0;
        }

        .upload-subtitle {
          color: #666;
          font-size: 0.9rem;
          margin: 0.3rem 0;
        }

        .upload-format {
          color: #999;
          font-size: 0.85rem;
          margin-top: 1rem;
        }

        /* Progress */
        .import-progress {
          display: flex;
          align-items: center;
          gap: 1.5rem;
        }

        .progress-icon {
          font-size: 2.5rem;
          flex-shrink: 0;
        }

        .progress-text {
          flex: 1;
        }

        .progress-status {
          font-weight: 500;
          color: #333;
          margin: 0 0 0.5rem 0;
        }

        .progress-bar {
          height: 8px;
          background: #e0e0e0;
          border-radius: 4px;
          overflow: hidden;
          margin-bottom: 0.5rem;
        }

        .progress-fill {
          height: 100%;
          background: #4CAF50;
          border-radius: 4px;
          transition: width 0.3s ease;
        }

        .progress-fill.importing {
          background: linear-gradient(
            90deg,
            #4CAF50,
            #66BB6A,
            #4CAF50
          );
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
        }

        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }

        .progress-percent {
          text-align: right;
          font-size: 0.9rem;
          color: #666;
          margin: 0;
        }

        /* Complete */
        .import-complete {
          text-align: center;
        }

        .complete-icon {
          font-size: 3rem;
          margin-bottom: 1rem;
        }

        .complete-content h3 {
          font-size: 1.3rem;
          color: #333;
          margin: 0 0 1rem 0;
        }

        .complete-stats {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 1rem;
          margin-bottom: 1.5rem;
        }

        .stat {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 0.75rem;
          background: white;
          border-radius: 6px;
          border: 1px solid #e0e0e0;
        }

        .stat-label {
          font-size: 0.85rem;
          color: #666;
          margin-bottom: 0.25rem;
        }

        .stat-value {
          font-size: 1.5rem;
          font-weight: 600;
          color: #4CAF50;
        }

        .complete-message {
          color: #666;
          margin-bottom: 1.5rem;
        }

        /* Error */
        .import-error {
          text-align: center;
        }

        .error-icon {
          font-size: 3rem;
          margin-bottom: 1rem;
        }

        .error-message {
          font-size: 1.1rem;
          color: #d32f2f;
          font-weight: 500;
          margin: 0 0 0.5rem 0;
        }

        .error-detail {
          color: #666;
          font-size: 0.9rem;
          margin: 0 0 1.5rem 0;
          font-family: monospace;
          background: #fff3cd;
          padding: 0.75rem;
          border-radius: 4px;
          border-left: 4px solid #ffc107;
        }

        /* Buttons */
        .btn-primary,
        .btn-secondary {
          padding: 0.75rem 1.5rem;
          font-size: 1rem;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .btn-primary {
          background: #4CAF50;
          color: white;
        }

        .btn-primary:hover {
          background: #45a049;
        }

        .btn-secondary {
          background: #f0f0f0;
          color: #333;
        }

        .btn-secondary:hover {
          background: #e0e0e0;
        }
      `}</style>
    </div>
  )
}

export default DeckImporter
