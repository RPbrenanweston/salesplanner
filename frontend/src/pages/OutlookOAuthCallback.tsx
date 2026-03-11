/**
 * @crumb
 * @id frontend-page-outlook-oauth-callback
 * @area UI/Auth/OAuth
 * @intent Outlook OAuth callback — receive authorization code from Microsoft, exchange for tokens via edge function, show status, close popup
 * @responsibilities Delegate to useOAuthCallback hook with provider='outlook', render processing/success/error states
 * @contracts OutlookOAuthCallback() -> JSX; uses useOAuthCallback('outlook', redirectUri)
 * @in URL search params (code, state, error, error_description), useOAuthCallback hook
 * @out Outlook access/refresh tokens stored via edge function; popup closes on success; error state displayed on failure
 * @shared-edges frontend/src/components/OutlookOAuthButton.tsx->INITIATES OAuth flow; frontend/src/hooks/useOAuthCallback.ts->HANDLES token exchange
 */
import { useOAuthCallback } from '../hooks/useOAuthCallback'
import OAuthCallbackLayout from '../components/OAuthCallbackLayout'

const OUTLOOK_REDIRECT_URI =
  import.meta.env.VITE_OUTLOOK_REDIRECT_URI ||
  `${window.location.origin}/oauth/outlook/callback`

export default function OutlookOAuthCallback() {
  const { status, errorMessage } = useOAuthCallback(
    'outlook',
    OUTLOOK_REDIRECT_URI
  )

  return (
    <OAuthCallbackLayout
      status={status}
      errorMessage={errorMessage}
      providerName="Outlook"
    />
  )
}
