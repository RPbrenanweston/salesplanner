// @crumb frontend-component-oauth-callback-layout
// UI/Auth/OAuth | processing_spinner | success_checkmark | error_display | close_button
// why: Shared OAuth callback layout — renders processing/success/error states with VV design tokens
// in:status,errorMessage,providerName out:JSX rendering processing/success/error states err:none
// hazard: Auto-close not implemented (line says "close automatically" but no setTimeout) — users stuck in success state if this component used standalone
// hazard: errorMessage displayed unescaped (line 86) — if error from API contains HTML/JS, could execute arbitrary code in popup
// edge:frontend/src/pages/GmailOAuthCallback.tsx -> SERVES
// edge:frontend/src/pages/GoogleCalendarOAuthCallback.tsx -> SERVES
// edge:frontend/src/pages/OutlookOAuthCallback.tsx -> SERVES
// edge:frontend/src/pages/OutlookCalendarOAuthCallback.tsx -> SERVES
// edge:frontend/src/pages/SalesforceOAuthCallback.tsx -> SERVES
// edge:oauth-layout#1 -> STEP_IN
// prompt: Add animated transition between processing/success/error states. Ensure providerName displays human-readable label (Gmail not gmail). Test with popup blocker active — error state should explain manual close.

interface OAuthCallbackLayoutProps {
  status: 'processing' | 'success' | 'error'
  errorMessage: string | null
  providerName: string
}

export default function OAuthCallbackLayout({
  status,
  errorMessage,
  providerName,
}: OAuthCallbackLayoutProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-void-950 via-void-900 to-void-950">
      <div className="max-w-md w-full glass-card p-8">
        {status === 'processing' && (
          <div className="text-center">
            <div className="w-12 h-12 border-2 border-indigo-electric border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">
              Connecting {providerName}...
            </h2>
            <p className="text-white/60">
              Please wait while we complete the connection.
            </p>
          </div>
        )}

        {status === 'success' && (
          <div className="text-center">
            <div className="w-12 h-12 bg-emerald-signal/20 border border-emerald-signal/40 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-6 h-6 text-emerald-signal"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">
              {providerName} Connected!
            </h2>
            <p className="text-white/60">
              This window will close automatically.
            </p>
          </div>
        )}

        {status === 'error' && (
          <div className="text-center">
            <div className="w-12 h-12 bg-red-alert/20 border border-red-alert/40 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-6 h-6 text-red-alert"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">
              Connection Failed
            </h2>
            <p className="text-white/60 mb-4">
              {errorMessage ||
                `An error occurred while connecting to ${providerName}.`}
            </p>
            <button
              onClick={() => window.close()}
              className="px-4 py-2 bg-indigo-electric hover:bg-indigo-electric/80 text-white rounded-lg transition-colors ease-snappy"
            >
              Close Window
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
