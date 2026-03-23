// @crumb frontend-component-google-calendar-oauth-button
// UI/Integrations/OAuth | connection_status_check | connect_disconnect_button
// why: Google Calendar OAuth button — uses useGoogleOAuth hook with 'google_calendar' provider for calendar.events scopes
// in:useGoogleOAuth('google_calendar') out:Connect/Disconnect button with connection status err:See useGoogleOAuth hook
// edge:frontend/src/hooks/useGoogleOAuth.ts -> CALLS
// edge:frontend/src/pages/GoogleCalendarOAuthCallback.tsx -> RELATES
// edge:frontend/src/pages/SettingsPage.tsx -> RELATES
import { Calendar, X } from 'lucide-react'
import { useGoogleOAuth } from '../hooks/useGoogleOAuth'

export default function GoogleCalendarOAuthButton() {
  const { connectionStatus, initiateOAuth, disconnect } = useGoogleOAuth('google_calendar')
  const { connection, loading, error } = connectionStatus

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
              {!!connection.email_address && (
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {String(connection.email_address)}
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
        {error && <span className="text-sm text-red-600 dark:text-red-400">{error}</span>}

        {connection ? (
          <button
            onClick={disconnect}
            disabled={loading}
            className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 disabled:opacity-50 transition-colors"
          >
            <X className="w-4 h-4" />
            <span>Disconnect</span>
          </button>
        ) : (
          <button
            onClick={initiateOAuth}
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
