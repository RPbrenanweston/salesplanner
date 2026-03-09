/**
 * @crumb
 * @id frontend-page-content-library
 * @area UI/Pages
 * @intent Unified content library — combined view of email templates and call scripts for browsing and management
 * @responsibilities Load and display both email_templates and call_scripts in one view, filter by type, open TemplateModal or ScriptModal for create/edit, delete items
 * @contracts ContentLibrary() → JSX; reads email_templates + call_scripts from Supabase; writes on create/update/delete
 * @in supabase (email_templates + call_scripts tables), TemplateModal + ScriptModal components
 * @out Tabbed or merged content list with type labels, shared badges, edit/delete actions
 * @err Supabase query failure for either type (silent partial load — may show only one content type with no indication the other failed)
 * @hazard Dual-table load with no error differentiation — if email_templates query fails, scripts still render and vice versa; partial state looks identical to full success state
 * @hazard RLS on both tables must scope to same org — if one table has tighter RLS than the other, the views will show inconsistent ownership across content types
 * @shared-edges frontend/src/lib/supabase.ts→QUERIES email_templates+call_scripts; frontend/src/components/TemplateModal.tsx→LAUNCHES; frontend/src/components/ScriptModal.tsx→LAUNCHES; frontend/src/App.tsx→ROUTES to /content-library
 * @trail content-library#1 | ContentLibrary mounts → load templates + scripts → render unified list → user filters by type → user creates/edits via modal → reload
 * @prompt VV tokens applied — glass-card, indigo-electric CTAs, cyan-neon script accents, red-alert delete, VV spinners on load states. Surface load errors per content type with distinct error banners. Merge with EmailTemplates and Scripts pages or remove redundancy. Add bulk actions. Verify org-scoped RLS on both tables.
 */
import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Share2, Lock, Mail, FileText } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { TemplateModal } from '../components/TemplateModal';
import { ScriptModal } from '../components/ScriptModal';

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  owner_id: string;
  is_shared: boolean;
  times_used: number;
  reply_count: number;
  created_at: string;
}

interface CallScript {
  id: string;
  name: string;
  content: string;
  is_shared: boolean;
  owner_id: string;
  created_at: string;
}

type Tab = 'templates' | 'scripts';

export default function ContentLibrary() {
  const [activeTab, setActiveTab] = useState<Tab>('templates');

  // Templates state
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);

  // Scripts state
  const [scripts, setScripts] = useState<CallScript[]>([]);
  const [loadingScripts, setLoadingScripts] = useState(true);
  const [scriptModalOpen, setScriptModalOpen] = useState(false);
  const [editingScriptId, setEditingScriptId] = useState<string | null>(null);

  // Common state
  const [currentUserId, setCurrentUserId] = useState<string>('');

  useEffect(() => {
    loadCurrentUser();
    loadTemplates();
    loadScripts();
  }, []);

  async function loadCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) setCurrentUserId(user.id);
  }

  // ─── Templates Logic ───
  async function loadTemplates() {
    setLoadingTemplates(true);
    try {
      const { data, error } = await supabase
        .from('email_templates')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTemplates(data || []);
    } catch (err) {
      console.error('Error loading templates:', err);
    } finally {
      setLoadingTemplates(false);
    }
  }

  async function handleDeleteTemplate(id: string) {
    if (!confirm('Delete this email template?')) return;

    try {
      const { error } = await supabase
        .from('email_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;
      loadTemplates();
    } catch (err) {
      console.error('Error deleting template:', err);
      alert('Failed to delete template');
    }
  }

  // ─── Scripts Logic ───
  async function loadScripts() {
    setLoadingScripts(true);
    try {
      const { data, error } = await supabase
        .from('call_scripts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setScripts(data || []);
    } catch (err) {
      console.error('Error loading scripts:', err);
    } finally {
      setLoadingScripts(false);
    }
  }

  async function handleDeleteScript(scriptId: string, scriptName: string) {
    if (!confirm(`Delete script "${scriptName}"?`)) return;

    try {
      const { error } = await supabase
        .from('call_scripts')
        .delete()
        .eq('id', scriptId);

      if (error) throw error;
      loadScripts();
    } catch (err) {
      console.error('Error deleting script:', err);
      alert('Failed to delete script');
    }
  }

  // ─── Utilities ───
  function stripHtml(html: string): string {
    const tmp = document.createElement('DIV');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  }

  function truncate(text: string, maxLength: number = 120): string {
    const stripped = stripHtml(text);
    return stripped.length > maxLength ? stripped.slice(0, maxLength) + '...' : stripped;
  }

  function calculateReplyRate(template: EmailTemplate): string {
    if (template.times_used === 0) return '—';
    const rate = (template.reply_count / template.times_used) * 100;
    return `${rate.toFixed(1)}%`;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-void-950 via-void-900 to-void-950 p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 bg-indigo-electric/10 rounded-lg">
            <FileText className="w-8 h-8 text-indigo-electric" />
          </div>
          <div>
            <h1 className="text-3xl font-black font-display text-white">Content Armory</h1>
            <p className="text-white/60 mt-1">Manage email templates and call scripts</p>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="glass-card mb-8 p-1 flex gap-1 w-fit rounded-xl">
        <button
          onClick={() => setActiveTab('templates')}
          className={`flex items-center gap-2 px-6 py-2 rounded-lg font-medium transition-all ${
            activeTab === 'templates'
              ? 'bg-indigo-electric text-white shadow-lg shadow-indigo-electric/30'
              : 'text-white/60 hover:text-white/80'
          }`}
        >
          <Mail className="w-5 h-5" />
          Email Templates
        </button>
        <button
          onClick={() => setActiveTab('scripts')}
          className={`flex items-center gap-2 px-6 py-2 rounded-lg font-medium transition-all ${
            activeTab === 'scripts'
              ? 'bg-cyan-neon text-white shadow-lg shadow-cyan-neon/30'
              : 'text-white/60 hover:text-white/80'
          }`}
        >
          <FileText className="w-5 h-5" />
          Call Scripts
        </button>
      </div>

      {/* Templates Tab */}
      {activeTab === 'templates' && (
        <div>
          {/* Header with Create Button */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold text-white">Email Templates</h2>
              <p className="text-white/60 text-sm mt-1">Create and manage reusable email templates</p>
            </div>
            <button
              onClick={() => {
                setEditingTemplate(null);
                setTemplateModalOpen(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-electric text-white rounded-lg hover:bg-indigo-electric/80 transition-all ease-snappy"
            >
              <Plus className="w-5 h-5" />
              Create Template
            </button>
          </div>

          {/* Content */}
          {loadingTemplates ? (
            <div className="glass-card p-12 flex items-center justify-center gap-3 text-white/60">
              <div className="w-5 h-5 border-2 border-indigo-electric border-t-transparent rounded-full animate-spin" />
              Loading templates...
            </div>
          ) : templates.length === 0 ? (
            <div className="glass-card p-12 text-center">
              <Mail className="w-12 h-12 text-white/40 mx-auto mb-3" />
              <p className="text-white/60 mb-4">No email templates yet</p>
              <button
                onClick={() => {
                  setEditingTemplate(null);
                  setTemplateModalOpen(true);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-electric text-white rounded-lg hover:bg-indigo-electric/80 transition-all ease-snappy"
              >
                <Plus className="w-4 h-4" />
                Create Your First Template
              </button>
            </div>
          ) : (
            <div className="grid gap-4">
              {templates.map((template) => (
                <div
                  key={template.id}
                  className="glass-card group p-6 hover:border-indigo-electric/50 border-transparent transition-all"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-white">
                          {template.name}
                        </h3>
                        {template.is_shared ? (
                          <span className="flex items-center gap-1 text-xs text-cyan-neon bg-cyan-neon/10 px-2 py-1 rounded-full">
                            <Share2 className="w-3 h-3" />
                            Shared
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-white/60 bg-white/10 px-2 py-1 rounded-full">
                            <Lock className="w-3 h-3" />
                            Private
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-white/70 mb-2">
                        <span className="font-medium text-white/80">Subject:</span> {template.subject}
                      </p>
                      <p className="text-sm text-white/60">
                        {truncate(template.body, 120)}
                      </p>
                    </div>

                    {currentUserId === template.owner_id && (
                      <div className="flex items-center gap-2 ml-4 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => {
                            setEditingTemplate(template);
                            setTemplateModalOpen(true);
                          }}
                          className="p-2 text-indigo-electric hover:bg-indigo-electric/10 rounded-lg transition-all"
                          title="Edit"
                        >
                          <Edit2 className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleDeleteTemplate(template.id)}
                          className="p-2 text-red-alert hover:bg-red-alert/10 rounded-lg transition-all"
                          title="Delete"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Stats Footer */}
                  <div className="flex gap-6 text-xs text-white/60 border-t border-white/10 pt-4">
                    <div>
                      <span className="text-white/80 font-medium">Times Used:</span> {template.times_used}
                    </div>
                    <div>
                      <span className="text-white/80 font-medium">Reply Rate:</span> {calculateReplyRate(template)}
                    </div>
                    <div>
                      <span className="text-white/80 font-medium">Replies:</span> {template.reply_count}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Scripts Tab */}
      {activeTab === 'scripts' && (
        <div>
          {/* Header with Create Button */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold text-white">Call Scripts</h2>
              <p className="text-white/60 text-sm mt-1">Create and manage call scripts for guidance</p>
            </div>
            <button
              onClick={() => {
                setEditingScriptId(null);
                setScriptModalOpen(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-cyan-neon text-void-950 rounded-lg hover:bg-cyan-neon/80 font-semibold transition-all ease-snappy"
            >
              <Plus className="w-5 h-5" />
              Create Script
            </button>
          </div>

          {/* Content */}
          {loadingScripts ? (
            <div className="glass-card p-12 flex items-center justify-center gap-3 text-white/60">
              <div className="w-5 h-5 border-2 border-cyan-neon border-t-transparent rounded-full animate-spin" />
              Loading scripts...
            </div>
          ) : scripts.length === 0 ? (
            <div className="glass-card p-12 text-center">
              <FileText className="w-12 h-12 text-white/40 mx-auto mb-3" />
              <p className="text-white/60 mb-4">No call scripts yet</p>
              <button
                onClick={() => {
                  setEditingScriptId(null);
                  setScriptModalOpen(true);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-neon text-void-950 rounded-lg hover:bg-cyan-neon/80 font-semibold transition-all ease-snappy"
              >
                <Plus className="w-4 h-4" />
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
                    className="glass-card group p-6 hover:border-cyan-neon/50 border-transparent transition-all"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-white">
                            {script.name}
                          </h3>
                          {script.is_shared ? (
                            <span className="flex items-center gap-1 text-xs text-cyan-neon bg-cyan-neon/10 px-2 py-1 rounded-full">
                              <Share2 className="w-3 h-3" />
                              Shared
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-xs text-white/60 bg-white/10 px-2 py-1 rounded-full">
                              <Lock className="w-3 h-3" />
                              Private
                            </span>
                          )}
                        </div>

                        <p className="text-sm text-white/60 line-clamp-2">
                          {contentPreview}
                          {contentPreview.length >= 120 && '...'}
                        </p>

                        <p className="text-xs text-white/40 mt-2">
                          Created {new Date(script.created_at).toLocaleDateString()}
                          {!isOwner && ' • Shared with you'}
                        </p>
                      </div>

                      {isOwner && (
                        <div className="flex items-center gap-2 ml-4 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => {
                              setEditingScriptId(script.id);
                              setScriptModalOpen(true);
                            }}
                            className="p-2 text-cyan-neon hover:bg-cyan-neon/10 rounded-lg transition-all"
                            title="Edit"
                          >
                            <Edit2 className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleDeleteScript(script.id, script.name)}
                            className="p-2 text-red-alert hover:bg-red-alert/10 rounded-lg transition-all"
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
        </div>
      )}

      {/* Modals */}
      <TemplateModal
        isOpen={templateModalOpen}
        onClose={() => {
          setTemplateModalOpen(false);
          setEditingTemplate(null);
        }}
        onSuccess={loadTemplates}
        template={editingTemplate}
      />

      <ScriptModal
        isOpen={scriptModalOpen}
        onClose={() => {
          setScriptModalOpen(false);
          setEditingScriptId(null);
        }}
        onSuccess={loadScripts}
        scriptId={editingScriptId}
      />
    </div>
  );
}
