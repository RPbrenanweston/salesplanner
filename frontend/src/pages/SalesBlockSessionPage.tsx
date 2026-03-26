// @crumb salesblock-session-orchestrator
// UI/Core | session_orchestration | contact_queueing | activity_logging | modal_coordination | state_persistence
// why: Live session orchestrator — manages 3-column contact queue, disposition log-and-advance workflow, activity tracking, and session lifecycle (start/resume/complete)
// in:salesblockId:string,user:User out:Session UI with contact queue, active card, activity timeline, modals err:Contact queue load fails,activity log fails,session state corrupt,localStorage malformed
// hazard: Race condition when list_contacts empty — concurrent loadData calls trigger duplicate fallback-resolution inserts to list_contacts junction table
// hazard: Async activity logging (handleDisposition, handleConnectedFlowSave) doesn't retry on failure — network error silently advances queue without recording activity
// hazard: Multi-tab session override — localStorage used for resume state, but no cross-tab sync; last tab to modify state wins, earlier work lost
// hazard: Timer doesn't stop on handleEndSession failure — elapsed time keeps incrementing while session state becomes inconsistent
// hazard: N+1 query problem — per-contact activity status check (line 264) makes 100+ separate queries for 100 contacts instead of single batched query
// hazard: Session completed state not persisted — reload after completion loses isCompleted flag, displays stale debrief funnel with null completionStats
// hazard: Script content fallback opaque — null scriptContent shows hardcoded template, no indicator whether template is from DB or placeholder
// hazard: localStorage parse doesn't validate activeIndex — malformed JSON removes key, but resumed state may have activeIndex >= contacts.length (guarded by Math.min line 508, but still reactive)
// edge:frontend/src/components/session/RightPanelTabs.tsx -> RELATES
// edge:frontend/src/components/session/DispositionButtons.tsx -> CALLS
// edge:frontend/src/components/session/ConnectedFlowPanel.tsx -> CALLS
// edge:frontend/src/components/ComposeEmailModal.tsx -> RELATES
// edge:frontend/src/components/BookMeetingModal.tsx -> RELATES
// edge:frontend/src/components/session/DebriefFunnel.tsx -> RELATES
// edge:frontend/src/lib/queries/activityQueries.ts -> CALLS
// edge:frontend/src/hooks/useAuth.ts -> READS
// edge:frontend/src/lib/supabase.ts -> CALLS
// prompt: Add mutex/debounce to fallback contact resolution to prevent duplicate inserts. Implement retry logic for logActivity with user toast on failure. Persist isCompleted to DB/sessionStorage so reload doesn't lose completion state. Batch activity check with single query + group by. Use script loading state indicator and null safety. Add cross-tab storage events for session state sync on resume.

/** @crumbfn SalesBlockSessionPage | 3-column session orchestrator with queue, disposition logging, modals | Race condition on contact load, async log failures, multi-tab override +L139-L504 */
import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ROUTES } from '../lib/routes'
import { useAuth } from '../hooks/useAuth'
import {
  Phone,
  Mail,
  Check,
  ChevronDown,
  ChevronUp,
  Home,
  Calendar,
  Linkedin,
  SkipForward,
  Pause,
  Play,
  PartyPopper,
  CalendarPlus,
  XCircle,
} from 'lucide-react'
import ComposeEmailModal from '../components/ComposeEmailModal'
import BookMeetingModal from '../components/BookMeetingModal'
import RightPanelTabs from '../components/session/RightPanelTabs'
import { DispositionButtons } from '../components/session/DispositionButtons'
import { ConnectedFlowPanel } from '../components/session/ConnectedFlowPanel'
import DebriefFunnel from '../components/session/DebriefFunnel'
import { logActivity, getSessionStats } from '../lib/queries/activityQueries'
import type { SessionType, ProgressFlags } from '../types/domain'
import type { ActivityOutcome } from '../types/enums'

// ---------- Local interfaces ----------

interface SessionContact {
  id: string
  first_name: string
  last_name: string
  email: string
  phone: string | null
  company: string | null
  title: string | null
  notes: string | null
  linkedin_url: string | null
  hasActivity?: boolean
  activityCount?: number
  lastActivityAt?: string | null
  isSkipped?: boolean
}

interface SalesBlockData {
  id: string
  title: string
  scheduled_start: string
  duration_minutes: number
  status: string
  list_id: string
  script_id?: string | null
  session_type?: SessionType
}

interface LiveStats {
  totalDials: number
  connects: number
  meetings: number
}

// ---------- Component ----------

export default function SalesBlockSessionPage() {
  const { salesblockId } = useParams<{ salesblockId: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()

  // Core state
  const [salesblock, setSalesblock] = useState<SalesBlockData | null>(null)
  const [contacts, setContacts] = useState<SessionContact[]>([])
  const [activeIndex, setActiveIndex] = useState(0)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [loading, setLoading] = useState(true)
  const [orgId, setOrgId] = useState<string>('')

  // Session type derived from salesblock
  const sessionType: SessionType = salesblock?.session_type || 'call'

  // Connected flow panel
  const [connectedFlowOpen, setConnectedFlowOpen] = useState(false)

  // Live stats (updated after each disposition)
  const [liveStats, setLiveStats] = useState<LiveStats>({
    totalDials: 0,
    connects: 0,
    meetings: 0,
  })

  // Call script panel (call sessions only)
  const [scriptExpanded, setScriptExpanded] = useState(false)
  const [scriptContent, setScriptContent] = useState<string | null>(null)

  // Email compose + Book meeting modals (complex flows kept as modals)
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false)
  const [isMeetingModalOpen, setIsMeetingModalOpen] = useState(false)

  // Completion state
  const [isCompleted, setIsCompleted] = useState(false)
  const [completionStats, setCompletionStats] = useState<{
    totalContacts: number
    contactsWorked: number
    calls: number
    emails: number
    social: number
    meetings: number
    connects: number
    conversations: number
  } | null>(null)
  const [sessionNotes, setSessionNotes] = useState('')
  const [noteSaveError, setNoteSaveError] = useState('')
  const [debriefStats, setDebriefStats] = useState<{
    totalDials: number
    connects: number
    intros: number
    conversations: number
    asks: number
    meetings: number
  } | null>(null)

  // Session pause / abandon / timer celebration
  const [isPaused, setIsPaused] = useState(false)
  const [isAbandoned, setIsAbandoned] = useState(false)
  const [timerExpired, setTimerExpired] = useState(false)

  // Session resume
  const [resumeBannerVisible, setResumeBannerVisible] = useState(false)
  const [savedState, setSavedState] = useState<{
    activeIndex: number
    elapsedSeconds: number
    sessionNotes: string
  } | null>(null)

  const activeContact = contacts[activeIndex] || null

  // ---------- Data loading ----------

  useEffect(() => {
    if (!user) return
    async function loadOrgId() {
      const { data, error } = await supabase
        .from('users')
        .select('org_id')
        .eq('id', user!.id)
        .single()
      if (error) {
        console.error('Error loading org_id:', error)
      } else if (data) {
        setOrgId(data.org_id)
      }
    }
    loadOrgId()
  }, [user])

  useEffect(() => {
    if (!salesblockId || !user) return

    async function loadData() {
      try {
        // Fetch salesblock
        const { data: sbData, error: sbError } = await supabase
          .from('salesblocks')
          .select('*')
          .eq('id', salesblockId)
          .single()

        if (sbError) throw sbError
        setSalesblock(sbData)

        // Load call script if assigned
        if (sbData.script_id) {
          const { data: scriptData } = await supabase
            .from('call_scripts')
            .select('content')
            .eq('id', sbData.script_id)
            .single()

          if (scriptData?.content) {
            setScriptContent(scriptData.content)
          }
        }

        // Fetch contacts from the list
        const { data: listContactsData, error: lcError } = await supabase
          .from('list_contacts')
          .select('contact_id')
          .eq('list_id', sbData.list_id)
          .order('position', { ascending: true })

        if (lcError) throw lcError

        let contactIds = listContactsData.map((lc) => lc.contact_id)

        if (contactIds.length === 0) {
          // Fallback: re-resolve via list filter_criteria
          const { data: listData } = await supabase
            .from('lists')
            .select('filter_criteria, org_id')
            .eq('id', sbData.list_id)
            .single()

          const filters = listData?.filter_criteria?.filters
          if (filters && filters.length > 0) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let contactQuery: any = supabase
              .from('contacts')
              .select('id')
              .eq('org_id', listData.org_id)

            for (const filter of filters) {
              if (!filter.value) continue
              if (filter.field === 'custom_field' && filter.customFieldKey) {
                const jsonbPath = `custom_fields->${filter.customFieldKey}`
                if (filter.operator === 'equals')
                  contactQuery = contactQuery.eq(jsonbPath, filter.value)
                else if (filter.operator === 'contains')
                  contactQuery = contactQuery.ilike(jsonbPath, `%${filter.value}%`)
              } else {
                if (filter.operator === 'equals')
                  contactQuery = contactQuery.eq(filter.field, filter.value)
                else if (filter.operator === 'contains')
                  contactQuery = contactQuery.ilike(filter.field, `%${filter.value}%`)
                else if (filter.operator === 'starts_with')
                  contactQuery = contactQuery.ilike(filter.field, `${filter.value}%`)
                else if (filter.operator === 'greater_than' && filter.field === 'created_at')
                  contactQuery = contactQuery.gt(filter.field, filter.value)
                else if (filter.operator === 'less_than' && filter.field === 'created_at')
                  contactQuery = contactQuery.lt(filter.field, filter.value)
              }
            }

            const { data: resolvedContacts } = await contactQuery
            const resolved = (resolvedContacts ?? []) as { id: string }[]
            if (resolved.length > 0) {
              const junctionRecords = resolved.map((c, index) => ({
                list_id: sbData.list_id,
                contact_id: c.id,
                position: index,
              }))
              await supabase.from('list_contacts').insert(junctionRecords)
              contactIds = resolved.map((c) => c.id)
            }
          }

          if (contactIds.length === 0) {
            setContacts([])
            setLoading(false)
            return
          }
        }

        // Fetch contact details
        const { data: contactsData, error: contactsError } = await supabase
          .from('contacts')
          .select('id, first_name, last_name, email, phone, company, title, notes, linkedin_url')
          .in('id', contactIds)

        if (contactsError) throw contactsError

        // Batch activity check — single query instead of N+1
        const { data: activityData } = await supabase
          .from('activities')
          .select('contact_id, created_at')
          .in('contact_id', contactIds)
          .order('created_at', { ascending: false })

        // Build map: contact_id → { count, lastActivityAt }
        const activityMap = new Map<string, { count: number; lastActivityAt: string }>()
        for (const a of activityData || []) {
          const existing = activityMap.get(a.contact_id)
          if (existing) {
            existing.count++
          } else {
            activityMap.set(a.contact_id, { count: 1, lastActivityAt: a.created_at })
          }
        }

        const contactsWithActivity = (contactsData || []).map((contact) => {
          const activity = activityMap.get(contact.id)
          return {
            ...contact,
            hasActivity: !!activity,
            activityCount: activity?.count ?? 0,
            lastActivityAt: activity?.lastActivityAt ?? null,
          }
        })

        // Smart sort: unworked contacts first (by original position),
        // then worked contacts sorted by oldest activity first (due for follow-up)
        contactsWithActivity.sort((a, b) => {
          if (!a.hasActivity && b.hasActivity) return -1
          if (a.hasActivity && !b.hasActivity) return 1
          // Both worked — oldest activity first (needs follow-up soonest)
          if (a.lastActivityAt && b.lastActivityAt) {
            return new Date(a.lastActivityAt).getTime() - new Date(b.lastActivityAt).getTime()
          }
          return 0
        })

        setContacts(contactsWithActivity)

        // Check for saved session state
        const savedRaw = localStorage.getItem(`salesblock_session_${salesblockId}`)
        if (savedRaw) {
          try {
            const saved = JSON.parse(savedRaw)
            setSavedState(saved)
            setResumeBannerVisible(true)
          } catch {
            localStorage.removeItem(`salesblock_session_${salesblockId}`)
          }
        }
      } catch (error) {
        console.error('Error loading session data:', error)
        alert('Failed to load session data')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [salesblockId, user])

  // Start session (status → in_progress) — also handles resuming from paused/abandoned
  useEffect(() => {
    if (!salesblockId || !salesblock) return
    if (!['scheduled', 'paused', 'abandoned'].includes(salesblock.status)) return

    async function startSession() {
      const updates: Record<string, string> = { status: 'in_progress' }
      // Only set actual_start on first start, not resume
      if (salesblock!.status === 'scheduled') {
        updates.actual_start = new Date().toISOString()
      }

      const { error } = await supabase
        .from('salesblocks')
        .update(updates)
        .eq('id', salesblockId)

      if (error) {
        console.error('Error starting session:', error)
      } else {
        setSalesblock((prev) => (prev ? { ...prev, status: 'in_progress' } : null))
      }
    }

    startSession()
  }, [salesblockId, salesblock])

  // Auto-save to localStorage
  useEffect(() => {
    if (!salesblockId || loading || isCompleted) return
    localStorage.setItem(
      `salesblock_session_${salesblockId}`,
      JSON.stringify({ activeIndex, elapsedSeconds, sessionNotes })
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, sessionNotes])

  // Timer — pauses when isPaused, celebrates on expiry instead of auto-ending
  useEffect(() => {
    if (isCompleted || isPaused || timerExpired) return

    const interval = setInterval(() => {
      setElapsedSeconds((prev) => {
        const next = prev + 1
        if (salesblock && next >= salesblock.duration_minutes * 60) {
          setTimerExpired(true)
        }
        return next
      })
    }, 1000)

    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [salesblock, isCompleted, isPaused, timerExpired])

  // Load live stats on mount + after dispositions
  const refreshLiveStats = useCallback(async () => {
    if (!salesblockId) return
    try {
      const stats = await getSessionStats(salesblockId)
      setLiveStats({
        totalDials: stats.totalDials,
        connects: stats.connects,
        meetings: stats.meetings,
      })
    } catch (error) {
      console.error('Error refreshing stats:', error)
    }
  }, [salesblockId])

  useEffect(() => {
    if (salesblockId && !loading) {
      refreshLiveStats()
    }
  }, [salesblockId, loading, refreshLiveStats])

  // ---------- Handlers ----------

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const totalDurationSeconds = salesblock ? salesblock.duration_minutes * 60 : 0
  const progressPct = totalDurationSeconds > 0 ? (elapsedSeconds / totalDurationSeconds) * 100 : 0

  const handleNext = useCallback(() => {
    setConnectedFlowOpen(false)
    if (activeIndex < contacts.length - 1) {
      setActiveIndex((prev) => prev + 1)
    }
  }, [activeIndex, contacts.length])

  const handleSkip = () => {
    setContacts((prev) =>
      prev.map((c, i) => (i === activeIndex ? { ...c, isSkipped: true } : c))
    )
    // Advance to next non-skipped contact
    const nextActive = contacts.findIndex(
      (c, i) => i > activeIndex && !c.isSkipped
    )
    if (nextActive !== -1) {
      setActiveIndex(nextActive)
    } else {
      // Try wrapping to find any non-skipped before current
      const wrapActive = contacts.findIndex(
        (c, i) => i < activeIndex && !c.isSkipped
      )
      if (wrapActive !== -1) {
        setActiveIndex(wrapActive)
      }
      // If all skipped, activeIndex stays (user sees skipped state)
    }
    setConnectedFlowOpen(false)
  }

  // Disposition click → log activity + advance
  const handleDisposition = useCallback(
    async (outcome: ActivityOutcome, label: string) => {
      if (!activeContact || !salesblockId || !user || !orgId) return

      try {
        await logActivity({
          orgId,
          contactId: activeContact.id,
          userId: user.id,
          salesblockId,
          type: sessionType,
          outcome,
          notes: label,
        })

        // Mark contact as worked
        setContacts((prev) =>
          prev.map((c, i) => (i === activeIndex ? { ...c, hasActivity: true } : c))
        )

        refreshLiveStats()
        handleNext()
      } catch (error) {
        console.error('Error logging activity:', error)
      }
    },
    [activeContact, salesblockId, user, orgId, sessionType, activeIndex, refreshLiveStats, handleNext]
  )

  // Connected flow → show panel
  const handleConnectedFlowOpen = useCallback(() => {
    setConnectedFlowOpen(true)
  }, [])

  // Connected flow → save with progress flags
  const handleConnectedFlowSave = useCallback(
    async (flags: ProgressFlags, advance: boolean) => {
      if (!activeContact || !salesblockId || !user || !orgId) return

      try {
        await logActivity({
          orgId,
          contactId: activeContact.id,
          userId: user.id,
          salesblockId,
          type: sessionType,
          outcome: 'connect' as ActivityOutcome,
          progressFlags: flags,
        })

        setContacts((prev) =>
          prev.map((c, i) => (i === activeIndex ? { ...c, hasActivity: true } : c))
        )

        setConnectedFlowOpen(false)
        refreshLiveStats()

        if (advance) handleNext()
      } catch (error) {
        console.error('Error saving connected flow:', error)
      }
    },
    [activeContact, salesblockId, user, orgId, sessionType, activeIndex, refreshLiveStats, handleNext]
  )

  // Pause — stops timer, saves state, user can navigate away and return
  const handlePause = async () => {
    setIsPaused(true)
    if (!salesblockId) return

    // Save current state to localStorage for resume
    localStorage.setItem(
      `salesblock_session_${salesblockId}`,
      JSON.stringify({ activeIndex, elapsedSeconds, sessionNotes })
    )

    // Update status to paused in DB
    await supabase
      .from('salesblocks')
      .update({ status: 'paused' })
      .eq('id', salesblockId)
  }

  const handleUnpause = () => {
    setIsPaused(false)

    // Restore status to in_progress in DB
    if (salesblockId) {
      supabase
        .from('salesblocks')
        .update({ status: 'in_progress' })
        .eq('id', salesblockId)
    }
  }

  // Abandon — emotive exit, does NOT mark as completed
  const handleAbandon = async () => {
    if (!salesblockId) return

    try {
      // Save state so session can be resumed later
      localStorage.setItem(
        `salesblock_session_${salesblockId}`,
        JSON.stringify({ activeIndex, elapsedSeconds, sessionNotes })
      )

      const { error } = await supabase
        .from('salesblocks')
        .update({ status: 'abandoned', actual_end: new Date().toISOString() })
        .eq('id', salesblockId)

      if (error) throw error

      setIsAbandoned(true)
      navigate(ROUTES.HOME)
    } catch (error) {
      console.error('Error abandoning session:', error)
    }
  }

  // Finish — the proper completion path
  const handleEndSession = async () => {
    if (!salesblockId) return

    try {
      // Fetch completion stats
      const { data: activities, error: actErr } = await supabase
        .from('activities')
        .select('type, outcome, contact_id')
        .eq('salesblock_id', salesblockId)

      if (actErr) throw actErr

      const uniqueContacts = new Set(activities?.map((a) => a.contact_id)).size
      const stats = {
        totalContacts: contacts.filter((c) => !c.isSkipped).length,
        contactsWorked: uniqueContacts,
        calls: activities?.filter((a) => a.type === 'call').length || 0,
        emails: activities?.filter((a) => a.type === 'email').length || 0,
        social: activities?.filter((a) => a.type === 'social').length || 0,
        meetings: activities?.filter((a) => a.outcome === 'meeting_booked').length || 0,
        connects: activities?.filter(
          (a) => a.outcome === 'connect' || a.outcome === 'conversation'
        ).length || 0,
        conversations: activities?.filter((a) => a.outcome === 'conversation').length || 0,
      }

      const { error } = await supabase
        .from('salesblocks')
        .update({ status: 'completed', actual_end: new Date().toISOString() })
        .eq('id', salesblockId)

      if (error) throw error

      // Fetch full 7-rate funnel stats
      const funnelStats = await getSessionStats(salesblockId)
      setDebriefStats(funnelStats)

      setCompletionStats(stats)
      setIsCompleted(true)
      if (salesblockId) localStorage.removeItem(`salesblock_session_${salesblockId}`)
    } catch (error) {
      console.error('Error ending session:', error)
      alert('Failed to end session')
    }
  }

  const handleResume = () => {
    if (savedState) {
      setActiveIndex(Math.min(savedState.activeIndex, contacts.length - 1))
      setElapsedSeconds(savedState.elapsedSeconds)
      setSessionNotes(savedState.sessionNotes)
    }
    setResumeBannerVisible(false)
  }

  const handleStartFresh = () => {
    if (salesblockId) localStorage.removeItem(`salesblock_session_${salesblockId}`)
    setResumeBannerVisible(false)
  }

  const handleSaveNotes = async () => {
    if (!salesblockId) return
    setNoteSaveError('')
    try {
      const { error } = await supabase
        .from('salesblocks')
        .update({ notes: sessionNotes })
        .eq('id', salesblockId)
      if (error) throw error
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to save session notes'
      setNoteSaveError(msg)
      console.error('Error saving notes:', error)
    }
  }

  const handleBackToHome = async () => {
    await handleSaveNotes()
    navigate(ROUTES.HOME)
  }

  // ---------- Loading ----------

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50 dark:bg-void-950">
        <div className="flex items-center gap-3 text-gray-400 dark:text-white/40">
          <div className="w-5 h-5 border-2 border-indigo-electric border-t-transparent rounded-full animate-spin" />
          <span className="font-mono text-sm tracking-widest uppercase">Loading Session...</span>
        </div>
      </div>
    )
  }

  if (!salesblock) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50 dark:bg-void-950">
        <div className="glass-card p-6 border-l-4 border-red-alert">
          <p className="text-red-600 dark:text-red-alert text-sm font-semibold">SalesBlock not found</p>
        </div>
      </div>
    )
  }

  // ---------- Empty list guard — don't mark as completed ----------

  if (!loading && contacts.length === 0 && !isCompleted) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50 dark:bg-void-950">
        <div className="glass-card p-8 max-w-md text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-500/10 mb-4">
            <XCircle className="w-6 h-6 text-amber-600 dark:text-amber-400" />
          </div>
          <h2 className="font-display text-xl font-bold text-gray-900 dark:text-white mb-2">
            No contacts in this list
          </h2>
          <p className="text-sm text-gray-500 dark:text-white/40 mb-6">
            The list assigned to this session has no contacts. Add contacts to the list first, then try again.
          </p>
          <button
            onClick={() => navigate(ROUTES.SALESBLOCKS)}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-indigo-electric hover:bg-indigo-electric/80 text-white rounded-lg font-semibold transition-all duration-200 ease-snappy mx-auto"
          >
            <Home className="w-5 h-5" />
            Back to SalesBlocks
          </button>
        </div>
      </div>
    )
  }

  // ---------- Completion screen ----------

  if (isCompleted && completionStats) {
    return (
      <div className="flex flex-col h-full bg-gray-50 dark:bg-void-950 p-8 overflow-y-auto">
        <div className="max-w-4xl mx-auto w-full space-y-6">
          {/* Celebration Header */}
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-signal/10 mb-4">
              <PartyPopper className="w-8 h-8 text-emerald-signal" />
            </div>
            <p className="vv-section-title mb-1">Session Complete</p>
            <h1 className="font-display text-3xl font-bold text-gray-900 dark:text-white mb-1">
              {salesblock.title}
            </h1>
            <p className="text-sm text-gray-500 dark:text-white/50">
              Great work — here's your session summary
            </p>
          </div>

          {/* 7-Rate Debrief Funnel */}
          <DebriefFunnel
            totalDials={debriefStats?.totalDials ?? completionStats.calls}
            connects={debriefStats?.connects ?? completionStats.connects}
            intros={debriefStats?.intros ?? 0}
            conversations={debriefStats?.conversations ?? completionStats.conversations}
            asks={debriefStats?.asks ?? 0}
            meetings={debriefStats?.meetings ?? completionStats.meetings}
            elapsedSeconds={elapsedSeconds}
          />

          {/* Reflection Prompts */}
          <div className="glass-card p-6">
            <label className="vv-section-title block mb-3">Session Reflection</label>
            <div className="space-y-3 mb-4">
              <p className="text-xs text-gray-500 dark:text-white/40 italic">
                These prompts will help with your daily debrief:
              </p>
              <ul className="text-sm text-gray-600 dark:text-white/50 space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-indigo-electric mt-0.5">•</span>
                  What objections came up most? How did you handle them?
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-indigo-electric mt-0.5">•</span>
                  Which conversations felt strongest? What made them work?
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-indigo-electric mt-0.5">•</span>
                  What would you do differently in the next session?
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-indigo-electric mt-0.5">•</span>
                  Any follow-ups you need to action before end of day?
                </li>
              </ul>
            </div>
            <textarea
              value={sessionNotes}
              onChange={(e) => setSessionNotes(e.target.value)}
              placeholder="Capture your reflections here — what worked, what to improve, follow-ups needed..."
              className="w-full px-4 py-3 border border-gray-200 dark:border-white/10 rounded-lg bg-white dark:bg-white/5 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-indigo-electric text-sm"
              rows={5}
            />
            {noteSaveError && (
              <div className="mt-3 p-3 bg-red-alert/10 border border-red-alert rounded-lg flex items-center gap-2">
                <span className="text-red-alert text-sm">{noteSaveError}</span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => {
                handleSaveNotes()
                navigate(ROUTES.SALESBLOCKS + '?action=schedule')
              }}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-indigo-electric hover:bg-indigo-electric/80 text-white rounded-lg font-semibold transition-all duration-200 ease-snappy"
            >
              <CalendarPlus className="w-5 h-5" />
              <span>Schedule Next Session</span>
            </button>
            <button
              onClick={handleBackToHome}
              className="flex items-center justify-center gap-2 px-6 py-3 border border-gray-200 dark:border-white/10 text-gray-700 dark:text-white/70 rounded-lg font-semibold hover:bg-gray-50 dark:hover:bg-white/[0.08] transition-all duration-200 ease-snappy"
            >
              <Home className="w-5 h-5" />
              <span>Back to Home</span>
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ---------- Main Session Layout (3 columns) ----------

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-void-950">
      {/* ── Header Bar: Title + Stats + Timer + End ── */}
      <div className="bg-white dark:bg-white/5 border-b border-gray-200 dark:border-white/10 px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-6">
            <h2 className="font-display text-lg font-semibold text-gray-900 dark:text-white">
              {salesblock.title}
            </h2>
            {/* Live session stats */}
            <div className="hidden md:flex items-center gap-4 text-xs font-mono">
              <span className="text-gray-500 dark:text-white/40">
                Dials{' '}
                <span className="text-gray-900 dark:text-white font-bold">{liveStats.totalDials}</span>
              </span>
              <span className="text-gray-500 dark:text-white/40">
                Connects{' '}
                <span className="text-emerald-600 dark:text-emerald-signal font-bold">
                  {liveStats.connects}
                </span>
              </span>
              <span className="text-gray-500 dark:text-white/40">
                Meetings{' '}
                <span className="text-purple-600 dark:text-purple-neon font-bold">
                  {liveStats.meetings}
                </span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className={`text-sm font-mono ${timerExpired ? 'text-emerald-600 dark:text-emerald-signal font-bold' : isPaused ? 'text-amber-600 dark:text-amber-400' : 'text-gray-600 dark:text-white/50'}`}>
              {isPaused && '⏸ '}
              {formatTime(elapsedSeconds)} / {salesblock.duration_minutes} min
            </div>

            {/* Pause / Resume toggle */}
            {isPaused ? (
              <button
                onClick={handleUnpause}
                className="flex items-center gap-1.5 px-3 py-2 bg-emerald-signal text-white text-sm rounded-lg hover:bg-emerald-signal/80 transition-all duration-200 ease-snappy"
              >
                <Play className="w-4 h-4" />
                Resume
              </button>
            ) : (
              <button
                onClick={handlePause}
                className="flex items-center gap-1.5 px-3 py-2 border border-amber-300 dark:border-amber-500/30 text-amber-700 dark:text-amber-400 text-sm rounded-lg hover:bg-amber-50 dark:hover:bg-amber-500/10 transition-all duration-200 ease-snappy"
              >
                <Pause className="w-4 h-4" />
                Pause
              </button>
            )}

            {/* Abandon — emotive exit */}
            <button
              onClick={handleAbandon}
              className="flex items-center gap-1.5 px-3 py-2 border border-red-300 dark:border-red-500/30 text-red-600 dark:text-red-400 text-sm rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 transition-all duration-200 ease-snappy"
            >
              <XCircle className="w-4 h-4" />
              Abandon
            </button>

            {/* Finish — proper completion */}
            <button
              onClick={handleEndSession}
              className="flex items-center gap-1.5 px-3 py-2 bg-indigo-electric text-white text-sm rounded-lg hover:bg-indigo-electric/80 transition-all duration-200 ease-snappy"
            >
              <Check className="w-4 h-4" />
              Finish
            </button>
          </div>
        </div>
        <div className="w-full bg-gray-200 dark:bg-white/10 rounded-full h-1.5">
          <div
            className={`h-1.5 rounded-full transition-all duration-300 ${timerExpired ? 'bg-emerald-signal' : 'bg-indigo-electric'}`}
            style={{ width: `${Math.min(progressPct, 100)}%` }}
          />
        </div>
      </div>

      {/* Timer Expiry Celebration Banner */}
      {timerExpired && !isCompleted && (
        <div className="bg-gradient-to-r from-emerald-500/10 via-indigo-500/10 to-purple-500/10 border-b border-emerald-500/20 px-4 py-4">
          <div className="flex items-center justify-between max-w-4xl mx-auto">
            <div className="flex items-center gap-3">
              <PartyPopper className="w-6 h-6 text-emerald-signal" />
              <div>
                <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-signal">
                  Time's up — great session!
                </p>
                <p className="text-xs text-gray-500 dark:text-white/40 mt-0.5">
                  You can keep going or finish up and review your session
                </p>
              </div>
            </div>
            <button
              onClick={handleEndSession}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-signal text-white text-sm rounded-lg hover:bg-emerald-signal/80 font-semibold transition-all duration-200 ease-snappy"
            >
              <Check className="w-4 h-4" />
              Finish Session
            </button>
          </div>
        </div>
      )}

      {/* Paused Overlay Banner */}
      {isPaused && (
        <div className="bg-amber-50 dark:bg-amber-500/5 border-b border-amber-200 dark:border-amber-500/20 px-4 py-4">
          <div className="flex items-center justify-between max-w-4xl mx-auto">
            <div className="flex items-center gap-3">
              <Pause className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              <div>
                <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">Session Paused</p>
                <p className="text-xs text-gray-500 dark:text-white/40 mt-0.5">
                  Timer stopped. You can leave and come back — your progress is saved.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate(ROUTES.HOME)}
                className="px-3 py-1.5 text-xs border border-gray-200 dark:border-white/10 text-gray-600 dark:text-white/60 rounded-lg hover:bg-gray-50 dark:hover:bg-white/[0.08] transition-all duration-150 ease-snappy"
              >
                Leave Session
              </button>
              <button
                onClick={handleUnpause}
                className="flex items-center gap-1 px-3 py-1.5 text-xs bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-all duration-200 ease-snappy"
              >
                <Play className="w-3 h-3" />
                Resume
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Resume Banner */}
      {resumeBannerVisible && (
        <div className="bg-indigo-electric/10 border-b border-indigo-electric/30 px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-indigo-electric">Resume where you left off?</p>
            <p className="text-xs text-gray-500 dark:text-white/40 mt-0.5">
              Saved progress — contact {(savedState?.activeIndex ?? 0) + 1} of {contacts.length}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleStartFresh}
              className="px-3 py-1.5 text-xs border border-gray-200 dark:border-white/10 text-gray-600 dark:text-white/60 rounded-lg hover:bg-gray-50 dark:hover:bg-white/[0.08] transition-all duration-150 ease-snappy"
            >
              Start Fresh
            </button>
            <button
              onClick={handleResume}
              className="px-3 py-1.5 text-xs bg-indigo-electric text-white rounded-lg hover:bg-indigo-electric/80 transition-all duration-200 ease-snappy"
            >
              Resume
            </button>
          </div>
        </div>
      )}

      {/* ── 3-Column Body ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ─── LEFT: Contact Queue ─── */}
        <div className="w-64 border-r border-gray-200 dark:border-white/10 overflow-y-auto bg-gray-50 dark:bg-white/[0.02] flex-shrink-0">
          <div className="p-3 border-b border-gray-200 dark:border-white/10">
            <h3 className="vv-section-title text-xs">Queue ({contacts.filter((c) => !c.isSkipped).length})</h3>
            <p className="text-[10px] text-gray-400 dark:text-white/30 font-mono mt-0.5">
              {activeIndex + 1} of {contacts.length}
            </p>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-white/10">
            {contacts.filter((c) => !c.isSkipped).map((contact) => {
              const originalIndex = contacts.indexOf(contact)
              return (
                <div
                  key={contact.id}
                  className={`px-3 py-2.5 cursor-pointer transition-all duration-150 ease-snappy ${
                    originalIndex === activeIndex
                      ? 'bg-indigo-electric/10 dark:bg-indigo-electric/10 border-l-4 border-indigo-electric'
                      : 'hover:bg-gray-50 dark:hover:bg-white/[0.08]'
                  }`}
                  onClick={() => {
                    setActiveIndex(originalIndex)
                    setConnectedFlowOpen(false)
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {contact.first_name} {contact.last_name}
                      </p>
                      <p className="text-[11px] text-gray-500 dark:text-white/40 truncate">
                        {contact.company || 'No company'}
                      </p>
                    </div>
                    {contact.hasActivity && (
                      <span className="flex items-center gap-1 flex-shrink-0 ml-1.5">
                        {(contact.activityCount ?? 0) > 1 && (
                          <span className="text-[10px] font-mono text-emerald-signal bg-emerald-signal/10 rounded-full px-1.5 py-0.5">
                            {contact.activityCount}x
                          </span>
                        )}
                        <Check className="w-4 h-4 text-emerald-signal" />
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
            {contacts.filter((c) => !c.isSkipped).length === 0 && (
              <div className="p-6 text-center">
                <p className="text-sm text-gray-500 dark:text-white/40">No contacts in this list</p>
              </div>
            )}
          </div>

          {/* ─── Skipped Contacts Review Section ─── */}
          {contacts.some((c) => c.isSkipped) && (
            <>
              <div className="p-3 border-t border-b border-amber-200 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/5">
                <h3 className="vv-section-title text-xs text-amber-700 dark:text-amber-400">
                  Skipped ({contacts.filter((c) => c.isSkipped).length})
                </h3>
                <p className="text-[10px] text-amber-500 dark:text-amber-400/60 font-mono mt-0.5">
                  Review or remove
                </p>
              </div>
              <div className="divide-y divide-gray-200 dark:divide-white/10">
                {contacts.filter((c) => c.isSkipped).map((contact) => {
                  const originalIndex = contacts.indexOf(contact)
                  return (
                    <div
                      key={contact.id}
                      className={`px-3 py-2.5 cursor-pointer transition-all duration-150 ease-snappy opacity-60 ${
                        originalIndex === activeIndex
                          ? 'bg-amber-50 dark:bg-amber-500/10 border-l-4 border-amber-400'
                          : 'hover:bg-gray-50 dark:hover:bg-white/[0.08]'
                      }`}
                      onClick={() => {
                        setActiveIndex(originalIndex)
                        setConnectedFlowOpen(false)
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-500 dark:text-white/50 truncate">
                            {contact.first_name} {contact.last_name}
                          </p>
                          <p className="text-[11px] text-gray-400 dark:text-white/30 truncate">
                            {contact.company || 'No company'}
                          </p>
                        </div>
                        <SkipForward className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 ml-1.5" />
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>

        {/* ─── CENTER: Active Contact + Dispositions ─── */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeContact ? (
            <div className="max-w-2xl">
              {/* Contact header */}
              <div className="mb-4">
                <h1 className="font-display text-2xl font-bold text-gray-900 dark:text-white mb-1">
                  {activeContact.first_name} {activeContact.last_name}
                </h1>
                <p className="text-sm text-gray-600 dark:text-white/50">
                  {activeContact.title || 'No title'} at {activeContact.company || 'No company'}
                </p>
              </div>

              {/* Contact info */}
              <div className="flex flex-wrap gap-4 mb-5">
                {activeContact.phone && (
                  <a
                    href={`tel:${activeContact.phone}`}
                    className="flex items-center gap-2 text-sm text-indigo-electric hover:text-indigo-electric/70 transition-colors"
                  >
                    <Phone className="w-4 h-4" />
                    {activeContact.phone}
                  </a>
                )}
                <a
                  href={`mailto:${activeContact.email}`}
                  className="flex items-center gap-2 text-sm text-indigo-electric hover:text-indigo-electric/70 transition-colors"
                >
                  <Mail className="w-4 h-4" />
                  {activeContact.email}
                </a>
                {activeContact.linkedin_url && (
                  <a
                    href={activeContact.linkedin_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-indigo-electric hover:text-indigo-electric/70 transition-colors"
                  >
                    <Linkedin className="w-4 h-4" />
                    LinkedIn
                  </a>
                )}
              </div>

              {/* Contact notes */}
              {activeContact.notes && (
                <div className="mb-5 p-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg">
                  <p className="text-sm text-gray-600 dark:text-white/40 whitespace-pre-wrap">
                    {activeContact.notes}
                  </p>
                </div>
              )}

              {/* Call Script (call sessions only) */}
              {sessionType === 'call' && (
                <div className="mb-5">
                  <button
                    onClick={() => setScriptExpanded(!scriptExpanded)}
                    className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 transition-all duration-150 ease-snappy"
                  >
                    <span className="text-sm font-semibold text-gray-700 dark:text-white/70">
                      Call Script
                    </span>
                    {scriptExpanded ? (
                      <ChevronUp className="w-4 h-4 text-gray-500 dark:text-white/40" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-500 dark:text-white/40" />
                    )}
                  </button>
                  {scriptExpanded && (
                    <div className="mt-2 p-4 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg">
                      <p className="text-sm text-gray-600 dark:text-white/50 whitespace-pre-wrap">
                        {scriptContent
                          ? scriptContent
                          : `Hi, this is [Your Name] from [Company]. I'm reaching out because we help companies like ${activeContact.company || '[Company]'} with [Value Proposition].\n\nI wanted to see if you have a few minutes to discuss how we could help you with [Specific Pain Point]?\n\n[Listen for response and move to qualification questions...]`}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* ── Disposition Buttons ── */}
              <div className="mb-5">
                <h3 className="vv-section-title mb-2">Disposition</h3>
                <DispositionButtons
                  sessionType={sessionType}
                  onDisposition={handleDisposition}
                  onConnectedFlow={handleConnectedFlowOpen}
                  disabled={connectedFlowOpen}
                />
              </div>

              {/* ── Connected Flow Panel (inline, shows when "Connected" clicked) ── */}
              {connectedFlowOpen && (
                <ConnectedFlowPanel
                  onSaveAndNext={(flags) => handleConnectedFlowSave(flags, true)}
                  onSaveAndStay={(flags) => handleConnectedFlowSave(flags, false)}
                  onCancel={() => setConnectedFlowOpen(false)}
                />
              )}

              {/* Quick actions — email compose + book meeting */}
              <div className="flex gap-2 mt-5">
                <button
                  onClick={() => setIsEmailModalOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 text-sm border border-gray-200 dark:border-white/10 text-gray-700 dark:text-white/70 rounded-lg hover:bg-gray-50 dark:hover:bg-white/[0.08] transition-all duration-150 ease-snappy"
                >
                  <Mail className="w-4 h-4" />
                  Compose Email
                </button>
                <button
                  onClick={() => setIsMeetingModalOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 text-sm border border-gray-200 dark:border-white/10 text-gray-700 dark:text-white/70 rounded-lg hover:bg-gray-50 dark:hover:bg-white/[0.08] transition-all duration-150 ease-snappy"
                >
                  <Calendar className="w-4 h-4" />
                  Book Meeting
                </button>
              </div>

              {/* Skip / Next navigation */}
              <div className="flex gap-2 mt-4 pt-4 border-t border-gray-200 dark:border-white/10">
                <button
                  onClick={handleSkip}
                  disabled={contacts.filter((c) => !c.isSkipped).length <= 1 || activeContact?.isSkipped}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm border border-gray-200 dark:border-white/10 text-gray-600 dark:text-white/50 rounded-lg hover:bg-amber-50 hover:border-amber-200 hover:text-amber-700 dark:hover:bg-amber-500/10 dark:hover:border-amber-500/30 dark:hover:text-amber-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150 ease-snappy"
                >
                  <SkipForward className="w-3.5 h-3.5" />
                  Skip
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-gray-500 dark:text-white/40">No contact selected</p>
            </div>
          )}
        </div>

        {/* ─── RIGHT: Tabbed Panel (History / Research / Notes) ─── */}
        <div className="w-80 border-l border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.02] flex-shrink-0 flex flex-col overflow-hidden">
          {activeContact ? (
            <RightPanelTabs
              contactId={activeContact.id}
              contactCompany={activeContact.company ?? null}
              orgId={orgId}
              userId={user!.id}
              salesblockId={salesblockId!}
              onActivityLogged={refreshLiveStats}
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-xs text-gray-400 dark:text-white/30">Select a contact</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Modals ── */}
      {activeContact && (
        <ComposeEmailModal
          isOpen={isEmailModalOpen}
          onClose={() => setIsEmailModalOpen(false)}
          contact={activeContact}
          onSuccess={() => {
            setIsEmailModalOpen(false)
            refreshLiveStats()
          }}
        />
      )}

      {activeContact && (
        <BookMeetingModal
          isOpen={isMeetingModalOpen}
          onClose={() => setIsMeetingModalOpen(false)}
          contact={activeContact}
          salesblockId={salesblockId}
          onSuccess={() => {
            setIsMeetingModalOpen(false)
            refreshLiveStats()
          }}
        />
      )}
    </div>
  )
}
