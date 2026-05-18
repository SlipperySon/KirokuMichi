import { useEffect, useMemo, useState } from 'react'
import { Navigation } from '../components/Navigation'
import { getTextbookQARows, type TextbookQARow } from '../content/textbookQAService'

export function TextbookQADashboard() {
  const [rows, setRows] = useState<TextbookQARow[]>([])
  const [loading, setLoading] = useState(true)
  const [level, setLevel] = useState<string>('all')

  useEffect(() => {
    let cancelled = false
    void getTextbookQARows().then(result => {
      if (cancelled) return
      setRows(result)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const filtered = useMemo(
    () => rows.filter(row => level === 'all' || row.cefr === level),
    [level, rows]
  )
  const totals = useMemo(() => ({
    lessons: filtered.length,
    vocab: filtered.reduce((sum, row) => sum + row.vocabCount, 0),
    grammar: filtered.reduce((sum, row) => sum + row.grammarCount, 0),
    scenarios: filtered.reduce((sum, row) => sum + row.scenarioCount, 0),
    maynard: filtered.reduce((sum, row) => sum + row.maynardMatchCount, 0),
    warnings: filtered.reduce((sum, row) => sum + row.warnings.length, 0),
  }), [filtered])

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-indigo-600">Developer QA</p>
            <h1 className="mt-1 text-3xl font-bold text-gray-900">Textbook Coverage Dashboard</h1>
            <p className="mt-2 text-gray-600">Lesson-by-lesson content health for vocab, grammar, scenarios, Maynard/support coverage, and suspicious extraction artifacts.</p>
          </div>
          <select
            value={level}
            onChange={event => setLevel(event.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900"
          >
            <option value="all">All levels</option>
            <option value="a1">A1</option>
            <option value="a2">A2</option>
            <option value="b1">B1</option>
            <option value="b2">B2</option>
          </select>
        </div>

        <div className="mb-6 grid gap-3 md:grid-cols-6">
          <QAStat label="Lessons" value={totals.lessons} />
          <QAStat label="Vocab" value={totals.vocab} />
          <QAStat label="Grammar" value={totals.grammar} />
          <QAStat label="Scenarios" value={totals.scenarios} />
          <QAStat label="Maynard/support" value={totals.maynard} />
          <QAStat label="Warnings" value={totals.warnings} tone={totals.warnings > 0 ? 'amber' : 'green'} />
        </div>

        <div className="overflow-hidden rounded-lg bg-white shadow">
          {loading ? (
            <div className="p-6 text-gray-600">Loading coverage...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-4 py-3">Lesson</th>
                    <th className="px-4 py-3">Pages</th>
                    <th className="px-4 py-3">Vocab</th>
                    <th className="px-4 py-3">Grammar</th>
                    <th className="px-4 py-3">Scenarios</th>
                    <th className="px-4 py-3">Maynard/support</th>
                    <th className="px-4 py-3">Suspicious</th>
                    <th className="px-4 py-3">Warnings</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map(row => (
                    <tr key={row.lessonId}>
                      <td className="px-4 py-3 font-semibold text-gray-900">{row.cefr.toUpperCase()} L{row.lessonNumber}</td>
                      <td className="px-4 py-3 text-gray-600">{row.pageRange}</td>
                      <td className="px-4 py-3 text-gray-900">{row.vocabCount}</td>
                      <td className="px-4 py-3 text-gray-900">{row.grammarCount}</td>
                      <td className="px-4 py-3 text-gray-900">{row.scenarioCount}</td>
                      <td className="px-4 py-3 text-gray-900">{row.maynardMatchCount}</td>
                      <td className="px-4 py-3 text-gray-900">{row.suspiciousVocabCount}</td>
                      <td className="px-4 py-3">
                        {row.warnings.length > 0 ? (
                          <span className="text-amber-700">{row.warnings.join(', ')}</span>
                        ) : (
                          <span className="text-green-700">ok</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

function QAStat({ label, value, tone = 'slate' }: { label: string; value: number; tone?: 'slate' | 'amber' | 'green' }) {
  const classes = {
    slate: 'bg-white text-slate-900',
    amber: 'bg-amber-50 text-amber-950',
    green: 'bg-green-50 text-green-950',
  }
  return (
    <div className={`rounded-lg p-4 shadow ${classes[tone]}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs font-semibold uppercase tracking-wide opacity-80">{label}</div>
    </div>
  )
}
