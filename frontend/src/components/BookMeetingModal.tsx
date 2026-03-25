// @crumb frontend-component-book-meeting-modal
// UI/Meetings | date_time_picker | calendar_event_creation | activity_logging | on_booked_callback
// why: Book meeting modal — schedule a meeting with a contact by selecting a time slot and creating a calendar event via the calendar integration
// in:contactId,useAuth (userId),lib/calendar.createCalendarEvent,supabase activities table out:Calendar event created,activity log entry,onBooked called err:createCalendarEvent failure (no calendar, expired token, API error),Supabase activity insert failure
// hazard: createCalendarEvent silently fails if no calendar connected — user thinks meeting was booked but no event exists
// hazard: Meeting time in browser local timezone with no explicit conversion — cross-timezone contacts get wrong slot
// edge:frontend/src/lib/calendar.ts -> CALLS
// edge:frontend/src/hooks/useAuth.ts -> READS
// edge:book-meeting#1 -> STEP_IN
// prompt: Pre-check for connected calendar before rendering form. Add explicit timezone display and conversion. Log activity even if calendar event fails.
import { useState, useEffect } from 'react';
import { X, Calendar, Clock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { createCalendarEvent, getCalendarConnection } from '../lib/calendar';
import { markActivityForSync } from '../lib/salesforce';
import { DURATION, ACTIVITY_OUTCOME } from '../lib/constants';
import { logError } from '../lib/error-logger';

interface BookMeetingModalProps {
  isOpen: boolean;
  onClose: () => void;
  contact: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  };
  salesblockId?: string | null;
  onSuccess?: () => void;
}

export default function BookMeetingModal({
  isOpen,
  onClose,
  contact,
  salesblockId,
  onSuccess,
}: BookMeetingModalProps) {
  const { user: _user } = useAuth();
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [duration, setDuration] = useState(String(DURATION.DEFAULT_SALESBLOCK_MINUTES));
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [calendarStatus, setCalendarStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');

  const checkingCalendar = calendarStatus === 'checking';
  const calendarDisconnected = calendarStatus === 'disconnected';

  useEffect(() => {
    if (!isOpen) return;

    // Set form defaults
    const defaultTitle = `Meeting with ${contact.first_name} ${contact.last_name}`;
    setTitle(defaultTitle);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setDate(tomorrow.toISOString().split('T')[0]);
    setTime('10:00');

    // Pre-check calendar connection before user fills in the form
    setCalendarStatus('checking');
    getCalendarConnection().then((connection) => {
      setCalendarStatus(connection ? 'connected' : 'disconnected');
    });
  }, [isOpen, contact]);

  const handleSave = async () => {
    setError('');

    if (!title || !date || !time) {
      setError('Please fill in all required fields');
      return;
    }

    setIsSaving(true);

    try {
      // Combine date and time
      const scheduledStart = new Date(`${date}T${time}`);
      const scheduledEnd = new Date(scheduledStart.getTime() + parseInt(duration) * 60000);

      // Create calendar event — check for expired/missing connection
      const calendarResult = await createCalendarEvent({
        title,
        description: description || `Meeting with ${contact.first_name} ${contact.last_name} (${contact.email})`,
        start: scheduledStart.toISOString(),
        end: scheduledEnd.toISOString(),
      });

      if (!calendarResult) {
        setCalendarStatus('disconnected');
        setError('Calendar disconnected — reconnect in Settings to book meetings.');
        setIsSaving(false);
        return;
      }

      // Log meeting activity
      const { data: userData } = await supabase.auth.getUser();
      const { data: dbUser } = await supabase
        .from('users')
        .select('org_id')
        .eq('id', userData.user?.id)
        .single();

      const { data: activityData, error: activityError } = await supabase.from('activities').insert({
        org_id: dbUser?.org_id,
        contact_id: contact.id,
        user_id: userData.user?.id,
        salesblock_id: salesblockId || null,
        type: 'meeting',
        outcome: ACTIVITY_OUTCOME.MEETING_BOOKED,
        notes: `Meeting scheduled: ${title}${description ? ` - ${description}` : ''}`,
        created_at: new Date().toISOString(),
      }).select('id').single();

      if (activityError) throw activityError;

      // Mark for Salesforce sync if auto-push enabled
      if (activityData?.id) {
        markActivityForSync(activityData.id);
      }

      onSuccess?.();
      resetAndClose();
    } catch (err: any) {
      logError(err, 'BookMeetingModal.handleSave');
      setError(err.message || 'Failed to book meeting');
    } finally {
      setIsSaving(false);
    }
  };

  const resetAndClose = () => {
    setTitle('');
    setDate('');
    setTime('');
    setDuration(String(DURATION.DEFAULT_SALESBLOCK_MINUTES));
    setDescription('');
    setError('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Book Meeting</h2>
          </div>
          <button
            onClick={resetAndClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {calendarDisconnected && (
            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-amber-700 dark:text-amber-400 text-sm">
              Calendar disconnected &mdash; <a href="/settings" className="underline font-medium hover:text-amber-800 dark:hover:text-amber-300">reconnect in Settings</a> to book meetings.
            </div>
          )}

          {error && !calendarDisconnected && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          {calendarStatus === 'checking' && (
            <div className="p-3 bg-gray-50 dark:bg-gray-700/40 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-500 dark:text-gray-400 text-sm flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
              Checking calendar connection…
            </div>
          )}

          {calendarStatus === 'disconnected' && (
            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-amber-700 dark:text-amber-400 text-sm">
              <strong>No calendar connected.</strong> Meeting will be logged as an activity but no calendar event will be created.{' '}
              <a href="/settings" className="underline font-medium hover:text-amber-900 dark:hover:text-amber-300">
                Connect a calendar in Settings →
              </a>
            </div>
          )}

          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-blue-700 dark:text-blue-400 text-sm">
            Booking meeting with <strong>{contact.first_name} {contact.last_name}</strong> ({contact.email})
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:text-gray-100"
              placeholder="Meeting title"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:text-gray-100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Time <span className="text-red-500">*</span>
              </label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:text-gray-100"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Duration
            </label>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              <select
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:text-gray-100"
              >
                <option value="15">15 minutes</option>
                <option value="30">30 minutes</option>
                <option value="45">45 minutes</option>
                <option value="60">1 hour</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:text-gray-100"
              placeholder="Meeting agenda or notes"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={resetAndClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || calendarDisconnected || checkingCalendar}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Calendar className="w-4 h-4" />
            {checkingCalendar ? 'Checking calendar...' : isSaving ? 'Booking...' : calendarDisconnected ? 'Calendar Disconnected' : 'Book Meeting'}
          </button>
        </div>
      </div>
    </div>
  );
}
