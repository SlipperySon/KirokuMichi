/**
 * CEFR Level to Textbook Mapping
 * Maps proficiency levels to their base textbooks and supplemental materials
 */

export type CEFRLevel = 'a1' | 'a2' | 'b1' | 'b2' | 'c1'

/**
 * Base textbooks for each CEFR level
 * These are the primary textbooks users follow for each level
 */
export const CEFR_BASE_TEXTBOOK: Record<CEFRLevel, string> = {
  a1: 'genki_1_textbook',      // Genki 1
  a2: 'genki_2_textbook',      // Genki 2
  b1: 'quartet_1_textbook',    // Quartet 1
  b2: 'quartet_2_textbook',    // Quartet 2
  c1: 'tobira_textbook'        // Tobira
}

/**
 * Supplemental materials available for each CEFR level
 * Users can optionally study workbooks, alternative textbooks, etc.
 */
export const CEFR_SUPPLEMENTAL: Record<CEFRLevel, string[]> = {
  a1: ['genki_1_workbook'],
  a2: ['genki_2_workbook'],
  b1: ['quartet_1_workbook'],
  b2: ['quartet_2_workbook'],
  c1: []
}

/**
 * Lesson counts for each base textbook
 */
export const TEXTBOOK_LESSON_COUNTS: Record<string, number> = {
  'genki_1_textbook': 12,
  'genki_2_textbook': 12,
  'genki_1_workbook': 12,
  'genki_2_workbook': 12,
  'marugoto_a1_textbook': 8,
  'marugoto_a2_textbook': 8,
  'marugoto_b1_textbook': 8,
  'marugoto_b1_workbook': 8,
  'quartet_1_textbook': 12,
  'quartet_1_workbook': 12,
  'quartet_2_textbook': 12,
  'quartet_2_workbook': 12,
  'tobira_textbook': 14
}

/**
 * Get the total lesson count for a textbook
 */
export function getTotalLessons(textbookName: string): number {
  return TEXTBOOK_LESSON_COUNTS[textbookName] ?? 0
}

/**
 * Get the CEFR level for a given textbook
 */
export function getCEFRForTextbook(textbookName: string): CEFRLevel | null {
  for (const [cefr, base] of Object.entries(CEFR_BASE_TEXTBOOK)) {
    if (base === textbookName) {
      return cefr as CEFRLevel
    }
    if (CEFR_SUPPLEMENTAL[cefr as CEFRLevel].includes(textbookName)) {
      return cefr as CEFRLevel
    }
  }
  return null
}

/**
 * Get the base textbook for a CEFR level
 */
export function getBaseTextbook(cefr: CEFRLevel): string {
  return CEFR_BASE_TEXTBOOK[cefr]
}

/**
 * Get all available textbooks for a CEFR level (base + supplemental)
 */
export function getAllTextbooksForCEFR(cefr: CEFRLevel): string[] {
  const base = CEFR_BASE_TEXTBOOK[cefr]
  const supplemental = CEFR_SUPPLEMENTAL[cefr]
  return [base, ...supplemental]
}
