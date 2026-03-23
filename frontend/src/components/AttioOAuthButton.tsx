/**
 * Attio OAuth Button — initiate Attio OAuth flow via popup,
 * display connection status, and disconnect.
 * Follows the exact pattern of SalesforceOAuthButton.tsx.
 */
import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { generateOAuthNonce } from '../lib/oauth-csrf'
import { logError } from '../lib/error-logger'

const ATTIO_CLIENT_ID = import.meta.env.VITE_ATTIO_CLIENT_ID
const ATTIO_REDIRECT_URI =
  import.meta.env.VITE_ATTIO_REDIRECT_URI ||
  `${window.location.origin}/oauth/attio/callback`
export default function AttioOAuthButton() {
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
        .eq('provider', 'attio')
        .maybeSingle()

      if (error) throw error

      setConnection(data)
    } catch (err) {
      logError(err, 'AttioOAuthButton.loadConnection')
      setError('Failed to load connection status')
    } finally {
      setLoading(false)
    }
  }

  const handleConnect = () => {
    if (!ATTIO_CLIENT_ID) {
      setError(
        'Attio integration not configured. Missing VITE_ATTIO_CLIENT_ID environment variable.'
      )
      return
    }

    const nonce = generateOAuthNonce('attio')

    const params = new URLSearchParams({
      client_id: ATTIO_CLIENT_ID,
      redirect_uri: ATTIO_REDIRECT_URI,
      response_type: 'code',
      state: JSON.stringify({ user_id: user?.id, nonce }),
    })

    const authUrl = `https://app.attio.com/authorize?${params.toString()}`

    // Open OAuth flow in popup window
    const width = 600
    const height = 700
    const left = window.screenX + (window.outerWidth - width) / 2
    const top = window.screenY + (window.outerHeight - height) / 2

    const popup = window.open(
      authUrl,
      'Attio OAuth',
      `width=${width},height=${height},left=${left},top=${top}`
    )

    // Poll for popup closure
    const pollTimer = setInterval(() => {
      if (popup?.closed) {
        clearInterval(pollTimer)
        loadConnection()
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
      logError(err, 'AttioOAuthButton.handleDisconnect')
      setError('Failed to disconnect. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded">
            <span className="text-sm font-medium text-purple-600 dark:text-purple-400">
              AT
            </span>
          </div>
          <div>
            <h3 className="font-medium text-gray-900 dark:text-white">Attio</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">Loading...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800">
      <div className="flex items-center space-x-3">
        <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded">
          <span className="text-sm font-medium text-purple-600 dark:text-purple-400">
            AT
          </span>
        </div>
        <div>
          <h3 className="font-medium text-gray-900 dark:text-white">Attio</h3>
          {connection ? (
            <div className="flex items-center space-x-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">
                Connected
              </span>
            </div>
          ) : (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Sync contacts and push activities to Attio CRM
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center space-x-3">
        {error && (
          <span className="text-sm text-red-600 dark:text-red-400">{error}</span>
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
            Connect Attio
          </button>
        )}
      </div>
    </div>
  )
}
