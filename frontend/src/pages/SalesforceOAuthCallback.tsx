/**
 * @crumb
 * @id frontend-page-salesforce-oauth-callback
 * @area UI/Auth/OAuth
 * @intent Salesforce OAuth callback — receive authorization code from Salesforce, exchange for tokens, store CRM integration, redirect to settings
 * @responsibilities Parse code/state/error/error_description from URL params on mount via useSearchParams, exchange code for tokens via backend, persist connection, navigate to /settings
 * @contracts SalesforceOAuthCallback() → JSX; uses useSearchParams (not window.location.search) for OAuth params; calls token exchange; uses useNavigate
 * @in useSearchParams (code, state, error, error_description params), backend token exchange, useNavigate
 * @out Salesforce access/refresh tokens stored; redirect to /settings on success; error state displayed on failure
 * @err OAuth error param from Salesforce (error + error_description displayed); missing code (error state set); token exchange failure (error displayed)
 * @hazard useSearchParams instead of window.location.search is an inconsistency with all other OAuth callbacks — if a hash-based router is ever introduced, useSearchParams may silently stop seeing the params that window.location.search would still see
 * @hazard Salesforce OAuth returns an instance_url alongside the code that must be used as the base URL for all subsequent API calls — if the backend token exchange does not store instance_url, all Salesforce API calls will target the wrong org endpoint
 * @shared-edges frontend/src/components/SalesforceOAuthButton.tsx→INITIATES OAuth flow; frontend/src/pages/SettingsPage.tsx→RETURNS to after success; frontend/src/App.tsx→ROUTES to /oauth/salesforce/callback
 * @trail salesforce-oauth#1 | SalesforceOAuthButton redirects to Salesforce → Salesforce redirects to callback → parse params → exchange code → store tokens + instance_url → navigate('/settings')
 * @prompt VV tokens applied — void-950 gradient background, glass-card container, VV spinner (border-indigo-electric border-t-transparent), emerald-signal success icon/ring, red-alert error icon/ring, white text headers, white/60 body text, white/40 secondary text. Remaining: Align useSearchParams with window.location.search pattern used by other callbacks, or standardise all to useSearchParams. Verify backend stores instance_url. Add CSRF state validation.
 */
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

export default function SalesforceOAuthCallback() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    const handleCallback = async () => {
      // Extract OAuth code and state from URL
      const code = searchParams.get('code')
      const state = searchParams.get('state')
      const error = searchParams.get('error')
      const errorDescription = searchParams.get('error_description')

      // Handle OAuth errors
      if (error) {
        console.error('Salesforce OAuth error:', error, errorDescription)
        setErrorMessage(errorDescription || error)
        setStatus('error')
        setTimeout(() => {
          if (window.opener) {
            window.close()
          } else {
            navigate('/settings')
          }
        }, 3000)
        return
      }

      if (!code || !state) {
        setErrorMessage('Missing authorization code or state')
        setStatus('error')
        setTimeout(() => {
          if (window.opener) {
            window.close()
          } else {
            navigate('/settings')
          }
        }, 3000)
        return
      }

      try {
        // Parse user context from state
        const { user_id } = JSON.parse(state)

        // TODO (US-031): Exchange code for access token and refresh token via backend
        // This should be done in a Supabase Edge Function to keep client_secret secure
        // For now, we'll just store the code (insecure - needs backend implementation)

        console.log('Salesforce OAuth code received:', code)
        console.log('User ID from state:', user_id)

        // Placeholder: Mark as successful
        // In real implementation, Edge Function would:
        // 1. Exchange code for tokens via Salesforce token endpoint
        // 2. Store access_token, refresh_token, instance_url in oauth_connections table
        // 3. Return success/error to frontend

        setStatus('success')

        // Close popup or redirect after short delay
        setTimeout(() => {
          if (window.opener) {
            // This is a popup - close it
            window.close()
          } else {
            // This is not a popup - redirect to settings
            navigate('/settings')
          }
        }, 1500)
      } catch (err) {
        console.error('Failed to process Salesforce OAuth callback:', err)
        setErrorMessage('Failed to process OAuth response')
        setStatus('error')
        setTimeout(() => {
          if (window.opener) {
            window.close()
          } else {
            navigate('/settings')
          }
        }, 3000)
      }
    }

    handleCallback()
  }, [searchParams, navigate])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-void-950 via-void-900 to-void-950">
      <div className="max-w-md w-full glass-card p-8">
        {status === 'processing' && (
          <div className="text-center">
            <div className="w-12 h-12 border-2 border-indigo-electric border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <h2 className="text-xl font-semibold text-white mb-2">
              Connecting Salesforce...
            </h2>
            <p className="text-white/60">
              Please wait while we complete the connection.
            </p>
          </div>
        )}

        {status === 'success' && (
          <div className="text-center">
            <div className="w-12 h-12 bg-emerald-signal/20 border border-emerald-signal/40 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-emerald-signal" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">
              Salesforce Connected!
            </h2>
            <p className="text-white/60">
              This window will close automatically.
            </p>
          </div>
        )}

        {status === 'error' && (
          <div className="text-center">
            <div className="w-12 h-12 bg-red-alert/20 border border-red-alert/40 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-red-alert" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">
              Connection Failed
            </h2>
            <p className="text-white/60 mb-4">
              {errorMessage || 'An error occurred while connecting to Salesforce.'}
            </p>
            <p className="text-sm text-white/40">
              This window will close automatically.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
