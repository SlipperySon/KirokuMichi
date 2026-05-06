#!/usr/bin/env tsx
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import Anthropic from '@anthropic-ai/sdk'
import type { GenerationResult, VocabData } from './types.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUTPUT_DIR = path.join(__dirname, '../../data/generated')
const VOCAB_GLOB = path.join(OUTPUT_DIR, 'vocab-*.json')

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

interface VocabWithExamples extends VocabData {
  examples: string[]
}

async function generateExamplesForVocab(vocab: VocabData): Promise<string[]> {
  const prompt = `You are a Japanese language expert. Generate 2 natural example sentences using the word "${vocab.front}" (meaning: ${vocab.back}).

Requirements:
- Each sentence should be simple and appropriate for JLPT ${vocab.jlptLevel} level
- Include the reading: ${vocab.reading}
- Sentences should demonstrate real usage
- Return ONLY a JSON array of strings, no other text

Example format: ["sentence 1", "sentence 2"]`

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    })

    const content = response.content[0]
    if (content.type !== 'text') return []

    // Parse JSON from response
    const jsonMatch = content.text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) return []

    const examples = JSON.parse(jsonMatch[0])
    if (!Array.isArray(examples)) return []

    return examples.slice(0, 2)
  } catch (error) {
    console.error(`Failed to generate examples for ${vocab.front}:`, error)
    return []
  }
}

async function run(): Promise<GenerationResult> {
  try {
    // Find vocab files
    const vocabFiles = fs.readdirSync(OUTPUT_DIR).filter(f => f.startsWith('vocab-') && f.endsWith('.json'))

    if (vocabFiles.length === 0) {
      return {
        success: false,
        message: `No vocabulary files found. Run: tsx tools/generate/extract-vocab.ts <path-to-deck.apkg> first`,
        count: 0,
      }
    }

    console.log(`Found ${vocabFiles.length} vocabulary file(s). Processing...`)

    const allEnrichedVocab: VocabWithExamples[] = []

    for (const file of vocabFiles) {
      const filePath = path.join(OUTPUT_DIR, file)
      const vocabData = JSON.parse(fs.readFileSync(filePath, 'utf-8'))

      console.log(`\nEnriching ${file} (${vocabData.length} words)...`)

      for (let i = 0; i < Math.min(vocabData.length, 20); i++) {
        const vocab = vocabData[i]
        const examples = await generateExamplesForVocab(vocab)

        allEnrichedVocab.push({
          ...vocab,
          examples,
        })

        if ((i + 1) % 5 === 0) {
          console.log(`  [${i + 1}/${Math.min(vocabData.length, 20)}] Processed`)
        }
      }
    }

    const outputPath = path.join(OUTPUT_DIR, 'vocab-enriched.json')
    fs.writeFileSync(outputPath, JSON.stringify(allEnrichedVocab, null, 2))

    return {
      success: true,
      message: `Enriched ${allEnrichedVocab.length} vocabulary entries to ${outputPath}`,
      count: allEnrichedVocab.length,
    }
  } catch (error) {
    return {
      success: false,
      message: `Failed to generate examples: ${error instanceof Error ? error.message : String(error)}`,
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
