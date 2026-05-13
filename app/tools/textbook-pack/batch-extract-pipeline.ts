#!/usr/bin/env npx tsx
/**
 * Batch extraction pipeline: OCR → Normalize → Group → Build lessons
 * Processes a single textbook source through the complete pipeline
 */

import { execSync } from 'node:child_process'
import path from 'node:path'

interface PipelineConfig {
  sourceId: string
  dpi?: number
  skipOcr?: boolean
  verbose?: boolean
}

async function main() {
  const config = parseArgs(process.argv.slice(2))

  console.log(`\n🚀 Starting pipeline for ${config.sourceId}...`)

  // Step 1: OCR (skip if --skip-ocr)
  if (!config.skipOcr) {
    console.log(`\n📸 Step 1: OCR Capture (${config.dpi || 300} DPI)...`)
    try {
      execSync(
        `python3 app/tools/textbook-pack/ocr-full-capture.py --source-id ${config.sourceId} --dpi ${config.dpi || 300}`,
        { stdio: 'inherit', cwd: process.cwd() }
      )
      console.log(`✓ OCR complete for ${config.sourceId}`)
    } catch (error) {
      console.error(`✗ OCR failed: ${error}`)
      process.exit(1)
    }
  }

  // Step 2: Normalize
  console.log(`\n📋 Step 2: Normalize OCR pages...`)
  try {
    execSync(
      `npx tsx app/tools/textbook-pack/normalize-ocr-pages.ts --source-id ${config.sourceId}`,
      { stdio: 'inherit', cwd: process.cwd() }
    )
    console.log(`✓ Normalization complete`)
  } catch (error) {
    console.error(`✗ Normalization failed: ${error}`)
    process.exit(1)
  }

  // Step 3: Group
  console.log(`\n🔗 Step 3: Group OCR blocks...`)
  try {
    execSync(
      `npx tsx app/tools/textbook-pack/group-ocr-blocks.ts --source-id ${config.sourceId}`,
      { stdio: 'inherit', cwd: process.cwd() }
    )
    console.log(`✓ Grouping complete`)
  } catch (error) {
    console.error(`✗ Grouping failed: ${error}`)
    process.exit(1)
  }

  // Step 4: Build lessons (if it's a textbook with splitHints)
  console.log(`\n📖 Step 4: Build lesson packs...`)
  try {
    // Determine textbook key from source ID
    const textbookKey = deriveTextbookKey(config.sourceId)
    if (!textbookKey) {
      console.log(`⚠ Skipping lesson build (${config.sourceId} is not a lesson-bearing source)`)
    } else {
      // For now, just note that this would happen
      // The actual lesson building is source-specific (genki_1 has different structure than marugoto_a1)
      console.log(`Note: Lesson building would be ${textbookKey}-specific`)
      console.log(`For now, lesson packs are built separately per textbook type`)
    }
  } catch (error) {
    console.warn(`⚠ Lesson build noted (manual step may be needed): ${error}`)
  }

  console.log(`\n✓ Pipeline complete for ${config.sourceId}`)
  console.log(`Output:`)
  console.log(`  - Normalized: app/tools/textbook-pack/out/normalized/${config.sourceId}/`)
  console.log(`  - Grouped: app/tools/textbook-pack/out/grouped/${config.sourceId}/`)
}

function parseArgs(args: string[]): PipelineConfig {
  const config: PipelineConfig = {
    sourceId: '',
    dpi: 300,
    skipOcr: false,
    verbose: false,
  }

  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--source-id') config.sourceId = args[++i]
    if (args[i] === '--dpi') config.dpi = parseInt(args[++i], 10)
    if (args[i] === '--skip-ocr') config.skipOcr = true
    if (args[i] === '-v' || args[i] === '--verbose') config.verbose = true
  }

  if (!config.sourceId) {
    console.error('Error: --source-id is required')
    console.error('Usage: npx tsx batch-extract-pipeline.ts --source-id <id> [--dpi 300] [--skip-ocr]')
    process.exit(1)
  }

  return config
}

function deriveTextbookKey(sourceId: string): string | null {
  if (sourceId.includes('genki_1')) return 'genki_1'
  if (sourceId.includes('genki_2')) return 'genki_2'
  if (sourceId.includes('marugoto_a1')) return 'marugoto_a1'
  if (sourceId.includes('marugoto_a2')) return 'marugoto_a2'
  if (sourceId.includes('quartet')) return 'quartet_1'
  return null
}

main().catch(console.error)
