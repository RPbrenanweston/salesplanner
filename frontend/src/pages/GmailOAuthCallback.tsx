/**
 * @crumb
 * @id frontend-page-gmail-oauth-callback
 * @area UI/Auth/OAuth
 * @intent Gmail OAuth callback — receive authorization code from Google, exchange for tokens via edge function, show status, close popup
 * @responsibilities Delegate to useOAuthCallback hook with provider='gmail', render processing/success/error states
 * @contracts GmailOAuthCallback() -> JSX; uses useOAuthCallback('gmail', redirectUri)
 * @in URL search params (code, state, error), useOAuthCallback hook
 * @out Gmail access/refresh tokens stored via edge function; popup closes on success; error state displayed on failure
 * @shared-edges frontend/src/components/GmailOAuthButton.tsx->INITIATES OAuth flow; frontend/src/hooks/useOAuthCallback.ts->HANDLES token exchange
 */
import { useOAuthCallback } from '../hooks/useOAuthCallback'
import OAuthCallbackLayout from '../components/OAuthCallbackLayout'

const GMAIL_REDIRECT_URI =
  import.meta.env.VITE_GMAIL_REDIRECT_URI ||
  `${window.location.origin}/oauth/gmail/callback`

export default function GmailOAuthCallback() {
  const { status, errorMessage } = useOAuthCallback('gmail', GMAIL_REDIRECT_URI)

  return (
    <OAuthCallbackLayout
      status={status}
      errorMessage={errorMessage}
      providerName="Gmail"
    />
  )
}
