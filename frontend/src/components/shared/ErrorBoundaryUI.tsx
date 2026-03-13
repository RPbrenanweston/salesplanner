// @crumb frontend-component-error-boundary-ui
// UI | error_fallback_display | context_messaging | error_recovery | reset_action
// why: Fallback UI displayed when ErrorBoundary catches a render error, showing error message, context, and reset button
// in:error:Error,reset:callback,context:string out:Centered error card with AlertCircle icon, error message, context, "Try again" button err:Context string is "Unknown" (missing context from ErrorBoundary),error.message is too technical for users
// hazard: error.message displayed directly to users — may leak internal implementation details or sensitive paths from stack traces
// hazard: Reset button calls setState which may fail silently if error is in state initialization — error UI becomes stuck
// edge:frontend/src/components/shared/ErrorBoundary.tsx -> RELATES
// prompt: Sanitize error.message before display — show "Something went wrong" for user-facing errors, technical details only in logs. Test reset functionality with state initialization errors, consider showing error code/ID for support escalation.

import { AlertCircle } from "lucide-react"

interface ErrorBoundaryUIProps {
  error: Error
  reset: () => void
  context: string
}

export function ErrorBoundaryUI({ error, reset, context }: ErrorBoundaryUIProps) {
  return (
    <div className="flex items-center justify-center p-8">
      <div className="w-full max-w-md rounded-lg border bg-card p-6 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <AlertCircle className="h-6 w-6 text-red-alert" />
        </div>
        <h2 className="mb-1 text-lg font-semibold text-card-foreground">
          Something went wrong
        </h2>
        <p className="mb-1 text-sm text-muted-foreground">
          Error in: {context}
        </p>
        <p className="mb-4 text-xs text-muted-foreground">
          {error.message}
        </p>
        <button
          onClick={reset}
          className="rounded-md bg-indigo-electric px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-electric/90"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
