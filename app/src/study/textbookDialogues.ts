import { getSupplementalScenarios, type SupplementalScenario } from '../content/supplementalScenarioService'

export interface TextbookScenario {
  id: string
  title: string
  titleJa: string
  description: string
  textbook: string
  level: string
  page: number
  participants: string[]
  sampleDialogue: string
  canDo: string
  practicePrompts: string[]
  lines: SupplementalScenario['lines']
}

export async function loadTextbookScenarios(): Promise<TextbookScenario[]> {
  const scenarios = await getSupplementalScenarios()
  return scenarios.map(scenario => ({
    id: scenario.id,
    title: scenario.title,
    titleJa: scenario.titleJa,
    description: scenario.description,
    textbook: scenario.textbook,
    level: scenario.level,
    page: scenario.page,
    participants: scenario.participants,
    sampleDialogue: scenario.sampleDialogue,
    canDo: scenario.canDo,
    practicePrompts: scenario.practicePrompts,
    lines: scenario.lines,
  }))
}

let scenarioCache: TextbookScenario[] | null = null

export async function getTextbookScenarios(): Promise<TextbookScenario[]> {
  if (scenarioCache) return scenarioCache
  scenarioCache = await loadTextbookScenarios()
  return scenarioCache
}
