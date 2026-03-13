// @crumb frontend-component-page-loader
// UI | full_page_loading | spinner_animation | loading_state_display
// why: Full-page loading skeleton with centered spinner and loading message for page transitions and initial data fetches
// in:none out:Full-page loader overlay with animated spinner,no props needed err:Hardcoded text "Loading..." doesn't reflect actual loading state (multiple resources),spinner never stops if data fetch hangs
// hazard: Hardcoded "Loading..." text doesn't differentiate between auth check, data fetch, or page navigation — user has no context
// hazard: No timeout — if data fetch hangs indefinitely, user sees spinner forever with no error or retry option
// edge:frontend/src/pages/ -> RELATES
// edge:frontend/src/components/ProtectedRoute.tsx -> RELATES
// prompt: Pass loadingMessage prop for contextual text (e.g., "Loading dashboard...", "Connecting to calendar..."). Add timeout that shows error fallback after 30s. Consider skeleton screens for specific page types instead of generic spinner.

import { Loader } from 'lucide-react'

export default function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
      <div className="text-center space-y-4">
        <div className="flex justify-center">
          <Loader className="w-12 h-12 text-blue-500 animate-spin" />
        </div>
        <p className="text-slate-300 font-medium">Loading...</p>
      </div>
    </div>
  )
}
