/**
 * @crumb
 * @id frontend-page-home
 * @area UI/Pages
 * @intent Dashboard home — displays today's SalesBlock schedule, recent activity feed, goal progress rings, and quick-start actions for the authenticated rep
 * @responsibilities Load and display scheduled SalesBlocks, recent activities with contact names, goal progress vs targets, today's activity summary counts; navigate to session or create new SalesBlock
 * @contracts Home() → JSX; reads salesblocks+lists, activities+contacts, goals+user_goals from Supabase; uses useAuth for user+org_id scoping
 * @in supabase (salesblocks, activities, goals, users tables), useAuth (user), useNavigate for session entry
 * @out Dashboard with KPI summary row, SalesBlock schedule cards, activity feed, goal progress
 * @err Supabase query failure on any of 4 parallel data loads (silently empty state); no org_id on user row (all org-scoped queries return nothing)
 * @hazard Goal progress calculation uses activities table aggregate — if activities table is empty for the period, goals show 0% with no empty-state messaging, looks broken
 * @hazard CreateSalesBlockModal launched from Home must re-fetch salesblocks after close — if callback not wired, new block won't appear without page reload
 * @shared-edges frontend/src/components/CreateSalesBlockModal.tsx→LAUNCHES for new blocks; frontend/src/lib/supabase.ts→QUERIES all data; frontend/src/hooks/useAuth.ts→CALLS for user; frontend/src/App.tsx→ROUTES to /
 * @trail home#1 | Home mounts → parallel data load (salesblocks + activities + goals) → render KPI row + schedule + feed + progress → Play button navigates to /salesblocks/:id/session → CreateSalesBlockModal opens inline
 * @prompt Add empty-state messaging when goals have no activities for the period. Verify CreateSalesBlockModal refresh callback is wired. Consider skeleton loaders for each data section independently rather than single loading flag.
 */
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
  Target,
  Zap,
  TrendingUp,
  ChevronRight,
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
      const { data: userData } = await supabase
        .from('users')
        .select('display_name')
        .eq('id', user.id)
        .maybeSingle()

      if (userData) {
        setUserDisplayName(userData.display_name || 'there')
      }

      const today = new Date()
      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
      const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)

      const { data: todaysData } = await supabase
        .from('salesblocks')
        .select(`*, list:lists(name)`)
        .eq('user_id', user.id)
        .gte('scheduled_start', todayStart.toISOString())
        .lt('scheduled_start', todayEnd.toISOString())
        .in('status', ['scheduled', 'in_progress'])
        .order('scheduled_start', { ascending: true })

      if (todaysData) {
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

      const tomorrowStart = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)
      const weekEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 8)

      const { data: upcomingData } = await supabase
        .from('salesblocks')
        .select(`*, list:lists(name)`)
        .eq('user_id', user.id)
        .eq('status', 'scheduled')
        .gte('scheduled_start', tomorrowStart.toISOString())
        .lt('scheduled_start', weekEnd.toISOString())
        .order('scheduled_start', { ascending: true })

      if (upcomingData) {
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

      const { data: activitiesData } = await supabase
        .from('activities')
        .select(`id, type, outcome, notes, created_at, contact:contacts(first_name, last_name)`)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10)

      if (activitiesData) {
        const transformedActivities: Activity[] = activitiesData.map((a) => {
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
      const { data: goals, error } = await supabase
        .from('goals')
        .select('*')
        .eq('user_id', user.id)
        .in('period', ['daily', 'weekly'])

      if (error) {
        await loadDefaultGoalProgress()
        return
      }

      if (!goals || goals.length === 0) {
        await loadDefaultGoalProgress()
        return
      }

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
      await loadDefaultGoalProgress()
    }
  }

  const loadDefaultGoalProgress = async () => {
    if (!user) return

    const today = new Date()
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())

    const { count: callCount } = await supabase
      .from('activities')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('type', 'call')
      .gte('created_at', todayStart.toISOString())

    const { count: meetingCount } = await supabase
      .from('activities')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('type', 'meeting')
      .gte('created_at', todayStart.toISOString())

    setGoalProgress([
      { metric: 'calls', label: 'Calls Made (Daily)', current: callCount || 0, target: 50 },
      { metric: 'meetings_booked', label: 'Meetings Booked (Daily)', current: meetingCount || 0, target: 3 },
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
      const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1)
      periodStart = new Date(now.getFullYear(), now.getMonth(), diff)
    } else {
      periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
    }

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

    const isToday = date.toDateString() === now.toDateString()
    if (isToday) {
      return `Today ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })
  }

  const formatDateTime = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  }

  const getActivityIcon = (type: string) => {
    const cls = 'w-4 h-4'
    switch (type) {
      case 'call': return <Phone className={cls} />
      case 'email': return <Mail className={cls} />
      case 'social': return <Share2 className={cls} />
      case 'meeting': return <Calendar className={cls} />
      case 'note': return <FileText className={cls} />
      default: return <Clock className={cls} />
    }
  }

  const getActivityColor = (type: string): string => {
    switch (type) {
      case 'call': return 'text-cyan-neon bg-cyan-neon/10'
      case 'email': return 'text-indigo-electric bg-indigo-electric/10'
      case 'social': return 'text-purple-neon bg-purple-neon/10'
      case 'meeting': return 'text-emerald-signal bg-emerald-signal/10'
      default: return 'text-gray-400 dark:text-white/40 bg-gray-100 dark:bg-white/5'
    }
  }

  const getOutcomeColor = (outcome: string): string => {
    const success = ['connect', 'conversation', 'meeting_booked']
    const negative = ['not_interested']
    if (success.includes(outcome)) return 'text-emerald-signal bg-emerald-signal/10'
    if (negative.includes(outcome)) return 'text-red-alert bg-red-alert/10'
    return 'text-gray-400 dark:text-white/40 bg-gray-100 dark:bg-white/5'
  }

  const formatOutcome = (outcome: string): string => {
    return outcome.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
  }

  const canStartBlock = (sb: SalesBlock): boolean => {
    if (sb.status !== 'scheduled') return false
    return new Date(sb.scheduled_start) <= new Date()
  }

  const handleStartBlock = (salesblockId: string) => {
    navigate(`/salesblocks/${salesblockId}/session`)
  }

  // Derive the "active mission" — in_progress block first, otherwise next scheduled today
  const activeMission = todaysSalesblocks.find(sb => sb.status === 'in_progress')
    ?? todaysSalesblocks.find(sb => sb.status === 'scheduled')

  // Top-level KPI: first 2 goal progress items mapped to KPI cards
  const callGoal = goalProgress.find(g => g.metric === 'calls') ?? { label: 'Calls Today', current: 0, target: 50, metric: 'calls' }
  const meetingGoal = goalProgress.find(g => g.metric === 'meetings_booked') ?? { label: 'Meetings Booked', current: 0, target: 3, metric: 'meetings_booked' }
  const overallPct = goalProgress.length > 0
    ? Math.round(goalProgress.reduce((acc, g) => acc + (g.target > 0 ? (g.current / g.target) * 100 : 0), 0) / goalProgress.length)
    : 0

  if (loading) {
    return (
      <div className="min-h-full bg-gray-50 dark:bg-void-950 p-8 flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-400 dark:text-white/40">
          <div className="w-5 h-5 border-2 border-indigo-electric border-t-transparent rounded-full animate-spin" />
          <span className="font-mono text-sm tracking-widest uppercase">Initialising Briefing...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-full bg-gray-50 dark:bg-void-950 p-6 space-y-6">

      {/* ── Header ── */}
      <div className="flex items-end justify-between">
        <div>
          <p className="vv-section-title mb-1">Daily Briefing</p>
          <h1 className="font-display text-3xl font-bold text-gray-900 dark:text-white">
            {getGreeting()}, {userDisplayName}
          </h1>
        </div>
        <p className="font-mono text-xs text-gray-300 dark:text-white/30 tracking-wide">{formatDate()}</p>
      </div>

      {/* ── Mission Timer Strip ── */}
      <div className="glass-card p-5 flex items-center justify-between neon-glow-indigo">
        <div className="flex items-center gap-4">
          <div className="relative flex items-center justify-center w-10 h-10">
            {activeMission?.status === 'in_progress' && (
              <span className="absolute inset-0 rounded-full bg-indigo-electric/20 animate-ping" />
            )}
            <Zap className="w-5 h-5 text-indigo-electric relative z-10" />
          </div>
          <div>
            <p className="vv-section-title mb-0.5">
              {activeMission?.status === 'in_progress' ? 'Active Mission' : 'Next Mission'}
            </p>
            {activeMission ? (
              <>
                <p className="font-display font-semibold text-gray-900 dark:text-white">{activeMission.title}</p>
                <p className="text-xs text-gray-400 dark:text-white/40 font-mono mt-0.5">
                  {activeMission.list?.name} · {activeMission.contact_count} contacts · {activeMission.duration_minutes} min
                </p>
              </>
            ) : (
              <p className="font-display font-semibold text-gray-400 dark:text-white/40">No mission scheduled today</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {activeMission ? (
            <>
              {activeMission.status === 'in_progress' && (
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-electric/15 text-indigo-electric text-xs font-semibold uppercase tracking-widest">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-electric animate-pulse" />
                  In Progress
                </span>
              )}
              {activeMission.status === 'scheduled' && (
                <span className="font-mono text-xs text-gray-400 dark:text-white/40">
                  {new Date(activeMission.scheduled_start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                </span>
              )}
              {(canStartBlock(activeMission) || activeMission.status === 'in_progress') && (
                <button
                  onClick={() => handleStartBlock(activeMission.id)}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-electric hover:bg-indigo-electric/80 text-white rounded-lg text-sm font-semibold transition-all duration-200 ease-snappy"
                >
                  <Play className="w-3.5 h-3.5" />
                  {activeMission.status === 'in_progress' ? 'Continue' : 'Launch'}
                </button>
              )}
            </>
          ) : (
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white rounded-lg text-sm font-semibold transition-all duration-200 ease-snappy"
            >
              <Plus className="w-3.5 h-3.5" />
              Schedule Block
            </button>
          )}
        </div>
      </div>

      {/* ── KPI Row ── */}
      <div className="grid grid-cols-3 gap-4">
        {/* Calls KPI */}
        <div className="stat-card neon-glow-cyan group hover:scale-[1.02] transition-transform duration-200 ease-snappy">
          <div className="flex items-center justify-between">
            <span className="vv-section-title">Calls Today</span>
            <Phone className="w-4 h-4 text-cyan-neon opacity-60 group-hover:opacity-100 transition-opacity" />
          </div>
          <div className="flex items-end gap-2 mt-1">
            <span className="font-mono text-3xl font-bold text-gray-900 dark:text-white">{callGoal.current}</span>
            <span className="font-mono text-sm text-gray-300 dark:text-white/30 mb-1">/ {callGoal.target}</span>
          </div>
          <div className="w-full bg-gray-100 dark:bg-white/5 rounded-full h-1.5 mt-1">
            <div
              className="h-1.5 rounded-full bg-cyan-neon transition-all duration-500"
              style={{ width: `${Math.min((callGoal.current / callGoal.target) * 100, 100)}%` }}
            />
          </div>
        </div>

        {/* Meetings KPI */}
        <div className="stat-card neon-glow-purple group hover:scale-[1.02] transition-transform duration-200 ease-snappy">
          <div className="flex items-center justify-between">
            <span className="vv-section-title">Meetings Booked</span>
            <Calendar className="w-4 h-4 text-purple-neon opacity-60 group-hover:opacity-100 transition-opacity" />
          </div>
          <div className="flex items-end gap-2 mt-1">
            <span className="font-mono text-3xl font-bold text-gray-900 dark:text-white">{meetingGoal.current}</span>
            <span className="font-mono text-sm text-gray-300 dark:text-white/30 mb-1">/ {meetingGoal.target}</span>
          </div>
          <div className="w-full bg-gray-100 dark:bg-white/5 rounded-full h-1.5 mt-1">
            <div
              className="h-1.5 rounded-full bg-purple-neon transition-all duration-500"
              style={{ width: `${Math.min((meetingGoal.current / meetingGoal.target) * 100, 100)}%` }}
            />
          </div>
        </div>

        {/* Overall Mission Progress */}
        <div className="stat-card group hover:scale-[1.02] transition-transform duration-200 ease-snappy">
          <div className="flex items-center justify-between">
            <span className="vv-section-title">Mission Progress</span>
            <Target className="w-4 h-4 text-emerald-signal opacity-60 group-hover:opacity-100 transition-opacity" />
          </div>
          <div className="flex items-end gap-2 mt-1">
            <span className={`font-mono text-3xl font-bold ${overallPct >= 75 ? 'text-emerald-signal' : overallPct >= 40 ? 'text-cyan-neon' : 'text-gray-900 dark:text-white'}`}>
              {overallPct}%
            </span>
          </div>
          <div className="w-full bg-gray-100 dark:bg-white/5 rounded-full h-1.5 mt-1">
            <div
              className={`h-1.5 rounded-full transition-all duration-500 ${overallPct >= 75 ? 'bg-emerald-signal' : overallPct >= 40 ? 'bg-cyan-neon' : 'bg-indigo-electric'}`}
              style={{ width: `${overallPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* ── Main Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left: Today's Blocks + Activity Feed */}
        <div className="lg:col-span-2 space-y-6">

          {/* Today's SalesBlocks */}
          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-electric" />
                <h2 className="font-display font-semibold text-gray-900 dark:text-white text-sm">Today's SalesBlocks</h2>
              </div>
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-1.5 text-xs text-indigo-electric hover:text-gray-900 dark:hover:text-white transition-colors font-medium"
              >
                <Plus className="w-3.5 h-3.5" />
                New
              </button>
            </div>

            {todaysSalesblocks.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-300 dark:text-white/30 text-sm mb-4">No missions scheduled today</p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-electric hover:bg-indigo-electric/80 text-white rounded-lg text-sm font-semibold transition-all duration-200 ease-snappy"
                >
                  <Plus className="w-4 h-4" />
                  Schedule a SalesBlock
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {todaysSalesblocks.map((sb) => (
                  <div
                    key={sb.id}
                    className={`flex items-center justify-between p-4 rounded-lg border transition-all duration-200 ${
                      sb.status === 'in_progress'
                        ? 'bg-indigo-electric/10 border-indigo-electric/30'
                        : 'bg-gray-50 dark:bg-white/[0.03] border-gray-200 dark:border-white/5 hover:bg-gray-100 dark:hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-1.5 h-8 rounded-full ${sb.status === 'in_progress' ? 'bg-indigo-electric' : 'bg-gray-200 dark:bg-white/10'}`} />
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white text-sm">{sb.title}</p>
                        <p className="text-xs text-gray-400 dark:text-white/40 font-mono mt-0.5">
                          {sb.list?.name} · {sb.contact_count} contacts · {sb.duration_minutes}m
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs text-gray-300 dark:text-white/30">
                        {new Date(sb.scheduled_start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                      </span>
                      {(canStartBlock(sb) || sb.status === 'in_progress') && (
                        <button
                          onClick={() => handleStartBlock(sb.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-signal hover:bg-emerald-signal/80 text-white rounded-lg text-xs font-semibold transition-all duration-200 ease-snappy"
                        >
                          <Play className="w-3 h-3" />
                          {sb.status === 'in_progress' ? 'Continue' : 'Start'}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Activity Feed */}
          <div className="glass-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4 text-purple-neon" />
              <h2 className="font-display font-semibold text-gray-900 dark:text-white text-sm">Activity Feed</h2>
            </div>

            {recentActivities.length === 0 ? (
              <p className="text-gray-300 dark:text-white/30 text-sm text-center py-6">No recent activities logged</p>
            ) : (
              <div className="space-y-1">
                {recentActivities.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors group"
                  >
                    <div className={`flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg ${getActivityColor(activity.type)}`}>
                      {getActivityIcon(activity.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-gray-900 dark:text-white text-sm font-medium">
                          {activity.contact?.first_name} {activity.contact?.last_name}
                        </span>
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getOutcomeColor(activity.outcome)}`}>
                          {formatOutcome(activity.outcome)}
                        </span>
                      </div>
                      {activity.notes && (
                        <p className="text-xs text-gray-300 dark:text-white/30 mt-0.5 truncate">{activity.notes}</p>
                      )}
                    </div>
                    <span className="font-mono text-xs text-gray-200 dark:text-white/20 flex-shrink-0 mt-0.5 group-hover:text-gray-400 dark:group-hover:text-white/40 transition-colors">
                      {formatTimeAgo(activity.created_at)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Goal Progress + Upcoming */}
        <div className="space-y-6">

          {/* Goal Progress */}
          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-emerald-signal" />
                <h2 className="font-display font-semibold text-gray-900 dark:text-white text-sm">Goal Progress</h2>
              </div>
            </div>

            {goalProgress.length === 0 ? (
              <p className="text-gray-300 dark:text-white/30 text-sm text-center py-4">No goals configured</p>
            ) : (
              <div className="space-y-5">
                {goalProgress.map((goal, index) => {
                  const pct = goal.target > 0 ? Math.min((goal.current / goal.target) * 100, 100) : 0
                  const color = pct >= 100 ? 'bg-emerald-signal' : pct >= 75 ? 'bg-cyan-neon' : pct >= 40 ? 'bg-indigo-electric' : 'bg-gray-200 dark:bg-white/20'
                  return (
                    <div key={index}>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs text-gray-500 dark:text-white/60 font-medium">{goal.label}</span>
                        <span className="font-mono text-xs text-gray-400 dark:text-white/40">{goal.current} / {goal.target}</span>
                      </div>
                      <div className="w-full bg-gray-100 dark:bg-white/5 rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full transition-all duration-500 ${color}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <p className="font-mono text-xs text-gray-200 dark:text-white/20 mt-1 text-right">{Math.round(pct)}%</p>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Upcoming This Week */}
          <div className="glass-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="w-4 h-4 text-cyan-neon" />
              <h2 className="font-display font-semibold text-gray-900 dark:text-white text-sm">Upcoming This Week</h2>
            </div>

            {upcomingSalesblocks.length === 0 ? (
              <p className="text-gray-300 dark:text-white/30 text-sm text-center py-4">Clear week ahead</p>
            ) : (
              <div className="space-y-2">
                {upcomingSalesblocks.map((sb) => (
                  <div
                    key={sb.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-white/[0.03] hover:bg-gray-100 dark:hover:bg-white/5 border border-gray-200 dark:border-white/5 transition-colors group"
                  >
                    <div>
                      <p className="text-gray-900 dark:text-white text-sm font-medium">{sb.title}</p>
                      <p className="font-mono text-xs text-gray-300 dark:text-white/30 mt-0.5">
                        {formatDateTime(sb.scheduled_start)}
                      </p>
                      <p className="text-xs text-gray-200 dark:text-white/20 mt-0.5">{sb.contact_count} contacts · {sb.duration_minutes}m</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-100 dark:text-white/10 group-hover:text-gray-300 dark:group-hover:text-white/30 transition-colors flex-shrink-0" />
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
