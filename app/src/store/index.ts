import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface Settings {
  aiProvider: 'anthropic' | 'openai' | 'openrouter' | 'deepseek' | 'ollama' | 'custom' | null
  apiKey: string | null
  apiEndpoint: string | null
  schedulerAlgorithm: 'fsrs' | 'sm2'
  jlptTarget: 'N5' | 'N4' | 'N3' | 'N2' | 'N1'
  goalDate: string | null
  dailyCardLimit: number
  hoverDelayMs: number
  furiganaEnabled: boolean
  romajiEnabled: boolean
  sessionToken: string | null
  fastModel: string
  powerfulModel: string
  // Immersion mode
  immersionSessionMinutes: number
  immersionBreakMinutes: number
  immersionSessionsPerDay: number
  immersionEnabled: boolean
}

interface AppState {
  settings: Settings
  onboardingComplete: boolean
  activeUserId: number | null
  lessonsCompleted: string[] // e.g., ["genki_1_1", "genki_1_2"]
  currentLesson: string | null // e.g., "genki_1_1"
  updateSettings: (patch: Partial<Settings>) => void
  setOnboardingComplete: (v: boolean) => void
  setSessionToken: (token: string) => void
  setActiveUserId: (id: number) => void
  markLessonComplete: (lessonId: string) => void
  setCurrentLesson: (lessonId: string | null) => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      activeUserId: null,
      lessonsCompleted: [],
      currentLesson: null,
      settings: {
        aiProvider: null,
        apiKey: null,
        apiEndpoint: null,
        schedulerAlgorithm: 'fsrs',
        jlptTarget: 'N5',
        goalDate: null,
        dailyCardLimit: 20,
        hoverDelayMs: 2000,
        furiganaEnabled: true,
        romajiEnabled: false,
        sessionToken: null,
        fastModel: 'claude-haiku-4-5-20251001',
        powerfulModel: 'claude-sonnet-4-6',
        immersionSessionMinutes: 25,
        immersionBreakMinutes: 5,
        immersionSessionsPerDay: 4,
        immersionEnabled: false,
      },
      onboardingComplete: false,
      updateSettings: (patch) =>
        set((s) => ({ settings: { ...s.settings, ...patch } })),
      setOnboardingComplete: (v) => set({ onboardingComplete: v }),
      setSessionToken: (token) =>
        set((s) => ({ settings: { ...s.settings, sessionToken: token } })),
      setActiveUserId: (id) => set({ activeUserId: id }),
      markLessonComplete: (lessonId) =>
        set((s) => ({
          lessonsCompleted: s.lessonsCompleted.includes(lessonId)
            ? s.lessonsCompleted
            : [...s.lessonsCompleted, lessonId],
        })),
      setCurrentLesson: (lessonId) => set({ currentLesson: lessonId }),
    }),
    { name: 'kiroku-michi-app' }
  )
)
