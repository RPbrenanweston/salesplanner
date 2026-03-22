// @crumb frontend-page-home
// UI/PAGES | load_salesblock_schedule | recent_activity_feed | goal_progress_rings | quick_start_actions
// why: Dashboard home — displays today's SalesBlock schedule, recent activity feed, goal progress, and quick-start actions
// in:supabase(salesblocks,activities,goals,users),useAuth(user),useNavigate out:dashboard with KPI summary,SalesBlock schedule cards,activity feed,goal progress err:Supabase query failure on parallel loads(silently empty),no org_id on user(all queries return nothing)
// hazard: Goal progress uses activities aggregate — if empty for the period, goals show 0% with no empty-state messaging
// hazard: CreateSalesBlockModal launched from Home must re-fetch salesblocks after close — if callback not wired, new block won't appear without reload
// edge:frontend/src/components/CreateSalesBlockModal.tsx -> CALLS
// edge:frontend/src/lib/supabase.ts -> CALLS
// edge:frontend/src/hooks/useAuth.ts -> CALLS
// edge:frontend/src/App.tsx -> RELATES
// edge:home#1 -> STEP_IN
// prompt: Add empty-state messaging when goals have no activities. Consider skeleton loaders per data section independently.
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Phone,
  Calendar,
  Play,
  Plus,
  Target,
  Zap,
} from 'lucide-react'
import { useDashboardData } from '../hooks/useDashboardData'
import { useGoalProgress } from '../hooks/useGoalProgress'
import { CreateSalesBlockModal } from '../components/CreateSalesBlockModal'
import { DashboardGreeting } from '../components/dashboard-greeting'
import { TodaysSalesBlocksSection } from '../components/todays-salesblocks-section'
import { ActivityFeedSection } from '../components/activity-feed-section'
import { GoalProgressSection } from '../components/goal-progress-section'
import { UpcomingSalesBlocksSection } from '../components/upcoming-salesblocks-section'

export default function Home() {
  const [showCreateModal, setShowCreateModal] = useState(false)
  const navigate = useNavigate()
  const { userDisplayName, todaysSalesblocks, upcomingSalesblocks, recentActivities, loading, refreshData } = useDashboardData()
  const { goalProgress } = useGoalProgress()

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

  const formatDate = (): string => {
    return new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const canStartBlock = (sb: { status: string; scheduled_start: string }): boolean => {
    if (sb.status !== 'scheduled') return false
    return new Date(sb.scheduled_start) <= new Date()
  }

  return (
    <div className="min-h-full bg-gray-50 dark:bg-void-950 p-6 space-y-6">

      {/* ── Header ── */}
      <div className="flex items-end justify-between">
        <DashboardGreeting userDisplayName={userDisplayName} />
        <p className="font-mono text-xs text-gray-400 dark:text-white/30 tracking-wide">{formatDate()}</p>
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
                <p className="text-xs text-gray-500 dark:text-white/40 font-mono mt-0.5">
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
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 border border-gray-200 text-gray-900 dark:bg-white/5 dark:hover:bg-white/10 dark:border-white/10 dark:text-white rounded-lg text-sm font-semibold transition-all duration-200 ease-snappy"
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
            <span className="font-mono text-sm text-gray-400 dark:text-white/30 mb-1">/ {callGoal.target}</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-white/5 rounded-full h-1.5 mt-1">
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
            <span className="font-mono text-sm text-gray-400 dark:text-white/30 mb-1">/ {meetingGoal.target}</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-white/5 rounded-full h-1.5 mt-1">
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
          <div className="w-full bg-gray-200 dark:bg-white/5 rounded-full h-1.5 mt-1">
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
          <TodaysSalesBlocksSection
            salesblocks={todaysSalesblocks}
            onStartBlock={handleStartBlock}
            onScheduleBlock={() => setShowCreateModal(true)}
            loading={loading}
          />
          <ActivityFeedSection activities={recentActivities} loading={loading} />
        </div>

        {/* Right: Goal Progress + Upcoming */}
        <div className="space-y-6">
          <GoalProgressSection goals={goalProgress} loading={loading} />
          <UpcomingSalesBlocksSection salesblocks={upcomingSalesblocks} />
        </div>
      </div>

      {/* Create SalesBlock Modal */}
      <CreateSalesBlockModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => {
          setShowCreateModal(false)
          refreshData()
        }}
      />
    </div>
  )
}
