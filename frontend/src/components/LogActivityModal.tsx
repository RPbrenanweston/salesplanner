/**
 * @crumb
 * @id frontend-component-log-activity-modal
 * @area UI/Activities
 * @intent Log activity modal — record a sales activity (call, email, meeting, note) against a contact, with optional Salesforce sync
 * @responsibilities Render activity type selector and notes/outcome fields, insert activity into Supabase activities table, optionally call markActivityForSync for Salesforce users, call onLogged callback
 * @contracts LogActivityModal({ contactId, salesBlockId?, onClose, onLogged }) → JSX; calls supabase.from('activities').insert; calls markActivityForSync from lib/salesforce if Salesforce connected
 * @in contactId (string), salesBlockId (optional string), supabase activities table, lib/salesforce.markActivityForSync (conditional), onClose callback, onLogged callback
 * @out New activity row in activities table linked to contactId; markActivityForSync called if Salesforce connected; onLogged called; modal closed
 * @err Supabase insert failure (caught, error shown); markActivityForSync failure (caught separately — Supabase insert may still succeed)
 * @hazard markActivityForSync is called after the Supabase insert regardless of whether the user has Salesforce connected — if the connection check is missing or async race condition, it may attempt to sync with no Salesforce credentials, silently failing
 * @hazard Activity type options are hardcoded in the component — if new activity types are added to the Supabase activities table (e.g. "LinkedIn message"), the modal will not include them without a code change
 * @shared-edges supabase activities table→INSERTS to; lib/salesforce.ts→CALLS markActivityForSync; frontend/src/components/ContactActivityTimeline.tsx→READS activities logged here; parent page→RENDERS modal
 * @trail log-activity#1 | User clicks "Log Activity" → LogActivityModal renders → user selects type + fills notes → handleLog → supabase insert → markActivityForSync (if connected) → onLogged() → modal closes → timeline updates
 * @prompt Pre-check Salesforce connection before calling markActivityForSync. Make activity types configurable via org settings. Add outcome field for calls.
 */
import { useState } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { markActivityForSync } from '../lib/salesforce';

interface LogActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  contactId: string;
  salesblockId: string;
  userId: string;
  orgId: string;
  activityType: 'call' | 'email' | 'social' | 'note';
  onSuccess: () => void;
}

const outcomeOptions: Record<string, string[]> = {
  call: ['no_answer', 'voicemail', 'connect', 'conversation', 'meeting_booked', 'not_interested', 'follow_up', 'other'],
  email: ['other'],
  social: ['other'],
  note: ['other'],
};

const outcomeLabels: Record<string, string> = {
  no_answer: 'No Answer',
  voicemail: 'Voicemail',
  connect: 'Connect',
  conversation: 'Conversation',
  meeting_booked: 'Meeting Booked',
  not_interested: 'Not Interested',
  follow_up: 'Follow Up',
  other: 'Other',
};

export default function LogActivityModal({
  isOpen,
  onClose,
  contactId,
  salesblockId,
  userId,
  orgId,
  activityType,
  onSuccess,
}: LogActivityModalProps) {
  const [outcome, setOutcome] = useState<string>('other');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const resetAndClose = () => {
    setOutcome('other');
    setNotes('');
    onClose();
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data, error } = await supabase.from('activities').insert({
        org_id: orgId,
        contact_id: contactId,
        user_id: userId,
        salesblock_id: salesblockId,
        type: activityType,
        outcome,
        notes: notes.trim() || null,
      }).select('id').single();

      if (error) throw error;

      // Mark for Salesforce sync if auto-push enabled
      if (data?.id) {
        markActivityForSync(data.id); // Non-blocking, logs errors internally
      }

      onSuccess();
      resetAndClose();
    } catch (error) {
      console.error('Error logging activity:', error);
      alert('Failed to log activity');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const typeLabel = activityType.charAt(0).toUpperCase() + activityType.slice(1);
  const availableOutcomes = outcomeOptions[activityType] || ['other'];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Log {typeLabel}</h2>
          <button
            onClick={resetAndClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Outcome Dropdown (only for call) */}
          {activityType === 'call' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Outcome
              </label>
              <select
                value={outcome}
                onChange={(e) => setOutcome(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                {availableOutcomes.map((opt) => (
                  <option key={opt} value={opt}>
                    {outcomeLabels[opt] || opt}
                  </option>
                ))}
              </select>
            </div>
          )}

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
              placeholder="Add any notes about this activity..."
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
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
