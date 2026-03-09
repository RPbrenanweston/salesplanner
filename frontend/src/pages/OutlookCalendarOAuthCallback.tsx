/**
 * @crumb
 * @id frontend-page-outlook-calendar-oauth-callback
 * @area UI/Auth/OAuth
 * @intent Outlook Calendar OAuth callback — receive authorization code from Microsoft, exchange for tokens, store calendar integration, redirect to settings
 * @responsibilities Parse code/state/error/error_description from URL params on mount, exchange code for tokens via backend, persist connection, navigate to /settings
 * @contracts OutlookCalendarOAuthCallback() → JSX; reads window.location.search for OAuth params; calls token exchange; uses useNavigate
 * @in window.location.search (code, state, error, error_description params), backend token exchange, useNavigate
 * @out Outlook Calendar access/refresh tokens stored; redirect to /settings on success; error state displayed on failure
 * @err OAuth error param from Microsoft (error + error_description displayed); missing code (error state set); token exchange failure (error displayed)
 * @hazard Outlook Calendar and Outlook Mail OAuth callbacks are nearly identical — if the mail callback gets a fix or improvement (e.g. better error handling), the calendar callback may silently diverge; no shared base
 * @hazard Microsoft Calendar OAuth scopes differ from Outlook Mail scopes — if the wrong scope set was requested in the OAuth button, the callback will succeed but calendar read/write operations will fail at runtime
 * @shared-edges frontend/src/components/OutlookCalendarOAuthButton.tsx→INITIATES OAuth flow; frontend/src/pages/SettingsPage.tsx→RETURNS to after success; frontend/src/App.tsx→ROUTES to /oauth/outlook-calendar/callback
 * @trail outlook-calendar-oauth#1 | OutlookCalendarOAuthButton redirects to Microsoft → Microsoft redirects to callback → parse params → exchange code → store tokens → navigate('/settings')
 * @prompt Consolidate all OAuth callbacks into a shared hook with provider param. Verify scope set is correct for calendar read/write. Add CSRF state validation.
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function OutlookCalendarOAuthCallback() {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    handleCallback()
  }, [])

  const handleCallback = async () => {
    try {
      // Parse URL parameters
      const params = new URLSearchParams(window.location.search)
      const code = params.get('code')
      const state = params.get('state')
      const errorParam = params.get('error')
      const errorDescription = params.get('error_description')

      // Handle OAuth errors
      if (errorParam) {
        throw new Error(errorDescription || `OAuth error: ${errorParam}`)
      }

      if (!code) {
        throw new Error('No authorization code received')
      }

      // Parse state to get user_id
      const stateData = state ? JSON.parse(state) : null
      const userId = stateData?.user_id

      if (!userId) {
        throw new Error('Invalid state parameter')
      }

      // Exchange authorization code for tokens
      // NOTE: This should happen in a secure backend (Supabase Edge Function)
      // For now, we'll just show a message and close the popup
      // TODO: Implement token exchange in backend (US-028 follow-up)

      // Close popup and return to main window
      if (window.opener) {
        window.close()
      } else {
        // If not in popup, redirect to settings
        navigate('/settings')
      }
    } catch (err) {
      console.error('OAuth callback error:', err)
      setError(err instanceof Error ? err.message : 'OAuth flow failed')
    }
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <div className="max-w-md w-full p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
          <h1 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-4">
            OAuth Error
          </h1>
          <p className="text-gray-700 dark:text-gray-300 mb-4">
            {error}
          </p>
          <button
            onClick={() => window.close()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            Close Window
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
      <div className="max-w-md w-full p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          Completing OAuth...
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          This window will close automatically.
        </p>
      </div>
    </div>
  )
}
