/**
 * @crumb
 * @id frontend-component-google-calendar-oauth-button
 * @area UI/Integrations/OAuth
 * @intent Google Calendar OAuth button — initiate Google Calendar OAuth flow with calendar-specific scopes, check connection status, allow disconnect
 * @responsibilities Check current Google Calendar connection status from Supabase, render Connect/Disconnect button, construct Google OAuth URL with calendar scopes and state param containing user_id, redirect to Google
 * @contracts GoogleCalendarOAuthButton({ onConnected?, onDisconnected? }) → JSX; reads google_calendar_integrations table; constructs OAuth URL with calendar scopes; window.location.href redirect
 * @in useAuth (user_id), supabase google_calendar_integrations table, Google OAuth env vars (VITE_GOOGLE_CLIENT_ID, VITE_GOOGLE_OAUTH_REDIRECT_URI for calendar), onConnected callback (optional), onDisconnected callback (optional)
 * @out Redirect to Google OAuth URL with calendar scopes; or Disconnect: supabase google_calendar_integrations delete; connection status updated
 * @err Missing env vars (OAuth URL malformed); disconnect delete failure (caught, error shown)
 * @hazard Google Calendar and Gmail both use Google OAuth but require different scope sets — if this button requests the same scopes as GmailOAuthButton or the redirect URI routes to the wrong callback, the integration will connect but have incorrect permissions
 * @hazard Same CSRF nonce gap as GmailOAuthButton — state param contains user_id without a nonce, making the callback vulnerable to state forgery
 * @shared-edges frontend/src/hooks/useAuth.ts→READS user_id; supabase google_calendar_integrations table→READS connection status; frontend/src/pages/GoogleCalendarOAuthCallback.tsx→RECEIVES redirect; frontend/src/pages/SettingsPage.tsx→RENDERS button
 * @trail gcal-connect#1 | User clicks "Connect Google Calendar" → constructs OAuth URL with calendar scopes → window.location.href redirect → Google login → GoogleCalendarOAuthCallback → tokens stored → /settings
 * @prompt Verify calendar scopes differ from Gmail scopes. Add CSRF nonce. Consolidate OAuth button logic with GmailOAuthButton into a shared hook with provider param.
 */
import { useState, useEffect } from 'react'
import { Calendar, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

const GOOGLE_CALENDAR_CLIENT_ID = import.meta.env.VITE_GOOGLE_CALENDAR_CLIENT_ID
const GOOGLE_CALENDAR_REDIRECT_URI = import.meta.env.VITE_GOOGLE_CALENDAR_REDIRECT_URI || `${window.location.origin}/oauth/google-calendar/callback`
const GOOGLE_CALENDAR_SCOPES = 'https://www.googleapis.com/auth/calendar.events'

export default function GoogleCalendarOAuthButton() {
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
        .eq('provider', 'google_calendar')
        .maybeSingle()

      if (error) throw error

      setConnection(data)
    } catch (err) {
      console.error('Failed to load Google Calendar connection:', err)
      setError('Failed to load connection status')
    } finally {
      setLoading(false)
    }
  }

  const handleConnect = () => {
    if (!GOOGLE_CALENDAR_CLIENT_ID) {
      setError('Google Calendar integration not configured. Missing VITE_GOOGLE_CALENDAR_CLIENT_ID environment variable.')
      return
    }

    // Build OAuth URL
    const params = new URLSearchParams({
      client_id: GOOGLE_CALENDAR_CLIENT_ID,
      redirect_uri: GOOGLE_CALENDAR_REDIRECT_URI,
      response_type: 'code',
      scope: GOOGLE_CALENDAR_SCOPES,
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
      'Google Calendar OAuth',
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
      console.error('Failed to disconnect Google Calendar:', err)
      setError('Failed to disconnect. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded">
            <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h3 className="font-medium text-gray-900 dark:text-white">Google Calendar</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">Loading...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800">
      <div className="flex items-center space-x-3">
        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded">
          <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h3 className="font-medium text-gray-900 dark:text-white">Google Calendar</h3>
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
              Sync salesblocks to your calendar
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
            Connect Google Calendar
          </button>
        )}
      </div>
    </div>
  )
}
