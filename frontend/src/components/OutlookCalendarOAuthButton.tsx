import { useState, useEffect } from 'react'
import { Calendar, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

const OUTLOOK_CALENDAR_CLIENT_ID = import.meta.env.VITE_OUTLOOK_CALENDAR_CLIENT_ID
const OUTLOOK_CALENDAR_REDIRECT_URI = import.meta.env.VITE_OUTLOOK_CALENDAR_REDIRECT_URI || `${window.location.origin}/oauth/outlook-calendar/callback`
const OUTLOOK_CALENDAR_SCOPES = 'Calendars.ReadWrite offline_access'

export default function OutlookCalendarOAuthButton() {
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
        .eq('provider', 'outlook_calendar')
        .maybeSingle()

      if (error) throw error

      setConnection(data)
    } catch (err) {
      console.error('Failed to load Outlook Calendar connection:', err)
      setError('Failed to load connection status')
    } finally {
      setLoading(false)
    }
  }

  const handleConnect = () => {
    if (!OUTLOOK_CALENDAR_CLIENT_ID) {
      setError('Outlook Calendar integration not configured. Missing VITE_OUTLOOK_CALENDAR_CLIENT_ID environment variable.')
      return
    }

    // Build OAuth URL for Microsoft Graph API
    const params = new URLSearchParams({
      client_id: OUTLOOK_CALENDAR_CLIENT_ID,
      redirect_uri: OUTLOOK_CALENDAR_REDIRECT_URI,
      response_type: 'code',
      scope: OUTLOOK_CALENDAR_SCOPES,
      response_mode: 'query',
      state: JSON.stringify({ user_id: user?.id }), // Pass user context
    })

    const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`

    // Open OAuth flow in popup window
    const width = 500
    const height = 600
    const left = window.screenX + (window.outerWidth - width) / 2
    const top = window.screenY + (window.outerHeight - height) / 2

    const popup = window.open(
      authUrl,
      'Outlook Calendar OAuth',
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
      console.error('Failed to disconnect Outlook Calendar:', err)
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
            <h3 className="font-medium text-gray-900 dark:text-white">Outlook Calendar</h3>
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
          <h3 className="font-medium text-gray-900 dark:text-white">Outlook Calendar</h3>
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
              Sync salesblocks to your Outlook calendar
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
            Connect Outlook Calendar
          </button>
        )}
      </div>
    </div>
  )
}
