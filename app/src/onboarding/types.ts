export type OnboardingStep =
  | 'welcome'
  | 'ai'
  | 'prefs'
  | 'hiragana'
  | 'katakana'
  | 'learning'
  | 'placement'
  | 'goal'
  | 'ime'
  | 'done'

export type JlptLevel = 'N5' | 'N4' | 'N3' | 'N2' | 'N1'
export type CEFRLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'

export interface OnboardingState {
  step: OnboardingStep
  hiraganaResult: 'pass' | 'skip' | null
  katakanaResult: 'pass' | 'skip' | null
  placementLevel: JlptLevel | null
  cefrLevel: CEFRLevel | null
  goalLevel: JlptLevel | null
  goalDate: string | null
}
