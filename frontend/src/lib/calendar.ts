import { supabase } from './supabase';

/**
 * Calendar API wrapper for Google Calendar and Microsoft Outlook Calendar.
 * Handles event creation, updates, and deletion via OAuth-connected accounts.
 */

interface CalendarEvent {
  title: string;
  description: string;
  start: string; // ISO 8601 datetime
  end: string;   // ISO 8601 datetime
}

interface CalendarEventResponse {
  eventId: string;
  provider: 'google_calendar' | 'outlook_calendar';
}

/**
 * Get user's connected calendar OAuth connection (Google or Outlook)
 */
async function getCalendarConnection(): Promise<{
  provider: 'google_calendar' | 'outlook_calendar';
  accessToken: string;
} | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Check for Google Calendar connection first
  const { data: googleConn } = await supabase
    .from('oauth_connections')
    .select('*')
    .eq('user_id', user.id)
    .eq('provider', 'google_calendar')
    .maybeSingle();

  if (googleConn) {
    return {
      provider: 'google_calendar',
      accessToken: googleConn.access_token,
    };
  }

  // Fallback to Outlook Calendar
  const { data: outlookConn } = await supabase
    .from('oauth_connections')
    .select('*')
    .eq('user_id', user.id)
    .eq('provider', 'outlook_calendar')
    .maybeSingle();

  if (outlookConn) {
    return {
      provider: 'outlook_calendar',
      accessToken: outlookConn.access_token,
    };
  }

  return null;
}

/**
 * Create calendar event via Google Calendar or Outlook Calendar API
 */
export async function createCalendarEvent(
  event: CalendarEvent
): Promise<CalendarEventResponse | null> {
  const connection = await getCalendarConnection();
  if (!connection) {
    console.warn('No calendar connection found');
    return null;
  }

  if (connection.provider === 'google_calendar') {
    return createGoogleCalendarEvent(connection.accessToken, event);
  } else {
    return createOutlookCalendarEvent(connection.accessToken, event);
  }
}

/**
 * Update calendar event (reschedule)
 */
export async function updateCalendarEvent(
  eventId: string,
  provider: 'google_calendar' | 'outlook_calendar',
  event: CalendarEvent
): Promise<boolean> {
  const connection = await getCalendarConnection();
  if (!connection || connection.provider !== provider) {
    console.warn('Calendar connection mismatch or missing');
    return false;
  }

  if (provider === 'google_calendar') {
    return updateGoogleCalendarEvent(connection.accessToken, eventId, event);
  } else {
    return updateOutlookCalendarEvent(connection.accessToken, eventId, event);
  }
}

/**
 * Delete calendar event (cancel salesblock)
 */
export async function deleteCalendarEvent(
  eventId: string,
  provider: 'google_calendar' | 'outlook_calendar'
): Promise<boolean> {
  const connection = await getCalendarConnection();
  if (!connection || connection.provider !== provider) {
    console.warn('Calendar connection mismatch or missing');
    return false;
  }

  if (provider === 'google_calendar') {
    return deleteGoogleCalendarEvent(connection.accessToken, eventId);
  } else {
    return deleteOutlookCalendarEvent(connection.accessToken, eventId);
  }
}

// ============================================================================
// Google Calendar API Functions
// ============================================================================

async function createGoogleCalendarEvent(
  accessToken: string,
  event: CalendarEvent
): Promise<CalendarEventResponse | null> {
  try {
    const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        summary: event.title,
        description: event.description,
        start: {
          dateTime: event.start,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        end: {
          dateTime: event.end,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
      }),
    });

    if (!response.ok) {
      console.error('Google Calendar API error:', await response.text());
      return null;
    }

    const data = await response.json();
    return {
      eventId: data.id,
      provider: 'google_calendar',
    };
  } catch (error) {
    console.error('Failed to create Google Calendar event:', error);
    return null;
  }
}

async function updateGoogleCalendarEvent(
  accessToken: string,
  eventId: string,
  event: CalendarEvent
): Promise<boolean> {
  try {
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          summary: event.title,
          description: event.description,
          start: {
            dateTime: event.start,
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          },
          end: {
            dateTime: event.end,
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          },
        }),
      }
    );

    return response.ok;
  } catch (error) {
    console.error('Failed to update Google Calendar event:', error);
    return false;
  }
}

async function deleteGoogleCalendarEvent(
  accessToken: string,
  eventId: string
): Promise<boolean> {
  try {
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    return response.ok || response.status === 404; // 404 = already deleted
  } catch (error) {
    console.error('Failed to delete Google Calendar event:', error);
    return false;
  }
}

// ============================================================================
// Outlook Calendar API Functions
// ============================================================================

async function createOutlookCalendarEvent(
  accessToken: string,
  event: CalendarEvent
): Promise<CalendarEventResponse | null> {
  try {
    const response = await fetch('https://graph.microsoft.com/v1.0/me/events', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        subject: event.title,
        body: {
          contentType: 'Text',
          content: event.description,
        },
        start: {
          dateTime: event.start,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        end: {
          dateTime: event.end,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
      }),
    });

    if (!response.ok) {
      console.error('Outlook Calendar API error:', await response.text());
      return null;
    }

    const data = await response.json();
    return {
      eventId: data.id,
      provider: 'outlook_calendar',
    };
  } catch (error) {
    console.error('Failed to create Outlook Calendar event:', error);
    return null;
  }
}

async function updateOutlookCalendarEvent(
  accessToken: string,
  eventId: string,
  event: CalendarEvent
): Promise<boolean> {
  try {
    const response = await fetch(
      `https://graph.microsoft.com/v1.0/me/events/${eventId}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subject: event.title,
          body: {
            contentType: 'Text',
            content: event.description,
          },
          start: {
            dateTime: event.start,
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          },
          end: {
            dateTime: event.end,
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          },
        }),
      }
    );

    return response.ok;
  } catch (error) {
    console.error('Failed to update Outlook Calendar event:', error);
    return false;
  }
}

async function deleteOutlookCalendarEvent(
  accessToken: string,
  eventId: string
): Promise<boolean> {
  try {
    const response = await fetch(
      `https://graph.microsoft.com/v1.0/me/events/${eventId}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    return response.ok || response.status === 404; // 404 = already deleted
  } catch (error) {
    console.error('Failed to delete Outlook Calendar event:', error);
    return false;
  }
}
