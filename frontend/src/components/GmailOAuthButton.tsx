/**
 * @crumb
 * @id frontend-component-gmail-oauth-button
 * @area UI/Integrations/OAuth
 * @intent Gmail OAuth button — initiate Gmail OAuth flow by redirecting user to Google's authorization endpoint with the correct scopes and state param
 * @responsibilities Check current Gmail connection status from Supabase, render Connect/Disconnect button, construct Google OAuth URL with state param containing user_id, redirect to Google
 * @contracts GmailOAuthButton({ onConnected?, onDisconnected? }) → JSX; reads gmail_integrations table for current user; constructs OAuth URL with state=JSON.stringify({user_id}); window.location.href redirect
 * @in useAuth (user_id), supabase gmail_integrations table, Google OAuth env vars (VITE_GOOGLE_CLIENT_ID, VITE_GOOGLE_OAUTH_REDIRECT_URI), onConnected callback (optional), onDisconnected callback (optional)
 * @out Redirect to Google OAuth URL; or Disconnect: supabase gmail_integrations delete; connection status display updated
 * @err Missing env vars (OAuth URL malformed — silent failure); Google redirect failure (user sees Google error page); disconnect Supabase delete failure (caught, error shown)
 * @hazard state param contains user_id as JSON but no CSRF nonce — if the redirect URI is known to an attacker, they can forge a state param with a victim's user_id and complete the OAuth flow on their behalf
 * @hazard OAuth redirect uses window.location.href (full page navigation) — if the user has unsaved changes on SettingsPage, those changes are silently lost when the OAuth redirect happens
 * @shared-edges frontend/src/hooks/useAuth.ts→READS user_id; supabase gmail_integrations table→READS connection status; frontend/src/pages/GmailOAuthCallback.tsx→RECEIVES redirect; frontend/src/pages/SettingsPage.tsx→RENDERS button
 * @trail gmail-connect#1 | User clicks "Connect Gmail" → GmailOAuthButton constructs OAuth URL → window.location.href redirect → Google login → GmailOAuthCallback → tokens stored → /settings
 * @prompt Add CSRF nonce to state param. Warn user about unsaved changes before redirect. Use popup window instead of full page redirect to preserve page state.
 */
import { useState, useEffect } from 'react'
import { Mail, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

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

    // Build OAuth URL
    const params = new URLSearchParams({
      client_id: GMAIL_CLIENT_ID,
      redirect_uri: GMAIL_REDIRECT_URI,
      response_type: 'code',
      scope: GMAIL_SCOPES,
      access_type: 'offline', // Request refresh token
      prompt: 'consent', // Force consent screen to ensure refresh token
      state: JSON.stringify({ user_id: user?.id }), // Pass user context
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
