// @crumb frontend-component-gmail-oauth-button
// UI/Integrations/OAuth | connection_status_check | connect_disconnect_button
// why: Gmail OAuth button — uses useGoogleOAuth hook with 'gmail' provider for gmail.send + gmail.readonly scopes
// in:useGoogleOAuth('gmail') out:Connect/Disconnect button with connection status err:See useGoogleOAuth hook
// edge:frontend/src/hooks/useGoogleOAuth.ts -> CALLS
// edge:frontend/src/pages/GmailOAuthCallback.tsx -> RELATES
// edge:frontend/src/pages/SettingsPage.tsx -> RELATES
import { Mail, X } from 'lucide-react'
import { useGoogleOAuth } from '../hooks/useGoogleOAuth'

export default function GmailOAuthButton() {
  const { connectionStatus, initiateOAuth, disconnect } = useGoogleOAuth('gmail')
  const { connection, loading, error } = connectionStatus

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
              {!!connection.email_address && (
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {String(connection.email_address)}
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
            Connect Gmail
          </button>
        )}
      </div>
    </div>
  )
}
