// @crumb frontend-calendar-integration
// INF | event_lifecycle_crud | oauth_provider_selection | free_busy_calculation | availability_formatting
// why: Unified OAuth wrapper for Google Calendar v3 and Microsoft Outlook Graph APIs enabling event CRUD and free/busy slot calculation
// in:OAuth tokens,CalendarEvent objects,time range parameters out:CalendarEventResponse,TimeSlot[],formatted availability string err:OAuth token expiration (401);API rate limits (429);timezone handling errors on slot calculation
// hazard: Free/busy algorithm assumes UTC conversion — timezone mismatches on DST transitions can cause double-booking; formatAvailabilityText hardcoded to 6 slots
// hazard: Provider selection race — getCalendarConnection may return expired token before refresh completes; createCalendarEvent fails with 401 but no automatic retry
// edge:calendar-integration#1 -> STEP_IN
// prompt: When adding multi-calendar support, ensure free/busy queries aggregate across ALL accounts. Verify timezone normalization before slot comparison — test DST transitions. Add exponential backoff retry for transient 429/503 errors.

import { getValidToken } from './token-refresh';

/**
 * Calendar API wrapper for Google Calendar and Microsoft Outlook Calendar.
 * Handles event creation, updates, and deletion via OAuth-connected accounts.
 * Uses getValidToken() for automatic token refresh before API calls.
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
 * Get user's connected calendar OAuth connection (Google or Outlook).
 * Uses getValidToken() which auto-refreshes expired tokens.
 */
async function getCalendarConnection(): Promise<{
  provider: 'google_calendar' | 'outlook_calendar';
  accessToken: string;
} | null> {
  // Try Google Calendar first (with auto-refresh)
  const googleToken = await getValidToken('google_calendar');
  if (googleToken) {
    return {
      provider: 'google_calendar',
      accessToken: googleToken,
    };
  }

  // Fallback to Outlook Calendar (with auto-refresh)
  const outlookToken = await getValidToken('outlook_calendar');
  if (outlookToken) {
    return {
      provider: 'outlook_calendar',
      accessToken: outlookToken,
    };
  }

  return null;
}

/**
 * Check if user has an active (non-expired) calendar connection.
 * Returns the provider name if connected, null otherwise.
 */
export async function checkCalendarConnection(): Promise<'google_calendar' | 'outlook_calendar' | null> {
  const connection = await getCalendarConnection();
  return connection?.provider ?? null;
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

// ============================================================================
// Free/Busy and Availability Functions
// ============================================================================

export interface TimeSlot {
  start: string; // ISO 8601
  end: string;   // ISO 8601
}

/**
 * Get free/busy information from calendar for the next N days
 */
export async function getFreeBusySlots(daysAhead: number = 7): Promise<TimeSlot[] | null> {
  const connection = await getCalendarConnection();
  if (!connection) {
    console.warn('No calendar connection found');
    return null;
  }

  const timeMin = new Date();
  const timeMax = new Date();
  timeMax.setDate(timeMax.getDate() + daysAhead);

  if (connection.provider === 'google_calendar') {
    return getGoogleFreeBusy(connection.accessToken, timeMin.toISOString(), timeMax.toISOString());
  } else {
    return getOutlookFreeBusy(connection.accessToken, timeMin.toISOString(), timeMax.toISOString());
  }
}

async function getGoogleFreeBusy(
  accessToken: string,
  timeMin: string,
  timeMax: string
): Promise<TimeSlot[]> {
  try {
    const response = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        timeMin,
        timeMax,
        items: [{ id: 'primary' }],
      }),
    });

    if (!response.ok) {
      console.error('Google FreeBusy API error:', await response.text());
      return [];
    }

    const data = await response.json();
    const busySlots: TimeSlot[] = data.calendars?.primary?.busy || [];

    // Convert busy slots to free slots
    return convertBusyToFreeSlots(busySlots, timeMin, timeMax);
  } catch (error) {
    console.error('Failed to fetch Google FreeBusy:', error);
    return [];
  }
}

async function getOutlookFreeBusy(
  accessToken: string,
  timeMin: string,
  timeMax: string
): Promise<TimeSlot[]> {
  try {
    const response = await fetch(
      `https://graph.microsoft.com/v1.0/me/calendarview?startDateTime=${encodeURIComponent(
        timeMin
      )}&endDateTime=${encodeURIComponent(timeMax)}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Prefer: 'outlook.timezone="' + Intl.DateTimeFormat().resolvedOptions().timeZone + '"',
        },
      }
    );

    if (!response.ok) {
      console.error('Outlook CalendarView API error:', await response.text());
      return [];
    }

    const data = await response.json();
    const busySlots: TimeSlot[] = (data.value || []).map((event: any) => ({
      start: event.start.dateTime,
      end: event.end.dateTime,
    }));

    return convertBusyToFreeSlots(busySlots, timeMin, timeMax);
  } catch (error) {
    console.error('Failed to fetch Outlook FreeBusy:', error);
    return [];
  }
}

/**
 * Convert busy slots to free slots during business hours (9am-5pm Mon-Fri)
 */
function convertBusyToFreeSlots(
  busySlots: TimeSlot[],
  timeMin: string,
  timeMax: string
): TimeSlot[] {
  const freeSlots: TimeSlot[] = [];
  const start = new Date(timeMin);
  const end = new Date(timeMax);

  // Generate business hours slots for each weekday
  const currentDate = new Date(start);
  currentDate.setHours(0, 0, 0, 0);

  while (currentDate < end) {
    const dayOfWeek = currentDate.getDay();

    // Skip weekends
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      const dayStart = new Date(currentDate);
      dayStart.setHours(9, 0, 0, 0);
      const dayEnd = new Date(currentDate);
      dayEnd.setHours(17, 0, 0, 0);

      // Check if this business hour slot overlaps with any busy slot
      const slotStart = dayStart.getTime();
      const slotEnd = dayEnd.getTime();

      let currentFreeStart = slotStart;

      // Sort busy slots by start time
      const sortedBusy = busySlots
        .filter((busy) => {
          const busyStart = new Date(busy.start).getTime();
          const busyEnd = new Date(busy.end).getTime();
          return busyEnd > slotStart && busyStart < slotEnd;
        })
        .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

      // Find free gaps between busy slots
      for (const busy of sortedBusy) {
        const busyStart = Math.max(new Date(busy.start).getTime(), slotStart);
        const busyEnd = Math.min(new Date(busy.end).getTime(), slotEnd);

        if (currentFreeStart < busyStart) {
          // Free slot before this busy period
          freeSlots.push({
            start: new Date(currentFreeStart).toISOString(),
            end: new Date(busyStart).toISOString(),
          });
        }

        currentFreeStart = Math.max(currentFreeStart, busyEnd);
      }

      // Add remaining free time after last busy slot
      if (currentFreeStart < slotEnd) {
        freeSlots.push({
          start: new Date(currentFreeStart).toISOString(),
          end: new Date(slotEnd).toISOString(),
        });
      }
    }

    // Move to next day
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return freeSlots;
}

/**
 * Format free slots as human-readable text for email insertion
 */
export function formatAvailabilityText(slots: TimeSlot[], maxSlots: number = 6): string {
  if (slots.length === 0) {
    return 'No availability found in the next 7 days.';
  }

  const slotTexts: string[] = [];

  for (let i = 0; i < Math.min(slots.length, maxSlots); i++) {
    const slot = slots[i];
    const start = new Date(slot.start);
    const end = new Date(slot.end);

    // Format: "Monday, Jan 15 - 9:00 AM to 12:00 PM"
    const dateStr = start.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    });
    const startTime = start.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    const endTime = end.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    slotTexts.push(`${dateStr} - ${startTime} to ${endTime}`);
  }

  return slotTexts.join('\n');
}
