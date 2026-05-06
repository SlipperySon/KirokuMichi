#!/usr/bin/env tsx
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import type { GenerationResult } from './types.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUTPUT_DIR = path.join(__dirname, '../../data/generated')

interface GeneratedCard {
  type: string
  front: string
  back: string
  reading?: string
  jlptLevel?: string
  frequencyRank?: number
  domain?: string | null
  audioUrl?: string | null
}

interface GeneratedGrammar {
  jlptLevel: string
  title: string
  pattern: string
  meaning: string
  explanation: string
  examplesJson: string
  category?: string | null
  isKeigo?: number
  frequencyRank?: number | null
}

interface GeneratedQuestion {
  grammarPointId?: number | null
  jlptLevel: string
  questionType: string
  prompt: string
  optionsJson?: string | null
  answer: string
  explanation?: string | null
}

function escapeSql(str: string | null | undefined): string {
  if (str === null || str === undefined) return 'NULL'
  return `'${String(str).replace(/'/g, "''")}'`
}

function generateInsertSQL(table: string, records: any[]): string {
  const statements: string[] = []

  if (table === 'cards') {
    for (const card of records) {
      const stmt = `INSERT OR IGNORE INTO cards (type, front, back, reading, jlpt_level, frequency_rank, domain, audio_url) VALUES (${escapeSql(card.type)}, ${escapeSql(card.front)}, ${escapeSql(card.back)}, ${escapeSql(card.reading)}, ${escapeSql(card.jlptLevel)}, ${card.frequencyRank ?? 'NULL'}, ${escapeSql(card.domain)}, ${escapeSql(card.audioUrl)});`
      statements.push(stmt)
    }
  } else if (table === 'grammar_points') {
    for (const point of records) {
      const stmt = `INSERT OR IGNORE INTO grammar_points (jlpt_level, title, pattern, meaning, explanation, examples_json, category, is_keigo, frequency_rank) VALUES (${escapeSql(point.jlptLevel)}, ${escapeSql(point.title)}, ${escapeSql(point.pattern)}, ${escapeSql(point.meaning)}, ${escapeSql(point.explanation)}, ${escapeSql(point.examplesJson)}, ${escapeSql(point.category)}, ${point.isKeigo ?? 0}, ${point.frequencyRank ?? 'NULL'});`
      statements.push(stmt)
    }
  } else if (table === 'questions') {
    for (const q of records) {
      const stmt = `INSERT INTO questions (grammar_point_id, jlpt_level, question_type, prompt, options_json, answer, explanation, source) VALUES (${q.grammarPointId ?? 'NULL'}, ${escapeSql(q.jlptLevel)}, ${escapeSql(q.questionType)}, ${escapeSql(q.prompt)}, ${escapeSql(q.optionsJson)}, ${escapeSql(q.answer)}, ${escapeSql(q.explanation)}, 'pregenerated');`
      statements.push(stmt)
    }
  }

  return statements.join('\n')
}

async function run(): Promise<GenerationResult> {
  try {
    let totalRecords = 0
    const sqlStatements: string[] = []
    const errors: string[] = []

    // Process kanji
    const kanjiPath = path.join(OUTPUT_DIR, 'kanji-cards.json')
    if (fs.existsSync(kanjiPath)) {
      const cards = JSON.parse(fs.readFileSync(kanjiPath, 'utf-8'))
      sqlStatements.push(generateInsertSQL('cards', cards))
      totalRecords += cards.length
      console.log(`✓ Kanji: ${cards.length} records`)
    } else {
      errors.push('kanji-cards.json not found')
    }

    // Process vocab from jlpt folder
    const jlptDir = path.join(OUTPUT_DIR, 'jlpt')
    const vocabFiles = fs.readdirSync(jlptDir).filter(f =>
      f.startsWith('vocab-') && f.endsWith('.json') && !f.includes('enriched')
    )
    if (vocabFiles.length > 0) {
      for (const file of vocabFiles) {
        const cards = JSON.parse(fs.readFileSync(path.join(jlptDir, file), 'utf-8'))
        sqlStatements.push(generateInsertSQL('cards', cards))
        totalRecords += cards.length
        console.log(`✓ Vocabulary (${file}): ${cards.length} records`)
      }
    } else {
      errors.push('No vocab-*.json files found in jlpt folder')
    }

    // Process grammar from jlpt folder
    const grammarPath = path.join(jlptDir, 'grammar-points.json')
    if (fs.existsSync(grammarPath)) {
      const points = JSON.parse(fs.readFileSync(grammarPath, 'utf-8'))
      sqlStatements.push(generateInsertSQL('grammar_points', points))
      totalRecords += points.length
      console.log(`✓ Grammar: ${points.length} records`)
    } else {
      errors.push('grammar-points.json not found in jlpt folder')
    }

    // Process questions from jlpt folder
    const questionsPath = path.join(jlptDir, 'quiz-questions.json')
    if (fs.existsSync(questionsPath)) {
      const questions = JSON.parse(fs.readFileSync(questionsPath, 'utf-8'))
      sqlStatements.push(generateInsertSQL('questions', questions))
      totalRecords += questions.length
      console.log(`✓ Quiz Questions: ${questions.length} records`)
    }

    // Write SQL file
    const sqlPath = path.join(OUTPUT_DIR, 'import.sql')
    fs.writeFileSync(sqlPath, sqlStatements.join('\n\n'))

    console.log(`\n✓ Generated SQL file: ${sqlPath}`)
    console.log(`  Total records: ${totalRecords}`)

    if (errors.length > 0) {
      console.log(`\n⚠ Missing files:`)
      errors.forEach(e => console.log(`  - ${e}`))
    }

    console.log(`\nNext steps:`)
    console.log(`1. Start the app: npm run dev`)
    console.log(`2. Open browser console and run:`)
    console.log(`   fetch('${sqlPath}').then(r => r.text()).then(sql => window.db.exec(sql))`)

    return {
      success: true,
      message: `Generated SQL import file with ${totalRecords} records`,
      count: totalRecords,
    }
  } catch (error) {
    return {
      success: false,
      message: `Failed to generate SQL: ${error instanceof Error ? error.message : String(error)}`,
      count: 0,
      errors: [error instanceof Error ? error.stack || '' : String(error)],
    }
  }
}

run().then(result => {
  console.log('\n' + result.message)
  if (!result.success) {
    process.exit(1)
  }
})
