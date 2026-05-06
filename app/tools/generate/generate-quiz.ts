#!/usr/bin/env tsx
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import Anthropic from '@anthropic-ai/sdk'
import type { GenerationResult, GrammarData, QuizData } from './types.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUTPUT_DIR = path.join(__dirname, '../../data/generated')
const GRAMMAR_PATH = path.join(OUTPUT_DIR, 'grammar-points.json')
const QUIZ_PATH = path.join(OUTPUT_DIR, 'quiz-questions.json')

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true })

const QUESTIONS_PER_GRAMMAR = 10  // 2 batches of 5
const BATCH_SIZE = 5
const THINKING_BUDGET = 6000

async function generateBatch(grammar: any): Promise<QuizData[]> {
  const prompt = `You are a strict JLPT grammar examiner. Generate exactly ${BATCH_SIZE} multiple-choice fill-in-the-blank questions for this JLPT ${grammar.jlptLevel} grammar pattern.

Pattern: ${grammar.pattern}
Title: ${grammar.title}
Meaning: ${grammar.meaning}
Explanation: ${grammar.explanation}

Return a JSON array with exactly ${BATCH_SIZE} questions. Each question:
{
  "questionType": "fill_blank",
  "prompt": "Sentence with [___] marking the blank",
  "options": ["CORRECT ANSWER FIRST", "wrong option B", "wrong option C", "wrong option D"],
  "answer": "must exactly match options[0]",
  "explanation": "Why this answer is correct and the others are wrong"
}

Strict rules:
1. Use [___] (with square brackets) as the ONLY blank marker
2. options[0] MUST be the correct answer — the answer field must exactly equal options[0]
3. The answer must contain ONLY the text that fills [___] — never duplicate particles or words already outside the blank
   Example: for "これはいくら[___]か？" the answer is "です" not "ですか" (か is already in the prompt)
4. BEFORE committing to each distractor, ask yourself: could an advanced native speaker argue this option is also correct? If yes, replace it with a clearly wrong alternative
5. All four options must be plausible but only one grammatically/semantically correct given the full context
6. Vary sentence contexts across the ${BATCH_SIZE} questions — no two prompts should test the same sub-nuance
7. Return ONLY valid JSON array, no markdown, no other text`

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8192,
      thinking: { type: 'enabled', budget_tokens: THINKING_BUDGET },
      messages: [{ role: 'user', content: prompt }],
    })

    const text = response.content.find(b => b.type === 'text')?.text ?? ''
    const match = text.match(/\[[\s\S]*\]/)
    if (!match) return []

    const questions: any[] = JSON.parse(match[0])
    if (!Array.isArray(questions)) return []

    return questions.map(q => {
      // Enforce answer = options[0] (top-left in 2x2 grid).
      // Place the actual answer at index 0 regardless of what the model returned.
      const options: string[] = Array.isArray(q.options) ? q.options : []
      const answerText: string = q.answer ?? options[0] ?? ''
      // Move answer to front if it isn't already
      const withoutAnswer = options.filter((o: string) => o !== answerText)
      const orderedOptions = [answerText, ...withoutAnswer].slice(0, 4)
      return {
        grammarPointId: undefined,
        jlptLevel: grammar.jlptLevel,
        questionType: 'fill_blank',
        prompt: q.prompt,
        optionsJson: JSON.stringify(orderedOptions),
        answer: answerText,
        explanation: q.explanation,
      }
    })
  } catch (err) {
    console.error(`  Batch failed for "${grammar.title}": ${err}`)
    return []
  }
}

async function run(): Promise<GenerationResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { success: false, message: 'ANTHROPIC_API_KEY not set', count: 0 }
  }
  if (!fs.existsSync(GRAMMAR_PATH)) {
    return {
      success: false,
      message: 'grammar-points.json not found. Run extract-grammar.ts first.',
      count: 0,
    }
  }

  const grammarData: any[] = JSON.parse(fs.readFileSync(GRAMMAR_PATH, 'utf-8'))

  // Load existing questions to support resume
  const existing: QuizData[] = fs.existsSync(QUIZ_PATH)
    ? JSON.parse(fs.readFileSync(QUIZ_PATH, 'utf-8'))
    : []

  // Count existing questions per grammar title
  const questionsByTitle = new Map<string, number>()
  for (const q of existing) {
    // Match by finding grammar point with this jlptLevel
    // We key by the position in grammarData, stored via a side-file
  }

  // Use a progress tracker keyed by grammar title
  const progressPath = path.join(OUTPUT_DIR, 'quiz-progress.json')
  const progress: Record<string, number> = fs.existsSync(progressPath)
    ? JSON.parse(fs.readFileSync(progressPath, 'utf-8'))
    : {}

  const allQuestions = [...existing]
  let processed = 0
  let skipped = 0

  console.log(`\nGenerating quiz questions for ${grammarData.length} grammar points...`)
  console.log(`Target: ${QUESTIONS_PER_GRAMMAR} questions per point (${BATCH_SIZE} per API call)`)
  console.log(`Model: claude-sonnet-4-6 with extended thinking (${THINKING_BUDGET} budget tokens)\n`)

  for (let i = 0; i < grammarData.length; i++) {
    const grammar = grammarData[i]
    const key = `${grammar.jlptLevel}::${grammar.title}`
    const have = progress[key] ?? 0

    if (have >= QUESTIONS_PER_GRAMMAR) {
      skipped++
      continue
    }

    const batchesNeeded = Math.ceil((QUESTIONS_PER_GRAMMAR - have) / BATCH_SIZE)

    for (let b = 0; b < batchesNeeded; b++) {
      const batch = await generateBatch(grammar)
      allQuestions.push(...batch)
      progress[key] = (progress[key] ?? 0) + batch.length

      // Save after every batch
      fs.writeFileSync(QUIZ_PATH, JSON.stringify(allQuestions, null, 2))
      fs.writeFileSync(progressPath, JSON.stringify(progress, null, 2))

      if (batch.length < BATCH_SIZE) break  // model returned fewer; move on
    }

    processed++
    const total = grammarData.length
    const pct = Math.round(((i + 1) / total) * 100)
    console.log(`[${i + 1}/${total}] (${pct}%) ${grammar.jlptLevel} "${grammar.title}" → ${progress[key] ?? 0} questions`)
  }

  fs.writeFileSync(QUIZ_PATH, JSON.stringify(allQuestions, null, 2))

  return {
    success: true,
    message: `Generated ${allQuestions.length} quiz questions (${processed} new, ${skipped} skipped) to ${QUIZ_PATH}`,
    count: allQuestions.length,
  }
}

run().then(result => {
  console.log('\n' + result.message)
  if (!result.success) process.exit(1)
})
