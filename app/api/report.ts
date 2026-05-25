import { sanitizeReport, submitIssueReport } from '../server/reportIssue'

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('allow', 'POST')
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    const report = sanitizeReport(req.body)
    const result = await submitIssueReport(report)
    res.status(result.mode === 'github' ? 201 : 202).json(result)
  } catch (err) {
    res.status(400).json({
      error: err instanceof Error ? err.message : 'Report submission failed',
    })
  }
}
