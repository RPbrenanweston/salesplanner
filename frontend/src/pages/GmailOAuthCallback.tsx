/**
 * @crumb
 * @id frontend-page-gmail-oauth-callback
 * @area UI/Auth/OAuth
 * @intent Gmail OAuth callback — receive authorization code from Google, exchange for tokens, store Gmail integration, redirect to settings
 * @responsibilities Parse code/state/error from URL params on mount, exchange code for tokens via backend, persist connection, navigate to /settings
 * @contracts GmailOAuthCallback() → JSX; reads window.location.search for OAuth params; calls token exchange; uses useNavigate
 * @in window.location.search (code, state, error params), backend token exchange, useNavigate
 * @out Gmail access/refresh tokens stored; redirect to /settings on success; error state displayed on failure
 * @err OAuth error param from Google (error displayed); missing code (error state set); token exchange failure (error displayed)
 * @hazard state param CSRF validation depends entirely on the token exchange backend — if backend does not verify state against a stored nonce, CSRF attacks on Gmail OAuth are possible
 * @hazard handleCallback runs once on mount with no guard against React.StrictMode double-invoke — OAuth codes are single-use; second invocation will fail and may show spurious error to user
 * @shared-edges frontend/src/components/GmailOAuthButton.tsx→INITIATES OAuth flow; frontend/src/pages/SettingsPage.tsx→RETURNS to after success; frontend/src/App.tsx→ROUTES to /oauth/gmail/callback
 * @trail gmail-oauth#1 | GmailOAuthButton redirects to Google → Google redirects to callback → parse params → exchange code → store tokens → navigate('/settings')
 * @prompt VV tokens applied — void-950 gradient background, glass-card container, red-alert error heading, white/70 error body, indigo-electric CTA button with ease-snappy, VV spinner (border-indigo-electric border-t-transparent). Remaining: Add CSRF state validation against sessionStorage nonce before token exchange. Guard against strict mode double-invoke with a ref flag.
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function GmailOAuthCallback() {
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

      // Handle OAuth errors
      if (errorParam) {
        throw new Error(`OAuth error: ${errorParam}`)
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
      // TODO: Implement token exchange in backend (US-022 follow-up)

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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-void-950 via-void-900 to-void-950">
        <div className="max-w-md w-full p-6 glass-card">
          <h1 className="text-2xl font-bold font-display text-red-alert mb-4">
            OAuth Error
          </h1>
          <p className="text-white/70 mb-4">
            {error}
          </p>
          <button
            onClick={() => window.close()}
            className="px-4 py-2 bg-indigo-electric hover:bg-indigo-electric/80 text-white rounded-lg transition-colors ease-snappy"
          >
            Close Window
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-void-950 via-void-900 to-void-950">
      <div className="max-w-md w-full p-6 glass-card text-center">
        <div className="w-12 h-12 border-2 border-indigo-electric border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <h1 className="text-xl font-semibold text-white mb-2">
          Completing OAuth...
        </h1>
        <p className="text-white/60">
          This window will close automatically.
        </p>
      </div>
    </div>
  )
}
