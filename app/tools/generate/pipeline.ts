#!/usr/bin/env tsx
import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import { fileURLToPath } from 'url'

const execAsync = promisify(exec)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

interface Step {
  name: string
  file: string
  description: string
  optional: boolean
  args?: string[]
}

const STEPS: Step[] = [
  {
    name: 'Extract Kanji',
    file: 'extract-kanji.ts',
    description: 'Download kanji data from davidluzgouveia/kanji-data (auto-downloads)',
    optional: false,
  },
  {
    name: 'Extract Vocabulary (Anki)',
    file: 'extract-vocab.ts',
    description: 'Extract N5 vocabulary from JLPT Anki deck (.apkg) — requires a file',
    optional: true,
    args: ['<path-to-n5-deck.apkg>'],
  },
  {
    name: 'Generate Vocabulary (AI)',
    file: 'generate-vocab.ts',
    description: 'Generate N4–N1 vocabulary using Claude Haiku (requires ANTHROPIC_API_KEY)',
    optional: true,
  },
  {
    name: 'Extract Grammar',
    file: 'extract-grammar.ts',
    description: 'Generate N5–N1 grammar points using Claude Haiku (requires ANTHROPIC_API_KEY)',
    optional: false,
  },
  {
    name: 'Generate Quiz Questions',
    file: 'generate-quiz.ts',
    description: 'Generate fill-blank quiz questions using Claude Sonnet + extended thinking (requires ANTHROPIC_API_KEY)',
    optional: true,
  },
  {
    name: 'Generate Examples',
    file: 'generate-examples.ts',
    description: 'Enrich vocabulary with example sentences using Claude Haiku (requires ANTHROPIC_API_KEY)',
    optional: true,
  },
  {
    name: 'Import to Database',
    file: 'import-to-db.ts',
    description: 'Compile all generated JSON files into import.sql',
    optional: false,
  },
]

async function runStep(step: Step): Promise<boolean> {
  const stepPath = path.join(__dirname, step.file)

  console.log(`\n${'='.repeat(60)}`)
  console.log(`${step.name}`)
  console.log(`${'-'.repeat(60)}`)
  console.log(`${step.description}`)

  if (step.args) {
    console.log(`\n⚠  Run manually: tsx ${step.file} ${step.args.join(' ')}`)
    return true  // non-blocking: skip if no args supplied
  }

  try {
    console.log(`\nRunning...`)
    const { stdout, stderr } = await execAsync(`tsx "${stepPath}"`, {
      cwd: __dirname,
      env: { ...process.env },
      timeout: 600_000,  // 10-minute timeout for long AI steps
    })
    if (stdout) process.stdout.write(stdout)
    if (stderr) process.stderr.write(stderr)
    return true
  } catch (error: any) {
    if (step.optional) {
      console.error(`⚠  Optional step failed (continuing): ${error?.message ?? error}`)
      return true
    }
    console.error(`✗  Step failed: ${error?.message ?? error}`)
    return false
  }
}

async function main() {
  console.log(`\n${'='.repeat(60)}`)
  console.log('KirokuMichi — Content Generation Pipeline')
  console.log(`${'='.repeat(60)}`)

  const args = process.argv.slice(2)
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage:
  npm run generate                   Run full pipeline
  npm run generate -- --grammar-only Extract grammar + import
  npm run generate -- --quiz-only    Generate quiz questions + import
  npm run generate -- --kanji-only   Extract kanji + import
  npm run generate -- --vocab-only   Generate N4-N1 vocab + import

Individual steps:
  tsx tools/generate/extract-kanji.ts
  tsx tools/generate/extract-vocab.ts <path.apkg>
  tsx tools/generate/generate-vocab.ts [N4|N3|N2|N1]
  tsx tools/generate/extract-grammar.ts
  tsx tools/generate/generate-quiz.ts
  tsx tools/generate/generate-examples.ts
  tsx tools/generate/import-to-db.ts
  tsx tools/init-db.ts                  (after import-to-db)

Models used:
  Haiku 4.5   — grammar extraction, vocab generation, example sentences
  Sonnet 4.6  — quiz generation (with extended thinking)
`)
    return
  }

  let stepsToRun = STEPS
  if (args.includes('--grammar-only')) stepsToRun = STEPS.filter(s => s.name.includes('Grammar') || s.name === 'Import to Database')
  if (args.includes('--quiz-only')) stepsToRun = STEPS.filter(s => s.name.includes('Quiz') || s.name === 'Import to Database')
  if (args.includes('--kanji-only')) stepsToRun = STEPS.filter(s => s.name === 'Extract Kanji' || s.name === 'Import to Database')
  if (args.includes('--vocab-only')) stepsToRun = STEPS.filter(s => s.name.includes('Vocabulary') || s.name.includes('Vocab') || s.name === 'Import to Database')

  let allSuccess = true
  for (const step of stepsToRun) {
    const ok = await runStep(step)
    if (!ok && !step.optional) {
      console.log(`\n✗ Pipeline stopped at: ${step.name}`)
      process.exit(1)
    }
    if (!ok) allSuccess = false
  }

  console.log(`\n${'='.repeat(60)}`)
  if (allSuccess) {
    console.log('✓ Pipeline complete!')
    console.log('\nNext: tsx tools/init-db.ts  (pack import.sql into kiroku.db)')
  } else {
    console.log('⚠  Pipeline finished with warnings. Review output above.')
  }
  console.log(`${'='.repeat(60)}\n`)
}

main().catch(console.error)
