// @crumb frontend-page-email-templates
// UI/PAGES | load_user_templates | render_template_cards | create_edit_modal | delete_with_confirmation | toggle_shared
// why: Email template library — create, edit, share, and delete reusable email templates with usage and reply tracking
// in:supabase(email_templates,auth.getUser),TemplateModal out:grid of template cards with name,subject preview,usage stats,shared badge,edit/delete actions err:Supabase load failure(silent empty list),delete error(silent no feedback)
// hazard: Delete fires on confirmation with no optimistic rollback — UI shows card gone but DB may still have it
// hazard: Shared templates visible to all org users — no RLS verification; if misconfigured, templates leak across orgs
// edge:frontend/src/lib/supabase.ts -> CALLS
// edge:frontend/src/components/TemplateModal.tsx -> CALLS
// edge:frontend/src/App.tsx -> RELATES
// edge:email-templates#1 -> STEP_IN
// prompt: Add error toast on delete failure. Verify RLS on email_templates scopes to org_id. Add template preview and search/filter.
import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, Share2, Lock } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { TemplateModal } from '../components/TemplateModal'
import DOMPurify from 'dompurify'

interface EmailTemplate {
  id: string
  name: string
  subject: string
  body: string
  owner_id: string
  is_shared: boolean
  times_used: number
  reply_count: number
  created_at: string
}

export default function EmailTemplates() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  useEffect(() => {
    loadTemplates()
    loadCurrentUser()
  }, [])

  const loadCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) setCurrentUserId(user.id)
  }

  const loadTemplates = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('email_templates')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setTemplates(data || [])
    } catch (err) {
      console.error('Error loading templates:', err)
      setLoadError('Failed to load templates. Please refresh the page.')
      setLoading(false)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('email_templates')
        .delete()
        .eq('id', id)

      if (error) throw error
      setDeleteConfirm(null)
      loadTemplates()
    } catch (err) {
      console.error('Error deleting template:', err)
      alert('Failed to delete template')
    }
  }

  const stripHTML = (html: string) => {
    const div = document.createElement('DIV')
    div.innerHTML = DOMPurify.sanitize(html)
    return div.textContent || div.innerText || ''
  }

  const truncate = (text: string, maxLength: number) => {
    const stripped = stripHTML(text)
    return stripped.length > maxLength ? stripped.substring(0, maxLength) + '...' : stripped
  }

  const calculateReplyRate = (template: EmailTemplate) => {
    if (template.times_used === 0) return '—'
    const rate = (template.reply_count / template.times_used) * 100
    return `${rate.toFixed(1)}%`
  }

  if (loading) {
    return (
      <div className="min-h-full bg-gray-50 dark:bg-void-950 p-6 flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-400 dark:text-white/40">
          <div className="w-5 h-5 border-2 border-indigo-electric border-t-transparent rounded-full animate-spin" />
          <span className="font-mono text-sm tracking-widest uppercase">Loading Templates...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-full bg-gray-50 dark:bg-void-950 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="vv-section-title mb-1">Outreach</p>
          <h1 className="font-display text-3xl font-bold text-gray-900 dark:text-white">Email Templates</h1>
        </div>
        <button
          onClick={() => {
            setEditingTemplate(null)
            setModalOpen(true)
          }}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-electric hover:bg-indigo-electric/80 text-white rounded-lg text-sm font-semibold transition-all duration-200 ease-snappy"
        >
          <Plus className="w-4 h-4" />
          Create Template
        </button>
      </div>

      {loadError && (
        <div className="rounded-lg bg-red-alert/10 border border-red-alert/30 p-4 m-4">
          <p className="text-sm text-red-alert">{loadError}</p>
        </div>
      )}

      {/* Templates List */}
      {templates.length === 0 ? (
        <div className="glass-card text-center py-16">
          <p className="font-display font-semibold text-gray-900 dark:text-white mb-1">No email templates yet</p>
          <p className="text-sm text-gray-400 dark:text-white/40 mb-4">Build templates to speed up your outreach</p>
          <button
            onClick={() => {
              setEditingTemplate(null)
              setModalOpen(true)
            }}
            className="px-4 py-2 bg-indigo-electric hover:bg-indigo-electric/80 text-white rounded-lg text-sm font-semibold transition-all duration-200 ease-snappy"
          >
            Create Your First Template
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {templates.map((template) => (
            <div
              key={template.id}
              className="glass-card p-4 hover:bg-gray-50 dark:hover:bg-white/[0.08] transition-all duration-150 ease-snappy"
            >
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-display font-semibold text-gray-900 dark:text-white">
                      {template.name}
                    </h3>
                    {template.is_shared ? (
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
                  <p className="text-sm text-gray-600 dark:text-white/50 mb-2">
                    Subject: {template.subject}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-white/40 line-clamp-2">
                    {truncate(template.body, 120)}
                  </p>
                </div>
                <div className="flex gap-2 ml-4">
                  {currentUserId === template.owner_id && (
                    <>
                      <button
                        onClick={() => {
                          setEditingTemplate(template)
                          setModalOpen(true)
                        }}
                        className="p-2 text-gray-400 dark:text-white/30 hover:text-indigo-electric dark:hover:text-indigo-electric hover:bg-indigo-electric/10 rounded transition-colors duration-150 ease-snappy"
                        title="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(template.id)}
                        className="p-2 text-gray-400 dark:text-white/30 hover:text-red-alert dark:hover:text-red-alert hover:bg-red-alert/10 rounded transition-colors duration-150 ease-snappy"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="flex gap-6 text-xs text-gray-400 dark:text-white/30 font-mono border-t border-gray-200 dark:border-white/10 pt-3">
                <div>
                  <span className="font-semibold">Used:</span> {template.times_used}
                </div>
                <div>
                  <span className="font-semibold">Reply Rate:</span> {calculateReplyRate(template)}
                </div>
                <div>
                  <span className="font-semibold">Replies:</span> {template.reply_count}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <TemplateModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false)
          setEditingTemplate(null)
        }}
        onSuccess={loadTemplates}
        template={editingTemplate}
      />

      {/* Delete Confirmation Dialog */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="glass-card p-6 max-w-md w-full mx-4">
            <h3 className="font-display font-semibold text-gray-900 dark:text-white mb-3">
              Delete Template
            </h3>
            <p className="text-sm text-gray-500 dark:text-white/50 mb-6">
              Are you sure you want to delete this email template? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-700 dark:text-white/70 hover:bg-gray-50 dark:hover:bg-white/10 rounded-lg text-sm font-semibold transition-all duration-200 ease-snappy"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="px-4 py-2 bg-red-alert hover:bg-red-alert/80 text-white rounded-lg text-sm font-semibold transition-all duration-200 ease-snappy"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
