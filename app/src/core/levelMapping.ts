export type JLPTLevel = 'N5' | 'N4' | 'N3' | 'N2' | 'N1'
export type CEFRLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'

const jlptToCefr: Record<JLPTLevel, CEFRLevel> = {
  N5: 'A1',
  N4: 'A2',
  N3: 'B1',
  N2: 'B2',
  N1: 'C1',
}

const cefrToJlpt: Record<CEFRLevel, JLPTLevel> = {
  A1: 'N5',
  A2: 'N4',
  B1: 'N3',
  B2: 'N2',
  C1: 'N1',
  C2: 'N1', // No N2+ distinction for C2, map to N1
}

export function jlptLevelToCefr(level: JLPTLevel): CEFRLevel {
  return jlptToCefr[level]
}

export function cefrLevelToJlpt(level: CEFRLevel): JLPTLevel {
  return cefrToJlpt[level]
}

export const JLPT_LEVELS: JLPTLevel[] = ['N5', 'N4', 'N3', 'N2', 'N1']
export const CEFR_LEVELS: CEFRLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
