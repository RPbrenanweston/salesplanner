// @crumb frontend-component-log-activity-modal
// UI/Activities | activity_type_selector | notes_outcome_fields | supabase_insert | salesforce_sync | on_logged_callback
// why: Log activity modal — record a sales activity (call, email, meeting, note) against a contact, with optional Salesforce sync
// in:contactId,salesBlockId (optional),supabase activities table,lib/salesforce.markActivityForSync out:New activity row,markActivityForSync called,onLogged called err:Supabase insert failure,markActivityForSync failure (insert may still succeed)
// hazard: markActivityForSync called without pre-checking Salesforce connection — silently fails with no credentials
// hazard: Activity type options hardcoded — new types require code change, not configurable
// edge:frontend/src/lib/salesforce.ts -> CALLS
// edge:frontend/src/components/ContactActivityTimeline.tsx -> RELATES
// edge:log-activity#1 -> STEP_IN
// prompt: Pre-check Salesforce connection before calling markActivityForSync. Make activity types configurable via org settings. Add outcome field for calls.
import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { markActivityForSync, getSalesforceConnection } from '../lib/salesforce';
import { toast } from '../hooks/use-toast';

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
  const [salesforceConnected, setSalesforceConnected] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    getSalesforceConnection().then((conn) => setSalesforceConnected(!!conn));
  }, [isOpen]);

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

      // Mark for Salesforce sync only if a connection is confirmed
      if (data?.id && salesforceConnected) {
        markActivityForSync(data.id); // Non-blocking, logs errors internally
      }

      onSuccess();
      resetAndClose();
    } catch (error) {
      console.error('Error logging activity:', error);
      toast({ variant: 'destructive', title: 'Failed to log activity', description: error instanceof Error ? error.message : undefined });
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
