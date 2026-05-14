import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useIntl } from 'react-intl'
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
import type { ReviewCard, GrammarQuestion } from './types'

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

  const { currentCard, currentVariant, currentGrammar, phase, intervalPreviews, isNewLeech, progress } = session

  if (!currentCard) return null

  function handleExit() {
    if (window.confirm('Exit review? Your progress so far will be saved.')) {
      navigate('/study')
    }
  }

  return (
    <div className="flex flex-col min-h-screen p-6 max-w-xl mx-auto">
      {/* Header with exit */}
      <div className="flex justify-end mb-2">
        <button
          onClick={handleExit}
          className="text-sm text-gray-400 hover:text-gray-600 px-3 py-1 rounded-lg hover:bg-gray-100 transition-colors"
          aria-label="Exit review session"
        >
          ✕ Exit
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
