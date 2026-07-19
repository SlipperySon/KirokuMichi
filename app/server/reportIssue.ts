import { sanitizeReportMetadata } from './securityGuards'

export type ReportType =
  | 'bug'
  | 'content'
  | 'contrast'
  | 'lesson'
  | 'scenario'
  | 'suggestion'

export interface IssueReport {
  type: ReportType
  summary: string
  details: string
  contact?: string | null
  metadata?: Record<string, unknown>
}

export interface ReportResult {
  ok: boolean
  mode: 'github' | 'local'
  url?: string
  id?: string
}

const REPORT_LABELS: Record<ReportType, string[]> = {
  bug: ['bug'],
  content: ['content'],
  contrast: ['contrast'],
  lesson: ['lesson-flow'],
  scenario: ['scenario'],
  suggestion: ['suggestion'],
}

export function sanitizeReport(input: unknown): IssueReport {
  if (!input || typeof input !== 'object') throw new Error('Report body is required')
  const body = input as Partial<IssueReport>
  const type = isReportType(body.type) ? body.type : 'bug'
  const summary = clean(body.summary, 140)
  const details = clean(body.details, 5000)
  const contact = clean(body.contact ?? '', 200) || null
  const metadata = sanitizeReportMetadata(body.metadata)

  if (!summary) throw new Error('Summary is required')
  if (!details) throw new Error('Details are required')

  return { type, summary, details, contact, metadata }
}

export async function submitIssueReport(report: IssueReport): Promise<ReportResult> {
  const repo = process.env.GITHUB_REPORT_REPO || process.env.GITHUB_REPOSITORY
  const token = process.env.GITHUB_REPORT_TOKEN || process.env.GITHUB_TOKEN

  if (!repo || !token) {
    const id = `local-${Date.now()}`
    console.info('[report] GitHub reporting is not configured; accepted locally', {
      id,
      type: report.type,
      summary: report.summary,
      route: report.metadata?.route,
    })
    return { ok: true, mode: 'local', id }
  }

  const response = await fetch(`https://api.github.com/repos/${repo}/issues`, {
    method: 'POST',
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      'x-github-api-version': '2022-11-28',
    },
    body: JSON.stringify({
      title: `[${labelFor(report.type)}] ${report.summary}`,
      body: formatIssueBody(report),
      labels: ['tester-report', ...REPORT_LABELS[report.type]],
    }),
  })

  const data = await response.json().catch(() => null) as { html_url?: string; message?: string } | null
  if (!response.ok) {
    throw new Error(data?.message || `GitHub issue creation failed with ${response.status}`)
  }

  return { ok: true, mode: 'github', url: data?.html_url }
}

function isReportType(value: unknown): value is ReportType {
  return value === 'bug' ||
    value === 'content' ||
    value === 'contrast' ||
    value === 'lesson' ||
    value === 'scenario' ||
    value === 'suggestion'
}

function clean(value: unknown, maxLength: number) {
  return String(value ?? '')
    .split(String.fromCharCode(0)).join('')
    .trim()
    .slice(0, maxLength)
}

function labelFor(type: ReportType) {
  switch (type) {
    case 'content': return 'Content'
    case 'contrast': return 'Contrast'
    case 'lesson': return 'Lesson'
    case 'scenario': return 'Scenario'
    case 'suggestion': return 'Suggestion'
    case 'bug':
    default:
      return 'Bug'
  }
}

function formatIssueBody(report: IssueReport) {
  const metadata = report.metadata ?? {}
  return [
    '## Report',
    '',
    report.details,
    '',
    '## Contact',
    '',
    report.contact || 'Not provided',
    '',
    '## Context',
    '',
    '```json',
    JSON.stringify(metadata, null, 2),
    '```',
  ].join('\n')
}
