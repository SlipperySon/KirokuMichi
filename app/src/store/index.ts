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
  // Daily goal & streak
  dailyGoal: number
  streakFreezeTokens: number
  /** Highest streak length at which a freeze token was last awarded (so we award each threshold once). */
  lastStreakAward: number
  /** ISO date (YYYY-MM-DD) of the last day a freeze token was consumed (so we only consume once per gap). */
  lastFreezeUsedDate: string | null
  // Text-to-speech
  ttsEnabled: boolean
  ttsRate: number
  azureTtsKey: string | null
  azureTtsRegion: string
}

interface DailyStats {
  currentStreak: number
  longestStreak: number
  todayReviewed: number
}

export interface LearningPathWeek {
  week: number
  focus: string
  dailyGoal: number
  activities: string[]
  milestone: string
}

export interface LearningPath {
  weeks: LearningPathWeek[]
  generatedAt: string // ISO date
}

interface AppState {
  settings: Settings
  onboardingComplete: boolean
  activeUserId: number | null
  lessonsCompleted: string[] // e.g., ["genki_1_1", "genki_1_2"]
  currentLesson: string | null // e.g., "genki_1_1"
  /** Active deck filter — null means all decks */
  activeDeckId: number | null
  /**
   * Cached daily snapshot for nav indicators. Refreshed from the SRS service on
   * mount and after each review session ends. Persisted so the UI shows a value
   * immediately on cold start; refreshed values overwrite quickly.
   */
  dailyStats: DailyStats
  /** Cached AI-generated learning path */
  learningPath: LearningPath | null
  updateSettings: (patch: Partial<Settings>) => void
  setOnboardingComplete: (v: boolean) => void
  setSessionToken: (token: string) => void
  setActiveUserId: (id: number) => void
  markLessonComplete: (lessonId: string) => void
  setCurrentLesson: (lessonId: string | null) => void
  setDailyStats: (stats: DailyStats) => void
  setActiveDeckId: (id: number | null) => void
  setLearningPath: (path: LearningPath | null) => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      activeUserId: null,
      lessonsCompleted: [],
      currentLesson: null,
      activeDeckId: null,
      dailyStats: { currentStreak: 0, longestStreak: 0, todayReviewed: 0 },
      learningPath: null,
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
        dailyGoal: 20,
        streakFreezeTokens: 0,
        lastStreakAward: 0,
        lastFreezeUsedDate: null,
        ttsEnabled: true,
        ttsRate: 0.95,
        azureTtsKey: null,
        azureTtsRegion: 'eastus',
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
      setDailyStats: (stats) => set({ dailyStats: stats }),
      setActiveDeckId: (id) => set({ activeDeckId: id }),
      setLearningPath: (path) => set({ learningPath: path }),
    }),
    { name: 'kiroku-michi-app' }
  )
)
