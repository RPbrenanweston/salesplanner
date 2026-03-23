// @crumb frontend-component-microsoft-oauth-button
// UI/Integrations/OAuth | connection_status_check | connect_disconnect_button | oauth_url_construction | popup_oauth_window | popup_close_polling
// why: Consolidated Microsoft OAuth button — handles both Outlook Mail and Outlook Calendar OAuth flows via integrationType prop
// in:integrationType('mail'|'calendar'),useAuth (user_id),supabase oauth_connections table,VITE_OUTLOOK_* env vars out:Redirect to Microsoft OAuth in popup,Disconnect deletes connection err:Missing env vars (OAuth URL malformed),popup blocked (silent fail),disconnect failure
// edge:frontend/src/hooks/useAuth.ts -> READS
// edge:frontend/src/pages/OutlookOAuthCallback.tsx -> RELATES
// edge:frontend/src/pages/OutlookCalendarOAuthCallback.tsx -> RELATES
// edge:frontend/src/pages/SettingsPage.tsx -> RELATES
import { useState, useEffect } from 'react'
import { Mail, Calendar, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { generateOAuthNonce } from '../lib/oauth-csrf'

type IntegrationType = 'mail' | 'calendar'

interface MicrosoftOAuthButtonProps {
  integrationType: IntegrationType
}

const CONFIG: Record<IntegrationType, {
  provider: string
  clientIdEnv: string
  redirectUriEnv: string
  defaultRedirectPath: string
  scopes: string
  popupName: string
  icon: typeof Mail
  title: string
  description: string
  connectLabel: string
}> = {
  mail: {
    provider: 'outlook',
    clientIdEnv: 'VITE_OUTLOOK_CLIENT_ID',
    redirectUriEnv: 'VITE_OUTLOOK_REDIRECT_URI',
    defaultRedirectPath: '/oauth/outlook/callback',
    scopes: 'Mail.Send Mail.ReadBasic offline_access',
    popupName: 'Outlook OAuth',
    icon: Mail,
    title: 'Outlook',
    description: 'Send and track emails from Outlook',
    connectLabel: 'Connect Outlook',
  },
  calendar: {
    provider: 'outlook_calendar',
    clientIdEnv: 'VITE_OUTLOOK_CALENDAR_CLIENT_ID',
    redirectUriEnv: 'VITE_OUTLOOK_CALENDAR_REDIRECT_URI',
    defaultRedirectPath: '/oauth/outlook-calendar/callback',
    scopes: 'Calendars.ReadWrite offline_access',
    popupName: 'Outlook Calendar OAuth',
    icon: Calendar,
    title: 'Outlook Calendar',
    description: 'Sync salesblocks to your Outlook calendar',
    connectLabel: 'Connect Outlook Calendar',
  },
}

export default function MicrosoftOAuthButton({ integrationType }: MicrosoftOAuthButtonProps) {
  const cfg = CONFIG[integrationType]
  const { user } = useAuth()
  const [connection, setConnection] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const clientId = import.meta.env[cfg.clientIdEnv]
  const redirectUri = import.meta.env[cfg.redirectUriEnv] || `${window.location.origin}${cfg.defaultRedirectPath}`

  const Icon = cfg.icon

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
        .eq('provider', cfg.provider)
        .maybeSingle()

      if (error) throw error
      setConnection(data)
    } catch (err) {
      console.error(`Failed to load ${cfg.title} connection:`, err)
      setError('Failed to load connection status')
    } finally {
      setLoading(false)
    }
  }

  const handleConnect = () => {
    if (!clientId) {
      setError(`${cfg.title} integration not configured. Missing ${cfg.clientIdEnv} environment variable.`)
      return
    }

    const nonce = generateOAuthNonce(cfg.provider)

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: cfg.scopes,
      response_mode: 'query',
      state: JSON.stringify({ user_id: user?.id, nonce }),
    })

    const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`

    const width = 500
    const height = 600
    const left = window.screenX + (window.outerWidth - width) / 2
    const top = window.screenY + (window.outerHeight - height) / 2

    const popup = window.open(authUrl, cfg.popupName, `width=${width},height=${height},left=${left},top=${top}`)

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
      console.error(`Failed to disconnect ${cfg.title}:`, err)
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
            <Icon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h3 className="font-medium text-gray-900 dark:text-white">{cfg.title}</h3>
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
          <Icon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h3 className="font-medium text-gray-900 dark:text-white">{cfg.title}</h3>
          {connection ? (
            <div className="flex items-center space-x-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">
                Connected
              </span>
              {connection.email_address && (
                <span className="text-sm text-gray-600 dark:text-gray-400">{connection.email_address}</span>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-600 dark:text-gray-400">{cfg.description}</p>
          )}
        </div>
      </div>

      <div className="flex items-center space-x-3">
        {error && <span className="text-sm text-red-600 dark:text-red-400">{error}</span>}

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
            {cfg.connectLabel}
          </button>
        )}
      </div>
    </div>
  )
}
