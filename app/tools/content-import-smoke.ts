import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'

interface SmokeFileResult {
  file: string
  bytes: number
  status: 'ready'
}

const FIXTURE_DIRS = [
  '../test-fixtures',
  'test-fixtures',
  'tools/textbook-pack/fixtures',
]

const REPORT_PATH = 'tools/textbook-pack/out/content-quality/content-import-smoke-report.json'

function main() {
  const fixtureFiles = findPdfFixtures()
  const report = fixtureFiles.length === 0
    ? {
        generatedAt: new Date().toISOString(),
        status: 'skipped_no_fixtures',
        checkedDirs: FIXTURE_DIRS,
        message: 'No PDF fixtures found. Add real textbook/import PDFs to one of the checked fixture directories and rerun npm run content:import:smoke.',
        files: [] as SmokeFileResult[],
      }
    : {
        generatedAt: new Date().toISOString(),
        status: 'ready',
        checkedDirs: FIXTURE_DIRS,
        message: 'PDF fixtures are present for manual/import smoke testing.',
        files: fixtureFiles,
      }

  mkdirSync(dirname(REPORT_PATH), { recursive: true })
  writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`)
  console.log(JSON.stringify({ reportPath: REPORT_PATH, ...report }, null, 2))
}

function findPdfFixtures(): SmokeFileResult[] {
  const files: SmokeFileResult[] = []
  for (const fixtureDir of FIXTURE_DIRS) {
    const dir = resolve(process.cwd(), fixtureDir)
    if (!existsSync(dir)) continue

    for (const filename of readdirSync(dir)) {
      if (!filename.toLowerCase().endsWith('.pdf')) continue
      const fullPath = join(dir, filename)
      const stats = statSync(fullPath)
      if (!stats.isFile()) continue
      files.push({
        file: `${fixtureDir.replace(/\/$/, '')}/${basename(filename)}`,
        bytes: stats.size,
        status: 'ready',
      })
    }
  }
  return files
}

main()
