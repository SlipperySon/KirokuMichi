import { Link, useLocation } from 'react-router-dom'
import { useIntl } from 'react-intl'

export function Navigation() {
  const location = useLocation()
  const intl = useIntl()

  const navItems = [
    { path: '/study', label: intl.formatMessage({ id: 'nav.study' }) },
    { path: '/learn', label: intl.formatMessage({ id: 'nav.learn' }) },
    { path: '/scenarios', label: intl.formatMessage({ id: 'nav.scenarios' }) },
    { path: '/practice', label: intl.formatMessage({ id: 'nav.practice' }) },
    { path: '/immersion', label: intl.formatMessage({ id: 'nav.immersion' }) },
    { path: '/settings', label: intl.formatMessage({ id: 'nav.settings' }) },
  ]

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/')

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link to="/study" className="text-xl font-bold text-indigo-600">
          {intl.formatMessage({ id: 'app.title' })}
        </Link>

        <div className="flex items-center gap-1">
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
