import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { IntlProvider } from 'react-intl'
import { useAppStore } from './store'
import { useTheme } from './hooks/useTheme'
import { messages } from './i18n'
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
import { OfflineBanner } from './components/OfflineBanner'

function App() {
  useTheme() // Initialize theme on mount

  const onboardingComplete = useAppStore(s => s.onboardingComplete)
  const sessionToken = useAppStore(s => s.settings.sessionToken)
  const setSessionToken = useAppStore(s => s.setSessionToken)

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
