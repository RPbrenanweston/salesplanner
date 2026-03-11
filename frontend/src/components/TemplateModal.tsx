// @crumb frontend-component-template-modal
// UI/Content/Templates | load_existing_template | render_subject_body_form | save_template | on_save_callback
// why: Template modal — create or edit an email template with subject + body fields, save to Supabase email_templates table for reuse in ComposeEmailModal
// in:isOpen,onClose,onSave,orgId,templateId (optional) out:New or updated row in email_templates table,onSave called err:Supabase read failure (form renders empty),Supabase insert/update failure
// hazard: Merge tags like {{first_name}} not substituted consistently across send paths — raw tags sent to prospects
// hazard: No subject line length or body size validation at save time — oversized content fails at send time with no feedback
// edge:frontend/src/pages/EmailTemplates.tsx -> RELATES
// edge:frontend/src/components/ComposeEmailModal.tsx -> RELATES
// edge:template-edit#1 -> STEP_IN
// prompt: Validate merge tags at save time against a known variable list. Add send-time preview with variable substitution. Enforce subject line and body character limits.
import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { supabase } from '../lib/supabase'

interface TemplateModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  template?: {
    id: string
    name: string
    subject: string
    body: string
    is_shared: boolean
  } | null
}

export function TemplateModal({ isOpen, onClose, onSuccess, template }: TemplateModalProps) {
  const [name, setName] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [isShared, setIsShared] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Pre-populate fields when editing
  useEffect(() => {
    if (template) {
      setName(template.name)
      setSubject(template.subject)
      setBody(template.body)
      setIsShared(template.is_shared)
    } else {
      resetForm()
    }
  }, [template])

  const resetForm = () => {
    setName('')
    setSubject('')
    setBody('')
    setIsShared(false)
    setShowPreview(false)
    setError(null)
  }

  const resetAndClose = () => {
    resetForm()
    onClose()
  }

  const handleSave = async () => {
    if (!name.trim() || !subject.trim() || !body.trim()) {
      setError('Name, subject, and body are required')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data: userData } = await supabase
        .from('users')
        .select('org_id')
        .eq('id', user.id)
        .single()

      if (!userData) throw new Error('User data not found')

      if (template) {
        // Update existing template
        const { error: updateError } = await supabase
          .from('email_templates')
          .update({
            name: name.trim(),
            subject: subject.trim(),
            body: body.trim(),
            is_shared: isShared,
          })
          .eq('id', template.id)

        if (updateError) throw updateError
      } else {
        // Create new template
        const { error: insertError } = await supabase
          .from('email_templates')
          .insert({
            org_id: userData.org_id,
            owner_id: user.id,
            name: name.trim(),
            subject: subject.trim(),
            body: body.trim(),
            is_shared: isShared,
          })

        if (insertError) throw insertError
      }

      onSuccess()
      resetAndClose()
    } catch (err) {
      console.error('Error saving template:', err)
      setError(err instanceof Error ? err.message : 'Failed to save template')
    } finally {
      setLoading(false)
    }
  }

  const renderPreview = () => {
    // Sample contact data for preview
    const sampleData = {
      first_name: 'Jane',
      last_name: 'Smith',
      company: 'Acme Corp',
      title: 'VP of Sales',
      email: 'jane.smith@acme.com',
    }

    const replaceVariables = (text: string) => {
      return text.replace(/\{\{(\w+)\}\}/g, (match, variable) => {
        return sampleData[variable as keyof typeof sampleData] || match
      })
    }

    return (
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Subject (Preview)
          </label>
          <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded border border-gray-300 dark:border-gray-600">
            {replaceVariables(subject)}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Body (Preview)
          </label>
          <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded border border-gray-300 dark:border-gray-600 whitespace-pre-wrap">
            {replaceVariables(body)}
          </div>
        </div>
        <div className="text-sm text-gray-500 dark:text-gray-400">
          Preview uses sample data: {Object.entries(sampleData).map(([key, val]) => `{{${key}}} = "${val}"`).join(', ')}
        </div>
      </div>
    )
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {template ? 'Edit Email Template' : 'Create Email Template'}
          </h2>
          <button
            onClick={resetAndClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded text-red-700 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Toggle between Edit and Preview */}
          <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setShowPreview(false)}
              className={`px-4 py-2 font-medium ${
                !showPreview
                  ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              Edit
            </button>
            <button
              onClick={() => setShowPreview(true)}
              className={`px-4 py-2 font-medium ${
                showPreview
                  ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
              disabled={!subject.trim() && !body.trim()}
            >
              Preview
            </button>
          </div>

          {!showPreview ? (
            <>
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Template Name
                </label>
                <input
                  type="text"
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Initial Outreach, Follow-up #1"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label htmlFor="subject" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Subject Line
                </label>
                <input
                  type="text"
                  id="subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g., Quick question about {{company}}'s sales process"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label htmlFor="body" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Email Body
                </label>
                <textarea
                  id="body"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder={`Hi {{first_name}},\n\nI noticed {{company}} is hiring for {{title}} roles...\n\nAvailable variables: {{first_name}}, {{last_name}}, {{company}}, {{title}}, {{email}}`}
                  rows={10}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isShared"
                  checked={isShared}
                  onChange={(e) => setIsShared(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="isShared" className="text-sm text-gray-700 dark:text-gray-300">
                  Share with team members
                </label>
              </div>
            </>
          ) : (
            renderPreview()
          )}
        </div>

        <div className="sticky bottom-0 bg-gray-50 dark:bg-gray-900 px-6 py-4 flex gap-3 justify-end border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={resetAndClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading || !name.trim() || !subject.trim() || !body.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {loading ? 'Saving...' : template ? 'Update Template' : 'Create Template'}
          </button>
        </div>
      </div>
    </div>
  )
}
