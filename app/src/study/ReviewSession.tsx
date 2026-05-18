import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useIntl } from 'react-intl'
import { LogOut, RotateCcw } from 'lucide-react'
import { useReviewSession } from './useReviewSession'
import { CardReading } from './CardReading'
import { CardMeaning } from './CardMeaning'
import { CardWriting } from './CardWriting'
import { CardGrammar } from './CardGrammar'
import { LeechWarning } from './LeechWarning'
import { SessionSummary } from './SessionSummary'
import { exportToAnki } from '../srs/ankiExport'
import { importFromAnki } from '../srs/ankiImport'
import { SQLiteStorage } from '../db/sqlite'
import { FSRSScheduler, SM2Scheduler } from '../core/scheduler'
import { SRSService } from '../srs/srsService'
import { useAppStore } from '../store'
import type { ReviewCard, GrammarQuestion, GrammarReviewContext } from './types'

interface LocationState {
  queue: ReviewCard[]
  grammarEntries: [number, GrammarQuestion][]
  sessionId: number
  userId: number
  lessonId?: string
}

export function ReviewSession() {
  const intl = useIntl()
  const navigate = useNavigate()
  const { state } = useLocation() as { state: LocationState }
  const { settings, markLessonComplete } = useAppStore()

  const [storage] = useState(() => new SQLiteStorage())
  const scheduler = settings.schedulerAlgorithm === 'fsrs' ? new FSRSScheduler() : new SM2Scheduler()
  const [service] = useState(() => new SRSService(storage, scheduler))

  const grammarMap = new Map<number, GrammarQuestion>(state.grammarEntries ?? [])

  const session = useReviewSession(
    state.userId,
    service,
    state.queue,
    grammarMap,
    state.sessionId
  )

  const { currentCard, currentVariant, currentGrammar, phase, intervalPreviews, isNewLeech, progress } = session
  const [grammarContext, setGrammarContext] = useState<GrammarReviewContext | null>(null)

  useEffect(() => {
    let cancelled = false
    async function loadGrammarContext() {
      if (!currentGrammar?.grammarPointId) {
        setGrammarContext(null)
        return
      }
      const context = await service.getGrammarReviewContext(currentGrammar.grammarPointId)
      if (!cancelled) setGrammarContext(context)
    }
    void loadGrammarContext()
    return () => { cancelled = true }
  }, [currentGrammar?.grammarPointId, service])

  if (session.isComplete) {
    // Mark lesson as complete if this was a lesson study session
    if (state.lessonId) {
      markLessonComplete(state.lessonId)
    }

    return (
      <SessionSummary
        stats={session.stats}
        totalCards={state.queue.length}
        onDone={() => navigate('/study')}
        onExportAnki={() => exportToAnki(state.queue)}
        onImportAnki={async (file) => {
          await importFromAnki(file, storage, state.userId)
          navigate('/study')
        }}
      />
    )
  }

  if (!currentCard) return null

  function handleExit() {
    if (window.confirm('Exit to Study Dashboard? Your review progress so far will be saved.')) {
      navigate('/study')
    }
  }

  return (
    <div className="flex flex-col min-h-screen p-6 max-w-xl mx-auto">
      {/* Header with exit + undo */}
      <div className="flex justify-end gap-1 mb-2">
        {session.canUndo && (
          <button
            onClick={() => void session.undoLastRating()}
            className="inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800 transition-colors hover:bg-amber-100"
            aria-label="Undo last rating"
            title="Undo last rating (Ctrl+Z)"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Undo
          </button>
        )}
        <button
          onClick={handleExit}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
          aria-label="Exit review session to Study Dashboard"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          Exit to Study Dashboard
        </button>
      </div>
      {/* Progress bar */}
      <div className="flex flex-col gap-2 mb-8">
        <div className="w-full bg-gray-100 rounded-full h-2">
          <div
            className="bg-indigo-500 h-2 rounded-full transition-all"
            style={{ width: `${(progress.current / progress.total) * 100}%` }}
          />
        </div>
        <p className="text-sm text-gray-400 text-right">
          {intl.formatMessage({ id: 'study.session.progress' }, { current: progress.current, total: progress.total })}
        </p>
      </div>

      {/* Card */}
      <div className="flex-1 flex items-center justify-center">
        {currentVariant === 'reading' && (
          <CardReading
            card={currentCard}
            phase={phase}
            intervalPreviews={intervalPreviews}
            onReveal={session.reveal}
            onRate={session.rate}
          />
        )}
        {currentVariant === 'meaning' && (
          <CardMeaning
            card={currentCard}
            phase={phase}
            intervalPreviews={intervalPreviews}
            onReveal={session.reveal}
            onRate={session.rate}
          />
        )}
        {currentVariant === 'writing' && (
          <CardWriting
            card={currentCard}
            phase={phase}
            intervalPreviews={intervalPreviews}
            onReveal={session.reveal}
            onRate={session.rate}
          />
        )}
        {currentVariant === 'grammar' && currentGrammar && (
          <CardGrammar
            question={currentGrammar}
            phase={phase}
            intervalPreviews={intervalPreviews}
            context={grammarContext}
            onAnswer={session.handleGrammarAnswer}
            onRate={session.rate}
          />
        )}
      </div>

      {isNewLeech && (
        <LeechWarning
          card={currentCard}
          onSuspend={session.suspendCurrentCard}
          onDismiss={session.dismissLeechWarning}
        />
      )}
    </div>
  )
}
