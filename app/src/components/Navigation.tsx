import { useState, type ComponentType } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useIntl } from 'react-intl'
import {
  BarChart3,
  BookOpen,
  Brain,
  LibraryBig,
  FileText,
  GraduationCap,
  Home,
  Layers,
  Library,
  LifeBuoy,
  Menu,
  MessageCircle,
  PenSquare,
  Settings,
  Sparkles,
  Upload,
  X,
} from 'lucide-react'
import { useAppStore } from '../store'
import { ReportIssueModal } from './ReportIssueModal'

interface NavLinkItem {
  path: string
  label: string
  description: string
  icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
  /** Exact pathname match only (avoids Today lighting up for all /study/*). */
  exact?: boolean
}

interface NavGroup {
  title: string
  items: NavLinkItem[]
}

export function Navigation() {
  const location = useLocation()
  const intl = useIntl()
  const dailyStats = useAppStore(s => s.dailyStats)
  const dailyGoal = useAppStore(s => s.settings.dailyGoal)
  const freezeTokens = useAppStore(s => s.settings.streakFreezeTokens)
  const [menuOpen, setMenuOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)

  const navGroups: NavGroup[] = [
    {
      title: 'Today',
      items: [
        { path: '/study', label: 'Today', description: 'Next action, streak, and daily goal', icon: Home, exact: true },
      ],
    },
    {
      title: 'Course',
      items: [
        { path: '/learn', label: 'Course', description: 'Textbook curriculum and active lesson', icon: GraduationCap },
        { path: '/study/path', label: 'Learning Path', description: 'CEFR-guided weekly plan', icon: BookOpen },
      ],
    },
    {
      title: 'Review',
      items: [
        { path: '/study/srs', label: 'Review', description: 'Anki-style SRS — words and grammar', icon: Brain },
        { path: '/study/browser', label: 'Card Browser', description: 'Search, edit, move, suspend', icon: LibraryBig },
        { path: '/study/create', label: 'Create Card', description: 'Add your own card or audio', icon: PenSquare },
        { path: '/study/templates', label: 'Templates', description: 'Deck card layouts and fields', icon: Layers },
        { path: '/study/mistakes', label: 'Mistakes', description: 'Drill recent misses', icon: FileText },
        { path: '/study/stats', label: 'Stats', description: 'Retention and review history', icon: BarChart3 },
      ],
    },
    {
      title: 'Speak',
      items: [
        { path: '/scenarios', label: 'Scenarios', description: 'Roleplay and practical dialogue', icon: MessageCircle },
      ],
    },
    {
      title: 'Library',
      items: [
        { path: '/my-content', label: 'My Content', description: 'Import PDFs, decks, and packs', icon: Upload },
        { path: '/immersion', label: 'Immersion', description: 'Turn native text into study material', icon: Library },
        { path: '/practice', label: 'AI Tutor', description: 'Ask questions or practise output', icon: Sparkles },
        { path: '/settings', label: 'Settings', description: 'App, AI, audio, and shortcuts', icon: Settings },
      ],
    },
  ]

  const isActive = (item: NavLinkItem) => {
    if (item.exact) return location.pathname === item.path
    if (item.path === '/learn') {
      return location.pathname === '/learn' || location.pathname.startsWith('/learn/')
    }
    if (item.path === '/study/srs') {
      return location.pathname === '/study/srs' || location.pathname === '/study/grammar'
    }
    return location.pathname === item.path || location.pathname.startsWith(item.path + '/')
  }

  const goalPct =
    dailyGoal > 0 ? Math.min(100, Math.round((dailyStats.todayReviewed / dailyGoal) * 100)) : 0
  const goalDone = dailyGoal > 0 && dailyStats.todayReviewed >= dailyGoal

  return (
    <nav className="sticky top-0 z-40 border-b border-gray-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-3 py-3 sm:px-4">
        <Link
          to="/study"
          onClick={() => setMenuOpen(false)}
          className="flex min-w-0 items-center gap-2 text-lg font-bold text-indigo-700 sm:text-xl"
        >
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-indigo-600 text-sm font-black text-white">
            記
          </span>
          <span className="truncate">{intl.formatMessage({ id: 'app.title' })}</span>
        </Link>

        <div className="flex items-center gap-2">
          <Link
            to="/study"
            onClick={() => setMenuOpen(false)}
            className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-sm font-semibold text-gray-800 transition-colors hover:bg-gray-100"
            aria-label={`${dailyStats.currentStreak} day streak, ${dailyStats.todayReviewed} of ${dailyGoal} cards today`}
            title={`Streak: ${dailyStats.currentStreak} days${freezeTokens > 0 ? ` · ${freezeTokens} freeze${freezeTokens === 1 ? '' : 's'}` : ''}\nToday: ${dailyStats.todayReviewed} / ${dailyGoal}`}
          >
            <span className="text-orange-700">{dailyStats.currentStreak}d</span>
            <span className={goalDone ? 'text-emerald-700' : 'text-gray-600'}>
              {goalDone ? 'goal' : `${goalPct}%`}
            </span>
          </Link>

          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-800 shadow-sm transition-colors hover:bg-gray-50"
            onClick={() => setMenuOpen(v => !v)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X className="h-4 w-4" aria-hidden /> : <Menu className="h-4 w-4" aria-hidden />}
            <span className="hidden sm:inline">Menu</span>
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="border-t border-gray-200 bg-white shadow-lg">
          <div className="mx-auto grid max-w-6xl gap-4 px-3 py-4 sm:px-4 md:grid-cols-3 lg:grid-cols-5">
            {navGroups.map(group => (
              <div key={group.title}>
                <h2 className="px-2 text-xs font-bold uppercase tracking-wide text-gray-500">{group.title}</h2>
                <div className="mt-2 grid gap-1">
                  {group.items.map(item => {
                    const Icon = item.icon
                    const active = isActive(item)
                    return (
                      <Link
                        key={`${group.title}-${item.path}-${item.label}`}
                        to={item.path}
                        onClick={() => setMenuOpen(false)}
                        className={`flex gap-3 rounded-lg px-2 py-2.5 transition-colors ${
                          active
                            ? 'bg-indigo-50 text-indigo-900'
                            : 'text-gray-800 hover:bg-gray-50'
                        }`}
                      >
                        <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${active ? 'text-indigo-700' : 'text-gray-500'}`} aria-hidden />
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold">{item.label}</span>
                          <span className="block text-xs leading-5 text-gray-500">{item.description}</span>
                        </span>
                      </Link>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
          <div className="mx-auto flex max-w-6xl justify-end border-t border-gray-100 px-3 pb-4 sm:px-4">
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false)
                setReportOpen(true)
              }}
              className="inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900 transition-colors hover:bg-amber-100"
            >
              <LifeBuoy className="h-4 w-4" aria-hidden />
              Report issue
            </button>
          </div>
        </div>
      )}
      <ReportIssueModal open={reportOpen} onClose={() => setReportOpen(false)} />
    </nav>
  )
}
