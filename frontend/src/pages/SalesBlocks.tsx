import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Play, Edit, X, Users, User, Linkedin, Mail, Phone, CheckCircle, Grid, Zap } from 'lucide-react'
import { CreateSalesBlockModal } from '../components/CreateSalesBlockModal'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { deleteCalendarEvent } from '../lib/calendar'

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
          className="backdrop-blur-md bg-gradient-to-br from-void-900/50 to-void-950/80 border border-white/10 rounded-xl p-6 hover:border-white/20 transition-all group"
        >
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-lg font-bold text-white mb-1">{sb.title}</h3>
                <p className="text-sm text-gray-400">{sb.list?.name}</p>
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
            <p className="text-xs text-gray-500">
              {sb.duration_minutes} min session {sb.contact_count ? `• ${sb.contact_count} prospects` : ''}
            </p>
          </div>

          {/* Multi-step Sequence */}
          <div className="space-y-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Outreach Flow</p>
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
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white/10 border border-white/20 flex-shrink-0">
                      <Icon className={`w-4 h-4 ${tp.color}`} />
                    </div>
                    {/* Label and count */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-white">{tp.label}</span>
                        {count > 0 && (
                          <span className="text-xs font-bold text-cyan-neon bg-cyan-neon/10 px-2 py-1 rounded">
                            {count} {tp.label === 'Follow-up' ? 'sent' : 'completed'}
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Arrow */}
                    {idx < touchpointSequence.length - 1 && (
                      <div className="text-white/30">→</div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Summary */}
          {sb.contacts_worked !== undefined && (
            <div className="mt-6 pt-6 border-t border-white/10">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="bg-white/5 rounded-lg p-3">
                  <p className="text-xs text-gray-400 mb-1">Prospects Worked</p>
                  <p className="text-lg font-bold text-white">
                    {sb.contacts_worked} <span className="text-xs text-gray-500">/ {sb.contact_count}</span>
                  </p>
                </div>
                <div className="bg-white/5 rounded-lg p-3">
                  <p className="text-xs text-gray-400 mb-1">Total Actions</p>
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
  const [salesblocks, setSalesblocks] = useState<SalesBlock[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabType>('upcoming')
  const [viewType, setViewType] = useState<ViewType>('my')
  const [displayMode, setDisplayMode] = useState<DisplayMode>('list')
  const [isManager, setIsManager] = useState(false)
  const [teamId, setTeamId] = useState<string | null>(null)
  const { user } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    loadUserRole()
  }, [user])

  useEffect(() => {
    loadSalesblocks()
  }, [user, activeTab, viewType])

  const loadUserRole = async () => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .from('users')
        .select('role, team_id')
        .eq('id', user.id)
        .maybeSingle()

      if (error) throw error
      if (data) {
        setIsManager(data.role === 'manager')
        setTeamId(data.team_id)
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
    } finally {
      setLoading(false)
    }
  }

  const handleStart = (salesblockId: string) => {
    navigate(`/salesblocks/${salesblockId}/session`)
  }

  const handleEdit = (salesblockId: string) => {
    // TODO: Open edit modal when implemented
    alert(`Edit salesblock: ${salesblockId}`)
  }

  const handleCancel = async (salesblockId: string) => {
    if (!confirm('Are you sure you want to cancel this salesblock?')) return

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
      alert('Failed to cancel salesblock')
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
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
      case 'in_progress':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
      case 'completed':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
      case 'cancelled':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
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
    { key: 'upcoming', label: 'Upcoming' },
    { key: 'in_progress', label: 'In Progress' },
    { key: 'completed', label: 'Completed' },
    { key: 'all', label: 'All' },
  ]

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            SalesBlocks
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage your timed focus sessions
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-1">
            <button
              onClick={() => setDisplayMode('list')}
              className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors ${
                displayMode === 'list'
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
              title="List View"
            >
              <Grid className="w-4 h-4" />
              List
            </button>
            <button
              onClick={() => setDisplayMode('campaign')}
              className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors ${
                displayMode === 'campaign'
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
              title="Campaign View"
            >
              <Zap className="w-4 h-4" />
              Campaign
            </button>
          </div>

          {isManager && (
            <div className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-1">
              <button
                onClick={() => setViewType('my')}
                className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors ${
                  viewType === 'my'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <User className="w-4 h-4" />
                My SalesBlocks
              </button>
              <button
                onClick={() => setViewType('team')}
                className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors ${
                  viewType === 'team'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <Users className="w-4 h-4" />
                Team SalesBlocks
              </button>
            </div>
          )}
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Create SalesBlock
          </button>
        </div>
      </div>

      {/* Tab Filters */}
      <div className="flex gap-2 mb-6 border-b border-gray-200 dark:border-gray-700">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 font-medium transition-colors border-b-2 ${
              activeTab === tab.key
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-gray-500 dark:text-gray-400">Loading...</p>
      ) : salesblocks.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            No {activeTab !== 'all' ? activeTab : ''} salesblocks
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            Create your first SalesBlock
          </button>
        </div>
      ) : displayMode === 'campaign' ? (
        <CampaignViewGrid salesblocks={salesblocks} />
      ) : (
        <div className="grid gap-4">
          {salesblocks.map((sb) => (
            <div
              key={sb.id}
              className="border border-gray-200 dark:border-gray-700 rounded-lg p-6 bg-white dark:bg-gray-800"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
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
                  <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
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
                      <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                        <p className="font-medium text-gray-900 dark:text-white mb-2">
                          Session Summary
                        </p>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">
                              Contacts Worked:
                            </span>{' '}
                            <span className="font-medium text-gray-900 dark:text-white">
                              {sb.contacts_worked} / {sb.contact_count}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">
                              Calls:
                            </span>{' '}
                            <span className="font-medium text-gray-900 dark:text-white">
                              {sb.calls_made}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">
                              Emails:
                            </span>{' '}
                            <span className="font-medium text-gray-900 dark:text-white">
                              {sb.emails_sent}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">
                              Social:
                            </span>{' '}
                            <span className="font-medium text-gray-900 dark:text-white">
                              {sb.social_touches}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">
                              Meetings:
                            </span>{' '}
                            <span className="font-medium text-gray-900 dark:text-white">
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
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                      >
                        <Play className="w-4 h-4" />
                        Start
                      </button>
                      <button
                        onClick={() => handleEdit(sb.id)}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                      >
                        <Edit className="w-4 h-4" />
                        Edit
                      </button>
                      <button
                        onClick={() => handleCancel(sb.id)}
                        className="flex items-center gap-2 px-4 py-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
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
    </div>
  )
}
