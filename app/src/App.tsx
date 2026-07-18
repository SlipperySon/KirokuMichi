import { lazy, Suspense, useEffect, useState, type ReactElement } from 'react'
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
import { toast } from './components/toastStore'
import { KeyboardHelpModal } from './components/KeyboardHelpModal'
import { getBetaAccess } from './betaAccess'

const OnboardingFlow = lazy(() => import('./onboarding/OnboardingFlow').then(module => ({ default: module.OnboardingFlow })))
const StudyDashboard = lazy(() => import('./study/StudyDashboard').then(module => ({ default: module.StudyDashboard })))
const ReviewSession = lazy(() => import('./study/ReviewSession').then(module => ({ default: module.ReviewSession })))
const JLPTSection = lazy(() => import('./study/JLPTSection').then(module => ({ default: module.JLPTSection })))
const TutorChat = lazy(() => import('./study/TutorChat').then(module => ({ default: module.TutorChat })))
const MyContent = lazy(() => import('./study/MyContent').then(module => ({ default: module.MyContent })))
const Settings = lazy(() => import('./pages/Settings').then(module => ({ default: module.Settings })))
const BetaLogin = lazy(() => import('./pages/BetaLogin').then(module => ({ default: module.BetaLogin })))
const ImmersionMode = lazy(() => import('./study/ImmersionMode').then(module => ({ default: module.ImmersionMode })))
const LearningMode = lazy(() => import('./study/LearningMode').then(module => ({ default: module.LearningMode })))
const ScenarioMode = lazy(() => import('./study/ScenarioMode').then(module => ({ default: module.ScenarioMode })))
const GrammarReview = lazy(() => import('./study/GrammarReview').then(module => ({ default: module.GrammarReview })))
const LessonPage = lazy(() => import('./study/LessonPage').then(module => ({ default: module.LessonPage })))
const LessonStudy = lazy(() => import('./study/LessonStudy').then(module => ({ default: module.LessonStudy })))
const MistakeReview = lazy(() => import('./study/MistakeReview').then(module => ({ default: module.MistakeReview })))
const TextbookQADashboard = lazy(() => import('./study/TextbookQADashboard').then(module => ({ default: module.TextbookQADashboard })))
const StudyStats = lazy(() => import('./study/StudyStats').then(module => ({ default: module.StudyStats })))
const CardBrowser = lazy(() => import('./study/CardBrowser').then(module => ({ default: module.CardBrowser })))
const CardCreate = lazy(() => import('./study/CardCreate').then(module => ({ default: module.CardCreate })))
const TemplateEditor = lazy(() => import('./study/TemplateEditor').then(module => ({ default: module.TemplateEditor })))
const LearningPath = lazy(() => import('./study/LearningPath').then(module => ({ default: module.LearningPath })))
const ReviewHub = lazy(() => import('./study/ReviewHub').then(module => ({ default: module.ReviewHub })))

function protectedElement(betaGateEnabled: boolean | null, element: ReactElement) {
  if (betaGateEnabled && getBetaAccess() !== 'granted') {
    return <Navigate to="/beta-login" replace />
  }
  return element
}

function App() {
  useTheme() // Initialize theme on mount

  const onboardingComplete = useAppStore(s => s.onboardingComplete)
  const sessionToken = useAppStore(s => s.settings.sessionToken)
  const setSessionToken = useAppStore(s => s.setSessionToken)
  const activeUserId = useAppStore(s => s.activeUserId)
  const setDailyStats = useAppStore(s => s.setDailyStats)
  const [betaGateEnabled, setBetaGateEnabled] = useState<boolean | null>(null)

  // Bootstrap session token on app mount (requires beta grant cookie when beta is enabled)
  useEffect(() => {
    if (sessionToken) return
    if (betaGateEnabled === null) return
    if (betaGateEnabled && getBetaAccess() !== 'granted') return

    fetch('/api/session', { method: 'POST', credentials: 'include' })
      .then(async response => {
        if (!response.ok) return
        const data = await response.json() as { token: string }
        setSessionToken(data.token)
      })
      .catch(() => {
        // Silently fail — user can still use app without AI
      })
  }, [sessionToken, setSessionToken, betaGateEnabled])

  useEffect(() => {
    let cancelled = false
    void fetch('/api/beta/status', { credentials: 'include' })
      .then(response => response.json() as Promise<{ enabled: boolean }>)
      .then(data => {
        if (!cancelled) setBetaGateEnabled(data.enabled)
      })
      .catch(() => {
        if (!cancelled) setBetaGateEnabled(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const handler = () => {
      toast.error('Study data could not be saved. Export or back up your data before continuing.', 8000)
    }
    window.addEventListener('kiroku:persistence-error', handler)
    return () => window.removeEventListener('kiroku:persistence-error', handler)
  }, [])

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
              <Route path="/beta-login" element={<BetaLogin />} />
              <Route
                path="/"
                element={
                  betaGateEnabled && getBetaAccess() !== 'granted'
                    ? <Navigate to="/beta-login" replace />
                    : onboardingComplete ? <Navigate to="/study" replace /> : <Navigate to="/onboarding" replace />
                }
              />
              <Route path="/onboarding" element={protectedElement(betaGateEnabled, <OnboardingFlow />)} />
              <Route path="/study" element={protectedElement(betaGateEnabled, <StudyDashboard />)} />
              <Route path="/study/srs" element={protectedElement(betaGateEnabled, <ReviewHub />)} />
              <Route path="/study/review" element={protectedElement(betaGateEnabled, <ReviewSession />)} />
              <Route path="/study/mistakes" element={protectedElement(betaGateEnabled, <MistakeReview />)} />
              <Route path="/learn/lessons" element={<Navigate to="/learn" replace />} />
              <Route path="/learn/lessons/:cefr/:lessonNumber" element={protectedElement(betaGateEnabled, <LessonPage />)} />
              <Route path="/learn/study" element={protectedElement(betaGateEnabled, <LessonStudy />)} />
              <Route path="/study/jlpt" element={protectedElement(betaGateEnabled, <JLPTSection />)} />
              <Route path="/practice" element={protectedElement(betaGateEnabled, <TutorChat />)} />
              <Route path="/my-content" element={protectedElement(betaGateEnabled, <MyContent />)} />
              <Route path="/settings" element={protectedElement(betaGateEnabled, <Settings />)} />
              <Route path="/immersion" element={protectedElement(betaGateEnabled, <ImmersionMode />)} />
              <Route path="/learn" element={protectedElement(betaGateEnabled, <LearningMode />)} />
              <Route path="/scenarios" element={protectedElement(betaGateEnabled, <ScenarioMode />)} />
              <Route path="/study/grammar" element={protectedElement(betaGateEnabled, <GrammarReview />)} />
              <Route path="/dev/textbook-qa" element={protectedElement(betaGateEnabled, <TextbookQADashboard />)} />
              <Route path="/study/stats" element={protectedElement(betaGateEnabled, <StudyStats />)} />
              <Route path="/study/browser" element={protectedElement(betaGateEnabled, <CardBrowser />)} />
              <Route path="/study/create" element={protectedElement(betaGateEnabled, <CardCreate />)} />
              <Route path="/study/templates" element={protectedElement(betaGateEnabled, <TemplateEditor />)} />
              <Route path="/study/path" element={protectedElement(betaGateEnabled, <LearningPath />)} />
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
