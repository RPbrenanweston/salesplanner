/**
 * @crumb
 * @id frontend-page-outlook-calendar-oauth-callback
 * @area UI/Auth/OAuth
 * @intent Outlook Calendar OAuth callback — receive authorization code from Microsoft, exchange for tokens via edge function, show status, close popup
 * @responsibilities Delegate to useOAuthCallback hook with provider='outlook_calendar', render processing/success/error states
 * @contracts OutlookCalendarOAuthCallback() -> JSX; uses useOAuthCallback('outlook_calendar', redirectUri)
 * @in URL search params (code, state, error, error_description), useOAuthCallback hook
 * @out Outlook Calendar access/refresh tokens stored via edge function; popup closes on success; error state displayed on failure
 * @shared-edges frontend/src/components/OutlookCalendarOAuthButton.tsx->INITIATES OAuth flow; frontend/src/hooks/useOAuthCallback.ts->HANDLES token exchange
 */
import { useOAuthCallback } from '../hooks/useOAuthCallback'
import OAuthCallbackLayout from '../components/OAuthCallbackLayout'

const OUTLOOK_CALENDAR_REDIRECT_URI =
  import.meta.env.VITE_OUTLOOK_CALENDAR_REDIRECT_URI ||
  `${window.location.origin}/oauth/outlook-calendar/callback`

export default function OutlookCalendarOAuthCallback() {
  const { status, errorMessage } = useOAuthCallback(
    'outlook_calendar',
    OUTLOOK_CALENDAR_REDIRECT_URI
  )

  return (
    <OAuthCallbackLayout
      status={status}
      errorMessage={errorMessage}
      providerName="Outlook Calendar"
    />
  )
}
