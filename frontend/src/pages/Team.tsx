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
      <div className="p-8 flex items-center justify-center">
        <div className="text-gray-600 dark:text-gray-400">Loading team data...</div>
      </div>
    )
  }

  if (!isManager) {
    return (
      <div className="p-8">
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <p className="text-yellow-800 dark:text-yellow-200">
            Team dashboard is only available to users with manager role.
          </p>
        </div>
      </div>
    )
  }

  const chartData = getComparisonChartData()

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Team Performance
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Track your team's activity and results
          </p>
        </div>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Clock className="w-4 h-4" />
          Assign SalesBlock
        </button>
      </div>

      {/* Date Range Selector */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setDateRange('today')}
          className={`px-4 py-2 rounded-lg border ${
            dateRange === 'today'
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
          }`}
        >
          Today
        </button>
        <button
          onClick={() => setDateRange('week')}
          className={`px-4 py-2 rounded-lg border ${
            dateRange === 'week'
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
          }`}
        >
          Last 7 Days
        </button>
        <button
          onClick={() => setDateRange('month')}
          className={`px-4 py-2 rounded-lg border ${
            dateRange === 'month'
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
          }`}
        >
          Last 30 Days
        </button>
      </div>

      {/* Leaderboard */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-6">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Leaderboard</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Rep
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  <div className="flex items-center justify-end gap-1">
                    <Phone className="w-3 h-3" />
                    Calls
                  </div>
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  <div className="flex items-center justify-end gap-1">
                    <Mail className="w-3 h-3" />
                    Emails
                  </div>
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  <div className="flex items-center justify-end gap-1">
                    <Users className="w-3 h-3" />
                    Social
                  </div>
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  <div className="flex items-center justify-end gap-1">
                    <Calendar className="w-3 h-3" />
                    Meetings
                  </div>
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  <div className="flex items-center justify-end gap-1">
                    <Target className="w-3 h-3" />
                    Pipeline
                  </div>
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {teamMetrics.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                    No team members found
                  </td>
                </tr>
              ) : (
                teamMetrics.map((member) => (
                  <tr key={member.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">
                          {member.display_name}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {member.email}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900 dark:text-white">
                      {member.calls}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900 dark:text-white">
                      {member.emails}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900 dark:text-white">
                      {member.social_touches}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900 dark:text-white">
                      {member.meetings_booked}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900 dark:text-white">
                      ${member.pipeline_value.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <button
                        onClick={() => handleMemberClick(member.id)}
                        className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm"
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
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Activity Comparison</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-gray-300 dark:stroke-gray-700" />
              <XAxis dataKey="name" className="text-gray-600 dark:text-gray-400" />
              <YAxis className="text-gray-600 dark:text-gray-400" />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--tooltip-bg)',
                  border: '1px solid var(--tooltip-border)',
                  borderRadius: '0.5rem'
                }}
              />
              <Legend />
              <Bar dataKey="calls" fill="#3b82f6" name="Calls" />
              <Bar dataKey="emails" fill="#10b981" name="Emails" />
              <Bar dataKey="social" fill="#f59e0b" name="Social" />
              <Bar dataKey="meetings" fill="#8b5cf6" name="Meetings" />
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
