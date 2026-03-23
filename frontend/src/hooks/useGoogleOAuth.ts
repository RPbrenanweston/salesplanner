// @crumb frontend-hook-use-google-oauth
// Hooks/OAuth | load_connection | initiate_oauth_popup | disconnect
// why: Shared Google OAuth hook — Gmail and Google Calendar OAuth flows share identical structure differing only in provider, scopes, and client_id
// in:provider('gmail'|'google_calendar'),useAuth (user_id),supabase oauth_connections out:initiateOAuth,connectionStatus,disconnect
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import { generateOAuthNonce } from '../lib/oauth-csrf'

type GoogleProvider = 'gmail' | 'google_calendar'

interface OAuthConfig {
  provider: GoogleProvider
  clientIdEnv: string
  redirectUriEnv: string
  defaultRedirectPath: string
  scopes: string
  popupName: string
}

const CONFIGS: Record<GoogleProvider, OAuthConfig> = {
  gmail: {
    provider: 'gmail',
    clientIdEnv: 'VITE_GMAIL_CLIENT_ID',
    redirectUriEnv: 'VITE_GMAIL_REDIRECT_URI',
    defaultRedirectPath: '/oauth/gmail/callback',
    scopes: 'https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly',
    popupName: 'Gmail OAuth',
  },
  google_calendar: {
    provider: 'google_calendar',
    clientIdEnv: 'VITE_GOOGLE_CALENDAR_CLIENT_ID',
    redirectUriEnv: 'VITE_GOOGLE_CALENDAR_REDIRECT_URI',
    defaultRedirectPath: '/oauth/google-calendar/callback',
    scopes: 'https://www.googleapis.com/auth/calendar.events',
    popupName: 'Google Calendar OAuth',
  },
}

export interface GoogleOAuthConnectionStatus {
  connection: Record<string, unknown> | null
  loading: boolean
  error: string | null
}

export interface UseGoogleOAuthReturn {
  connectionStatus: GoogleOAuthConnectionStatus
  initiateOAuth: () => void
  disconnect: () => Promise<void>
}

export function useGoogleOAuth(provider: GoogleProvider): UseGoogleOAuthReturn {
  const cfg = CONFIGS[provider]
  const { user } = useAuth()
  const [connection, setConnection] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const clientId = import.meta.env[cfg.clientIdEnv]
  const redirectUri = import.meta.env[cfg.redirectUriEnv] || `${window.location.origin}${cfg.defaultRedirectPath}`

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
      console.error(`Failed to load ${cfg.provider} connection:`, err)
      setError('Failed to load connection status')
    } finally {
      setLoading(false)
    }
  }

  const initiateOAuth = () => {
    if (!clientId) {
      setError(`Integration not configured. Missing ${cfg.clientIdEnv} environment variable.`)
      return
    }

    const nonce = generateOAuthNonce(cfg.provider)

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: cfg.scopes,
      access_type: 'offline',
      prompt: 'consent',
      state: JSON.stringify({ user_id: user?.id, nonce }),
    })

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`

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

  const disconnect = async () => {
    if (!connection) return

    try {
      setLoading(true)
      const { error } = await supabase
        .from('oauth_connections')
        .delete()
        .eq('id', connection.id as string)

      if (error) throw error
      setConnection(null)
      setError(null)
    } catch (err) {
      console.error(`Failed to disconnect ${cfg.provider}:`, err)
      setError('Failed to disconnect. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return {
    connectionStatus: { connection, loading, error },
    initiateOAuth,
    disconnect,
  }
}
