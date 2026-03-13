// @crumb frontend-page-team
// UI/PAGES | load_org_users | aggregate_activity_counts | render_team_leaderboard | navigate_rep_detail | invite_member_modal
// why: Team performance view — display all org members with their activity stats, invite new members, and navigate to individual rep detail
// in:supabase(users by org_id,activities aggregated per user),useAuth(user/org_id) out:team roster cards with activity stats,navigation to rep detail,invite modal err:org_id null(empty team),Supabase query failure(empty list),no active/inactive distinction
// hazard: Team query uses org_id from useAuth — if not set, query returns zero results silently
// hazard: Activity aggregation uses time-range filter — aggregate query may slow as team grows
// edge:frontend/src/lib/supabase.ts -> CALLS
// edge:frontend/src/hooks/useAuth.ts -> CALLS
// edge:frontend/src/App.tsx -> RELATES
// edge:team#1 -> STEP_IN
// prompt: Add time-range filter for activity aggregation. Handle empty org_id gracefully. Confirm user query is RLS-scoped. Add invite member flow.
import { useState, useEffect } from 'react'
import { Clock, Mail, Phone, Users, Calendar, Target, ArrowRight, UserPlus, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useNavigate } from 'react-router-dom'
import { CreateSalesBlockModal } from '../components/CreateSalesBlockModal'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface TeamMemberMetrics {
  id: string
  display_name: string
  email: string
  calls: number
  emails: number
  social_touches: number
  meetings_booked: number
  pipeline_value: number
}

interface ComparisonChartData {
  name: string
  calls: number
  emails: number
  social: number
  meetings: number
}

interface PipelineStage {
  name: string
}

type DateRange = '30days' | '90days' | 'all'
type InviteRole = 'sdr' | 'ae' | 'manager'

// ---------------------------------------------------------------------------
// Invite Member Modal (inline component)
// ---------------------------------------------------------------------------
function InviteModal({
  isOpen,
  onClose,
  orgId,
  teamId,
}: {
  isOpen: boolean
  onClose: () => void
  orgId: string
  teamId: string
}) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<InviteRole>('sdr')
  const [submitting, setSubmitting] = useState(false)
  const [successEmail, setSuccessEmail] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  function resetForm() {
    setEmail('')
    setRole('sdr')
    setSubmitting(false)
    setSuccessEmail(null)
    setErrorMessage(null)
  }

  function handleClose() {
    resetForm()
    onClose()
  }

  function isValidEmail(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorMessage(null)

    if (!isValidEmail(email)) {
      setErrorMessage('Please enter a valid email address.')
      return
    }

    setSubmitting(true)

    try {
      // Create invitation row first
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 7)

      const { data: invitation, error: insertError } = await supabase
        .from('team_invitations')
        .insert({
          org_id: orgId,
          invited_email: email,
          role,
          invited_by: (await supabase.auth.getUser()).data.user?.id,
          expires_at: expiresAt.toISOString(),
          status: 'pending',
        })
        .select('id')
        .single()

      if (insertError) {
        throw new Error(insertError.message)
      }

      // Call edge function to send the email
      const { data, error: fnError } = await supabase.functions.invoke(
        'send-team-invitation',
        {
          body: {
            invitation_id: invitation.id,
            email,
            org_id: orgId,
            team_id: teamId,
            role,
          },
        },
      )

      if (fnError) {
        throw new Error(fnError.message)
      }

      if (data && typeof data === 'object' && 'error' in data && data.error) {
        throw new Error(data.error as string)
      }

      setSuccessEmail(email)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong. Please try again.'
      setErrorMessage(message)
    } finally {
      setSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-white/10 bg-white shadow-2xl dark:bg-void-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-white/10">
          <h2 className="font-display text-lg font-semibold text-gray-900 dark:text-white">
            Invite Team Member
          </h2>
          <button
            onClick={handleClose}
            className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-white/10 dark:hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {successEmail ? (
            /* ---------- Success state ---------- */
            <div className="space-y-4 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-500/20">
                <Mail className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <p className="text-sm text-gray-700 dark:text-white/70">
                Invitation sent to{' '}
                <span className="font-semibold text-gray-900 dark:text-white">{successEmail}</span>
              </p>
              <button
                onClick={handleClose}
                className="w-full rounded-lg bg-indigo-electric px-4 py-2 text-sm font-semibold text-white transition-all duration-200 ease-snappy hover:bg-indigo-electric/80"
              >
                Close
              </button>
            </div>
          ) : (
            /* ---------- Form state ---------- */
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email */}
              <div>
                <label htmlFor="invite-email" className="mb-1 block text-sm font-medium text-gray-700 dark:text-white/70">
                  Email address
                </label>
                <input
                  id="invite-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="colleague@company.com"
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-electric focus:outline-none focus:ring-1 focus:ring-indigo-electric dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-white/30"
                />
              </div>

              {/* Role */}
              <div>
                <label htmlFor="invite-role" className="mb-1 block text-sm font-medium text-gray-700 dark:text-white/70">
                  Role
                </label>
                <select
                  id="invite-role"
                  value={role}
                  onChange={(e) => setRole(e.target.value as InviteRole)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-electric focus:outline-none focus:ring-1 focus:ring-indigo-electric dark:border-white/10 dark:bg-white/5 dark:text-white"
                >
                  <option value="sdr">SDR</option>
                  <option value="ae">AE</option>
                  <option value="manager">Manager</option>
                </select>
              </div>

              {/* Error message */}
              {errorMessage && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
                  {errorMessage}
                </div>
              )}

              {/* Buttons */}
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition-all duration-150 hover:bg-gray-50 dark:border-white/10 dark:text-white/70 dark:hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 rounded-lg bg-indigo-electric px-4 py-2 text-sm font-semibold text-white transition-all duration-200 ease-snappy hover:bg-indigo-electric/80 disabled:opacity-50"
                >
                  {submitting ? 'Sending...' : 'Send Invitation'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Team Page
// ---------------------------------------------------------------------------
export default function Team() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [isManager, setIsManager] = useState(false)
  const [teamMetrics, setTeamMetrics] = useState<TeamMemberMetrics[]>([])
  const [dateRange, setDateRange] = useState<DateRange>('30days')
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false)
  const [orgId, setOrgId] = useState('')
  const [teamId, setTeamId] = useState('')

  useEffect(() => {
    if (user) {
      checkManagerAndLoadTeam()
    }
  }, [user, dateRange])

  async function checkManagerAndLoadTeam() {
    setLoading(true)

    // Check if user is manager
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role, team_id, org_id')
      .eq('id', user?.id)
      .single()

    if (userError) {
      console.error('Error checking manager status:', userError)
      setLoading(false)
      return
    }

    const isManagerRole = userData.role === 'manager'
    setIsManager(isManagerRole)
    setOrgId(userData.org_id ?? '')
    setTeamId(userData.team_id ?? '')

    if (!isManagerRole) {
      setLoading(false)
      return // Non-managers don't see team dashboard
    }

    // Load team members
    const { data: teamMembers, error: teamError } = await supabase
      .from('users')
      .select('id, display_name, email')
      .eq('team_id', userData.team_id)

    if (teamError) {
      console.error('Error loading team:', teamError)
      setLoading(false)
      return
    }

    // Calculate metrics for each team member
    const metrics = await Promise.all((teamMembers || []).map(async (member) => {
      const dateFilter = getDateFilter(dateRange)

      // Build base query helper
      function activityQuery(activityType: string) {
        const query = supabase
          .from('activities')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', member.id)
          .eq('type', activityType)

        if (dateFilter) {
          return query.gte('created_at', dateFilter)
        }
        return query
      }

      // Count activities by type
      const { count: callCount } = await activityQuery('call')
      const { count: emailCount } = await activityQuery('email')
      const { count: socialCount } = await activityQuery('social')
      const { count: meetingCount } = await activityQuery('meeting')

      // Calculate pipeline value (open deals)
      const { data: deals } = await supabase
        .from('deals')
        .select('value, stage_id, pipeline_stages(name)')
        .eq('user_id', member.id)

      const openDeals = (deals || []).filter(d => {
        const stages = d.pipeline_stages as PipelineStage | PipelineStage[] | null
        const stageName = Array.isArray(stages)
          ? stages[0]?.name
          : stages?.name
        return stageName !== 'Closed Won' && stageName !== 'Closed Lost'
      })

      const pipelineValue = openDeals.reduce((sum, deal) => sum + (deal.value || 0), 0)

      return {
        id: member.id,
        display_name: member.display_name,
        email: member.email,
        calls: callCount || 0,
        emails: emailCount || 0,
        social_touches: socialCount || 0,
        meetings_booked: meetingCount || 0,
        pipeline_value: pipelineValue
      }
    }))

    setTeamMetrics(metrics)
    setLoading(false)
  }

  function getDateFilter(range: DateRange): string | null {
    const now = new Date()
    if (range === '30days') {
      const cutoff = new Date(now)
      cutoff.setDate(now.getDate() - 30)
      return cutoff.toISOString()
    } else if (range === '90days') {
      const cutoff = new Date(now)
      cutoff.setDate(now.getDate() - 90)
      return cutoff.toISOString()
    }
    // 'all' — no date filter
    return null
  }

  function getComparisonChartData(): ComparisonChartData[] {
    return teamMetrics.map(member => ({
      name: member.display_name.split(' ')[0], // First name only for chart
      calls: member.calls,
      emails: member.emails,
      social: member.social_touches,
      meetings: member.meetings_booked
    }))
  }

  function handleMemberClick(_memberId: string) {
    // Navigate to Analytics page with member filter (future enhancement: add ?user_id= query param)
    navigate('/analytics')
  }

  if (loading) {
    return (
      <div className="min-h-full bg-gray-50 dark:bg-void-950 p-6 flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-400 dark:text-white/40">
          <div className="w-5 h-5 border-2 border-indigo-electric border-t-transparent rounded-full animate-spin" />
          <span className="font-mono text-sm tracking-widest uppercase">Loading Team...</span>
        </div>
      </div>
    )
  }

  if (!isManager) {
    return (
      <div className="min-h-full bg-gray-50 dark:bg-void-950 p-6">
        <div className="glass-card p-4 border-l-4 border-amber-400">
          <p className="text-amber-700 dark:text-amber-300 text-sm">
            Team dashboard is only available to users with manager role.
          </p>
        </div>
      </div>
    )
  }

  const chartData = getComparisonChartData()

  const dateRangeOptions: { value: DateRange; label: string }[] = [
    { value: '30days', label: 'Last 30 days' },
    { value: '90days', label: 'Last 90 days' },
    { value: 'all', label: 'All time' },
  ]

  return (
    <div className="min-h-full bg-gray-50 dark:bg-void-950 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="vv-section-title mb-1">Performance</p>
          <h1 className="font-display text-3xl font-bold text-gray-900 dark:text-white">
            Team Performance
          </h1>
          <p className="text-sm text-gray-500 dark:text-white/50 mt-1">
            Track your team's activity and results
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsInviteModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 border border-indigo-electric text-indigo-electric hover:bg-indigo-electric hover:text-white rounded-lg text-sm font-semibold transition-all duration-200 ease-snappy"
          >
            <UserPlus className="w-4 h-4" />
            Invite Member
          </button>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-electric hover:bg-indigo-electric/80 text-white rounded-lg text-sm font-semibold transition-all duration-200 ease-snappy"
          >
            <Clock className="w-4 h-4" />
            Assign SalesBlock
          </button>
        </div>
      </div>

      {/* Date Range Selector */}
      <div className="flex gap-2">
        {dateRangeOptions.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setDateRange(opt.value)}
            className={`px-4 py-2 rounded-lg border text-sm font-semibold transition-all duration-150 ease-snappy ${
              dateRange === opt.value
                ? 'bg-indigo-electric border-indigo-electric text-white'
                : 'bg-white dark:bg-white/5 text-gray-700 dark:text-white/70 border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/10'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Empty team state */}
      {teamMetrics.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-500/20">
            <Users className="h-7 w-7 text-indigo-600 dark:text-indigo-400" />
          </div>
          <h2 className="font-display text-lg font-semibold text-gray-900 dark:text-white mb-2">
            No team members yet
          </h2>
          <p className="text-sm text-gray-500 dark:text-white/50 mb-5">
            Invite your first rep to start tracking team performance.
          </p>
          <button
            onClick={() => setIsInviteModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-electric px-5 py-2.5 text-sm font-semibold text-white transition-all duration-200 ease-snappy hover:bg-indigo-electric/80"
          >
            <UserPlus className="w-4 h-4" />
            Invite Member
          </button>
        </div>
      ) : (
        <>
          {/* Leaderboard */}
          <div className="glass-card">
            <div className="p-4 border-b border-gray-200 dark:border-white/10">
              <h2 className="font-display font-semibold text-gray-900 dark:text-white">Leaderboard</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-white/5">
                  <tr>
                    <th className="px-6 py-3 text-left vv-section-title">
                      Rep
                    </th>
                    <th className="px-6 py-3 text-right vv-section-title">
                      <div className="flex items-center justify-end gap-1">
                        <Phone className="w-3 h-3" />
                        Calls
                      </div>
                    </th>
                    <th className="px-6 py-3 text-right vv-section-title">
                      <div className="flex items-center justify-end gap-1">
                        <Mail className="w-3 h-3" />
                        Emails
                      </div>
                    </th>
                    <th className="px-6 py-3 text-right vv-section-title">
                      <div className="flex items-center justify-end gap-1">
                        <Users className="w-3 h-3" />
                        Social
                      </div>
                    </th>
                    <th className="px-6 py-3 text-right vv-section-title">
                      <div className="flex items-center justify-end gap-1">
                        <Calendar className="w-3 h-3" />
                        Meetings
                      </div>
                    </th>
                    <th className="px-6 py-3 text-right vv-section-title">
                      <div className="flex items-center justify-end gap-1">
                        <Target className="w-3 h-3" />
                        Pipeline
                      </div>
                    </th>
                    <th className="px-6 py-3 text-right vv-section-title">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-white/10">
                  {teamMetrics.map((member) => (
                    <tr key={member.id} className="hover:bg-gray-50 dark:hover:bg-white/[0.08] transition-colors duration-150">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="font-display font-semibold text-gray-900 dark:text-white">
                            {member.display_name}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-white/40 font-mono mt-0.5">
                            {member.email}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900 dark:text-white font-mono">
                        {member.calls}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900 dark:text-white font-mono">
                        {member.emails}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900 dark:text-white font-mono">
                        {member.social_touches}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900 dark:text-white font-mono">
                        {member.meetings_booked}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900 dark:text-white font-mono">
                        ${member.pipeline_value.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <button
                          onClick={() => handleMemberClick(member.id)}
                          className="inline-flex items-center gap-1 text-indigo-electric hover:text-indigo-electric/70 text-sm transition-colors duration-150"
                        >
                          View Details
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Comparison Chart */}
          {chartData.length > 0 && (
            <div className="glass-card p-6">
              <h2 className="font-display font-semibold text-gray-900 dark:text-white mb-4">Activity Comparison</h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-white/10" />
                  <XAxis dataKey="name" tick={{ fill: 'currentColor' }} className="text-gray-500 dark:text-white/40 text-xs" />
                  <YAxis tick={{ fill: 'currentColor' }} className="text-gray-500 dark:text-white/40 text-xs" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0F172A',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '0.5rem',
                      color: 'rgba(255,255,255,0.9)'
                    }}
                  />
                  <Legend />
                  <Bar dataKey="calls" fill="#6366F1" name="Calls" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="emails" fill="#10b981" name="Emails" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="social" fill="#0db9f2" name="Social" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="meetings" fill="#8b5cf6" name="Meetings" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}

      {/* Create SalesBlock Modal */}
      <CreateSalesBlockModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={() => {
          setIsCreateModalOpen(false)
          alert('SalesBlock assigned to team member!')
        }}
      />

      {/* Invite Member Modal */}
      <InviteModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        orgId={orgId}
        teamId={teamId}
      />
    </div>
  )
}
