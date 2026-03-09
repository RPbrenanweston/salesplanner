/**
 * @crumb
 * @id frontend-page-team
 * @area UI/Pages
 * @intent Team performance view — display all org members with their activity stats and navigate to individual rep detail
 * @responsibilities Load all users in same org, aggregate their activity counts (calls/emails/meetings), render team leaderboard, navigate to individual contact/rep view
 * @contracts Team() → JSX; reads users (by org_id) + activities aggregated per user from Supabase; uses useAuth for org scoping; uses useNavigate
 * @in supabase (users table filtered by org_id, activities aggregated by user_id), useAuth (user/org_id)
 * @out Team roster cards with activity stats, navigation to rep detail
 * @err org_id null on user (empty team, no error state); Supabase query failure (empty team list); no distinction between active and inactive users
 * @hazard Team query uses org_id from useAuth — if user's org_id is not set, query returns zero results silently (looks like solo account)
 * @hazard Activity aggregation is all-time — no period filter; as team grows, aggregate query may slow significantly
 * @shared-edges frontend/src/lib/supabase.ts→QUERIES users+activities; frontend/src/hooks/useAuth.ts→CALLS; frontend/src/App.tsx→ROUTES to /team
 * @trail team#1 | Team mounts → load org users → aggregate activity counts per user → render roster cards → navigate to rep detail
 * @prompt Add time-range filter for activity aggregation. Add period selector (week/month). Handle empty org_id gracefully. Confirm user query is RLS-scoped to same org. Add invite member flow. VV design applied: void-950 page bg, VV spinner, vv-section-title "Performance", font-display headings, glass-card leaderboard + chart panels, indigo-electric active tab + Assign CTA + View Details links, white/10 table dividers + dark hover rows, font-mono numeric cells, font-display member names, bar chart recolored to VV palette (indigo-electric/emerald-signal/cyan-neon/purple-neon).
 */
import { useState, useEffect } from 'react'
import { Clock, Mail, Phone, Users, Calendar, Target, ArrowRight } from 'lucide-react'
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

export default function Team() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [isManager, setIsManager] = useState(false)
  const [teamMetrics, setTeamMetrics] = useState<TeamMemberMetrics[]>([])
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month'>('week')
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)

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
      .select('role, team_id')
      .eq('id', user?.id)
      .single()

    if (userError) {
      console.error('Error checking manager status:', userError)
      setLoading(false)
      return
    }

    const isManagerRole = userData.role === 'manager'
    setIsManager(isManagerRole)

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

      // Count activities by type
      const { count: callCount } = await supabase
        .from('activities')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', member.id)
        .eq('type', 'call')
        .gte('created_at', dateFilter)

      const { count: emailCount } = await supabase
        .from('activities')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', member.id)
        .eq('type', 'email')
        .gte('created_at', dateFilter)

      const { count: socialCount } = await supabase
        .from('activities')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', member.id)
        .eq('type', 'social')
        .gte('created_at', dateFilter)

      const { count: meetingCount } = await supabase
        .from('activities')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', member.id)
        .eq('type', 'meeting')
        .gte('created_at', dateFilter)

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

  function getDateFilter(range: 'today' | 'week' | 'month'): string {
    const now = new Date()
    if (range === 'today') {
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      return todayStart.toISOString()
    } else if (range === 'week') {
      const weekStart = new Date(now)
      weekStart.setDate(now.getDate() - 7)
      return weekStart.toISOString()
    } else {
      const monthStart = new Date(now)
      monthStart.setDate(now.getDate() - 30)
      return monthStart.toISOString()
    }
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

  const dateRangeBtn = (value: typeof dateRange, label: string) => (
    <button
      onClick={() => setDateRange(value)}
      className={`px-4 py-2 rounded-lg border text-sm font-semibold transition-all duration-150 ease-snappy ${
        dateRange === value
          ? 'bg-indigo-electric border-indigo-electric text-white'
          : 'bg-white dark:bg-white/5 text-gray-700 dark:text-white/70 border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/10'
      }`}
    >
      {label}
    </button>
  )

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
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-electric hover:bg-indigo-electric/80 text-white rounded-lg text-sm font-semibold transition-all duration-200 ease-snappy"
        >
          <Clock className="w-4 h-4" />
          Assign SalesBlock
        </button>
      </div>

      {/* Date Range Selector */}
      <div className="flex gap-2">
        {dateRangeBtn('today', 'Today')}
        {dateRangeBtn('week', 'Last 7 Days')}
        {dateRangeBtn('month', 'Last 30 Days')}
      </div>

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
              {teamMetrics.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-sm text-gray-500 dark:text-white/40">
                    No team members found
                  </td>
                </tr>
              ) : (
                teamMetrics.map((member) => (
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
                ))
              )}
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

      {/* Create SalesBlock Modal */}
      <CreateSalesBlockModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={() => {
          setIsCreateModalOpen(false)
          alert('SalesBlock assigned to team member!')
        }}
      />
    </div>
  )
}
