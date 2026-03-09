/**
 * @crumb
 * @id frontend-page-scripts
 * @area UI/Pages
 * @intent Call script library — create, edit, share, and delete reusable call scripts for sales reps
 * @responsibilities Load user's scripts (owned + shared), render script cards, open ScriptModal for create/edit, delete scripts
 * @contracts Scripts() → JSX; reads call_scripts table by user_id from Supabase; writes on create/update/delete
 * @in supabase (call_scripts table, auth.getUser), ScriptModal component
 * @out Grid/list of script cards with name, content preview, shared badge, edit/delete actions
 * @err Supabase load failure (silent — empty list renders); delete error (no feedback)
 * @hazard No delete confirmation dialog — delete fires immediately on button click; user can accidentally delete scripts with no undo
 * @hazard Shared script visibility depends on RLS — if call_scripts table lacks org_id RLS, scripts from other orgs may appear in shared view
 * @shared-edges frontend/src/lib/supabase.ts→QUERIES call_scripts; frontend/src/components/ScriptModal.tsx→LAUNCHES for create/edit; frontend/src/App.tsx→ROUTES to /scripts
 * @trail scripts#1 | Scripts mounts → load scripts → render cards → user clicks New → ScriptModal → save → reload → user deletes → immediate remove
 * @prompt Add delete confirmation. Verify RLS on call_scripts. Add script categories/tags. Add search. Consider linking scripts to SalesBlock session for in-session use.
 */
import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Share2, Lock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { ScriptModal } from '../components/ScriptModal';

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
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  }

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-gray-600 dark:text-gray-400">Loading scripts...</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Call Scripts</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Create and manage call scripts for guidance during salesblocks
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-5 h-5" />
          Create Script
        </button>
      </div>

      {/* Scripts List */}
      {scripts.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <p className="text-gray-600 dark:text-gray-400 mb-4">No call scripts yet</p>
          <button
            onClick={openCreateModal}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
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
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    {/* Name and sharing indicator */}
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {script.name}
                      </h3>
                      {script.is_shared ? (
                        <span className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded">
                          <Share2 className="w-3 h-3" />
                          Shared
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                          <Lock className="w-3 h-3" />
                          Private
                        </span>
                      )}
                    </div>

                    {/* Content preview */}
                    <p className="text-gray-600 dark:text-gray-400 text-sm line-clamp-2">
                      {contentPreview}
                      {contentPreview.length >= 120 && '...'}
                    </p>

                    {/* Metadata */}
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                      Created {new Date(script.created_at).toLocaleDateString()}
                      {!isOwner && ' • Shared with you'}
                    </p>
                  </div>

                  {/* Actions (only for owner) */}
                  {isOwner && (
                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={() => openEditModal(script.id)}
                        className="p-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
                        title="Edit"
                      >
                        <Edit2 className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleDelete(script.id, script.name)}
                        className="p-2 text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                        title="Delete"
                      >
                        <Trash2 className="w-5 h-5" />
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
