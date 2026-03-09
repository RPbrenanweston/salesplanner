/**
 * @crumb
 * @id frontend-page-email-templates
 * @area UI/Pages
 * @intent Email template library — create, edit, share, and delete reusable email templates with usage and reply tracking
 * @responsibilities Load user's templates (owned + shared), render template cards with stats, open TemplateModal for create/edit, delete with confirmation, toggle shared status
 * @contracts EmailTemplates() → JSX; reads email_templates table by user_id from Supabase; writes on create/update/delete
 * @in supabase (email_templates table, auth.getUser), TemplateModal component
 * @out Grid of template cards with name, subject preview, usage stats, shared badge, edit/delete actions
 * @err Supabase load failure (silent — empty list renders); delete error (silent — no feedback to user)
 * @hazard Delete fires immediately on confirmation — no optimistic rollback if Supabase delete fails; UI shows card gone but DB may still have it
 * @hazard Shared templates are visible to all org users — no RLS verification in crumb; if RLS misconfigured, templates leak across orgs
 * @shared-edges frontend/src/lib/supabase.ts→QUERIES email_templates; frontend/src/components/TemplateModal.tsx→LAUNCHES for create/edit; frontend/src/App.tsx→ROUTES to /email-templates
 * @trail email-templates#1 | EmailTemplates mounts → load templates → render cards with stats → user edits → TemplateModal saves → reload → user deletes → confirm → remove
 * @prompt Add error toast on delete failure. Verify RLS on email_templates scopes to org_id. Add template preview before use. Add search/filter for large template libraries.
 */
import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, Share2, Lock } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { TemplateModal } from '../components/TemplateModal'

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
    div.innerHTML = html
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

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Email Templates</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Create and manage reusable email templates with variable placeholders
          </p>
        </div>
        <button
          onClick={() => {
            setEditingTemplate(null)
            setModalOpen(true)
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          Create Template
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">Loading templates...</div>
      ) : templates.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400 mb-4">No email templates yet.</p>
          <button
            onClick={() => {
              setEditingTemplate(null)
              setModalOpen(true)
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Create Your First Template
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {templates.map((template) => (
            <div
              key={template.id}
              className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800 hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {template.name}
                    </h3>
                    {template.is_shared ? (
                      <span title="Shared with team">
                        <Share2 className="w-4 h-4 text-blue-500" />
                      </span>
                    ) : (
                      <span title="Private">
                        <Lock className="w-4 h-4 text-gray-400" />
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    Subject: {template.subject}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-500">
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
                        className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                        title="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(template.id)}
                        className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="flex gap-6 text-sm text-gray-600 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700 pt-3">
                <div>
                  <span className="font-medium">Times Used:</span> {template.times_used}
                </div>
                <div>
                  <span className="font-medium">Reply Rate:</span> {calculateReplyRate(template)}
                </div>
                <div>
                  <span className="font-medium">Replies:</span> {template.reply_count}
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Delete Template
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Are you sure you want to delete this email template? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
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
