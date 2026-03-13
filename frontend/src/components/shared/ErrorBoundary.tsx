// @crumb frontend-component-error-boundary
// CORE | error_catching | error_logging | fallback_ui | recovery_state
// why: React error boundary wrapper catching unhandled render and lifecycle errors, logging via error-logger service, rendering fallback UI with reset capability
// in:children:ReactNode,context?:string out:Wrapped React tree with error interception, or ErrorBoundaryUI fallback with reset button err:Error boundary doesn't catch async errors,missing logError service,fallback UI undefined context
// hazard: Error boundary catches only render-time errors — async errors in useEffect/fetch/promises bypass boundary and can white-screen-of-death
// hazard: componentDidCatch fires async — user may see error UI briefly before logError completes, incomplete error tracking if network fails
// edge:frontend/src/App.tsx -> RELATES
// edge:frontend/src/components/shared/ErrorBoundaryUI.tsx -> RELATES
// edge:frontend/src/lib/error-logger.ts -> CALLS
// prompt: Wrap async operations in try-catch and manually call logError for boundary-escape errors. Consider Sentry integration for server-side error reporting. Test with unhandled Promise rejections and timeout errors.

import { Component, type ReactNode } from "react"
import { ErrorBoundaryUI } from "./ErrorBoundaryUI"
import { logError } from "@/lib/error-logger"

interface Props {
  children: ReactNode
  context?: string
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error) {
    logError(error, this.props.context ?? "Unknown")
  }

  render() {
    if (this.state.error) {
      return (
        <ErrorBoundaryUI
          error={this.state.error}
          reset={() => this.setState({ error: null })}
          context={this.props.context ?? "Unknown"}
        />
      )
    }
    return this.props.children
  }
}
