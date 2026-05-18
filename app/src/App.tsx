import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { IntlProvider } from 'react-intl'
import { useAppStore } from './store'
import { useTheme } from './hooks/useTheme'
import { messages } from './i18n'
import { SQLiteStorage } from './db/sqlite'
import { FSRSScheduler, SM2Scheduler } from './core/scheduler'
import { SRSService } from './srs/srsService'
import { refreshStreakSnapshot } from './study/streakService'
import { OfflineBanner } from './components/OfflineBanner'
import { ErrorBoundary } from './components/ErrorBoundary'
import { NotFound } from './pages/NotFound'
import { ToastContainer } from './components/Toast'
import { KeyboardHelpModal } from './components/KeyboardHelpModal'

const OnboardingFlow = lazy(() => import('./onboarding/OnboardingFlow').then(module => ({ default: module.OnboardingFlow })))
const StudyDashboard = lazy(() => import('./study/StudyDashboard').then(module => ({ default: module.StudyDashboard })))
const ReviewSession = lazy(() => import('./study/ReviewSession').then(module => ({ default: module.ReviewSession })))
const JLPTSection = lazy(() => import('./study/JLPTSection').then(module => ({ default: module.JLPTSection })))
const TutorChat = lazy(() => import('./study/TutorChat').then(module => ({ default: module.TutorChat })))
const MyContent = lazy(() => import('./study/MyContent').then(module => ({ default: module.MyContent })))
const Settings = lazy(() => import('./pages/Settings').then(module => ({ default: module.Settings })))
const ImmersionMode = lazy(() => import('./study/ImmersionMode').then(module => ({ default: module.ImmersionMode })))
const LearningMode = lazy(() => import('./study/LearningMode').then(module => ({ default: module.LearningMode })))
const ScenarioMode = lazy(() => import('./study/ScenarioMode').then(module => ({ default: module.ScenarioMode })))
const GrammarReview = lazy(() => import('./study/GrammarReview').then(module => ({ default: module.GrammarReview })))
const LessonsHub = lazy(() => import('./study/LessonsHub').then(module => ({ default: module.LessonsHub })))
const LessonPage = lazy(() => import('./study/LessonPage').then(module => ({ default: module.LessonPage })))
const LessonStudy = lazy(() => import('./study/LessonStudy').then(module => ({ default: module.LessonStudy })))
const MistakeReview = lazy(() => import('./study/MistakeReview').then(module => ({ default: module.MistakeReview })))
const TextbookQADashboard = lazy(() => import('./study/TextbookQADashboard').then(module => ({ default: module.TextbookQADashboard })))
const StudyStats = lazy(() => import('./study/StudyStats').then(module => ({ default: module.StudyStats })))

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
        <ErrorBoundary>
          <Suspense
            fallback={
              <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4">
                <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                <p className="text-sm text-gray-400">Loading…</p>
              </div>
            }
          >
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
              <Route path="/learn/study" element={<LessonStudy />} />
              <Route path="/study/jlpt" element={<JLPTSection />} />
              <Route path="/practice" element={<TutorChat />} />
              <Route path="/my-content" element={<MyContent />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/immersion" element={<ImmersionMode />} />
              <Route path="/learn" element={<LearningMode />} />
              <Route path="/scenarios" element={<ScenarioMode />} />
              <Route path="/study/grammar" element={<GrammarReview />} />
              <Route path="/dev/textbook-qa" element={<TextbookQADashboard />} />
              <Route path="/study/stats" element={<StudyStats />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
        <ToastContainer />
        <KeyboardHelpModal />
      </BrowserRouter>
    </IntlProvider>
  )
}

export default App
