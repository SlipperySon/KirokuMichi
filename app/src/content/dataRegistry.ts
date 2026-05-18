// Centralized registry of data file locations for easy swapping
// Updated to use /data/ endpoints served by Express server (via Vite proxy in dev)
// To replace data: update file paths below and replace files in app/data/generated/

export const VOCAB_FILES: Record<string, string> = {
  N5: '/data/generated/jlpt/vocab-N5.json',
  N4: '/data/generated/jlpt/vocab-N4.json',
  N3: '/data/generated/jlpt/vocab-N3.json',
  N2: '/data/generated/jlpt/vocab-N2.json',
  N1: '/data/generated/jlpt/vocab-N1.json',
}

export const GRAMMAR_FILES: Record<string, string> = {
  N5: '/data/generated/jlpt/grammar-n5.json',
  N4: '/data/generated/jlpt/grammar-n4.json',
  N3: '/data/generated/jlpt/grammar-n3.json',
  N2: '/data/generated/jlpt/grammar-n2.json',
  N1: '/data/generated/jlpt/grammar-n1.json',
}

export const QUIZ_FILES: string[] = [
  '/data/generated/jlpt/quiz-part1.json',
  '/data/generated/jlpt/quiz-part2.json',
  '/data/generated/jlpt/quiz-part3.json',
  '/data/generated/jlpt/quiz-part4.json',
  '/data/generated/jlpt/quiz-part5.json',
  '/data/generated/jlpt/quiz-part6.json',
  '/data/generated/jlpt/quiz-part7.json',
  '/data/generated/jlpt/quiz-part8.json',
  '/data/generated/jlpt/quiz-part9.json',
  '/data/generated/jlpt/quiz-part10.json',
]

// Textbook curriculum data
export const TEXTBOOK_FILES: Record<string, string> = {
  'comprehensive-curriculum': '/data/generated/textbooks/comprehensive-curriculum.json',
  'genki_1_textbook': '/data/generated/textbooks/genki_1_textbook-comprehensive.json',
  'genki_1_workbook': '/data/generated/textbooks/genki_1_workbook-comprehensive.json',
  'genki_2_textbook': '/data/generated/textbooks/genki_2_textbook-comprehensive.json',
  'genki_2_workbook': '/data/generated/textbooks/genki_2_workbook-comprehensive.json',
  'genki_combined_answer_key': '/data/generated/textbooks/genki_combined_answer_key-comprehensive.json',
  'marugoto_a1_textbook': '/data/generated/textbooks/marugoto_a1_textbook-comprehensive.json',
  'marugoto_a2_textbook': '/data/generated/textbooks/marugoto_a2_textbook-comprehensive.json',
  'marugoto_b1_textbook': '/data/generated/textbooks/marugoto_b1_textbook-comprehensive.json',
  'quartet_1_textbook': '/data/generated/textbooks/quartet_1_textbook-comprehensive.json',
  'quartet_1_workbook': '/data/generated/textbooks/quartet_1_workbook-comprehensive.json',
  'quartet_1_workbook_answer_key': '/data/generated/textbooks/quartet_1_workbook_answer_key-comprehensive.json',
  'quartet_2_textbook': '/data/generated/textbooks/quartet_2_textbook-comprehensive.json',
  'quartet_2_workbook': '/data/generated/textbooks/quartet_2_workbook-comprehensive.json',
  'tobira_textbook': '/data/generated/textbooks/tobira_textbook-comprehensive.json',
}

export const EXTRACTION_SUMMARY = '/data/generated/textbooks/EXTRACTION_SUMMARY.json'

// Curated scenario packs (hand-crafted conversation scenarios organized by textbook)
export const SCENARIO_FILES: Record<string, string> = {
  'genki_1': '/data/generated/scenarios/genki_1_scenarios.json',
  'genki_1_workbook': '/data/generated/scenarios/genki_1_workbook_scenarios.json',
  'genki_2': '/data/generated/scenarios/genki_2_scenarios.json',
  'genki_2_workbook': '/data/generated/scenarios/genki_2_workbook_scenarios.json',
  'marugoto_a1': '/data/generated/scenarios/marugoto_a1_scenarios.json',
  'marugoto_a2': '/data/generated/scenarios/marugoto_a2_scenarios.json',
  'marugoto_b1': '/data/generated/scenarios/marugoto_b1_scenarios.json',
  'quartet_1': '/data/generated/scenarios/quartet_1_scenarios.json',
  'quartet_1_workbook': '/data/generated/scenarios/quartet_1_workbook_scenarios.json',
  'quartet_2': '/data/generated/scenarios/quartet_2_scenarios.json',
  'quartet_2_workbook': '/data/generated/scenarios/quartet_2_workbook_scenarios.json',
}
