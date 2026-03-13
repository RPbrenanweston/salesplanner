// @crumb frontend-component-right-panel-tabs
// UI/Session/Dashboard | activity_timeline_display | research_entry_management | note_creation | cadence_tracking
// why: Right panel tabbed interface for session cockpit — display contact history, manage research entries, create quick notes, show outreach cadence
// in:contactId,contactCompany,orgId,userId,Supabase data(activities,research_entries,notes),query functions out:Three tabs (History/Research/Notes) with full CRUD for research and notes,cadence badge display err:Query failures hide silently,note creation race condition on double-submit
// hazard: No debounce on note/research creation — rapid clicks create duplicates without user feedback
// hazard: Activity timeline fetch has no pagination — large activity histories (100+ records) may cause UI lag or memory bloat
// edge:frontend/src/components/ContactActivityTimeline.tsx -> CALLS
// edge:frontend/src/lib/queries/activityQueries.ts -> CALLS
// edge:frontend/src/lib/queries/researchQueries.ts -> CALLS
// prompt: Add debounce/disable-on-submit for creation buttons. Implement pagination with lazy loading for activity timeline (fetch first 20, load more on scroll).

/**
 * RightPanelTabs — Tabbed right panel for the session cockpit.
 *
 * Three tabs:
 *   1. History  — cadence badge + ContactActivityTimeline
 *   2. Research — contact & company research entries with CRUD
 *   3. Notes    — quick inline note creation + recent notes list
 */
import { useEffect, useState, useCallback } from 'react'
import { Trash2, Plus } from 'lucide-react'
import ContactActivityTimeline from '../ContactActivityTimeline'
import { getContactCadence } from '../../lib/queries/activityQueries'
import { logActivity, getContactHistory } from '../../lib/queries/activityQueries'
import {
  getResearchForContact,
  createResearchEntry,
  deleteResearchEntry,
  RESEARCH_CATEGORY_CONFIG,
} from '../../lib/queries/researchQueries'
import type { ResearchEntry, ResearchCategory, ResearchLevel, Activity } from '../../types/domain'
import { ActivityOutcome } from '../../types/enums'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RightPanelTabsProps {
  contactId: string
  contactCompany: string | null
  orgId: string
  userId: string
  salesblockId: string
  onActivityLogged?: () => void
}

type TabKey = 'history' | 'research' | 'notes'

interface CadenceInfo {
  attemptCount: number
  maxAttempts: number
  daysSinceLastContact: number | null
}

const TAB_CONFIG: { key: TabKey; label: string }[] = [
  { key: 'history', label: 'History' },
  { key: 'research', label: 'Research' },
  { key: 'notes', label: 'Notes' },
]

const RESEARCH_CATEGORIES = Object.keys(RESEARCH_CATEGORY_CONFIG) as ResearchCategory[]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function RightPanelTabs({
  contactId,
  contactCompany,
  orgId,
  userId,
  salesblockId,
  onActivityLogged,
}: RightPanelTabsProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('history')

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex border-b border-gray-200 dark:border-white/10 flex-shrink-0">
        {TAB_CONFIG.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 px-2 py-2.5 text-xs font-medium transition-colors duration-150 relative ${
              activeTab === tab.key
                ? 'text-indigo-600 dark:text-indigo-400'
                : 'text-gray-500 dark:text-white/40 hover:text-gray-700 dark:hover:text-white/60'
            }`}
          >
            {tab.label}
            {activeTab === tab.key && (
              <span className="absolute bottom-0 left-1 right-1 h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* Tab content — scrolls independently */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'history' && (
          <HistoryTab
            contactId={contactId}
            onActivityLogged={onActivityLogged}
          />
        )}
        {activeTab === 'research' && (
          <ResearchTab
            contactId={contactId}
            contactCompany={contactCompany}
            orgId={orgId}
            userId={userId}
          />
        )}
        {activeTab === 'notes' && (
          <NotesTab
            contactId={contactId}
            orgId={orgId}
            userId={userId}
            salesblockId={salesblockId}
            onActivityLogged={onActivityLogged}
          />
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// History Tab
// ---------------------------------------------------------------------------

function HistoryTab({
  contactId,
  onActivityLogged,
}: {
  contactId: string
  onActivityLogged?: () => void
}) {
  const [cadence, setCadence] = useState<CadenceInfo | null>(null)

  useEffect(() => {
    let cancelled = false
    getContactCadence(contactId).then((result) => {
      if (!cancelled) {
        setCadence({
          attemptCount: result.attemptCount,
          maxAttempts: result.maxAttempts,
          daysSinceLastContact: result.daysSinceLastContact,
        })
      }
    }).catch(console.error)
    return () => { cancelled = true }
  }, [contactId])

  return (
    <div className="p-3 space-y-3">
      {/* Cadence badges */}
      {cadence && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">
            Attempt {cadence.attemptCount}/{cadence.maxAttempts}
          </span>
          {cadence.daysSinceLastContact !== null && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-white/50">
              {cadence.daysSinceLastContact === 0
                ? 'Contacted today'
                : `${cadence.daysSinceLastContact}d since last`}
            </span>
          )}
        </div>
      )}

      {/* Reuse existing timeline */}
      <ContactActivityTimeline
        contactId={contactId}
        showAddNote={false}
        onActivityLogged={onActivityLogged}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Research Tab
// ---------------------------------------------------------------------------

function ResearchTab({
  contactId,
  contactCompany,
  orgId,
  userId,
}: {
  contactId: string
  contactCompany: string | null
  orgId: string
  userId: string
}) {
  const [contactEntries, setContactEntries] = useState<ResearchEntry[]>([])
  const [companyEntries, setCompanyEntries] = useState<ResearchEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  // Form state
  const [formLevel, setFormLevel] = useState<ResearchLevel>('contact')
  const [formCategory, setFormCategory] = useState<ResearchCategory>('general')
  const [formContent, setFormContent] = useState('')
  const [saving, setSaving] = useState(false)

  const loadResearch = useCallback(async () => {
    setLoading(true)
    try {
      const result = await getResearchForContact(contactId, contactCompany ?? undefined)
      setContactEntries(result.contactEntries)
      setCompanyEntries(result.companyEntries)
    } catch (err) {
      console.error('Failed to load research:', err)
    } finally {
      setLoading(false)
    }
  }, [contactId, contactCompany])

  useEffect(() => {
    loadResearch()
  }, [loadResearch])

  const handleSave = async () => {
    if (!formContent.trim()) return
    setSaving(true)
    try {
      await createResearchEntry({
        orgId,
        contactId: formLevel === 'contact' ? contactId : null,
        companyName: contactCompany || 'Unknown',
        level: formLevel,
        category: formCategory,
        content: formContent.trim(),
        createdBy: userId,
      })
      setFormContent('')
      setShowForm(false)
      await loadResearch()
    } catch (err) {
      console.error('Failed to save research:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (entryId: string) => {
    setDeleting(entryId)
    try {
      await deleteResearchEntry(entryId)
      await loadResearch()
    } catch (err) {
      console.error('Failed to delete research:', err)
    } finally {
      setDeleting(null)
    }
  }

  const formatTimestamp = (dateString?: string) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
    }).format(date)
  }

  if (loading) {
    return (
      <div className="p-4">
        <p className="text-xs text-gray-400 dark:text-white/30">Loading research...</p>
      </div>
    )
  }

  const isEmpty = contactEntries.length === 0 && companyEntries.length === 0

  return (
    <div className="p-3 space-y-3">
      {/* Add research button */}
      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 w-full px-3 py-2 text-xs font-medium rounded-lg border border-dashed border-gray-300 dark:border-white/15 text-gray-500 dark:text-white/40 hover:border-indigo-400 hover:text-indigo-600 dark:hover:border-indigo-400/50 dark:hover:text-indigo-400 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Research
        </button>
      )}

      {/* Inline form */}
      {showForm && (
        <div className="space-y-2 p-2.5 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.03]">
          {/* Level toggle */}
          <div className="flex gap-1">
            {(['contact', 'company'] as ResearchLevel[]).map((level) => (
              <button
                key={level}
                onClick={() => setFormLevel(level)}
                className={`flex-1 px-2 py-1 text-[10px] font-medium rounded transition-colors ${
                  formLevel === level
                    ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300'
                    : 'bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-white/40 hover:bg-gray-200 dark:hover:bg-white/10'
                }`}
              >
                {level === 'contact' ? 'Contact' : 'Company'}
              </button>
            ))}
          </div>

          {/* Category select */}
          <select
            value={formCategory}
            onChange={(e) => setFormCategory(e.target.value as ResearchCategory)}
            className="w-full px-2 py-1.5 text-xs rounded border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.05] text-gray-900 dark:text-white"
          >
            {RESEARCH_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {RESEARCH_CATEGORY_CONFIG[cat].icon} {RESEARCH_CATEGORY_CONFIG[cat].label}
              </option>
            ))}
          </select>

          {/* Content */}
          <textarea
            value={formContent}
            onChange={(e) => setFormContent(e.target.value)}
            placeholder="Add intel for this contact or company..."
            rows={3}
            className="w-full px-2 py-1.5 text-xs rounded border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.05] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/25 resize-none"
          />

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={!formContent.trim() || saving}
              className="flex-1 px-3 py-1.5 text-xs font-medium rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={() => {
                setShowForm(false)
                setFormContent('')
              }}
              className="px-3 py-1.5 text-xs font-medium rounded border border-gray-200 dark:border-white/10 text-gray-600 dark:text-white/50 hover:bg-gray-50 dark:hover:bg-white/[0.05] transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {isEmpty && !showForm && (
        <div className="py-8 text-center">
          <p className="text-xs text-gray-400 dark:text-white/30">
            No research yet — add intel to prep for calls
          </p>
        </div>
      )}

      {/* Contact-level entries */}
      {contactEntries.length > 0 && (
        <ResearchSection
          title="Contact Intel"
          entries={contactEntries}
          deletingId={deleting}
          onDelete={handleDelete}
          formatTimestamp={formatTimestamp}
        />
      )}

      {/* Company-level entries */}
      {companyEntries.length > 0 && (
        <ResearchSection
          title="Company Intel"
          entries={companyEntries}
          deletingId={deleting}
          onDelete={handleDelete}
          formatTimestamp={formatTimestamp}
        />
      )}
    </div>
  )
}

/** Reusable section for a group of research entries */
function ResearchSection({
  title,
  entries,
  deletingId,
  onDelete,
  formatTimestamp,
}: {
  title: string
  entries: ResearchEntry[]
  deletingId: string | null
  onDelete: (id: string) => void
  formatTimestamp: (date?: string) => string
}) {
  return (
    <div className="space-y-1.5">
      <h4 className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-white/30">
        {title}
      </h4>
      {entries.map((entry) => {
        const config = RESEARCH_CATEGORY_CONFIG[entry.category]
        return (
          <div
            key={entry.id}
            className="group flex gap-2 p-2 rounded-lg border border-gray-100 dark:border-white/5 hover:border-gray-200 dark:hover:border-white/10 transition-colors"
          >
            <span className="text-sm flex-shrink-0 mt-0.5">{config.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-800 dark:text-white/80 leading-relaxed break-words">
                {entry.content}
              </p>
              <p className="text-[10px] text-gray-400 dark:text-white/25 mt-0.5 font-mono">
                {config.label} &middot; {formatTimestamp(entry.created_at)}
              </p>
            </div>
            <button
              onClick={() => onDelete(entry.id)}
              disabled={deletingId === entry.id}
              className="flex-shrink-0 p-1 rounded opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 dark:text-white/20 dark:hover:text-red-400 transition-all disabled:opacity-40"
              title="Delete"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Notes Tab
// ---------------------------------------------------------------------------

function NotesTab({
  contactId,
  orgId,
  userId,
  salesblockId,
  onActivityLogged,
}: {
  contactId: string
  orgId: string
  userId: string
  salesblockId: string
  onActivityLogged?: () => void
}) {
  const [noteText, setNoteText] = useState('')
  const [saving, setSaving] = useState(false)
  const [notes, setNotes] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)

  const loadNotes = useCallback(async () => {
    try {
      const history = await getContactHistory(contactId, 50)
      setNotes(history.filter((activity) => activity.type === 'note'))
    } catch (err) {
      console.error('Failed to load notes:', err)
    } finally {
      setLoading(false)
    }
  }, [contactId])

  useEffect(() => {
    loadNotes()
  }, [loadNotes])

  const handleSaveNote = async () => {
    if (!noteText.trim()) return
    setSaving(true)
    try {
      await logActivity({
        orgId,
        contactId,
        userId,
        salesblockId,
        type: 'note',
        outcome: ActivityOutcome.OTHER,
        notes: noteText.trim(),
      })
      setNoteText('')
      await loadNotes()
      onActivityLogged?.()
    } catch (err) {
      console.error('Failed to save note:', err)
    } finally {
      setSaving(false)
    }
  }

  const formatTimestamp = (dateString?: string) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays}d ago`

    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    }).format(date)
  }

  return (
    <div className="p-3 space-y-3">
      {/* Quick note form */}
      <div className="space-y-2">
        <textarea
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          placeholder="Quick note about this contact..."
          rows={3}
          className="w-full px-2.5 py-2 text-xs rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.03] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/25 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:focus:ring-indigo-400"
        />
        <button
          onClick={handleSaveNote}
          disabled={!noteText.trim() || saving}
          className="w-full px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? 'Saving...' : 'Save Note'}
        </button>
      </div>

      {/* Notes list */}
      {loading ? (
        <p className="text-xs text-gray-400 dark:text-white/30">Loading notes...</p>
      ) : notes.length === 0 ? (
        <div className="py-6 text-center">
          <p className="text-xs text-gray-400 dark:text-white/30">
            No notes yet — add one above
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <h4 className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-white/30">
            Recent Notes
          </h4>
          {notes.map((note) => (
            <div
              key={note.id}
              className="p-2.5 rounded-lg border border-gray-100 dark:border-white/5"
            >
              <p className="text-xs text-gray-800 dark:text-white/80 leading-relaxed break-words whitespace-pre-wrap">
                {note.notes}
              </p>
              <p className="text-[10px] text-gray-400 dark:text-white/25 mt-1.5 font-mono">
                {formatTimestamp(note.created_at)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
