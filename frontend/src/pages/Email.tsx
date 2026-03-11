// @crumb frontend-page-email
// UI/PAGES | load_email_activities | render_filterable_list | launch_compose_modal
// why: Email outreach page — display sent emails from activities table, filter by status, compose new emails
// in:supabase activities(type=email) joined to contacts,useAuth,ComposeEmailModal out:filterable email list with contact name,subject,timestamp,reply status err:Supabase query failure (empty list with error state)
// hazard: Email activities join to contacts via contact_id — if contact deleted, join returns null and email card renders with missing name
// hazard: No pagination — loads all email activities; large volumes cause slow query and blank state before data arrives
// edge:frontend/src/components/ComposeEmailModal.tsx -> CALLS
// edge:frontend/src/lib/supabase.ts -> CALLS
// edge:frontend/src/App.tsx -> RELATES
// edge:frontend/src/hooks/useAuth.ts -> CALLS
// edge:email#1 -> STEP_IN
// prompt: Add pagination or virtual scroll for email activity list. Guard deleted contact joins with null fallback. Add empty state with compose CTA.
import { useState, useEffect } from 'react'
import { Mail, Plus, Send, Reply, Clock, Search } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import ComposeEmailModal from '../components/ComposeEmailModal'

type EmailFilter = 'all' | 'sent' | 'replied'

interface EmailActivity {
  id: string
  contact_id: string
  notes: string | null
  created_at: string
  replied_at: string | null
  contact?: {
    first_name: string
    last_name: string
    email: string
    company: string | null
  }
}

export default function Email() {
  const { user } = useAuth()
  const [emails, setEmails] = useState<EmailActivity[]>([])
  const [loading, setLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState<EmailFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [showComposeModal, setShowComposeModal] = useState(false)

  useEffect(() => {
    if (user) {
      loadEmails()
    }
  }, [user])

  const loadEmails = async () => {
    if (!user) return
    setLoading(true)

    try {
      const { data, error } = await supabase
        .from('activities')
        .select(`
          id,
          contact_id,
          notes,
          created_at,
          replied_at,
          contact:contacts(first_name, last_name, email, company)
        `)
        .eq('user_id', user.id)
        .eq('type', 'email')
        .order('created_at', { ascending: false })

      if (error) throw error
      setEmails((data as unknown as EmailActivity[]) || [])
    } catch (error) {
      console.error('Error loading emails:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredEmails = emails.filter((email) => {
    // Apply status filter
    if (activeFilter === 'sent' && email.replied_at) return false
    if (activeFilter === 'replied' && !email.replied_at) return false

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      const contactName = `${email.contact?.first_name || ''} ${email.contact?.last_name || ''}`.toLowerCase()
      const subject = (email.notes || '').toLowerCase()
      const contactEmail = (email.contact?.email || '').toLowerCase()
      return contactName.includes(query) || subject.includes(query) || contactEmail.includes(query)
    }

    return true
  })

  const formatTimestamp = (isoString: string) => {
    const date = new Date(isoString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffHours = diffMs / (1000 * 60 * 60)

    if (diffHours < 1) {
      const mins = Math.floor(diffMs / (1000 * 60))
      return `${mins}m ago`
    }
    if (diffHours < 24) {
      return `${Math.floor(diffHours)}h ago`
    }
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  }

  const getContactName = (email: EmailActivity) => {
    if (email.contact) {
      return `${email.contact.first_name} ${email.contact.last_name}`.trim() || 'Unknown'
    }
    return 'Unknown'
  }

  const getSubject = (email: EmailActivity) => {
    if (!email.notes) return 'No subject'
    // Extract first line as subject, or first 80 chars
    const firstLine = email.notes.split('\n')[0]
    return firstLine.length > 80 ? firstLine.substring(0, 80) + '...' : firstLine
  }

  const filters: { key: EmailFilter; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: emails.length },
    { key: 'sent', label: 'Sent', count: emails.filter((e) => !e.replied_at).length },
    { key: 'replied', label: 'Replied', count: emails.filter((e) => e.replied_at).length },
  ]

  return (
    <div className="min-h-full bg-gray-50 dark:bg-void-950 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="vv-section-title mb-1">Outreach</p>
          <h1 className="font-display text-3xl font-bold text-gray-900 dark:text-white">
            Email
          </h1>
          <p className="text-sm text-gray-500 dark:text-white/50 mt-1">
            Send and track email outreach
          </p>
        </div>
        <button
          onClick={() => setShowComposeModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-electric hover:bg-indigo-electric/80 text-white rounded-lg text-sm font-semibold transition-all duration-200 ease-snappy"
        >
          <Plus className="w-4 h-4" />
          Compose Email
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-white/40" />
        <input
          type="text"
          placeholder="Search by name, email, or subject..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border border-gray-200 dark:border-white/10 rounded-lg bg-white dark:bg-white/5 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/40 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-electric/50 focus:border-indigo-electric transition-all"
        />
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-white/10">
        {filters.map((filter) => (
          <button
            key={filter.key}
            onClick={() => setActiveFilter(filter.key)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
              activeFilter === filter.key
                ? 'border-indigo-electric text-indigo-electric'
                : 'border-transparent text-gray-600 dark:text-white/50 hover:text-gray-900 dark:hover:text-white/80'
            }`}
          >
            {filter.label}
            <span className="ml-1.5 text-xs font-mono opacity-60">({filter.count})</span>
          </button>
        ))}
      </div>

      {/* Email List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="flex items-center gap-3 text-gray-400 dark:text-white/40">
            <div className="w-5 h-5 border-2 border-indigo-electric border-t-transparent rounded-full animate-spin" />
            <span className="font-mono text-sm tracking-widest uppercase">Loading Emails...</span>
          </div>
        </div>
      ) : filteredEmails.length === 0 ? (
        <div className="glass-card text-center py-16">
          <Mail className="w-12 h-12 text-gray-300 dark:text-white/20 mx-auto mb-3" />
          <p className="font-display font-semibold text-gray-900 dark:text-white mb-1">
            {searchQuery ? 'No emails match your search' : 'No emails yet'}
          </p>
          <p className="text-sm text-gray-500 dark:text-white/50 mb-4">
            {searchQuery
              ? 'Try adjusting your search terms'
              : 'Start sending emails to see them here'}
          </p>
          {!searchQuery && (
            <button
              onClick={() => setShowComposeModal(true)}
              className="text-indigo-electric hover:text-indigo-electric/70 text-sm font-medium transition-colors duration-150"
            >
              Compose your first email
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredEmails.map((email) => (
            <div
              key={email.id}
              className="glass-card p-4 hover:bg-gray-50 dark:hover:bg-white/[0.08] transition-all duration-150 ease-snappy"
            >
              <div className="flex items-center gap-4">
                {/* Status Icon */}
                <div
                  className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${
                    email.replied_at
                      ? 'bg-emerald-signal/15'
                      : 'bg-indigo-electric/15'
                  }`}
                >
                  {email.replied_at ? (
                    <Reply className="w-4 h-4 text-emerald-signal" />
                  ) : (
                    <Send className="w-4 h-4 text-indigo-electric" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-medium text-gray-900 dark:text-white text-sm truncate">
                      {getContactName(email)}
                    </span>
                    {email.contact?.company && (
                      <span className="text-xs text-gray-500 dark:text-white/40 truncate">
                        at {email.contact.company}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 dark:text-white/60 truncate">
                    {getSubject(email)}
                  </p>
                </div>

                {/* Reply Status Badge */}
                <div className="flex-shrink-0 flex items-center gap-3">
                  {email.replied_at ? (
                    <span className="px-2 py-1 text-xs font-semibold rounded-full bg-emerald-signal/15 text-emerald-signal">
                      Replied
                    </span>
                  ) : (
                    <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-white/50">
                      Sent
                    </span>
                  )}
                </div>

                {/* Timestamp */}
                <div className="flex-shrink-0 flex items-center gap-1 text-xs text-gray-500 dark:text-white/40">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{formatTimestamp(email.created_at)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Compose Email Modal */}
      {showComposeModal && (
        <ComposeEmailModal
          isOpen={showComposeModal}
          onClose={() => setShowComposeModal(false)}
          onSuccess={() => {
            setShowComposeModal(false)
            loadEmails()
          }}
        />
      )}
    </div>
  )
}
