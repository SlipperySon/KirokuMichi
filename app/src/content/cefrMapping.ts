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
  c1: 'authentic_japanese'     // TBD: Authentic Japanese reading/content (Tobira is supplementary for B2)
}

/**
 * Supplemental materials available for each CEFR level
 * Includes workbooks and "pair" practice textbooks (Marugoto/Tobira)
 * Users can optionally study these alongside the core textbook
 */
export const CEFR_SUPPLEMENTAL: Record<CEFRLevel, string[]> = {
  a1: ['genki_1_workbook', 'marugoto_a1_textbook'],
  a2: ['genki_2_workbook', 'marugoto_a2_textbook'],
  b1: ['quartet_1_workbook', 'marugoto_b1_textbook'],
  b2: ['quartet_2_workbook', 'tobira_textbook'],
  c1: []
}

/**
 * Lesson counts for each base textbook
 */
export const TEXTBOOK_LESSON_COUNTS: Record<string, number> = {
  'genki_1_textbook': 12,
  'genki_2_textbook': 11,
  'genki_1_workbook': 12,
  'genki_2_workbook': 11,
  'marugoto_a1_textbook': 9,
  'marugoto_a2_textbook': 9,
  'marugoto_b1_textbook': 7,
  'marugoto_b1_workbook': 7,
  'quartet_1_textbook': 6,
  'quartet_1_workbook': 6,
  'quartet_2_textbook': 6,
  'quartet_2_workbook': 6,
  'tobira_textbook': 14,
  'authentic_japanese': 0  // TBD: C1 content not yet available
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
