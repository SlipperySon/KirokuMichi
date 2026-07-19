import { useState, useEffect } from 'react'
import { useAppStore } from '../store'
import { SQLiteStorage } from '../db/sqlite'
import { FSRSScheduler, SM2Scheduler } from '../core/scheduler'
import { SRSService } from '../srs/srsService'
import { renderTemplate, sanitizeTemplateCss, sanitizeTemplateHtml } from '../srs/templateRenderer'
import { Navigation } from '../components/Navigation'
import { toast } from '../components/toastStore'

const SAMPLE_FIELDS = {
  front: '食べる',
  back: 'to eat',
  reading: 'たべる',
}

const DEFAULT_FRONT = '{{front}}'
const DEFAULT_BACK = '{{front}}\n\n{{reading}}\n\n{{back}}'

interface TemplateEditorProps {
  /** If provided, edit the template for a specific deck inline */
  deckId?: number
  deckName?: string
  onSaved?: () => void
  onClose?: () => void
}

export function TemplateEditor({ deckId, deckName, onSaved, onClose }: TemplateEditorProps) {
  const settings = useAppStore(s => s.settings)
  const activeUserId = useAppStore(s => s.activeUserId)
  const activeDeckId = useAppStore(s => s.activeDeckId)

  const [storage] = useState(() => new SQLiteStorage())
  const scheduler = settings.schedulerAlgorithm === 'fsrs' ? new FSRSScheduler() : new SM2Scheduler()
  const [service] = useState(() => new SRSService(storage, scheduler))

  const userId = activeUserId ?? 1
  const targetDeckId = deckId ?? activeDeckId

  const [decks, setDecks] = useState<{ id: number; name: string }[]>([])
  const [selectedDeckId, setSelectedDeckId] = useState<number | null>(targetDeckId)

  const [frontTemplate, setFrontTemplate] = useState(DEFAULT_FRONT)
  const [backTemplate, setBackTemplate] = useState(DEFAULT_BACK)
  const [css, setCss] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isInitialising, setIsInitialising] = useState(true)

  useEffect(() => {
    void (async () => {
      try {
        const deckRows = await service.getDecks(userId)
        setDecks(deckRows)

        const resolvedId = targetDeckId ?? deckRows[0]?.id ?? null
        setSelectedDeckId(resolvedId)

        if (resolvedId != null) {
          const tmpl = await service.getTemplate(resolvedId)
          if (tmpl) {
            setFrontTemplate(tmpl.frontTemplate)
            setBackTemplate(tmpl.backTemplate)
            setCss(tmpl.css)
          }
        }
      } finally {
        setIsInitialising(false)
      }
    })()
  }, [userId, targetDeckId])

  // Load template when deck selection changes
  async function handleDeckChange(id: number | null) {
    setSelectedDeckId(id)
    if (id == null) {
      setFrontTemplate(DEFAULT_FRONT)
      setBackTemplate(DEFAULT_BACK)
      setCss('')
      return
    }
    const tmpl = await service.getTemplate(id)
    if (tmpl) {
      setFrontTemplate(tmpl.frontTemplate)
      setBackTemplate(tmpl.backTemplate)
      setCss(tmpl.css)
    } else {
      setFrontTemplate(DEFAULT_FRONT)
      setBackTemplate(DEFAULT_BACK)
      setCss('')
    }
  }

  async function handleSave() {
    if (selectedDeckId == null) {
      toast.error('Please select a deck')
      return
    }
    setIsLoading(true)
    try {
      await service.saveTemplate(userId, selectedDeckId, {
        frontTemplate: sanitizeTemplateHtml(frontTemplate),
        backTemplate: sanitizeTemplateHtml(backTemplate),
        css: sanitizeTemplateCss(css),
      })
      toast.success('Template saved')
      onSaved?.()
    } catch (err) {
      toast.error('Failed to save template')
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  function handleReset() {
    setFrontTemplate(DEFAULT_FRONT)
    setBackTemplate(DEFAULT_BACK)
    setCss('')
  }

  const frontPreview = renderTemplate(frontTemplate, SAMPLE_FIELDS)
  const backPreview = renderTemplate(backTemplate, SAMPLE_FIELDS)

  const formContent = (
    <div className="flex flex-col gap-6">
      {/* Deck selector (only shown when no fixed deckId) */}
      {deckId == null && (
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-semibold text-gray-700">Deck</label>
          {isInitialising ? (
            <div className="h-10 bg-gray-100 rounded-xl animate-pulse" />
          ) : (
            <select
              value={selectedDeckId ?? ''}
              onChange={e => void handleDeckChange(e.target.value ? Number(e.target.value) : null)}
              className="px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
            >
              <option value="">Select a deck…</option>
              {decks.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          )}
        </div>
      )}

      {deckName && (
        <div className="text-sm text-gray-500">
          Editing template for deck: <span className="font-semibold text-gray-800">{deckName}</span>
        </div>
      )}

      {/* Template tip */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-800">
        Use <code className="font-mono bg-amber-100 px-1 rounded">{'{{front}}'}</code>,{' '}
        <code className="font-mono bg-amber-100 px-1 rounded">{'{{back}}'}</code>, and{' '}
        <code className="font-mono bg-amber-100 px-1 rounded">{'{{reading}}'}</code> as placeholders.
      </div>

      {/* Two-column editor */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Front template */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-semibold text-gray-700">Front Template</label>
          <textarea
            value={frontTemplate}
            onChange={e => setFrontTemplate(e.target.value)}
            rows={6}
            spellCheck={false}
            className="px-3 py-2.5 border border-gray-300 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white resize-none"
          />
        </div>

        {/* Back template */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-semibold text-gray-700">Back Template</label>
          <textarea
            value={backTemplate}
            onChange={e => setBackTemplate(e.target.value)}
            rows={6}
            spellCheck={false}
            className="px-3 py-2.5 border border-gray-300 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white resize-none"
          />
        </div>
      </div>

      {/* CSS */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-gray-600">
          Custom CSS <span className="text-gray-400 text-xs">(optional)</span>
        </label>
        <textarea
          value={css}
          onChange={e => setCss(e.target.value)}
          rows={3}
          spellCheck={false}
          placeholder=".card { font-size: 1.5rem; }"
          className="px-3 py-2.5 border border-gray-300 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white resize-none"
        />
      </div>

      {/* Live preview */}
      <div className="border border-gray-200 rounded-2xl overflow-hidden">
        <div className="bg-gray-100 px-4 py-2 text-xs font-semibold text-gray-600 border-b border-gray-200">
          Live preview (sample card: 食べる / to eat)
        </div>
        {/* Inject custom CSS */}
        {css && <style>{sanitizeTemplateCss(css)}</style>}
        <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-gray-200">
          <div className="p-4">
            <p className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wide">Front</p>
            <div
              className="text-gray-900 whitespace-pre-wrap text-lg font-bold"
              lang="ja"
              dangerouslySetInnerHTML={{ __html: frontPreview }}
            />
          </div>
          <div className="p-4">
            <p className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wide">Back</p>
            <div
              className="text-gray-900 whitespace-pre-wrap"
              lang="ja"
              dangerouslySetInnerHTML={{ __html: backPreview }}
            />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleReset}
          className="px-4 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          Reset to default
        </button>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        )}
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={isLoading || selectedDeckId == null}
          className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? 'Saving…' : 'Save Template'}
        </button>
      </div>
    </div>
  )

  // If used as an embedded panel (e.g. from DeckTree context), skip navigation wrapper
  if (onClose) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-900">Edit Card Template</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
        </div>
        {formContent}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Card Templates</h1>
          <p className="text-sm text-gray-500 mt-1">
            Customise how cards appear during review for each deck
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          {formContent}
        </div>
      </div>
    </div>
  )
}
