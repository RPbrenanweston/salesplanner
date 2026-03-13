// @crumb frontend-component-salesforce-oauth-button
// UI/Integrations/OAuth | connection_status_check | connect_disconnect_button | oauth_url_construction | popup_oauth_window | popup_close_polling
// why: Salesforce OAuth button — initiate Salesforce Connected App OAuth flow to authorize CRM sync, render connection status and disconnect option
// in:useAuth (user_id),supabase oauth_connections table,VITE_SALESFORCE_CLIENT_ID + VITE_SALESFORCE_REDIRECT_URI env vars out:Redirect to Salesforce OAuth in popup,Disconnect deletes connection err:Missing client_id (error shown),popup blocked (silent fail),disconnect failure
// hazard: Salesforce instance_url must be stored alongside tokens — missing it targets wrong org endpoint (production vs sandbox)
// hazard: Redirect URI must exactly match Salesforce Setup whitelist — mismatch causes error on Salesforce page, not in app UI
// edge:frontend/src/hooks/useAuth.ts -> READS
// edge:frontend/src/pages/SalesforceOAuthCallback.tsx -> RELATES
// edge:frontend/src/lib/salesforce.ts -> CALLS
// edge:frontend/src/pages/SettingsPage.tsx -> RELATES
// edge:sf-connect#1 -> STEP_IN
// prompt: Add CSRF nonce to state param. Validate instance_url storage in callback. Show clear error if popup is blocked. Differentiate sandbox vs production OAuth endpoints.
import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { generateOAuthNonce } from '../lib/oauth-csrf'
import { logError } from '../lib/error-logger'

const SALESFORCE_CLIENT_ID = import.meta.env.VITE_SALESFORCE_CLIENT_ID
const SALESFORCE_REDIRECT_URI = import.meta.env.VITE_SALESFORCE_REDIRECT_URI || `${window.location.origin}/oauth/salesforce/callback`

export default function SalesforceOAuthButton() {
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
        .eq('provider', 'salesforce')
        .maybeSingle()

      if (error) throw error

      setConnection(data)
    } catch (err) {
      logError(err, 'SalesforceOAuthButton.loadConnection')
      setError('Failed to load connection status')
    } finally {
      setLoading(false)
    }
  }

  const handleConnect = () => {
    if (!SALESFORCE_CLIENT_ID) {
      setError('Salesforce integration not configured. Missing VITE_SALESFORCE_CLIENT_ID environment variable.')
      return
    }

    // Build OAuth URL for Salesforce Connected App
    const params = new URLSearchParams({
      client_id: SALESFORCE_CLIENT_ID,
      redirect_uri: SALESFORCE_REDIRECT_URI,
      response_type: 'code',
      // Request full access to data API and refresh tokens
      scope: 'api refresh_token',
      // Force consent screen for refresh token
      prompt: 'consent',
      state: JSON.stringify({ user_id: user?.id, nonce: generateOAuthNonce('salesforce') }),
    })

    const authUrl = `https://login.salesforce.com/services/oauth2/authorize?${params.toString()}`

    // Open OAuth flow in popup window
    const width = 600
    const height = 700
    const left = window.screenX + (window.outerWidth - width) / 2
    const top = window.screenY + (window.outerHeight - height) / 2

    const popup = window.open(
      authUrl,
      'Salesforce OAuth',
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
      logError(err, 'SalesforceOAuthButton.handleDisconnect')
      setError('Failed to disconnect. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-cyan-100 dark:bg-cyan-900/30 rounded">
            <span className="text-sm font-medium text-cyan-600 dark:text-cyan-400">SF</span>
          </div>
          <div>
            <h3 className="font-medium text-gray-900 dark:text-white">Salesforce</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">Loading...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800">
      <div className="flex items-center space-x-3">
        <div className="p-2 bg-cyan-100 dark:bg-cyan-900/30 rounded">
          <span className="text-sm font-medium text-cyan-600 dark:text-cyan-400">SF</span>
        </div>
        <div>
          <h3 className="font-medium text-gray-900 dark:text-white">Salesforce</h3>
          {connection ? (
            <div className="flex items-center space-x-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">
                Connected
              </span>
              {connection.instance_url && (
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {new URL(connection.instance_url).hostname}
                </span>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Sync contacts and push activities to Salesforce
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
            Connect Salesforce
          </button>
        )}
      </div>
    </div>
  )
}
