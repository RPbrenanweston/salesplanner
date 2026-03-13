// @crumb frontend-component-error-boundary
// CORE | error_capture | error_fallback_ui | error_logging | page_reload
// why: Error boundary component wrapping React render tree to catch JS errors, display fallback UI, and prevent white-screen-of-death cascades
// in:children:ReactNode out:Either children or error fallback UI with reload button err:React lifecycle error in child component,getDerivedStateFromError fails
// hazard: Errors caught but only logged to console — no server-side error tracking or alerts, critical errors go unnoticed in production
// hazard: Reload button causes full page reload, losing all unsaved state — users must rework recent changes after error
// hazard: Error message displayed as-is from error.message — internal implementation details or stack traces leak to end users if error not sanitized
// edge:frontend/src/App.tsx -> WRAPS
// prompt: Add Sentry or error tracking service to send caught errors to backend. Store error timestamp and user session ID for debugging. Sanitize error messages before display.
import React from 'react'

interface Props {
  children: React.ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
          <div className="text-center max-w-md px-6">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Something went wrong</h1>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              {this.state.error?.message ?? 'An unexpected error occurred.'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Reload page
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
