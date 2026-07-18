import { useMemo, useState } from 'react'
import { AlertTriangle, Bug, Lightbulb, Send, X } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { useAppStore } from '../store'
import { toast } from './toastStore'

type ReportType =
  | 'bug'
  | 'content'
  | 'contrast'
  | 'lesson'
  | 'scenario'
  | 'suggestion'

interface ReportIssueModalProps {
  open: boolean
  onClose: () => void
}

const REPORT_TYPES: Array<{ value: ReportType; label: string }> = [
  { value: 'bug', label: 'Bug' },
  { value: 'content', label: 'Content / OCR issue' },
  { value: 'contrast', label: 'Unreadable text / contrast' },
  { value: 'lesson', label: 'Lesson problem' },
  { value: 'scenario', label: 'Scenario problem' },
  { value: 'suggestion', label: 'Suggestion' },
]

function getTheme() {
  if (typeof document === 'undefined') return 'unknown'
  if (document.documentElement.classList.contains('dark')) return 'dark'
  if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) return 'system-dark'
  return 'light'
}

function getAppVersion() {
  const env = import.meta.env as ImportMetaEnv & {
    VITE_APP_VERSION?: string
    VITE_GIT_COMMIT?: string
    VERCEL_GIT_COMMIT_SHA?: string
  }
  return env.VITE_APP_VERSION || env.VITE_GIT_COMMIT || env.VERCEL_GIT_COMMIT_SHA || 'local-dev'
}

function collectRouteContext(pathname: string, search: string) {
  const params = new URLSearchParams(search)
  const context: Record<string, string> = {}

  const lessonMatch = pathname.match(/^\/learn\/lessons\/([^/]+)\/([^/]+)/)
  if (lessonMatch) {
    context.cefr = lessonMatch[1]
    context.lessonNumber = lessonMatch[2]
  }

  for (const key of ['level', 'source', 'lesson', 'cardId', 'scenarioId']) {
    const value = params.get(key)
    if (value) context[key] = value
  }

  return context
}

export function ReportIssueModal({ open, onClose }: ReportIssueModalProps) {
  const location = useLocation()
  const currentLesson = useAppStore(s => s.currentLesson)
  const activeDeckId = useAppStore(s => s.activeDeckId)
  const [type, setType] = useState<ReportType>('bug')
  const [summary, setSummary] = useState('')
  const [details, setDetails] = useState('')
  const [contact, setContact] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const routeContext = useMemo(
    () => collectRouteContext(location.pathname, location.search),
    [location.pathname, location.search]
  )

  if (!open) return null

  async function submitReport() {
    if (!summary.trim() || !details.trim()) {
      toast.error('Add a short summary and a few details first.')
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        type,
        summary: summary.trim(),
        details: details.trim(),
        contact: contact.trim() || null,
        metadata: {
          route: location.pathname,
          url: window.location.href,
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
          viewport: `${window.innerWidth}x${window.innerHeight}`,
          theme: getTheme(),
          appVersion: getAppVersion(),
          currentLesson,
          activeDeckId,
          routeContext,
        },
      }

      const response = await fetch('/api/report', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await response.json().catch(() => null) as { url?: string; mode?: string; error?: string } | null
      if (!response.ok) throw new Error(data?.error || 'Report submission failed')

      if (data?.url) {
        toast.success('Report sent. Thank you for catching it.')
      } else {
        toast.success('Report saved for staging review.')
      }
      setSummary('')
      setDetails('')
      setContact('')
      setType('bug')
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not send report')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 px-3 py-4 sm:items-center">
      <div className="w-full max-w-lg rounded-lg border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div className="flex gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-indigo-50 text-indigo-700">
              <Bug className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <h2 className="text-lg font-bold text-slate-950">Report issue</h2>
              <p className="text-sm text-slate-600">Send the current page and context with your report.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            aria-label="Close report issue"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <div className="grid gap-4 px-5 py-4">
          <label className="grid gap-1.5">
            <span className="text-sm font-semibold text-slate-800">Type</span>
            <select
              value={type}
              onChange={event => setType(event.target.value as ReportType)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            >
              {REPORT_TYPES.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>

          <label className="grid gap-1.5">
            <span className="text-sm font-semibold text-slate-800">Summary</span>
            <input
              value={summary}
              onChange={event => setSummary(event.target.value)}
              maxLength={140}
              placeholder="Short title for the issue"
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </label>

          <label className="grid gap-1.5">
            <span className="text-sm font-semibold text-slate-800">Details</span>
            <textarea
              value={details}
              onChange={event => setDetails(event.target.value)}
              rows={5}
              placeholder="What happened? What did you expect instead?"
              className="min-h-32 resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </label>

          <label className="grid gap-1.5">
            <span className="text-sm font-semibold text-slate-800">Contact optional</span>
            <input
              value={contact}
              onChange={event => setContact(event.target.value)}
              placeholder="Email or Discord handle"
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </label>

          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
            <div className="flex gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>
                This attaches route, browser, theme, viewport, app version, and lesson/scenario/card context when available.
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-slate-200 px-5 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submitReport}
            disabled={submitting}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? <Lightbulb className="h-4 w-4 animate-pulse" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
            {submitting ? 'Sending…' : 'Send report'}
          </button>
        </div>
      </div>
    </div>
  )
}
