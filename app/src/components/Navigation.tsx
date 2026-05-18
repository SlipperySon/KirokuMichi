import { Link, useLocation } from 'react-router-dom'
import { useIntl } from 'react-intl'
import { useAppStore } from '../store'

export function Navigation() {
  const location = useLocation()
  const intl = useIntl()
  const dailyStats = useAppStore(s => s.dailyStats)
  const dailyGoal = useAppStore(s => s.settings.dailyGoal)
  const freezeTokens = useAppStore(s => s.settings.streakFreezeTokens)

  const navItems = [
    { path: '/study', label: intl.formatMessage({ id: 'nav.study' }) },
    { path: '/learn', label: intl.formatMessage({ id: 'nav.learn' }) },
    { path: '/scenarios', label: intl.formatMessage({ id: 'nav.scenarios' }) },
    { path: '/practice', label: intl.formatMessage({ id: 'nav.practice' }) },
    { path: '/immersion', label: intl.formatMessage({ id: 'nav.immersion' }) },
    { path: '/dev/textbook-qa', label: 'QA' },
    { path: '/settings', label: intl.formatMessage({ id: 'nav.settings' }) },
  ]

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + '/')

  const goalPct =
    dailyGoal > 0 ? Math.min(100, Math.round((dailyStats.todayReviewed / dailyGoal) * 100)) : 0
  const goalDone = dailyGoal > 0 && dailyStats.todayReviewed >= dailyGoal

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
        <Link to="/study" className="text-xl font-bold text-indigo-600">
          {intl.formatMessage({ id: 'app.title' })}
        </Link>

        <div className="flex items-center gap-1">
          {/* Streak & daily goal indicator */}
          <Link
            to="/study"
            className="hidden sm:flex items-center gap-2 mr-2 px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label={`${dailyStats.currentStreak} day streak, ${dailyStats.todayReviewed} of ${dailyGoal} cards today`}
            title={`Streak: ${dailyStats.currentStreak} days${freezeTokens > 0 ? ` · ${freezeTokens} freeze${freezeTokens === 1 ? '' : 's'}` : ''}\nToday: ${dailyStats.todayReviewed} / ${dailyGoal}`}
          >
            <span className="text-sm font-semibold flex items-center gap-1">
              <span aria-hidden>🔥</span>
              <span className="text-orange-700">{dailyStats.currentStreak}</span>
            </span>
            {freezeTokens > 0 && (
              <span className="text-xs text-blue-600 font-semibold" aria-hidden>
                ❄️{freezeTokens}
              </span>
            )}
            <span
              className={`text-xs font-semibold ${
                goalDone ? 'text-green-700' : 'text-gray-600'
              }`}
            >
              {goalDone ? '✓' : `${goalPct}%`}
            </span>
          </Link>

          {navItems.map(item => (
            <Link
              key={item.path}
              to={item.path}
              className={`px-4 py-2 rounded-lg transition-colors ${
                isActive(item.path)
                  ? 'bg-indigo-100 text-indigo-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  )
}
