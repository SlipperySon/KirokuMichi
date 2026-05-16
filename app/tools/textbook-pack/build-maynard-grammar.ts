#!/usr/bin/env npx tsx
/**
 * Build Maynard Grammar Reference JSON
 *
 * Unlike lesson-based textbooks, Maynard is a grammar reference organized by topic.
 * This script extracts grammar topics from grouped OCR pages and produces a structured
 * JSON that can enrich grammar cards across all CEFR levels.
 *
 * Output: out/comprehensive/maynard_grammar-comprehensive.json
 *
 * Structure:
 *   sections[] → topics[] → { title, text, examples[], pageRange }
 */

import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import type {
  GroupedPage,
  SourceManifestEntry,
  SourceOutlineEntry,
  TextbookSourceManifest,
} from './schema.ts'

const SOURCE_ID = 'maynard_grammar_grammar_reference'
const MANIFEST_PATH = 'app/tools/textbook-pack/out/source-manifest.json'
const GROUPED_ROOT = 'app/tools/textbook-pack/out/grouped'
const OUT_DIR = 'app/tools/textbook-pack/out/comprehensive'

interface MaynardTopic {
  id: string
  title: string
  depth: number
  pageStart: number
  pageEnd: number
  text: string
  examples: Array<{
    japanese: string
    english?: string
    romaji?: string
  }>
  children: string[] // child topic IDs
  parentId: string | null
}

interface MaynardSection {
  id: string
  title: string
  pageStart: number
  pageEnd: number
  topics: MaynardTopic[]
}

interface MaynardGrammarReference {
  textbook: 'maynard_grammar'
  sourceId: string
  generatedAt: string
  pageCount: number
  statistics: {
    sections: number
    topics: number
    totalTextLength: number
    examplesFound: number
  }
  sections: MaynardSection[]
  /** Flat index: topic ID → topic (for quick lookup by grammar pattern) */
  topicIndex: Record<string, MaynardTopic>
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const appRoot = path.resolve(process.cwd())
  const manifestPath = path.join(appRoot, MANIFEST_PATH)
  const manifest: TextbookSourceManifest = JSON.parse(await readFile(manifestPath, 'utf-8'))

  const entry = manifest.entries.find(e => e.id === SOURCE_ID)
  if (!entry) throw new Error(`Source not found: ${SOURCE_ID}`)

  const outline = entry.outline
  console.log(`📖 Maynard Grammar Reference: ${entry.pageCount} pages, ${outline.length} outline entries`)

  // Load all grouped pages
  const groupedDir = path.join(appRoot, GROUPED_ROOT, SOURCE_ID, 'pages')
  const pageFiles = (await readdir(groupedDir)).filter(f => f.endsWith('.json')).sort()
  console.log(`📄 Loading ${pageFiles.length} grouped pages...`)

  const pages: GroupedPage[] = []
  for (const file of pageFiles) {
    const page: GroupedPage = JSON.parse(await readFile(path.join(groupedDir, file), 'utf-8'))
    pages.push(page)
  }
  const pageMap = new Map(pages.map(p => [p.pageNumber, p]))

  // Build sections from depth-1 outline entries
  const majorSections = outline.filter(o => o.depth === 1 && o.pageNumber !== null)

  // Exclude front/back matter (trim \r from OCR artifacts)
  const EXCLUDE = new Set(['Table of Content', 'Acknowledgements', 'Preface', 'Index'])
  const contentSections = majorSections.filter(s =>
    !EXCLUDE.has(s.title.trim())
  )

  console.log(`📑 ${contentSections.length} content sections found`)

  const sections: MaynardSection[] = []
  const topicIndex: Record<string, MaynardTopic> = {}
  let totalExamples = 0

  for (let si = 0; si < contentSections.length; si++) {
    const section = contentSections[si]
    const nextSection = contentSections[si + 1]
    const sectionEnd = nextSection?.pageNumber
      ? nextSection.pageNumber - 1
      : entry.pageCount

    // Find all sub-entries for this section
    const sectionOutline = outline.filter(o =>
      o.pageNumber !== null &&
      o.pageNumber >= section.pageNumber! &&
      o.pageNumber <= sectionEnd &&
      o.depth >= 1
    )

    const sectionId = slugify(section.title.trim())
    const topics: MaynardTopic[] = []

    for (let ti = 0; ti < sectionOutline.length; ti++) {
      const topicEntry = sectionOutline[ti]
      const nextEntry = sectionOutline[ti + 1]
      const topicStart = topicEntry.pageNumber!
      const rawEnd = nextEntry?.pageNumber
        ? nextEntry.pageNumber - 1
        : sectionEnd
      // Clamp: pageEnd must be >= pageStart
      const topicEnd = Math.max(rawEnd, topicStart)

      // Extract text from pages in this topic's range
      const topicText = extractTextFromPages(pageMap, topicStart, topicEnd)
      const examples = extractExamples(topicText)
      totalExamples += examples.length

      // Disambiguate duplicate slugs by appending page number
      const trimmedTitle = topicEntry.title.trim()
      let topicId = `${sectionId}/${slugify(trimmedTitle)}`
      if (topicIndex[topicId]) {
        topicId = `${topicId}_p${topicStart}`
      }
      const parentId = topicEntry.depth > 1
        ? findParentId(sectionOutline, ti, sectionId)
        : null

      const topic: MaynardTopic = {
        id: topicId,
        title: trimmedTitle,
        depth: topicEntry.depth,
        pageStart: topicStart,
        pageEnd: topicEnd,
        text: topicText,
        examples,
        children: [],
        parentId,
      }

      topics.push(topic)
      topicIndex[topicId] = topic
    }

    // Wire up children
    for (const topic of topics) {
      if (topic.parentId && topicIndex[topic.parentId]) {
        topicIndex[topic.parentId].children.push(topic.id)
      }
    }

    sections.push({
      id: sectionId,
      title: section.title.trim(),
      pageStart: section.pageNumber!,
      pageEnd: sectionEnd,
      topics,
    })
  }

  const totalText = Object.values(topicIndex).reduce((sum, t) => sum + t.text.length, 0)
  const totalTopics = Object.keys(topicIndex).length

  const result: MaynardGrammarReference = {
    textbook: 'maynard_grammar',
    sourceId: SOURCE_ID,
    generatedAt: new Date().toISOString(),
    pageCount: entry.pageCount,
    statistics: {
      sections: sections.length,
      topics: totalTopics,
      totalTextLength: totalText,
      examplesFound: totalExamples,
    },
    sections,
    topicIndex,
  }

  const outDir = path.join(appRoot, OUT_DIR)
  await mkdir(outDir, { recursive: true })
  const outPath = path.join(outDir, 'maynard_grammar-comprehensive.json')
  await writeFile(outPath, JSON.stringify(result, null, 2) + '\n', 'utf-8')

  console.log(`\n✅ Maynard Grammar Reference built:`)
  console.log(`   ${sections.length} sections, ${totalTopics} topics`)
  console.log(`   ${totalText.toLocaleString()} chars of text`)
  console.log(`   ${totalExamples} examples extracted`)
  console.log(`   → ${outPath}`)
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function extractTextFromPages(
  pageMap: Map<number, GroupedPage>,
  startPage: number,
  endPage: number,
): string {
  const lines: string[] = []
  for (let p = startPage; p <= endPage; p++) {
    const page = pageMap.get(p)
    if (!page) continue
    for (const block of page.blocks) {
      const text = block.text?.trim()
      if (text) lines.push(text)
    }
  }
  return lines.join('\n')
}

/**
 * Extract Japanese examples from text.
 * Looks for patterns like:
 *   - Lines containing Japanese text followed by English translation
 *   - Numbered examples
 *   - Lines with both kana/kanji and romaji/English
 */
function extractExamples(text: string): Array<{ japanese: string; english?: string; romaji?: string }> {
  const examples: Array<{ japanese: string; english?: string; romaji?: string }> = []
  const lines = text.split('\n')

  // Pattern: Japanese line followed by English translation line
  const hasJapanese = /[　-〿぀-ゟ゠-ヿ一-龯]/
  const isMainlyEnglish = /^[a-zA-Z\s\d.,!?'"()\-:;]+$/

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line || line.length < 3) continue

    // Check if line has Japanese content
    if (hasJapanese.test(line)) {
      const example: { japanese: string; english?: string; romaji?: string } = {
        japanese: line,
      }

      // Check next line for English translation
      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1].trim()
        if (isMainlyEnglish.test(nextLine) && nextLine.length > 3) {
          example.english = nextLine
          i++ // skip the English line
        }
      }

      // Only include if the Japanese part is substantial (not just a page header)
      if (example.japanese.length >= 5) {
        examples.push(example)
      }
    }
  }

  return examples
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9぀-龯]+/g, '_')
    .replace(/^_|_$/g, '')
}

function findParentId(
  outline: SourceOutlineEntry[],
  currentIndex: number,
  sectionId: string,
): string | null {
  const current = outline[currentIndex]
  // Walk backwards to find the nearest entry with lower depth
  for (let i = currentIndex - 1; i >= 0; i--) {
    if (outline[i].depth < current.depth) {
      return `${sectionId}/${slugify(outline[i].title.trim())}`
    }
  }
  return null
}

main().catch(err => {
  console.error('❌ Error:', err)
  process.exit(1)
})
