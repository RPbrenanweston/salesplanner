/**
 * @crumb
 * @id frontend-component-log-social-activity-modal
 * @area UI/Activities/Social
 * @intent Log social activity modal — record a social interaction (LinkedIn message, Twitter DM, connection request) against a contact, with optional Salesforce sync
 * @responsibilities Render social activity type selector and notes fields, insert social activity into Supabase activities table with type='social', optionally call markActivityForSync for Salesforce users, call onSuccess callback
 * @contracts LogSocialActivityModal({ contactId, salesblockId, userId, orgId, isOpen, onClose, onSuccess }) → JSX; calls supabase.from('activities').insert with type='social'; calls markActivityForSync from lib/salesforce if Salesforce connected
 * @in contactId (string), salesblockId (string), userId (string), orgId (string), isOpen (boolean), onClose callback, onSuccess callback
 * @out New activity row in activities table with type='social' linked to contactId; markActivityForSync called if Salesforce connected; onSuccess called; modal closed
 * @err Supabase insert failure (caught, error shown); markActivityForSync failure (caught separately — Supabase insert may still succeed)
 * @hazard markActivityForSync is called after insert without pre-checking whether the user has Salesforce connected — if unchecked, will attempt sync with no credentials, silently failing or generating backend errors
 * @hazard Social activities are stored with type='social' in the same activities table as calls/emails/notes — if analytics queries don't filter by subtype (LinkedIn vs Twitter vs connection request), social channel breakdown reporting will be inaccurate
 * @shared-edges supabase activities table→INSERTS to; lib/salesforce.ts→CALLS markActivityForSync; frontend/src/components/ContactActivityTimeline.tsx→READS activities logged here; parent page→RENDERS modal
 * @trail log-social#1 | User clicks "Log Social" → LogSocialActivityModal renders → user selects platform + fills notes → handleSave → supabase insert → markActivityForSync (if connected) → onSuccess() → modal closes → timeline updates
 * @prompt Pre-check Salesforce connection before calling markActivityForSync. Add platform-specific subtype field (linkedin_message, twitter_dm, connection_request) to distinguish social channel in activity data.
 */
import { useState } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { markActivityForSync } from '../lib/salesforce';

interface LogSocialActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  contactId: string;
  salesblockId?: string | null;
  userId: string;
  orgId: string;
  onSuccess: () => void;
}

const platformOptions = [
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'twitter', label: 'Twitter / X' },
  { value: 'other', label: 'Other' },
];

const activityTypeOptions = [
  { value: 'connection_request', label: 'Connection Request' },
  { value: 'message_sent', label: 'Message Sent' },
  { value: 'inmail', label: 'InMail' },
  { value: 'comment', label: 'Comment' },
  { value: 'post_engagement', label: 'Post Engagement' },
];

export default function LogSocialActivityModal({
  isOpen,
  onClose,
  contactId,
  salesblockId = null,
  userId,
  orgId,
  onSuccess,
}: LogSocialActivityModalProps) {
  const [platform, setPlatform] = useState<string>('linkedin');
  const [activityType, setActivityType] = useState<string>('message_sent');
  const [notes, setNotes] = useState('');
  const [timestamp, setTimestamp] = useState(() => {
    // Default to current date/time in local timezone
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  });
  const [saving, setSaving] = useState(false);

  const resetAndClose = () => {
    setPlatform('linkedin');
    setActivityType('message_sent');
    setNotes('');
    // Reset to current time
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    setTimestamp(`${year}-${month}-${day}T${hours}:${minutes}`);
    onClose();
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Convert local datetime-local to ISO timestamp
      const isoTimestamp = new Date(timestamp).toISOString();

      // Store platform and activity type in notes as structured format
      const structuredNotes = JSON.stringify({
        platform,
        activity_type: activityType,
        user_notes: notes.trim() || null,
      });

      const { data, error } = await supabase.from('activities').insert({
        org_id: orgId,
        contact_id: contactId,
        user_id: userId,
        salesblock_id: salesblockId,
        type: 'social',
        outcome: 'other',
        notes: structuredNotes,
        created_at: isoTimestamp,
      }).select('id').single();

      if (error) throw error;

      // Mark for Salesforce sync if auto-push enabled
      if (data?.id) {
        markActivityForSync(data.id);
      }

      onSuccess();
      resetAndClose();
    } catch (error) {
      console.error('Error logging social activity:', error);
      alert('Failed to log social activity');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Log Social Activity</h2>
          <button
            onClick={resetAndClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Platform Dropdown */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Platform
            </label>
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              {platformOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Activity Type Dropdown */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Activity Type
            </label>
            <select
              value={activityType}
              onChange={(e) => setActivityType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              {activityTypeOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Timestamp Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Date & Time
            </label>
            <input
              type="datetime-local"
              value={timestamp}
              onChange={(e) => setTimestamp(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          {/* Notes Textarea */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
              placeholder="Add any notes about this social activity..."
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end space-x-3 mt-6">
          <button
            onClick={resetAndClose}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
