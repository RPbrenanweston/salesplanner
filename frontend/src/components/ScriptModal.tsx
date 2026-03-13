// @crumb frontend-component-script-modal
// UI/Content/Scripts | load_existing_script | render_title_body_form | save_script | on_save_callback
// why: Script modal — create or edit a call/meeting script with rich text formatting, save to Supabase scripts table for use during sales calls
// in:isOpen,onClose,onSave,orgId,scriptId (optional) out:New or updated script row,onSave called err:Supabase read failure (form renders empty),Supabase insert/update failure
// hazard: RichTextEditor outputs raw HTML stored in Supabase — unsanitized rendering enables XSS
// hazard: No title uniqueness validation per org — duplicate titles cause confusion in script selector
// edge:frontend/src/components/RichTextEditor.tsx -> RELATES
// edge:frontend/src/pages/Scripts.tsx -> RELATES
// edge:script-edit#1 -> STEP_IN
// prompt: Sanitize HTML before storing (DOMPurify). Add title uniqueness validation. Add script tagging/categorization.
import DOMPurify from 'dompurify';
import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { RichTextEditor } from './RichTextEditor';

interface ScriptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  scriptId?: string | null; // If editing existing script
}

interface CallScript {
  id: string;
  name: string;
  content: string;
  is_shared: boolean;
}

export function ScriptModal({ isOpen, onClose, onSuccess, scriptId }: ScriptModalProps) {
  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  const [isShared, setIsShared] = useState(false);
  const [loading, setLoading] = useState(false);

  // Load existing script if editing
  useEffect(() => {
    if (isOpen && scriptId) {
      loadScript();
    } else if (isOpen && !scriptId) {
      // Reset for new script
      setName('');
      setContent('');
      setIsShared(false);
    }
  }, [isOpen, scriptId]);

  async function loadScript() {
    try {
      const { data, error } = await supabase
        .from('call_scripts')
        .select('*')
        .eq('id', scriptId)
        .single();

      if (error) throw error;

      const script = data as CallScript;
      setName(script.name);
      setContent(DOMPurify.sanitize(script.content));
      setIsShared(script.is_shared);
    } catch (error) {
      console.error('Error loading script:', error);
      alert('Failed to load script');
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: userData } = await supabase
        .from('users')
        .select('org_id')
        .eq('id', user.id)
        .single();

      if (!userData) throw new Error('User data not found');

      if (scriptId) {
        // Update existing script
        const { error } = await supabase
          .from('call_scripts')
          .update({
            name,
            content,
            is_shared: isShared,
          })
          .eq('id', scriptId);

        if (error) throw error;
      } else {
        // Create new script
        const { error } = await supabase
          .from('call_scripts')
          .insert({
            org_id: userData.org_id,
            owner_id: user.id,
            name,
            content,
            is_shared: isShared,
          });

        if (error) throw error;
      }

      onSuccess();
      resetAndClose();
    } catch (error) {
      console.error('Error saving script:', error);
      alert('Failed to save script');
    } finally {
      setLoading(false);
    }
  }

  function resetAndClose() {
    setName('');
    setContent('');
    setIsShared(false);
    onClose();
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {scriptId ? 'Edit Script' : 'Create Call Script'}
          </h2>
          <button
            onClick={resetAndClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Script Name
            </label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="e.g., Discovery Call Script"
            />
          </div>

          {/* Content (Rich Text Editor) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Script Content
            </label>
            <RichTextEditor
              content={content}
              onChange={(html) => setContent(DOMPurify.sanitize(html))}
              placeholder="Write your call script here. Use formatting to organize your talking points..."
            />
          </div>

          {/* Shared */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_shared"
              checked={isShared}
              onChange={(e) => setIsShared(e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="is_shared" className="text-sm text-gray-700 dark:text-gray-300">
              Share with team
            </label>
          </div>

          {/* Actions */}
          <div className="flex gap-3 justify-end pt-4">
            <button
              type="button"
              onClick={resetAndClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim() || !content.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Saving...' : scriptId ? 'Update Script' : 'Create Script'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
