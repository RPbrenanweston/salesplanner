// @crumb frontend-component-oauth-error-boundary
// CORE | error_capture | inline_error_fallback
// why: Compact inline ErrorBoundary for OAuth integration buttons — one broken integration doesn't cascade to crash the whole settings page
// in:children:ReactNode out:Either children or compact inline error message
import React from 'react'
import { AlertCircle } from 'lucide-react'

interface Props {
  children: React.ReactNode
  label?: string
}

interface State {
  hasError: boolean
}

export default class OAuthErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('OAuthErrorBoundary caught:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center gap-3 p-4 border border-red-200 dark:border-red-900/30 rounded-lg bg-red-50 dark:bg-red-900/10">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-red-700 dark:text-red-400">
              {this.props.label ?? 'Integration'} failed to load
            </p>
            <button
              onClick={() => this.setState({ hasError: false })}
              className="text-xs text-red-600 dark:text-red-400 underline mt-1"
            >
              Try again
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
