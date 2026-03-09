/**
 * @crumb
 * @id frontend-component-salesforce-oauth-button
 * @area UI/Integrations/OAuth
 * @intent Salesforce OAuth button — initiate Salesforce Connected App OAuth flow to authorize CRM sync, render connection status and disconnect option
 * @responsibilities Check Salesforce connection status from Supabase oauth_connections, render Connect/Disconnect button, construct Salesforce OAuth URL with state param, open popup OAuth window, poll for popup close to refresh status
 * @contracts SalesforceOAuthButton() → JSX; reads oauth_connections for provider='salesforce'; constructs Salesforce OAuth URL with VITE_SALESFORCE_CLIENT_ID; opens popup; on disconnect: deletes from oauth_connections
 * @in useAuth (user_id), supabase oauth_connections table, VITE_SALESFORCE_CLIENT_ID + VITE_SALESFORCE_REDIRECT_URI env vars
 * @out Redirect to Salesforce OAuth in popup; or Disconnect: supabase oauth_connections delete; connection status display updated
 * @err Missing VITE_SALESFORCE_CLIENT_ID (error state shown); popup blocked (OAuth silently fails); disconnect failure (caught, error shown)
 * @hazard Salesforce OAuth returns an instance_url in the token response that must be stored alongside the tokens — if the backend callback does not capture and store instance_url, all subsequent Salesforce API calls will target the wrong org endpoint (production vs sandbox)
 * @hazard Salesforce Connected Apps require the redirect URI to be whitelisted in Salesforce Setup — if VITE_SALESFORCE_REDIRECT_URI doesn't exactly match the Salesforce app configuration, the OAuth flow will fail with an error that appears on the Salesforce authorization page, not in the app UI
 * @shared-edges frontend/src/hooks/useAuth.ts→READS user_id; supabase oauth_connections table→READS/DELETES; frontend/src/pages/SalesforceOAuthCallback.tsx→RECEIVES OAuth redirect; lib/salesforce.ts→USES stored tokens; frontend/src/pages/SettingsPage.tsx→RENDERS button
 * @trail sf-connect#1 | User clicks "Connect Salesforce" → SalesforceOAuthButton constructs OAuth URL → popup opens → Salesforce login → SalesforceOAuthCallback → tokens + instance_url stored → popup closes → connection reloads
 * @prompt Add CSRF nonce to state param. Validate instance_url storage in callback. Show clear error if popup is blocked. Differentiate sandbox vs production OAuth endpoints.
 */
import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

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
      console.error('Failed to load Salesforce connection:', err)
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
      state: JSON.stringify({ user_id: user?.id }),
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
      console.error('Failed to disconnect Salesforce:', err)
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
