/**
 * @crumb
 * @id frontend-page-salesforce-oauth-callback
 * @area UI/Auth/OAuth
 * @intent Salesforce OAuth callback — receive authorization code from Salesforce, exchange for tokens + instance_url via edge function, show status, close popup
 * @responsibilities Delegate to useOAuthCallback hook with provider='salesforce', render processing/success/error states
 * @contracts SalesforceOAuthCallback() -> JSX; uses useOAuthCallback('salesforce', redirectUri)
 * @in URL search params (code, state, error, error_description), useOAuthCallback hook
 * @out Salesforce access/refresh tokens + instance_url stored via edge function; popup closes on success; error state displayed on failure
 * @shared-edges frontend/src/components/SalesforceOAuthButton.tsx->INITIATES OAuth flow; frontend/src/hooks/useOAuthCallback.ts->HANDLES token exchange
 */
import { useOAuthCallback } from '../hooks/useOAuthCallback'
import OAuthCallbackLayout from '../components/OAuthCallbackLayout'

const SALESFORCE_REDIRECT_URI =
  import.meta.env.VITE_SALESFORCE_REDIRECT_URI ||
  `${window.location.origin}/oauth/salesforce/callback`

export default function SalesforceOAuthCallback() {
  const { status, errorMessage } = useOAuthCallback(
    'salesforce',
    SALESFORCE_REDIRECT_URI
  )

  return (
    <OAuthCallbackLayout
      status={status}
      errorMessage={errorMessage}
      providerName="Salesforce"
    />
  )
}
