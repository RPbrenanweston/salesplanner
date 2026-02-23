import { useState, useEffect } from 'react';
import { X, Calendar, Clock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { createCalendarEvent } from '../lib/calendar';
import { markActivityForSync } from '../lib/salesforce';

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
  const [duration, setDuration] = useState('30');
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      // Set defaults
      const defaultTitle = `Meeting with ${contact.first_name} ${contact.last_name}`;
      setTitle(defaultTitle);

      // Set default date to tomorrow
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      setDate(tomorrow.toISOString().split('T')[0]);

      // Set default time to 10:00 AM
      setTime('10:00');
    }
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

      // Create calendar event
      await createCalendarEvent({
        title,
        description: description || `Meeting with ${contact.first_name} ${contact.last_name} (${contact.email})`,
        start: scheduledStart.toISOString(),
        end: scheduledEnd.toISOString(),
      });

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
        outcome: 'meeting_booked',
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
      console.error('Error booking meeting:', err);
      setError(err.message || 'Failed to book meeting');
    } finally {
      setIsSaving(false);
    }
  };

  const resetAndClose = () => {
    setTitle('');
    setDate('');
    setTime('');
    setDuration('30');
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
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
              {error}
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
            disabled={isSaving}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Calendar className="w-4 h-4" />
            {isSaving ? 'Booking...' : 'Book Meeting'}
          </button>
        </div>
      </div>
    </div>
  );
}
