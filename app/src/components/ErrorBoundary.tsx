import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('[ErrorBoundary] Uncaught error:', error, info.componentStack)
  }

  handleReset() {
    this.setState({ hasError: false, error: null })
    window.location.href = '/'
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-8 bg-gray-50 text-center">
          <div className="text-6xl">⚠️</div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Something went wrong</h1>
            <p className="text-gray-500 max-w-sm">
              An unexpected error occurred. Your study data is safe — this is just a display issue.
            </p>
          </div>
          {this.state.error && (
            <details className="text-left max-w-lg w-full">
              <summary className="text-sm text-gray-400 cursor-pointer hover:text-gray-600">
                Error details
              </summary>
              <pre className="mt-2 p-3 bg-gray-100 rounded-lg text-xs text-gray-700 overflow-auto whitespace-pre-wrap break-words">
                {this.state.error.message}
              </pre>
            </details>
          )}
          <button
            onClick={() => this.handleReset()}
            className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors"
          >
            Return to Dashboard
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
