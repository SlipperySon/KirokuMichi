import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { IntlProvider } from 'react-intl'
import { useAppStore } from './store'
import { useTheme } from './hooks/useTheme'
import { messages } from './i18n'
import { SQLiteStorage } from './db/sqlite'
import { FSRSScheduler, SM2Scheduler } from './core/scheduler'
import { SRSService } from './srs/srsService'
import { refreshStreakSnapshot } from './study/streakService'
import { OnboardingFlow } from './onboarding/OnboardingFlow'
import { StudyDashboard } from './study/StudyDashboard'
import { ReviewSession } from './study/ReviewSession'
import { JLPTSection } from './study/JLPTSection'
import { TutorChat } from './study/TutorChat'
import { MyContent } from './study/MyContent'
import { Settings } from './pages/Settings'
import { ImmersionMode } from './study/ImmersionMode'
import { LearningMode } from './study/LearningMode'
import { ScenarioMode } from './study/ScenarioMode'
import { GrammarReview } from './study/GrammarReview'
import { LessonsHub } from './study/LessonsHub'
import { LessonPage } from './study/LessonPage'
import { MistakeReview } from './study/MistakeReview'
import { OfflineBanner } from './components/OfflineBanner'

function App() {
  useTheme() // Initialize theme on mount

  const onboardingComplete = useAppStore(s => s.onboardingComplete)
  const sessionToken = useAppStore(s => s.settings.sessionToken)
  const setSessionToken = useAppStore(s => s.setSessionToken)
  const activeUserId = useAppStore(s => s.activeUserId)
  const setDailyStats = useAppStore(s => s.setDailyStats)

  // Bootstrap session token on app mount
  useEffect(() => {
    if (!sessionToken) {
      fetch('/api/session', { method: 'POST' })
        .then(r => r.json())
        .then(({ token }) => setSessionToken(token))
        .catch(() => {
          // Silently fail — user can still use app without AI
        })
    }
  }, [sessionToken, setSessionToken])

  // Refresh streak + apply freeze-token policy once per app session
  useEffect(() => {
    if (!activeUserId) return
    let cancelled = false
    void (async () => {
      try {
        const storage = new SQLiteStorage()
        const settings = useAppStore.getState().settings
        const scheduler =
          settings.schedulerAlgorithm === 'fsrs' ? new FSRSScheduler() : new SM2Scheduler()
        const service = new SRSService(storage, scheduler)
        const { snapshot, patch } = await refreshStreakSnapshot(service, activeUserId, {
          streakFreezeTokens: settings.streakFreezeTokens,
          lastStreakAward: settings.lastStreakAward,
          lastFreezeUsedDate: settings.lastFreezeUsedDate,
        })
        if (cancelled) return
        setDailyStats(snapshot)
        if (Object.keys(patch).length > 0) {
          useAppStore.getState().updateSettings(patch)
        }
      } catch {
        // Non-fatal — UI will fall back to default snapshot
      }
    })()
    return () => {
      cancelled = true
    }
  }, [activeUserId, setDailyStats])

  return (
    <IntlProvider locale="en" messages={messages.en}>
      <BrowserRouter>
        <OfflineBanner />
        <Routes>
          <Route
            path="/"
            element={onboardingComplete ? <Navigate to="/study" replace /> : <Navigate to="/onboarding" replace />}
          />
          <Route path="/onboarding" element={<OnboardingFlow />} />
          <Route path="/study" element={<StudyDashboard />} />
          <Route path="/study/review" element={<ReviewSession />} />
          <Route path="/study/mistakes" element={<MistakeReview />} />
          <Route path="/learn/lessons" element={<LessonsHub />} />
          <Route path="/learn/lessons/:cefr/:lessonNumber" element={<LessonPage />} />
          <Route path="/study/jlpt" element={<JLPTSection />} />
          <Route path="/practice" element={<TutorChat />} />
          <Route path="/my-content" element={<MyContent />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/immersion" element={<ImmersionMode />} />
          <Route path="/learn" element={<LearningMode />} />
          <Route path="/scenarios" element={<ScenarioMode />} />
          <Route path="/study/grammar" element={<GrammarReview />} />
        </Routes>
      </BrowserRouter>
    </IntlProvider>
  )
}

export default App
