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
import { useState, useEffect, useMemo } from 'react'
import { Plus, Pencil, Trash2, Share2, Lock, Search, ChevronDown, ChevronUp } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { TemplateModal } from '../components/TemplateModal'
import { toast } from '../hooks/use-toast'
import DOMPurify from 'dompurify'
import ConfirmDeleteDialog from '../components/ConfirmDeleteDialog'

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
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    loadTemplates()
    loadCurrentUser()
  }, [])

  const filteredTemplates = useMemo(() => {
    const q = searchQuery.toLowerCase()
    return templates.filter(t =>
      !q || t.name.toLowerCase().includes(q) || t.subject.toLowerCase().includes(q)
    )
  }, [templates, searchQuery])

  const loadCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) setCurrentUserId(user.id)
  }

  const loadTemplates = async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: userData } = await supabase
        .from('users')
        .select('org_id')
        .eq('id', user.id)
        .single()

      let query = supabase
        .from('email_templates')
        .select('*')
        .order('created_at', { ascending: false })

      if (userData?.org_id) query = query.eq('org_id', userData.org_id)

      const { data, error } = await query

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

  const handleDeleteConfirmed = async (id: string) => {
    setDeleteTarget(null)
    try {
      const { error } = await supabase
        .from('email_templates')
        .delete()
        .eq('id', id)

      if (error) throw error
      loadTemplates()
    } catch (err) {
      console.error('Error deleting template:', err)
      toast({ variant: 'destructive', title: 'Failed to delete template', description: 'Please try again.' })
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

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-white/30 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search templates by name or subject..."
          className="w-full pl-10 pr-4 py-2.5 border border-gray-200 dark:border-white/10 rounded-lg bg-white dark:bg-white/5 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/30 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-electric/40"
        />
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
      ) : filteredTemplates.length === 0 ? (
        <div className="glass-card text-center py-12">
          <p className="font-display font-semibold text-gray-900 dark:text-white mb-1">No templates match your search</p>
          <button onClick={() => setSearchQuery('')} className="text-indigo-electric hover:text-indigo-electric/70 text-sm transition-colors">Clear search</button>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredTemplates.map((template) => (
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
                        onClick={() => setDeleteTarget({ id: template.id, name: template.name })}
                        className="p-2 text-gray-400 dark:text-white/30 hover:text-red-alert dark:hover:text-red-alert hover:bg-red-alert/10 rounded transition-colors duration-150 ease-snappy"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-gray-200 dark:border-white/10 pt-3">
                <div className="flex gap-6 text-xs text-gray-400 dark:text-white/30 font-mono">
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
                <button
                  onClick={() => setExpandedId(expandedId === template.id ? null : template.id)}
                  className="flex items-center gap-1 text-xs text-indigo-electric hover:text-indigo-electric/70 transition-colors font-medium"
                >
                  {expandedId === template.id ? (
                    <><ChevronUp className="w-3.5 h-3.5" /> Hide Preview</>
                  ) : (
                    <><ChevronDown className="w-3.5 h-3.5" /> Preview</>
                  )}
                </button>
              </div>

              {expandedId === template.id && (
                <div className="mt-3 pt-3 border-t border-gray-200 dark:border-white/10">
                  <p className="text-xs font-semibold text-gray-400 dark:text-white/30 uppercase tracking-wider mb-2">Preview</p>
                  <div
                    className="prose prose-sm dark:prose-invert max-w-none text-sm text-gray-700 dark:text-white/70 bg-gray-50 dark:bg-white/5 rounded-lg p-4 overflow-auto max-h-64"
                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(template.body) }}
                  />
                </div>
              )}
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

      <ConfirmDeleteDialog
        isOpen={deleteTarget !== null}
        itemType="Email Template"
        itemName={deleteTarget?.name ?? ''}
        onConfirm={() => deleteTarget && handleDeleteConfirmed(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
