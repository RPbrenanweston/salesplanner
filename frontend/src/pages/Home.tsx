import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Phone,
  Mail,
  Share2,
  Calendar,
  FileText,
  Play,
  Plus,
  Clock,
  Target
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { CreateSalesBlockModal } from '../components/CreateSalesBlockModal'

interface SalesBlock {
  id: string
  title: string
  scheduled_start: string
  scheduled_end: string
  duration_minutes: number
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
  list_id: string
  list?: { name: string }
  contact_count?: number
}

interface Activity {
  id: string
  type: 'call' | 'email' | 'social' | 'meeting' | 'note'
  outcome: string
  notes: string | null
  created_at: string
  contact?: {
    first_name: string
    last_name: string
  }
}

interface Goal {
  id: string
  metric: string
  target_value: number
  period: 'daily' | 'weekly' | 'monthly'
  custom_metric_name: string | null
}

interface GoalProgress {
  metric: string
  label: string
  current: number
  target: number
}

export default function Home() {
  const [userDisplayName, setUserDisplayName] = useState<string>('')
  const [todaysSalesblocks, setTodaysSalesblocks] = useState<SalesBlock[]>([])
  const [upcomingSalesblocks, setUpcomingSalesblocks] = useState<SalesBlock[]>([])
  const [recentActivities, setRecentActivities] = useState<Activity[]>([])
  const [goalProgress, setGoalProgress] = useState<GoalProgress[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const { user } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (user) {
      loadDashboardData()
    }
  }, [user])

  const loadDashboardData = async () => {
    if (!user) return
    setLoading(true)

    try {
      // Load user display name
      const { data: userData } = await supabase
        .from('users')
        .select('display_name')
        .eq('id', user.id)
        .maybeSingle()

      if (userData) {
        setUserDisplayName(userData.display_name || 'there')
      }

      // Load today's salesblocks
      const today = new Date()
      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
      const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)

      const { data: todaysData } = await supabase
        .from('salesblocks')
        .select(`
          *,
          list:lists(name)
        `)
        .eq('user_id', user.id)
        .gte('scheduled_start', todayStart.toISOString())
        .lt('scheduled_start', todayEnd.toISOString())
        .in('status', ['scheduled', 'in_progress'])
        .order('scheduled_start', { ascending: true })

      if (todaysData) {
        // Enrich with contact counts
        const enriched = await Promise.all(
          todaysData.map(async (sb) => {
            const { count } = await supabase
              .from('list_contacts')
              .select('*', { count: 'exact', head: true })
              .eq('list_id', sb.list_id)
            return { ...sb, contact_count: count || 0 }
          })
        )
        setTodaysSalesblocks(enriched)
      }

      // Load upcoming salesblocks (next 7 days, excluding today)
      const tomorrowStart = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)
      const weekEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 8)

      const { data: upcomingData } = await supabase
        .from('salesblocks')
        .select(`
          *,
          list:lists(name)
        `)
        .eq('user_id', user.id)
        .eq('status', 'scheduled')
        .gte('scheduled_start', tomorrowStart.toISOString())
        .lt('scheduled_start', weekEnd.toISOString())
        .order('scheduled_start', { ascending: true })

      if (upcomingData) {
        // Enrich with contact counts
        const enriched = await Promise.all(
          upcomingData.map(async (sb) => {
            const { count } = await supabase
              .from('list_contacts')
              .select('*', { count: 'exact', head: true })
              .eq('list_id', sb.list_id)
            return { ...sb, contact_count: count || 0 }
          })
        )
        setUpcomingSalesblocks(enriched)
      }

      // Load recent activities (last 10)
      const { data: activitiesData } = await supabase
        .from('activities')
        .select(`
          id,
          type,
          outcome,
          notes,
          created_at,
          contact:contacts(first_name, last_name)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10)

      if (activitiesData) {
        // Transform the data to match our Activity interface
        // Supabase may return contact as an array for joined data, extract first element
        const transformedActivities: Activity[] = activitiesData.map((a) => {
          // Handle both array and object forms of the contact relation
          const contactData = Array.isArray(a.contact) ? a.contact[0] : a.contact
          return {
            id: a.id,
            type: a.type,
            outcome: a.outcome,
            notes: a.notes,
            created_at: a.created_at,
            contact: contactData as { first_name: string; last_name: string } | undefined,
          }
        })
        setRecentActivities(transformedActivities)
      }

      // Load goals and calculate progress
      await loadGoalProgress()

    } catch (error) {
      console.error('Error loading dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadGoalProgress = async () => {
    if (!user) return

    try {
      // Try to load goals from goals table (may not exist yet)
      const { data: goals, error } = await supabase
        .from('goals')
        .select('*')
        .eq('user_id', user.id)
        .in('period', ['daily', 'weekly'])

      if (error) {
        // Goals table may not exist yet, use default goals
        console.log('Goals table not available, using defaults')
        await loadDefaultGoalProgress()
        return
      }

      if (!goals || goals.length === 0) {
        // No goals set, use defaults
        await loadDefaultGoalProgress()
        return
      }

      // Calculate progress for each goal
      const progress: GoalProgress[] = await Promise.all(
        goals.map(async (goal: Goal) => {
          const current = await countActivitiesForGoal(goal)
          return {
            metric: goal.metric,
            label: getGoalLabel(goal),
            current,
            target: goal.target_value,
          }
        })
      )

      setGoalProgress(progress)
    } catch {
      // Fallback to default goals
      await loadDefaultGoalProgress()
    }
  }

  const loadDefaultGoalProgress = async () => {
    if (!user) return

    // Default goals: calls and meetings for daily
    const today = new Date()
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())

    // Count calls today
    const { count: callCount } = await supabase
      .from('activities')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('type', 'call')
      .gte('created_at', todayStart.toISOString())

    // Count meetings booked today
    const { count: meetingCount } = await supabase
      .from('activities')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('type', 'meeting')
      .gte('created_at', todayStart.toISOString())

    setGoalProgress([
      {
        metric: 'calls',
        label: 'Calls Made (Daily)',
        current: callCount || 0,
        target: 50, // Default target
      },
      {
        metric: 'meetings_booked',
        label: 'Meetings Booked (Daily)',
        current: meetingCount || 0,
        target: 3, // Default target
      },
    ])
  }

  const countActivitiesForGoal = async (goal: Goal): Promise<number> => {
    if (!user) return 0

    const now = new Date()
    let periodStart: Date

    if (goal.period === 'daily') {
      periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    } else if (goal.period === 'weekly') {
      const dayOfWeek = now.getDay()
      const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1) // Monday start
      periodStart = new Date(now.getFullYear(), now.getMonth(), diff)
    } else {
      periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
    }

    // Map metric to activity type
    const typeMap: Record<string, string> = {
      calls: 'call',
      emails: 'email',
      social_touches: 'social',
      meetings_booked: 'meeting',
    }

    const activityType = typeMap[goal.metric]
    if (!activityType) return 0

    const { count } = await supabase
      .from('activities')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('type', activityType)
      .gte('created_at', periodStart.toISOString())

    return count || 0
  }

  const getGoalLabel = (goal: Goal): string => {
    const metricLabels: Record<string, string> = {
      calls: 'Calls Made',
      emails: 'Emails Sent',
      social_touches: 'Social Touches',
      meetings_booked: 'Meetings Booked',
      pipeline_value: 'Pipeline Value',
      custom: goal.custom_metric_name || 'Custom',
    }
    const periodLabel = goal.period.charAt(0).toUpperCase() + goal.period.slice(1)
    return `${metricLabels[goal.metric] || goal.metric} (${periodLabel})`
  }

  const getGreeting = (): string => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 17) return 'Good afternoon'
    return 'Good evening'
  }

  const formatDate = (): string => {
    return new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const formatTimeAgo = (dateString: string): string => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays}d ago`

    // Format as "Today 3:15pm" or date
    const isToday = date.toDateString() === now.toDateString()
    if (isToday) {
      return `Today ${date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      })}`
    }

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  }

  const formatDateTime = (dateString: string): string => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  }

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'call':
        return <Phone className="w-4 h-4" />
      case 'email':
        return <Mail className="w-4 h-4" />
      case 'social':
        return <Share2 className="w-4 h-4" />
      case 'meeting':
        return <Calendar className="w-4 h-4" />
      case 'note':
        return <FileText className="w-4 h-4" />
      default:
        return <Clock className="w-4 h-4" />
    }
  }

  const getOutcomeBadgeClass = (outcome: string): string => {
    const successOutcomes = ['connect', 'conversation', 'meeting_booked']
    const neutralOutcomes = ['no_answer', 'voicemail', 'follow_up']
    const negativeOutcomes = ['not_interested']

    if (successOutcomes.includes(outcome)) {
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
    }
    if (negativeOutcomes.includes(outcome)) {
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
    }
    if (neutralOutcomes.includes(outcome)) {
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
    }
    return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
  }

  const formatOutcome = (outcome: string): string => {
    return outcome
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  const truncateNotes = (notes: string | null, maxLength: number = 60): string => {
    if (!notes) return ''
    if (notes.length <= maxLength) return notes
    return notes.substring(0, maxLength) + '...'
  }

  const canStartBlock = (sb: SalesBlock): boolean => {
    if (sb.status !== 'scheduled') return false
    const now = new Date()
    const scheduledStart = new Date(sb.scheduled_start)
    // Can start if scheduled time is now or in the past
    return scheduledStart <= now
  }

  const handleStartBlock = (salesblockId: string) => {
    navigate(`/salesblocks/${salesblockId}/session`)
  }

  const handleScheduleBlock = () => {
    setShowCreateModal(true)
  }

  if (loading) {
    return (
      <div className="p-8">
        <p className="text-gray-500 dark:text-gray-400">Loading dashboard...</p>
      </div>
    )
  }

  return (
    <div className="p-8">
      {/* Greeting Section */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          {getGreeting()}, {userDisplayName}
        </h1>
        <p className="text-gray-600 dark:text-gray-400">{formatDate()}</p>
      </div>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Today's SalesBlocks + Activity Feed */}
        <div className="lg:col-span-2 space-y-6">
          {/* Today's SalesBlocks Section */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-600" />
              Today's SalesBlocks
            </h2>

            {todaysSalesblocks.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 dark:text-gray-400 mb-4">
                  No salesblocks scheduled for today
                </p>
                <button
                  onClick={handleScheduleBlock}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Schedule a SalesBlock
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {todaysSalesblocks.map((sb) => (
                  <div
                    key={sb.id}
                    className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg"
                  >
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-white">
                        {sb.title}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {sb.list?.name || 'Unknown list'} - {sb.contact_count} contacts - {sb.duration_minutes} min
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {new Date(sb.scheduled_start).toLocaleTimeString('en-US', {
                          hour: 'numeric',
                          minute: '2-digit',
                          hour12: true,
                        })}
                      </p>
                    </div>
                    {canStartBlock(sb) && (
                      <button
                        onClick={() => handleStartBlock(sb.id)}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                      >
                        <Play className="w-4 h-4" />
                        Start Block
                      </button>
                    )}
                    {!canStartBlock(sb) && sb.status === 'scheduled' && (
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        Starts at {new Date(sb.scheduled_start).toLocaleTimeString('en-US', {
                          hour: 'numeric',
                          minute: '2-digit',
                          hour12: true,
                        })}
                      </span>
                    )}
                    {sb.status === 'in_progress' && (
                      <button
                        onClick={() => handleStartBlock(sb.id)}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                      >
                        <Play className="w-4 h-4" />
                        Continue
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Activity Feed Section */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-purple-600" />
              Recent Activity
            </h2>

            {recentActivities.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                No recent activities
              </p>
            ) : (
              <div className="space-y-3">
                {recentActivities.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg"
                  >
                    <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                      {getActivityIcon(activity.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-gray-900 dark:text-white text-sm">
                          {activity.contact?.first_name} {activity.contact?.last_name}
                        </span>
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getOutcomeBadgeClass(activity.outcome)}`}>
                          {formatOutcome(activity.outcome)}
                        </span>
                      </div>
                      {activity.notes && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                          {truncateNotes(activity.notes)}
                        </p>
                      )}
                      <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                        {formatTimeAgo(activity.created_at)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Goal Progress + Upcoming SalesBlocks */}
        <div className="space-y-6">
          {/* Goal Progress Section */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Target className="w-5 h-5 text-green-600" />
              Goal Progress
            </h2>

            {goalProgress.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                No goals set
              </p>
            ) : (
              <div className="space-y-4">
                {goalProgress.map((goal, index) => {
                  const percentage = goal.target > 0 ? Math.min((goal.current / goal.target) * 100, 100) : 0
                  return (
                    <div key={index}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          {goal.label}
                        </span>
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          {goal.current} / {goal.target}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                        <div
                          className={`h-3 rounded-full transition-all duration-300 ${
                            percentage >= 100
                              ? 'bg-green-600'
                              : percentage >= 75
                              ? 'bg-green-500'
                              : percentage >= 50
                              ? 'bg-yellow-500'
                              : 'bg-blue-600'
                          }`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-500 mt-1 text-right">
                        {Math.round(percentage)}%
                      </p>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Upcoming SalesBlocks Section */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-orange-600" />
              Upcoming This Week
            </h2>

            {upcomingSalesblocks.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                No upcoming salesblocks this week
              </p>
            ) : (
              <div className="space-y-3">
                {upcomingSalesblocks.map((sb) => (
                  <div
                    key={sb.id}
                    className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg"
                  >
                    <h3 className="font-medium text-gray-900 dark:text-white text-sm">
                      {sb.title}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {sb.list?.name || 'Unknown list'}
                    </p>
                    <div className="flex items-center justify-between mt-2 text-xs text-gray-500 dark:text-gray-400">
                      <span>{formatDateTime(sb.scheduled_start)}</span>
                      <span>{sb.duration_minutes} min</span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {sb.contact_count} contacts
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create SalesBlock Modal */}
      <CreateSalesBlockModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => {
          setShowCreateModal(false)
          loadDashboardData()
        }}
      />
    </div>
  )
}
