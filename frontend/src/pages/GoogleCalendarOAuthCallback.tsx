/**
 * @crumb
 * @id frontend-page-google-calendar-oauth-callback
 * @area UI/Auth/OAuth
 * @intent Google Calendar OAuth callback — receive authorization code from Google, exchange for tokens via edge function, show status, close popup
 * @responsibilities Delegate to useOAuthCallback hook with provider='google_calendar', render processing/success/error states
 * @contracts GoogleCalendarOAuthCallback() -> JSX; uses useOAuthCallback('google_calendar', redirectUri)
 * @in URL search params (code, state, error), useOAuthCallback hook
 * @out Google Calendar access/refresh tokens stored via edge function; popup closes on success; error state displayed on failure
 * @shared-edges frontend/src/components/GoogleCalendarOAuthButton.tsx->INITIATES OAuth flow; frontend/src/hooks/useOAuthCallback.ts->HANDLES token exchange
 */
import { useOAuthCallback } from '../hooks/useOAuthCallback'
import OAuthCallbackLayout from '../components/OAuthCallbackLayout'

const GOOGLE_CALENDAR_REDIRECT_URI =
  import.meta.env.VITE_GOOGLE_CALENDAR_REDIRECT_URI ||
  `${window.location.origin}/oauth/google-calendar/callback`

export default function GoogleCalendarOAuthCallback() {
  const { status, errorMessage } = useOAuthCallback(
    'google_calendar',
    GOOGLE_CALENDAR_REDIRECT_URI
  )

  return (
    <OAuthCallbackLayout
      status={status}
      errorMessage={errorMessage}
      providerName="Google Calendar"
    />
  )
}
