import { useEffect, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useIntl } from 'react-intl'
import { LogOut, RotateCcw, MoreHorizontal } from 'lucide-react'
import { useReviewSession } from './useReviewSession'
import { CardReading } from './CardReading'
import { CardMeaning } from './CardMeaning'
import { CardWriting } from './CardWriting'
import { CardGrammar } from './CardGrammar'
import { RatingButtons } from './RatingButtons'
import { LeechWarning } from './LeechWarning'
import { SessionSummary } from './SessionSummary'
import { exportToAnki } from '../srs/ankiExport'
import { importFromAnki } from '../srs/ankiImport'
import { SQLiteStorage } from '../db/sqlite'
import { FSRSScheduler, SM2Scheduler } from '../core/scheduler'
import { SRSService } from '../srs/srsService'
import { renderTemplate } from '../srs/templateRenderer'
import { useAppStore } from '../store'
import { toast } from '../components/toastStore'
import type { ReviewCard, GrammarQuestion, GrammarReviewContext } from './types'

interface CardTemplate {
  id: number
  frontTemplate: string
  backTemplate: string
  css: string
}

/**
 * Templated card display — used when a deck has a custom template.
 */
function TemplatedCard({
  card,
  template,
  phase,
  onReveal,
  ratingButtons,
}: {
  card: ReviewCard
  template: CardTemplate
  phase: 'front' | 'back'
  onReveal: () => void
  ratingButtons: React.ReactNode
}) {
  const fields: Record<string, string> = {
    front: card.front,
    back: card.back,
    reading: card.reading ?? '',
  }
  const frontHtml = renderTemplate(template.frontTemplate, fields)
  const backHtml = renderTemplate(template.backTemplate, fields)

  return (
    <div className="flex flex-col items-center gap-8 w-full max-w-md mx-auto">
      {template.css && <style>{template.css}</style>}
      <div className="w-full min-h-48 bg-gray-50 rounded-2xl flex flex-col items-center justify-center gap-4 p-8">
        {phase === 'front' ? (
          <div
            className="text-2xl font-bold text-gray-900 text-center whitespace-pre-wrap"
            lang="ja"
            dangerouslySetInnerHTML={{ __html: frontHtml }}
          />
        ) : (
          <div
            className="text-lg text-gray-700 text-center whitespace-pre-wrap"
            lang="ja"
            dangerouslySetInnerHTML={{ __html: backHtml }}
          />
        )}
      </div>
      {phase === 'front' ? (
        <button
          onClick={onReveal}
          className="w-full px-8 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors"
        >
          Show Answer
        </button>
      ) : (
        ratingButtons
      )}
    </div>
  )
}

interface LocationState {
  queue: ReviewCard[]
  grammarEntries: [number, GrammarQuestion][]
  sessionId: number
  userId: number
  lessonId?: string
  cramMode?: boolean
  cramDeckName?: string
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
    state.sessionId,
    state.cramMode ?? false
  )

  const { currentCard, currentVariant, currentGrammar, phase, intervalPreviews, isNewLeech, progress } = session
  const [grammarContext, setGrammarContext] = useState<GrammarReviewContext | null>(null)
  const [showCardMenu, setShowCardMenu] = useState(false)
  // Template for active deck (if any)
  const [activeTemplate, setActiveTemplate] = useState<CardTemplate | null>(null)

  const isCramMode = state.cramMode ?? false

  // Fire celebration toasts when session completes (only once; skip in cram mode)
  const completionToastFiredRef = useRef(false)
  useEffect(() => {
    if (!session.isComplete || completionToastFiredRef.current) return
    completionToastFiredRef.current = true
    const reviewed = session.stats.cardsReviewed
    if (isCramMode) {
      toast.info(`Cram complete — ${reviewed} card${reviewed === 1 ? '' : 's'} reviewed`, 3000)
      return
    }
    const { dailyStats, settings } = useAppStore.getState()
    if (dailyStats.currentStreak > 1) {
      toast.success(`🔥 ${dailyStats.currentStreak}-day streak!`, 4000)
    }
    if (reviewed >= settings.dailyGoal && settings.dailyGoal > 0) {
      toast.success('✅ Daily goal complete!', 4000)
    }
    toast.info(`📈 Session complete — ${reviewed} card${reviewed === 1 ? '' : 's'} reviewed`, 4000)
  }, [session.isComplete, session.stats.cardsReviewed, isCramMode])

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

  // Load template for active deck on mount
  useEffect(() => {
    const deckId = useAppStore.getState().activeDeckId
    if (deckId == null) return
    let cancelled = false
    void service.getTemplate(deckId).then(tmpl => {
      if (!cancelled) setActiveTemplate(tmpl)
    })
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  async function handleSuspend() {
    setShowCardMenu(false)
    await session.suspendCurrentCard()
    toast.info('Card suspended — it will be skipped until you unsuspend it')
  }

  async function handleBury() {
    setShowCardMenu(false)
    await session.buryCurrentCard()
    toast.info('Card buried until tomorrow')
  }

  return (
    <div className="flex flex-col min-h-screen w-full px-4 py-6 sm:p-6 max-w-xl mx-auto">
      {/* Cram mode banner */}
      {isCramMode && (
        <div className="mb-3 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800 font-medium text-center">
          Cram mode — scheduling not affected{state.cramDeckName ? ` · ${state.cramDeckName}` : ''}
        </div>
      )}
      {/* Header with exit + undo + card menu */}
      <div className="flex flex-wrap justify-end gap-2 mb-2">
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

        {/* Card overflow menu */}
        <div className="relative">
          <button
            onClick={() => setShowCardMenu(v => !v)}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
            aria-label="Card options"
            aria-haspopup="menu"
            aria-expanded={showCardMenu}
          >
            <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
          </button>
          {showCardMenu && (
            <div
              className="absolute right-0 top-full mt-1 z-30 bg-white border border-gray-200 rounded-xl shadow-lg min-w-44 py-1"
              role="menu"
            >
              <button
                onClick={() => void handleSuspend()}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                role="menuitem"
              >
                Suspend card
              </button>
              <button
                onClick={() => void handleBury()}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                role="menuitem"
              >
                Bury until tomorrow
              </button>
            </div>
          )}
        </div>

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
        {/* If deck has a custom template and card is vocab, use templated display */}
        {activeTemplate && currentVariant !== 'grammar' ? (
          <TemplatedCard
            card={currentCard}
            template={activeTemplate}
            phase={phase}
            onReveal={session.reveal}
            ratingButtons={<RatingButtons previews={intervalPreviews} onRate={session.rate} />}
          />
        ) : (
          <>
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
          </>
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
