// @crumb frontend-component-gmail-oauth-button
// UI/Integrations/OAuth | connection_status_check | connect_disconnect_button | oauth_url_construction | google_redirect
// why: Gmail OAuth button — initiate Gmail OAuth flow by redirecting user to Google's authorization endpoint with the correct scopes and state param
// in:useAuth (user_id),supabase gmail_integrations table,Google OAuth env vars out:Redirect to Google OAuth URL,Disconnect deletes connection err:Missing env vars (silent failure),Google redirect failure,disconnect delete failure
// hazard: State param contains user_id without CSRF nonce — attacker can forge state and complete OAuth on victim's behalf
// hazard: OAuth redirect uses window.location.href — unsaved changes on SettingsPage are silently lost
// edge:frontend/src/hooks/useAuth.ts -> READS
// edge:frontend/src/pages/GmailOAuthCallback.tsx -> RELATES
// edge:frontend/src/pages/SettingsPage.tsx -> RELATES
// edge:gmail-connect#1 -> STEP_IN
// prompt: Add CSRF nonce to state param. Warn user about unsaved changes before redirect. Use popup window instead of full page redirect to preserve page state.
import { useState, useEffect } from 'react'
import { Mail, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { generateOAuthNonce } from '../lib/oauth-csrf'

const GMAIL_CLIENT_ID = import.meta.env.VITE_GMAIL_CLIENT_ID
const GMAIL_REDIRECT_URI = import.meta.env.VITE_GMAIL_REDIRECT_URI || `${window.location.origin}/oauth/gmail/callback`
const GMAIL_SCOPES = 'https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly'

export default function GmailOAuthButton() {
  const { user } = useAuth()
  const [connection, setConnection] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadConnection()
  }, [user])

  const loadConnection = async () => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .from('oauth_connections')
        .select('*')
        .eq('user_id', user.id)
        .eq('provider', 'gmail')
        .maybeSingle()

      if (error) throw error

      setConnection(data)
    } catch (err) {
      console.error('Failed to load Gmail connection:', err)
      setError('Failed to load connection status')
    } finally {
      setLoading(false)
    }
  }

  const handleConnect = () => {
    if (!GMAIL_CLIENT_ID) {
      setError('Gmail integration not configured. Missing VITE_GMAIL_CLIENT_ID environment variable.')
      return
    }

    // Generate CSRF nonce and store in sessionStorage for callback validation
    const nonce = generateOAuthNonce('gmail')

    // Build OAuth URL
    const params = new URLSearchParams({
      client_id: GMAIL_CLIENT_ID,
      redirect_uri: GMAIL_REDIRECT_URI,
      response_type: 'code',
      scope: GMAIL_SCOPES,
      access_type: 'offline', // Request refresh token
      prompt: 'consent', // Force consent screen to ensure refresh token
      state: JSON.stringify({ user_id: user?.id, nonce }), // Pass user context + CSRF nonce
    })

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`

    // Open OAuth flow in popup window
    const width = 500
    const height = 600
    const left = window.screenX + (window.outerWidth - width) / 2
    const top = window.screenY + (window.outerHeight - height) / 2

    const popup = window.open(
      authUrl,
      'Gmail OAuth',
      `width=${width},height=${height},left=${left},top=${top}`
    )

    // Poll for popup closure (indicates OAuth completion)
    const pollTimer = setInterval(() => {
      if (popup?.closed) {
        clearInterval(pollTimer)
        loadConnection() // Refresh connection status
      }
    }, 500)
  }

  const handleDisconnect = async () => {
    if (!connection) return

    try {
      setLoading(true)
      const { error } = await supabase
        .from('oauth_connections')
        .delete()
        .eq('id', connection.id)

      if (error) throw error

      setConnection(null)
      setError(null)
    } catch (err) {
      console.error('Failed to disconnect Gmail:', err)
      setError('Failed to disconnect. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded">
            <Mail className="w-5 h-5 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <h3 className="font-medium text-gray-900 dark:text-white">Gmail</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">Loading...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800">
      <div className="flex items-center space-x-3">
        <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded">
          <Mail className="w-5 h-5 text-red-600 dark:text-red-400" />
        </div>
        <div>
          <h3 className="font-medium text-gray-900 dark:text-white">Gmail</h3>
          {connection ? (
            <div className="flex items-center space-x-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">
                Connected
              </span>
              {connection.email_address && (
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {connection.email_address}
                </span>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Send and track emails from Gmail
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center space-x-3">
        {error && (
          <span className="text-sm text-red-600 dark:text-red-400">
            {error}
          </span>
        )}

        {connection ? (
          <button
            onClick={handleDisconnect}
            disabled={loading}
            className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 disabled:opacity-50 transition-colors"
          >
            <X className="w-4 h-4" />
            <span>Disconnect</span>
          </button>
        ) : (
          <button
            onClick={handleConnect}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors"
          >
            Connect Gmail
          </button>
        )}
      </div>
    </div>
  )
}
