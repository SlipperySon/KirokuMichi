import { Link } from 'react-router-dom'

export function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-8 bg-gray-50 text-center">
      <div className="text-7xl">🗺️</div>
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Page not found</h1>
        <p className="text-gray-500 max-w-sm">
          This path doesn't exist. You might have followed an old link or mistyped the URL.
        </p>
      </div>
      <Link
        to="/study"
        className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors"
      >
        Back to Dashboard
      </Link>
    </div>
  )
}
