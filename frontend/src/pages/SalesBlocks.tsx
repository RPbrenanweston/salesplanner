// @crumb frontend-page-salesblocks
// UI/PAGES | display_org_salesblocks | status_badges | create_modal | navigate_to_session | play_edit_delete
// why: SalesBlock management index — create, list, and launch timed outreach sessions targeting contact lists
// in:supabase(salesblocks joined to lists),useAuth(user/org_id),useNavigate,CreateSalesBlockModal out:grid of SalesBlock cards with play/edit/delete actions and status indicators err:Supabase query failure(empty grid),delete without confirmation
// hazard: Delete fires immediately on click with no confirmation dialog — accidental clicks destroy sessions with logged activities
// hazard: salesblocks query may not be scoped to org_id — verify RLS policy to prevent cross-org data leak
// edge:frontend/src/components/CreateSalesBlockModal.tsx -> CALLS
// edge:frontend/src/pages/SalesBlockSessionPage.tsx -> RELATES
// edge:frontend/src/lib/supabase.ts -> CALLS
// edge:frontend/src/App.tsx -> RELATES
// edge:salesblocks#1 -> STEP_IN
// prompt: Add delete confirmation dialog. Audit salesblocks query for org_id scoping. Add empty state UI. Consider status filter tabs.
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Play, Edit, X, Users, User, Linkedin, Mail, Phone, CheckCircle, Grid, Zap } from 'lucide-react'
import { CreateSalesBlockModal } from '../components/CreateSalesBlockModal'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { deleteCalendarEvent } from '../lib/calendar'
import { toast } from '../hooks/use-toast'
import ConfirmDeleteDialog from '../components/ConfirmDeleteDialog'

type TabType = 'upcoming' | 'in_progress' | 'completed' | 'all'
type ViewType = 'my' | 'team'
type DisplayMode = 'list' | 'campaign'

interface SalesBlock {
  id: string
  title: string
  scheduled_start: string
  scheduled_end: string
  duration_minutes: number
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
  list_id: string
  user_id: string
  calendar_event_id?: string | null
  calendar_provider?: 'google_calendar' | 'outlook_calendar' | null
  list?: { name: string }
  // For completed blocks stats
  contact_count?: number
  calls_made?: number
  emails_sent?: number
  social_touches?: number
  meetings_booked?: number
  contacts_worked?: number
}

// Campaign View Component — Shows multi-step touchpoint sequences
const CampaignViewGrid = ({ salesblocks }: { salesblocks: SalesBlock[] }) => {
  const touchpointSequence = [
    { step: 1, label: 'LinkedIn', icon: Linkedin, color: 'text-blue-500' },
    { step: 2, label: 'Email', icon: Mail, color: 'text-cyan-500' },
    { step: 3, label: 'Call', icon: Phone, color: 'text-emerald-500' },
    { step: 4, label: 'Follow-up', icon: CheckCircle, color: 'text-purple-500' },
  ]

  const getActivityCount = (sb: SalesBlock, activityType: string): number => {
    if (activityType === 'email') return sb.emails_sent || 0
    if (activityType === 'call') return sb.calls_made || 0
    if (activityType === 'social') return sb.social_touches || 0
    if (activityType === 'meeting') return sb.meetings_booked || 0
    return 0
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {salesblocks.map((sb) => (
        <div
          key={sb.id}
          className="glass-card p-6 hover:bg-gray-50 dark:hover:bg-white/[0.08] transition-all duration-150 ease-snappy group"
        >
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-display font-semibold text-gray-900 dark:text-white mb-1">{sb.title}</h3>
                <p className="text-sm text-gray-500 dark:text-white/40">{sb.list?.name}</p>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`px-2 py-1 text-xs font-semibold rounded-full ${
                    sb.status === 'completed'
                      ? 'bg-emerald-signal/20 text-emerald-signal'
                      : sb.status === 'in_progress'
                      ? 'bg-cyan-neon/20 text-cyan-neon'
                      : 'bg-indigo-electric/20 text-indigo-electric'
                  }`}
                >
                  {sb.status === 'completed' ? 'Completed' : sb.status === 'in_progress' ? 'Active' : 'Upcoming'}
                </span>
              </div>
            </div>
            <p className="text-xs text-gray-500 dark:text-white/40">
              {sb.duration_minutes} min session {sb.contact_count ? `• ${sb.contact_count} prospects` : ''}
            </p>
          </div>

          {/* Multi-step Sequence */}
          <div className="space-y-4">
            <p className="vv-section-title">Outreach Flow</p>
            <div className="space-y-3">
              {touchpointSequence.map((tp, idx) => {
                const Icon = tp.icon
                const count = getActivityCount(
                  sb,
                  tp.label === 'Email'
                    ? 'email'
                    : tp.label === 'Call'
                    ? 'call'
                    : tp.label === 'LinkedIn'
                    ? 'social'
                    : 'meeting'
                )
                return (
                  <div key={tp.step} className="flex items-center gap-3">
                    {/* Step circle */}
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 dark:bg-white/10 border border-gray-200 dark:border-white/20 flex-shrink-0">
                      <Icon className={`w-4 h-4 ${tp.color}`} />
                    </div>
                    {/* Label and count */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">{tp.label}</span>
                        {count > 0 && (
                          <span className="text-xs font-bold text-cyan-neon bg-cyan-neon/10 px-2 py-1 rounded">
                            {count} {tp.label === 'Follow-up' ? 'sent' : 'completed'}
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Arrow */}
                    {idx < touchpointSequence.length - 1 && (
                      <div className="text-gray-300 dark:text-white/30">→</div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Summary */}
          {sb.contacts_worked !== undefined && (
            <div className="mt-6 pt-6 border-t border-gray-200 dark:border-white/10">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="bg-gray-50 dark:bg-white/5 rounded-lg p-3">
                  <p className="text-xs text-gray-500 dark:text-white/40 mb-1">Prospects Worked</p>
                  <p className="font-mono text-lg font-bold text-gray-900 dark:text-white">
                    {sb.contacts_worked} <span className="text-xs text-gray-500 dark:text-white/40">/ {sb.contact_count}</span>
                  </p>
                </div>
                <div className="bg-gray-50 dark:bg-white/5 rounded-lg p-3">
                  <p className="text-xs text-gray-500 dark:text-white/40 mb-1">Total Actions</p>
                  <p className="text-lg font-bold text-cyan-neon">
                    {(sb.calls_made || 0) + (sb.emails_sent || 0) + (sb.social_touches || 0) + (sb.meetings_booked || 0)}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

export default function SalesBlocks() {
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingSalesblock, setEditingSalesblock] = useState<SalesBlock | null>(null)
  const [salesblocks, setSalesblocks] = useState<SalesBlock[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabType>('upcoming')
  const [viewType, setViewType] = useState<ViewType>('my')
  const [displayMode, setDisplayMode] = useState<DisplayMode>('list')
  const [isManager, setIsManager] = useState(false)
  const [teamId, setTeamId] = useState<string | null>(null)
  const [orgId, setOrgId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null)
  const { user } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    loadUserRole()
  }, [user])

  useEffect(() => {
    loadSalesblocks()
  }, [user, orgId, activeTab, viewType])

  const loadUserRole = async () => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .from('users')
        .select('role, team_id, org_id')
        .eq('id', user.id)
        .maybeSingle()

      if (error) throw error
      if (data) {
        setIsManager(data.role === 'manager')
        setTeamId(data.team_id)
        setOrgId(data.org_id)
      }
    } catch (error) {
      console.error('Error loading user role:', error)
    }
  }

  const loadSalesblocks = async () => {
    if (!user) return
    setLoading(true)

    try {
      let query = supabase
        .from('salesblocks')
        .select(`
          *,
          list:lists(name)
        `)

      // Scope to org
      if (orgId) query = query.eq('org_id', orgId)

      // Apply view filter (my vs team)
      if (viewType === 'my') {
        query = query.eq('user_id', user.id)
      } else if (viewType === 'team' && teamId) {
        // Team view: fetch team members first, then filter salesblocks
        const { data: teamUsers, error: teamError } = await supabase
          .from('users')
          .select('id')
          .eq('team_id', teamId)

        if (teamError) throw teamError
        const teamUserIds = teamUsers?.map(u => u.id) || []
        query = query.in('user_id', teamUserIds)
      }

      // Apply tab filter
      if (activeTab === 'upcoming') {
        query = query.eq('status', 'scheduled')
      } else if (activeTab === 'in_progress') {
        query = query.eq('status', 'in_progress')
      } else if (activeTab === 'completed') {
        query = query.eq('status', 'completed')
      }
      // 'all' tab: no status filter

      // Sort: upcoming ascending, others descending
      const ascending = activeTab === 'upcoming'
      query = query.order('scheduled_start', { ascending })

      const { data, error } = await query

      if (error) throw error

      // For completed salesblocks, fetch summary stats
      const enrichedData = await Promise.all(
        (data || []).map(async (sb) => {
          if (sb.status === 'completed') {
            // Fetch contact count from list
            const { count: contactCount } = await supabase
              .from('list_contacts')
              .select('*', { count: 'exact', head: true })
              .eq('list_id', sb.list_id)

            // Fetch activity stats for this salesblock
            const { data: activities } = await supabase
              .from('activities')
              .select('type')
              .eq('salesblock_id', sb.id)

            const callsMade = activities?.filter(a => a.type === 'call').length || 0
            const emailsSent = activities?.filter(a => a.type === 'email').length || 0
            const socialTouches = activities?.filter(a => a.type === 'social').length || 0
            const meetingsBooked = activities?.filter(a => a.type === 'meeting').length || 0

            // Contacts worked = unique contact_ids in activities
            const { data: uniqueContacts } = await supabase
              .from('activities')
              .select('contact_id')
              .eq('salesblock_id', sb.id)

            const contactsWorked = new Set(uniqueContacts?.map(a => a.contact_id)).size

            return {
              ...sb,
              contact_count: contactCount || 0,
              calls_made: callsMade,
              emails_sent: emailsSent,
              social_touches: socialTouches,
              meetings_booked: meetingsBooked,
              contacts_worked: contactsWorked,
            }
          }
          return sb
        })
      )

      setSalesblocks(enrichedData)
    } catch (error) {
      console.error('Error loading salesblocks:', error)
      setLoadError('Failed to load SalesBlocks. Please refresh the page.')
      setLoading(false)
    } finally {
      setLoading(false)
    }
  }

  const handleStart = (salesblockId: string) => {
    navigate(`/salesblocks/${salesblockId}/session`)
  }

  const handleEdit = (salesblockId: string) => {
    const sb = salesblocks.find(s => s.id === salesblockId)
    if (sb) {
      setEditingSalesblock(sb)
    }
  }

  const handleCancelConfirmed = async (salesblockId: string) => {
    setDeleteTarget(null)
    try {
      // Fetch salesblock to get calendar_event_id and provider
      const { data: salesblock } = await supabase
        .from('salesblocks')
        .select('calendar_event_id, calendar_provider')
        .eq('id', salesblockId)
        .single()

      // Update status to cancelled
      const { error } = await supabase
        .from('salesblocks')
        .update({ status: 'cancelled' })
        .eq('id', salesblockId)

      if (error) throw error

      // Delete calendar event if exists
      if (salesblock?.calendar_event_id && salesblock?.calendar_provider) {
        await deleteCalendarEvent(salesblock.calendar_event_id, salesblock.calendar_provider)
      }

      loadSalesblocks()
    } catch (error) {
      console.error('Error cancelling salesblock:', error)
      toast({ variant: 'destructive', title: 'Failed to cancel SalesBlock', description: 'Please try again.' })
    }
  }

  const formatDateTime = (isoString: string) => {
    const date = new Date(isoString)
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  }

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'scheduled':
        return 'bg-indigo-electric/15 text-indigo-electric'
      case 'in_progress':
        return 'bg-cyan-neon/15 text-cyan-neon'
      case 'completed':
        return 'bg-emerald-signal/15 text-emerald-signal'
      case 'cancelled':
        return 'bg-red-alert/15 text-red-alert'
      default:
        return 'bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-white/50'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'scheduled':
        return 'Scheduled'
      case 'in_progress':
        return 'In Progress'
      case 'completed':
        return 'Completed'
      case 'cancelled':
        return 'Cancelled'
      default:
        return status
    }
  }

  const tabs: { key: TabType; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'in_progress', label: 'Active' },
    { key: 'completed', label: 'Completed' },
    { key: 'upcoming', label: 'Scheduled' },
  ]

  return (
    <div className="min-h-full bg-gray-50 dark:bg-void-950 p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="vv-section-title mb-1">Sessions</p>
          <h1 className="font-display text-3xl font-bold text-gray-900 dark:text-white">
            SalesBlocks
          </h1>
          <p className="text-sm text-gray-500 dark:text-white/50 mt-1">
            Manage your timed focus sessions
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg p-1">
            <button
              onClick={() => setDisplayMode('list')}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all duration-150 ease-snappy ${
                displayMode === 'list'
                  ? 'bg-indigo-electric text-white'
                  : 'text-gray-600 dark:text-white/70 hover:bg-gray-50 dark:hover:bg-white/10'
              }`}
              title="List View"
            >
              <Grid className="w-4 h-4" />
              List
            </button>
            <button
              onClick={() => setDisplayMode('campaign')}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all duration-150 ease-snappy ${
                displayMode === 'campaign'
                  ? 'bg-indigo-electric text-white'
                  : 'text-gray-600 dark:text-white/70 hover:bg-gray-50 dark:hover:bg-white/10'
              }`}
              title="Campaign View"
            >
              <Zap className="w-4 h-4" />
              Campaign
            </button>
          </div>

          {isManager && (
            <div className="flex items-center gap-1 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg p-1">
              <button
                onClick={() => setViewType('my')}
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all duration-150 ease-snappy ${
                  viewType === 'my'
                    ? 'bg-indigo-electric text-white'
                    : 'text-gray-600 dark:text-white/70 hover:bg-gray-50 dark:hover:bg-white/10'
                }`}
              >
                <User className="w-4 h-4" />
                My SalesBlocks
              </button>
              <button
                onClick={() => setViewType('team')}
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all duration-150 ease-snappy ${
                  viewType === 'team'
                    ? 'bg-indigo-electric text-white'
                    : 'text-gray-600 dark:text-white/70 hover:bg-gray-50 dark:hover:bg-white/10'
                }`}
              >
                <Users className="w-4 h-4" />
                Team SalesBlocks
              </button>
            </div>
          )}
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-electric hover:bg-indigo-electric/80 text-white rounded-lg text-sm font-semibold transition-all duration-200 ease-snappy"
          >
            <Plus className="w-4 h-4" />
            Create SalesBlock
          </button>
        </div>
      </div>

      {/* Tab Filters */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-white/10">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
              activeTab === tab.key
                ? 'border-indigo-electric text-indigo-electric'
                : 'border-transparent text-gray-600 dark:text-white/50 hover:text-gray-900 dark:hover:text-white/80'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loadError && (
        <div className="rounded-lg bg-red-alert/10 border border-red-alert/30 p-4 m-4">
          <p className="text-sm text-red-alert">{loadError}</p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="flex items-center gap-3 text-gray-400 dark:text-white/40">
            <div className="w-5 h-5 border-2 border-indigo-electric border-t-transparent rounded-full animate-spin" />
            <span className="font-mono text-sm tracking-widest uppercase">Loading SalesBlocks...</span>
          </div>
        </div>
      ) : salesblocks.length === 0 ? (
        <div className="glass-card text-center py-16 px-8">
          <Zap className="mx-auto h-10 w-10 text-indigo-electric/40 mb-4" />
          <p className="font-display font-semibold text-gray-900 dark:text-white mb-2">
            No {activeTab === 'all' ? '' : activeTab === 'in_progress' ? 'active' : activeTab === 'upcoming' ? 'scheduled' : activeTab} SalesBlocks
          </p>
          <p className="text-sm text-gray-500 dark:text-white/50 mb-6 max-w-sm mx-auto">
            SalesBlocks are timed focus sessions that help you work through contact lists with structured outreach.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-electric hover:bg-indigo-electric/80 text-white rounded-lg text-sm font-semibold transition-all duration-200 ease-snappy"
          >
            <Plus className="w-4 h-4" />
            Create SalesBlock
          </button>
        </div>
      ) : displayMode === 'campaign' ? (
        <CampaignViewGrid salesblocks={salesblocks} />
      ) : (
        <div className="grid gap-4">
          {salesblocks.map((sb) => (
            <div
              key={sb.id}
              className="glass-card p-6"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-display font-semibold text-gray-900 dark:text-white">
                      {sb.title}
                    </h3>
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusBadgeClass(
                        sb.status
                      )}`}
                    >
                      {getStatusLabel(sb.status)}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600 dark:text-white/50 space-y-1">
                    <p>
                      <span className="font-medium">List:</span>{' '}
                      {sb.list?.name || 'Unknown'}
                    </p>
                    <p>
                      <span className="font-medium">When:</span>{' '}
                      {formatDateTime(sb.scheduled_start)}
                    </p>
                    <p>
                      <span className="font-medium">Duration:</span> {sb.duration_minutes}{' '}
                      minutes
                    </p>
                    {sb.status === 'completed' && sb.contact_count !== undefined && (
                      <div className="mt-3 pt-3 border-t border-gray-200 dark:border-white/10">
                        <p className="font-display font-medium text-gray-900 dark:text-white mb-2">
                          Session Summary
                        </p>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-gray-500 dark:text-white/40">
                              Contacts Worked:
                            </span>{' '}
                            <span className="font-mono font-medium text-gray-900 dark:text-white">
                              {sb.contacts_worked} / {sb.contact_count}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500 dark:text-white/40">
                              Calls:
                            </span>{' '}
                            <span className="font-mono font-medium text-gray-900 dark:text-white">
                              {sb.calls_made}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500 dark:text-white/40">
                              Emails:
                            </span>{' '}
                            <span className="font-mono font-medium text-gray-900 dark:text-white">
                              {sb.emails_sent}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500 dark:text-white/40">
                              Social:
                            </span>{' '}
                            <span className="font-mono font-medium text-gray-900 dark:text-white">
                              {sb.social_touches}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500 dark:text-white/40">
                              Meetings:
                            </span>{' '}
                            <span className="font-mono font-medium text-gray-900 dark:text-white">
                              {sb.meetings_booked}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 ml-4">
                  {sb.status === 'scheduled' && (
                    <>
                      <button
                        onClick={() => handleStart(sb.id)}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-signal hover:bg-emerald-signal/80 text-white rounded-lg text-sm font-semibold transition-all duration-200 ease-snappy"
                      >
                        <Play className="w-4 h-4" />
                        Start
                      </button>
                      <button
                        onClick={() => handleEdit(sb.id)}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-white/70 rounded-lg hover:bg-gray-200 dark:hover:bg-white/20 text-sm font-semibold transition-all duration-150 ease-snappy"
                      >
                        <Edit className="w-4 h-4" />
                        Edit
                      </button>
                      <button
                        onClick={() => setDeleteTarget({ id: sb.id, title: sb.title })}
                        className="flex items-center gap-2 px-4 py-2 bg-red-alert/10 text-red-alert rounded-lg hover:bg-red-alert/20 text-sm font-semibold transition-all duration-150 ease-snappy"
                      >
                        <X className="w-4 h-4" />
                        Cancel
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <CreateSalesBlockModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => {
          setShowCreateModal(false)
          loadSalesblocks()
        }}
      />

      {/* Edit Modal — reuses CreateSalesBlockModal in edit mode */}
      {editingSalesblock && (
        <CreateSalesBlockModal
          isOpen={!!editingSalesblock}
          onClose={() => setEditingSalesblock(null)}
          onSuccess={() => {
            setEditingSalesblock(null)
            loadSalesblocks()
          }}
          editData={{
            id: editingSalesblock.id,
            title: editingSalesblock.title,
            list_id: editingSalesblock.list_id,
            script_id: (editingSalesblock as any).script_id ?? null,
            scheduled_start: editingSalesblock.scheduled_start,
            duration_minutes: editingSalesblock.duration_minutes,
          }}
        />
      )}

      <ConfirmDeleteDialog
        isOpen={deleteTarget !== null}
        itemType="SalesBlock"
        itemName={deleteTarget?.title ?? ''}
        onConfirm={() => deleteTarget && handleCancelConfirmed(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
