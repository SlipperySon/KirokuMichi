import { sanitizeReport, submitIssueReport } from '../server/reportIssue'

/**
 * Legacy Vercel serverless stub. Staging/prod run Express on Render (`/api/report`).
 * Keep this handler inert so a mistaken Vercel deploy cannot accept unauthenticated reports.
 */
export default async function handler(req: any, res: any) {
  res.setHeader('allow', 'POST')
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  if (process.env.VERCEL_REPORT_ENABLED !== '1') {
    res.status(503).json({
      error: 'Report API is disabled on this host. Use the Render Express /api/report endpoint.',
    })
    return
  }

  try {
    const report = sanitizeReport(req.body)
    const result = await submitIssueReport(report)
    res.status(result.mode === 'github' ? 201 : 202).json(result)
  } catch (err) {
    res.status(400).json({
      error: 'Report submission failed',
    })
  }
}
