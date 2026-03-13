// @crumb frontend-page-scripts
// UI/PAGES | load_user_scripts | render_script_cards | create_edit_modal | delete_scripts
// why: Call script library — create, edit, share, and delete reusable call scripts for sales reps
// in:supabase(call_scripts table,auth.getUser),ScriptModal out:grid of script cards with name,content preview,shared badge,edit/delete actions err:Supabase load failure(silent empty list),delete error(no feedback)
// hazard: No delete confirmation dialog — delete fires immediately on button click; accidental deletion with no undo
// hazard: Shared script visibility depends on RLS — if call_scripts lacks org_id RLS, scripts from other orgs may appear
// edge:frontend/src/lib/supabase.ts -> CALLS
// edge:frontend/src/components/ScriptModal.tsx -> CALLS
// edge:frontend/src/App.tsx -> RELATES
// edge:scripts#1 -> STEP_IN
// prompt: Add delete confirmation. Verify RLS on call_scripts. Add script categories/tags. Add search. Link scripts to SalesBlock session.
import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Share2, Lock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { ScriptModal } from '../components/ScriptModal';
import DOMPurify from 'dompurify';

interface CallScript {
  id: string;
  name: string;
  content: string;
  is_shared: boolean;
  owner_id: string;
  created_at: string;
}

export default function Scripts() {
  const [scripts, setScripts] = useState<CallScript[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingScriptId, setEditingScriptId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string>('');

  useEffect(() => {
    loadScripts();
  }, []);

  async function loadScripts() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setCurrentUserId(user.id);

      const { data, error } = await supabase
        .from('call_scripts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setScripts(data || []);
    } catch (error) {
      console.error('Error loading scripts:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(scriptId: string, scriptName: string) {
    if (!confirm(`Delete script "${scriptName}"? This cannot be undone.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('call_scripts')
        .delete()
        .eq('id', scriptId);

      if (error) throw error;

      await loadScripts();
    } catch (error) {
      console.error('Error deleting script:', error);
      alert('Failed to delete script');
    }
  }

  function openCreateModal() {
    setEditingScriptId(null);
    setIsModalOpen(true);
  }

  function openEditModal(scriptId: string) {
    setEditingScriptId(scriptId);
    setIsModalOpen(true);
  }

  function handleModalSuccess() {
    loadScripts();
  }

  // Strip HTML tags for preview
  function stripHtml(html: string): string {
    const tmp = document.createElement('DIV');
    tmp.innerHTML = DOMPurify.sanitize(html);
    return tmp.textContent || tmp.innerText || '';
  }

  if (loading) {
    return (
      <div className="min-h-full bg-gray-50 dark:bg-void-950 p-6 flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-400 dark:text-white/40">
          <div className="w-5 h-5 border-2 border-indigo-electric border-t-transparent rounded-full animate-spin" />
          <span className="font-mono text-sm tracking-widest uppercase">Loading Scripts...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-gray-50 dark:bg-void-950 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="vv-section-title mb-1">Playbook</p>
          <h1 className="font-display text-3xl font-bold text-gray-900 dark:text-white">Call Scripts</h1>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-electric hover:bg-indigo-electric/80 text-white rounded-lg text-sm font-semibold transition-all duration-200 ease-snappy"
        >
          <Plus className="w-4 h-4" />
          Create Script
        </button>
      </div>

      {/* Scripts List */}
      {scripts.length === 0 ? (
        <div className="glass-card text-center py-16">
          <p className="font-display font-semibold text-gray-900 dark:text-white mb-1">No call scripts yet</p>
          <p className="text-sm text-gray-400 dark:text-white/40 mb-4">Build scripts to guide your reps during SalesBlocks</p>
          <button
            onClick={openCreateModal}
            className="px-4 py-2 bg-indigo-electric hover:bg-indigo-electric/80 text-white rounded-lg text-sm font-semibold transition-all duration-200 ease-snappy"
          >
            Create Your First Script
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {scripts.map((script) => {
            const isOwner = script.owner_id === currentUserId;
            const contentPreview = stripHtml(script.content).slice(0, 120);

            return (
              <div
                key={script.id}
                className="glass-card p-4 hover:bg-gray-50 dark:hover:bg-white/[0.08] transition-all duration-150 ease-snappy"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    {/* Name and sharing indicator */}
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-display font-semibold text-gray-900 dark:text-white">
                        {script.name}
                      </h3>
                      {script.is_shared ? (
                        <span className="flex items-center gap-1 text-xs text-indigo-electric bg-indigo-electric/15 px-2 py-1 rounded">
                          <Share2 className="w-3 h-3" />
                          Shared
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-white/40 bg-gray-100 dark:bg-white/10 px-2 py-1 rounded">
                          <Lock className="w-3 h-3" />
                          Private
                        </span>
                      )}
                    </div>

                    {/* Content preview */}
                    <p className="text-gray-500 dark:text-white/50 text-sm line-clamp-2">
                      {contentPreview}
                      {contentPreview.length >= 120 && '...'}
                    </p>

                    {/* Metadata */}
                    <p className="text-xs text-gray-400 dark:text-white/30 font-mono mt-2">
                      Created {new Date(script.created_at).toLocaleDateString()}
                      {!isOwner && ' • Shared with you'}
                    </p>
                  </div>

                  {/* Actions (only for owner) */}
                  {isOwner && (
                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={() => openEditModal(script.id)}
                        className="p-2 text-gray-400 dark:text-white/30 hover:text-indigo-electric dark:hover:text-indigo-electric hover:bg-indigo-electric/10 rounded transition-colors duration-150 ease-snappy"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(script.id, script.name)}
                        className="p-2 text-gray-400 dark:text-white/30 hover:text-red-alert dark:hover:text-red-alert hover:bg-red-alert/10 rounded transition-colors duration-150 ease-snappy"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Script Modal */}
      <ScriptModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={handleModalSuccess}
        scriptId={editingScriptId}
      />
    </div>
  );
}
