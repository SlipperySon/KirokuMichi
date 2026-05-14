import type { StorageProvider } from '../core/providers'

/**
 * Scenario Unlock Service
 * Maps CEFR levels to their paired practice textbooks
 * When a user completes a lesson in the core textbook,
 * corresponding scenarios from the paired textbook are unlocked
 */

const SCENARIO_UNLOCK_RULES = {
  a1: {
    coreTextbook: 'genki_1_textbook',
    practiceTextbook: 'marugoto_a1_textbook',
    practiceBookName: 'Marugoto A1'
  },
  a2: {
    coreTextbook: 'genki_2_textbook',
    practiceTextbook: 'marugoto_a2_textbook',
    practiceBookName: 'Marugoto A2'
  },
  b1: {
    coreTextbook: 'quartet_1_textbook',
    practiceTextbook: 'marugoto_b1_textbook',
    practiceBookName: 'Marugoto B1'
  },
  b2: {
    coreTextbook: 'quartet_2_textbook',
    practiceTextbook: 'tobira_textbook',
    practiceBookName: 'Tobira'
  }
}

type CEFRLevel = 'a1' | 'a2' | 'b1' | 'b2'

/**
 * Unlock scenarios when a lesson is completed
 *
 * Example: User completes genki_1_1 (Genki I, Lesson 1)
 * → Unlock marugoto_a1_1 (Marugoto A1, Lesson 1 scenarios)
 */
export async function unlockScenariosForLesson(
  lessonId: string,
  userId: number,
  storage: StorageProvider
): Promise<{ unlockedCount: number; practiceBookName?: string }> {
  // Extract CEFR level from lesson ID
  // lessonId format: "genki_1_1", "quartet_2_5", etc.
  const parts = lessonId.split('_')
  if (parts.length < 2) return { unlockedCount: 0 }

  // Determine CEFR level from core textbook
  let cefrLevel: CEFRLevel | null = null
  const textbookId = parts.slice(0, -1).join('_') // e.g., "genki_1"

  if (textbookId === 'genki_1') cefrLevel = 'a1'
  else if (textbookId === 'genki_2') cefrLevel = 'a2'
  else if (textbookId === 'quartet_1') cefrLevel = 'b1'
  else if (textbookId === 'quartet_2') cefrLevel = 'b2'

  if (!cefrLevel) return { unlockedCount: 0 }

  const rule = SCENARIO_UNLOCK_RULES[cefrLevel]
  const lessonNumber = parts[parts.length - 1] // e.g., "1"

  // Construct the corresponding practice lesson ID
  // e.g., "marugoto_a1_1"
  const practicePrefix = rule.practiceTextbook.split('_').slice(0, -1).join('_')
  const practiceCallToUnlock = `${practicePrefix}_${lessonNumber}`

  try {
    // Mark all scenarios with matching practice lesson ID as unlocked
    // by setting their lesson_id to the practice lesson ID
    const result = await storage.query<{ id: number }>(
      `SELECT id FROM scenarios
       WHERE (title LIKE ? OR description LIKE ?)
         AND (user_id = ? OR user_id IS NULL)
         AND lesson_id IS NULL`,
      [`%${practicePrefix}%`, `%${rule.practiceBookName}%`, userId]
    )

    // For now, we'll mark scenarios as unlocked by setting lesson_id
    // In a real implementation, you might want to create explicit unlock records
    for (const scenario of result) {
      await storage.execute(
        `UPDATE scenarios SET lesson_id = ? WHERE id = ?`,
        [practiceCallToUnlock, scenario.id]
      )
    }

    return {
      unlockedCount: result.length,
      practiceBookName: rule.practiceBookName
    }
  } catch (error) {
    console.error('Error unlocking scenarios:', error)
    return { unlockedCount: 0 }
  }
}

/**
 * Get available scenarios for a specific CEFR level
 * Shows unlocked scenarios grouped by lesson
 */
export async function getScenariosForLevel(
  cefrLevel: CEFRLevel,
  userId: number,
  storage: StorageProvider
): Promise<{ lesson: string; scenarios: Array<{ id: number; title: string; description?: string }> }[]> {
  const rule = SCENARIO_UNLOCK_RULES[cefrLevel]
  const practicePrefix = rule.practiceTextbook.split('_').slice(0, -1).join('_')

  const scenarios = await storage.query<{
    id: number
    title: string
    description: string | null
    lesson_id: string | null
  }>(
    `SELECT id, title, description, lesson_id FROM scenarios
     WHERE (title LIKE ? OR description LIKE ?)
       AND (user_id = ? OR user_id IS NULL)
     ORDER BY lesson_id ASC, id ASC`,
    [`%${practicePrefix}%`, `%${rule.practiceBookName}%`, userId]
  )

  // Group by lesson_id
  const grouped: { lesson: string; scenarios: Array<{ id: number; title: string; description?: string }> }[] = []
  const seen = new Set<string>()

  for (const scenario of scenarios) {
    const lesson = scenario.lesson_id || 'locked'
    if (!seen.has(lesson)) {
      seen.add(lesson)
      grouped.push({ lesson, scenarios: [] })
    }
    const group = grouped.find(g => g.lesson === lesson)
    if (group) {
      group.scenarios.push({
        id: scenario.id,
        title: scenario.title,
        description: scenario.description ?? undefined
      })
    }
  }

  return grouped
}
