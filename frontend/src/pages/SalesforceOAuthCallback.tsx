// @crumb frontend-page-salesforce-oauth-callback
// UI/AUTH/OAUTH | delegate_to_useOAuthCallback | render_processing_success_error_states
// why: Salesforce OAuth callback — receive authorization code from Salesforce, exchange for tokens + instance_url via edge function
// in:URL search params(code,state,error,error_description),useOAuthCallback hook out:Salesforce access/refresh tokens+instance_url stored via edge function,popup closes on success err:OAuth error from Salesforce,edge function failure
// hazard: Redirect URI mismatch — if VITE_SALESFORCE_REDIRECT_URI missing, falls back to window.location.origin/oauth/salesforce/callback (line 12), but Salesforce app config may expect different domain (staging vs prod)
// hazard: No instance_url handling — hook returns instance_url but component doesn't store it; Salesforce API calls need instanceUrl per tenant, will fail on next API call
// edge:frontend/src/components/SalesforceOAuthButton.tsx -> RELATES
// edge:frontend/src/hooks/useOAuthCallback.ts -> CALLS
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
