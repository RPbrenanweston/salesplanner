// @crumb frontend-page-gmail-oauth-callback
// UI/AUTH/OAUTH | parse_oauth_params | validate_csrf_nonce | exchange_tokens | close_popup
// why: Gmail OAuth callback — receive authorization code from Google, exchange for tokens via edge function, close popup
// in:window.location.search(code,state,error),Supabase session(JWT),exchange-google-token edge function out:Gmail access/refresh tokens stored via edge function,popup closes on success err:OAuth error from Google,missing code,CSRF nonce mismatch,edge function failure
// hazard: StrictMode double-invoke guarded with useRef flag — OAuth codes are single-use
// edge:frontend/src/components/GmailOAuthButton.tsx -> RELATES
// edge:supabase/functions/exchange-google-token -> CALLS
// edge:gmail-oauth#1 -> STEP_IN
// prompt: Test CSRF nonce round-trip with sessionStorage. Verify popup close fires window.opener.postMessage for parent to detect connection. Add explicit error display for nonce mismatch failure.
import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function GmailOAuthCallback() {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const hasRun = useRef(false) // StrictMode double-invoke guard

  useEffect(() => {
    if (hasRun.current) return
    hasRun.current = true
    handleCallback()
  }, [])

  const handleCallback = async () => {
    try {
      // Parse URL parameters
      const params = new URLSearchParams(window.location.search)
      const code = params.get('code')
      const state = params.get('state')
      const errorParam = params.get('error')

      // Handle OAuth errors from Google
      if (errorParam) {
        throw new Error(`OAuth error: ${errorParam}`)
      }

      if (!code) {
        throw new Error('No authorization code received')
      }

      // Parse and validate state
      const stateData = state ? JSON.parse(state) : null
      if (!stateData?.user_id) {
        throw new Error('Invalid state parameter')
      }

      // Validate CSRF nonce against sessionStorage
      const storedNonce = sessionStorage.getItem('oauth_csrf_nonce')
      if (!storedNonce || storedNonce !== stateData.nonce) {
        throw new Error('CSRF validation failed. Please try connecting again.')
      }
      sessionStorage.removeItem('oauth_csrf_nonce') // Clean up — single use

      // Build redirect_uri to match what was sent in the authorization request
      const redirectUri = import.meta.env.VITE_GMAIL_REDIRECT_URI || `${window.location.origin}/oauth/gmail/callback`

      // Exchange authorization code for tokens via Supabase edge function
      const { data, error: fnError } = await supabase.functions.invoke('exchange-google-token', {
        body: {
          code,
          redirect_uri: redirectUri,
          provider: 'gmail',
        },
      })

      if (fnError) {
        throw new Error(fnError.message || 'Token exchange failed')
      }

      if (data?.error) {
        throw new Error(data.error)
      }

      // Success — close popup or redirect
      if (window.opener) {
        window.close()
      } else {
        navigate('/settings')
      }
    } catch (err) {
      console.error('Gmail OAuth callback error:', err)
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
          Connecting Gmail...
        </h1>
        <p className="text-white/60">
          This window will close automatically.
        </p>
      </div>
    </div>
  )
}
