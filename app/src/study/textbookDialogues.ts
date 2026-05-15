/**
 * Textbook Dialogue Scenarios
 *
 * Loads real dialogue scenarios extracted from supplementary conversation-focused textbooks:
 * - Quartet 1 (B1/N3 level) — intermediate conversation practice
 * - Quartet 2 (B2/N2 level) — upper-intermediate conversation
 * - Marugoto A1/B1 — foundation + intermediate dialogues
 * - Tobira (B2/N2) — advanced discussion-based dialogues
 */

export interface TextbookScenario {
  id: string
  title: string
  titleJa: string
  description: string
  textbook: string
  level: string // A1, A2, B1, B2, etc.
  page: number
  participants: string[]
  sampleDialogue: string // First 100 chars of the dialogue for context
}

/**
 * Dynamic loader for textbook dialogues.
 * Fetches from the comprehensive JSON files generated during OCR.
 */
export async function loadTextbookScenarios(): Promise<TextbookScenario[]> {
  const scenarios: TextbookScenario[] = []

  try {
    // Load Quartet 1 (B1)
    const quartet1Data = await fetch('/data/generated/textbooks/quartet_1_textbook-comprehensive.json')
      .then(r => r.json())
      .catch(() => null)

    if (quartet1Data?.dialogues) {
      quartet1Data.dialogues.slice(0, 8).forEach((d: any, idx: number) => {
        if (d.lines?.length > 2) {
          const sampleLine = d.lines[0]?.japanese || ''
          scenarios.push({
            id: `quartet1_${idx}`,
            title: `Quartet 1 - Dialogue ${idx + 1}`,
            titleJa: `カルット 1 - 会話 ${idx + 1}`,
            description: 'Intermediate conversation from Quartet 1 textbook',
            textbook: 'Quartet 1',
            level: 'B1',
            page: d.page || 0,
            participants: d.participants?.slice(0, 2) || ['A', 'B'],
            sampleDialogue: sampleLine.substring(0, 100),
          })
        }
      })
    }

    // Load Quartet 2 (B2)
    const quartet2Data = await fetch('/data/generated/textbooks/quartet_2_textbook-comprehensive.json')
      .then(r => r.json())
      .catch(() => null)

    if (quartet2Data?.dialogues) {
      quartet2Data.dialogues.slice(0, 8).forEach((d: any, idx: number) => {
        if (d.lines?.length > 2) {
          const sampleLine = d.lines[0]?.japanese || ''
          scenarios.push({
            id: `quartet2_${idx}`,
            title: `Quartet 2 - Dialogue ${idx + 1}`,
            titleJa: `カルット 2 - 会話 ${idx + 1}`,
            description: 'Upper-intermediate conversation from Quartet 2 textbook',
            textbook: 'Quartet 2',
            level: 'B2',
            page: d.page || 0,
            participants: d.participants?.slice(0, 2) || ['A', 'B'],
            sampleDialogue: sampleLine.substring(0, 100),
          })
        }
      })
    }

    // Load Marugoto A1
    const maruA1Data = await fetch('/data/generated/textbooks/marugoto_a1_textbook-comprehensive.json')
      .then(r => r.json())
      .catch(() => null)

    if (maruA1Data?.dialogues) {
      maruA1Data.dialogues.slice(0, 6).forEach((d: any, idx: number) => {
        if (d.lines?.length > 2) {
          const sampleLine = d.lines[0]?.japanese || ''
          scenarios.push({
            id: `marugoto_a1_${idx}`,
            title: `Marugoto A1 - Dialogue ${idx + 1}`,
            titleJa: `まるごと A1 - 会話 ${idx + 1}`,
            description: 'Basic conversation from Marugoto A1 textbook',
            textbook: 'Marugoto A1',
            level: 'A1',
            page: d.page || 0,
            participants: d.participants?.slice(0, 2) || ['A', 'B'],
            sampleDialogue: sampleLine.substring(0, 100),
          })
        }
      })
    }

    // Load Marugoto B1
    const maruB1Data = await fetch('/data/generated/textbooks/marugoto_b1_textbook-comprehensive.json')
      .then(r => r.json())
      .catch(() => null)

    if (maruB1Data?.dialogues) {
      maruB1Data.dialogues.slice(0, 8).forEach((d: any, idx: number) => {
        if (d.lines?.length > 2) {
          const sampleLine = d.lines[0]?.japanese || ''
          scenarios.push({
            id: `marugoto_b1_${idx}`,
            title: `Marugoto B1 - Dialogue ${idx + 1}`,
            titleJa: `まるごと B1 - 会話 ${idx + 1}`,
            description: 'Intermediate conversation from Marugoto B1 textbook',
            textbook: 'Marugoto B1',
            level: 'B1',
            page: d.page || 0,
            participants: d.participants?.slice(0, 2) || ['A', 'B'],
            sampleDialogue: sampleLine.substring(0, 100),
          })
        }
      })
    }

    // Load Tobira (B2)
    const tobirahData = await fetch('/data/generated/textbooks/tobira_textbook-comprehensive.json')
      .then(r => r.json())
      .catch(() => null)

    if (tobirahData?.dialogues) {
      tobirahData.dialogues.slice(0, 8).forEach((d: any, idx: number) => {
        if (d.lines?.length > 2) {
          const sampleLine = d.lines[0]?.japanese || ''
          scenarios.push({
            id: `tobira_${idx}`,
            title: `Tobira - Dialogue ${idx + 1}`,
            titleJa: `扉 - 会話 ${idx + 1}`,
            description: 'Advanced conversation from Tobira textbook',
            textbook: 'Tobira',
            level: 'B2',
            page: d.page || 0,
            participants: d.participants?.slice(0, 2) || ['A', 'B'],
            sampleDialogue: sampleLine.substring(0, 100),
          })
        }
      })
    }
  } catch (err) {
    console.warn('Failed to load textbook scenarios:', err)
  }

  return scenarios
}

/**
 * Caches loaded scenarios to avoid repeated fetches.
 */
let scenarioCache: TextbookScenario[] | null = null

export async function getTextbookScenarios(): Promise<TextbookScenario[]> {
  if (scenarioCache) return scenarioCache
  scenarioCache = await loadTextbookScenarios()
  return scenarioCache
}
