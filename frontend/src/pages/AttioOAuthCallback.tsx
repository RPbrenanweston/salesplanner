/**
 * Attio OAuth Callback — receives authorization code from Attio,
 * delegates to useOAuthCallback for token exchange via edge function.
 * Follows the exact pattern of SalesforceOAuthCallback.tsx.
 */
import { useOAuthCallback } from '../hooks/useOAuthCallback'
import OAuthCallbackLayout from '../components/OAuthCallbackLayout'

const ATTIO_REDIRECT_URI =
  import.meta.env.VITE_ATTIO_REDIRECT_URI ||
  `${window.location.origin}/oauth/attio/callback`

export default function AttioOAuthCallback() {
  const { status, errorMessage } = useOAuthCallback(
    'attio',
    ATTIO_REDIRECT_URI
  )

  return (
    <OAuthCallbackLayout
      status={status}
      errorMessage={errorMessage}
      providerName="Attio"
    />
  )
}
