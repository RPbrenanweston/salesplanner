// @crumb frontend-page-goals
// UI/PAGES | load_user_goals | render_progress_bars | create_goal_form | delete_goals | period_support
// why: Sales goal tracking — create, display, and delete metric targets with period-based progress tracking
// in:supabase(goals,user_goals,activities),useAuth(user) out:goal list with progress bars,create form inline,delete action per goal err:Supabase query failure(empty goal list),activity aggregate failure(progress shows 0)
// hazard: Goal progress computed client-side — if activities period filter uses local time vs UTC, progress miscounted at day boundaries
// hazard: No confirmation on goal delete — single click permanently removes goal and history
// edge:frontend/src/lib/supabase.ts -> CALLS
// edge:frontend/src/hooks/useAuth.ts -> CALLS
// edge:frontend/src/App.tsx -> RELATES
// edge:goals#1 -> STEP_IN
// prompt: Add delete confirmation. Fix time-zone boundary for daily/weekly aggregation. Add empty state. Verify goals are user-scoped not org-scoped.
import { useState, useEffect } from 'react'
import { Plus, Target, Trash2, TrendingUp } from 'lucide-react'
import { supabase } from '../lib/supabase'
import ConfirmDeleteDialog from '../components/ConfirmDeleteDialog'

interface Goal {
  id: string
  metric: 'calls' | 'emails' | 'social_touches' | 'meetings_booked' | 'pipeline_value' | 'custom'
  target_value: number
  period: 'daily' | 'weekly' | 'monthly'
  custom_metric_name: string | null
  user_id: string
  users: {
    display_name: string
  }
}

interface GoalWithProgress extends Goal {
  currentValue: number
  percentage: number
}

export default function Goals() {
  const [goals, setGoals] = useState<GoalWithProgress[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isAddGoalModalOpen, setIsAddGoalModalOpen] = useState(false)

  // Add goal form state
  const [selectedMetric, setSelectedMetric] = useState<string>('calls')
  const [targetValue, setTargetValue] = useState<string>('')
  const [selectedPeriod, setSelectedPeriod] = useState<string>('daily')
  const [customMetricName, setCustomMetricName] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)

  useEffect(() => {
    loadGoals()
  }, [])

  async function loadGoals() {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: userData } = await supabase
        .from('users')
        .select('org_id')
        .eq('id', user.id)
        .single()

      if (!userData) return

      // Load goals with user info
      const { data: goalsData } = await supabase
        .from('goals')
        .select(`
          *,
          users (
            display_name
          )
        `)
        .eq('org_id', userData.org_id)
        .order('created_at', { ascending: false })

      if (!goalsData) return

      // Calculate progress for each goal
      const goalsWithProgress = await Promise.all(
        goalsData.map(async (goal) => {
          const currentValue = await calculateProgress(goal, user.id, userData.org_id)
          const percentage = Math.round((currentValue / goal.target_value) * 100)
          return {
            ...goal,
            users: Array.isArray(goal.users) ? goal.users[0] : goal.users,
            currentValue,
            percentage
          }
        })
      )

      setGoals(goalsWithProgress)
    } catch (error) {
      console.error('Error loading goals:', error)
      setLoadError('Failed to load goals. Please refresh the page.')
      setLoading(false)
    } finally {
      setLoading(false)
    }
  }

  async function calculateProgress(goal: Goal, userId: string, orgId: string): Promise<number> {
    // Get date range for the period
    const now = new Date()
    let startDate: Date

    if (goal.period === 'daily') {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0)
    } else if (goal.period === 'weekly') {
      const dayOfWeek = now.getDay()
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek, 0, 0, 0)
    } else { // monthly
      startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0)
    }

    // Calculate based on metric type
    if (goal.metric === 'pipeline_value') {
      // Sum of open deals value
      const { data: deals } = await supabase
        .from('deals')
        .select('value')
        .eq('org_id', orgId)
        .eq('user_id', userId)
        .neq('stage_id', 'closed_won') // Exclude closed deals
        .neq('stage_id', 'closed_lost')

      const total = deals?.reduce((sum, deal) => sum + (deal.value || 0), 0) || 0
      return Math.round(total)
    }

    // Count activities for other metrics
    let activityType: string | null = null
    let outcomeFilter: string | null = null

    if (goal.metric === 'calls') {
      activityType = 'call'
    } else if (goal.metric === 'emails') {
      activityType = 'email'
    } else if (goal.metric === 'social_touches') {
      activityType = 'social'
    } else if (goal.metric === 'meetings_booked') {
      activityType = 'meeting'
      outcomeFilter = 'meeting_booked'
    }

    if (!activityType) return 0

    let query = supabase
      .from('activities')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('user_id', userId)
      .eq('type', activityType)
      .gte('created_at', startDate.toISOString())

    if (outcomeFilter) {
      query = query.eq('outcome', outcomeFilter)
    }

    const { count } = await query

    return count || 0
  }

  async function handleAddGoal() {
    if (!targetValue || parseInt(targetValue) <= 0) {
      alert('Please enter a valid target value')
      return
    }

    if (selectedMetric === 'custom' && !customMetricName.trim()) {
      alert('Please enter a custom metric name')
      return
    }

    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: userData } = await supabase
        .from('users')
        .select('org_id')
        .eq('id', user.id)
        .single()

      if (!userData) return

      const { error } = await supabase
        .from('goals')
        .insert({
          org_id: userData.org_id,
          user_id: user.id,
          metric: selectedMetric,
          target_value: parseInt(targetValue),
          period: selectedPeriod,
          custom_metric_name: selectedMetric === 'custom' ? customMetricName : null
        })

      if (error) {
        console.error('Error creating goal:', error)
        alert('Failed to create goal')
        return
      }

      // Reset form
      setSelectedMetric('calls')
      setTargetValue('')
      setSelectedPeriod('daily')
      setCustomMetricName('')
      setIsAddGoalModalOpen(false)

      // Reload goals
      loadGoals()
    } catch (error) {
      console.error('Error adding goal:', error)
      alert('Failed to create goal')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteGoalConfirmed(goalId: string) {
    setDeleteTarget(null)
    try {
      const { error } = await supabase
        .from('goals')
        .delete()
        .eq('id', goalId)

      if (error) {
        console.error('Error deleting goal:', error)
        alert('Failed to delete goal')
        return
      }

      loadGoals()
    } catch (error) {
      console.error('Error deleting goal:', error)
      alert('Failed to delete goal')
    }
  }

  function getMetricLabel(metric: string, customName: string | null): string {
    if (metric === 'custom' && customName) return customName
    const labels: Record<string, string> = {
      calls: 'Calls',
      emails: 'Emails',
      social_touches: 'Social Touches',
      meetings_booked: 'Meetings Booked',
      pipeline_value: 'Pipeline Value'
    }
    return labels[metric] || metric
  }

  function getPeriodLabel(period: string): string {
    const labels: Record<string, string> = {
      daily: 'Daily',
      weekly: 'Weekly',
      monthly: 'Monthly'
    }
    return labels[period] || period
  }

  function getProgressBarColor(percentage: number): string {
    if (percentage >= 100) return 'bg-emerald-signal'
    if (percentage >= 75) return 'bg-emerald-signal/70'
    if (percentage >= 50) return 'bg-cyan-neon'
    return 'bg-indigo-electric'
  }

  if (loading) {
    return (
      <div className="min-h-full bg-gray-50 dark:bg-void-950 p-8 flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-400 dark:text-white/40">
          <div className="w-5 h-5 border-2 border-indigo-electric border-t-transparent rounded-full animate-spin" />
          <span className="font-mono text-sm tracking-widest uppercase">Loading Goals...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-full bg-gray-50 dark:bg-void-950 p-6 space-y-6">
      {loadError && (
        <div className="rounded-lg bg-red-alert/10 border border-red-alert/30 p-4 m-4">
          <p className="text-sm text-red-alert">{loadError}</p>
        </div>
      )}

      <div className="flex items-end justify-between">
        <div>
          <p className="vv-section-title mb-1">Performance</p>
          <h1 className="font-display text-3xl font-bold text-gray-900 dark:text-white">Goals</h1>
        </div>
        <button
          onClick={() => setIsAddGoalModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-electric hover:bg-indigo-electric/80 text-white rounded-lg text-sm font-semibold transition-all duration-200 ease-snappy"
        >
          <Plus className="w-4 h-4" />
          Add Goal
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {goals.map((goal) => (
          <div key={goal.id} className="glass-card p-5">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${
                  goal.percentage >= 100 ? 'bg-emerald-signal/15' : 'bg-indigo-electric/15'
                }`}>
                  {goal.percentage >= 100 ? (
                    <TrendingUp className="w-5 h-5 text-emerald-signal" />
                  ) : (
                    <Target className="w-5 h-5 text-indigo-electric" />
                  )}
                </div>
                <div>
                  <h3 className="font-display font-semibold text-gray-900 dark:text-white">
                    {getMetricLabel(goal.metric, goal.custom_metric_name)}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-white/40 font-mono mt-0.5">
                    {getPeriodLabel(goal.period)} · {goal.users.display_name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDeleteTarget({ id: goal.id, name: getMetricLabel(goal.metric, goal.custom_metric_name) })}
                className="text-gray-400 dark:text-white/30 hover:text-red-600 dark:hover:text-red-alert transition-colors duration-150 ease-snappy"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="vv-section-title">Progress</span>
                <span className="font-mono text-sm font-semibold text-gray-900 dark:text-white">
                  {goal.currentValue} / {goal.target_value}
                </span>
              </div>

              <div className="w-full bg-gray-100 dark:bg-white/5 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full ${getProgressBarColor(goal.percentage)} transition-all duration-500`}
                  style={{ width: `${Math.min(goal.percentage, 100)}%` }}
                />
              </div>

              <div className="flex items-center justify-between">
                <span className={`font-mono text-xs font-semibold ${
                  goal.percentage >= 100 ? 'text-emerald-signal' : 'text-gray-400 dark:text-white/40'
                }`}>
                  {goal.percentage}%
                </span>
                {goal.percentage >= 100 && (
                  <span className="text-xs font-semibold text-emerald-signal uppercase tracking-widest">
                    Goal Achieved
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}

        {goals.length === 0 && (
          <div className="col-span-2 glass-card p-12 text-center">
            <Target className="w-10 h-10 text-gray-300 dark:text-white/20 mx-auto mb-4" />
            <h3 className="font-display text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No goals set
            </h3>
            <p className="text-sm text-gray-500 dark:text-white/40 mb-6">
              Set your first goal to start tracking progress
            </p>
            <button
              onClick={() => setIsAddGoalModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-electric hover:bg-indigo-electric/80 text-white rounded-lg text-sm font-semibold transition-all duration-200 ease-snappy"
            >
              <Plus className="w-4 h-4" />
              Add Goal
            </button>
          </div>
        )}
      </div>

      {/* Add Goal Modal */}
      {isAddGoalModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white dark:bg-void-900 border border-gray-200 dark:border-white/10 rounded-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="p-6 border-b border-gray-200 dark:border-white/10">
              <h2 className="font-display text-xl font-semibold text-gray-900 dark:text-white">Add Goal</h2>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="vv-section-title block mb-2">
                  Metric
                </label>
                <select
                  value={selectedMetric}
                  onChange={(e) => setSelectedMetric(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-white/10 rounded-lg bg-gray-50 dark:bg-white/5 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-electric/50"
                >
                  <option value="calls">Calls</option>
                  <option value="emails">Emails</option>
                  <option value="social_touches">Social Touches</option>
                  <option value="meetings_booked">Meetings Booked</option>
                  <option value="pipeline_value">Pipeline Value</option>
                  <option value="custom">Custom</option>
                </select>
              </div>

              {selectedMetric === 'custom' && (
                <div>
                  <label className="vv-section-title block mb-2">
                    Custom Metric Name
                  </label>
                  <input
                    type="text"
                    value={customMetricName}
                    onChange={(e) => setCustomMetricName(e.target.value)}
                    placeholder="e.g., Demos Completed"
                    className="w-full px-3 py-2 border border-gray-200 dark:border-white/10 rounded-lg bg-gray-50 dark:bg-white/5 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-electric/50"
                  />
                </div>
              )}

              <div>
                <label className="vv-section-title block mb-2">
                  Target Value
                </label>
                <input
                  type="number"
                  value={targetValue}
                  onChange={(e) => setTargetValue(e.target.value)}
                  placeholder="e.g., 50"
                  min="1"
                  className="w-full px-3 py-2 border border-gray-200 dark:border-white/10 rounded-lg bg-gray-50 dark:bg-white/5 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-electric/50"
                />
              </div>

              <div>
                <label className="vv-section-title block mb-2">
                  Period
                </label>
                <select
                  value={selectedPeriod}
                  onChange={(e) => setSelectedPeriod(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-white/10 rounded-lg bg-gray-50 dark:bg-white/5 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-electric/50"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 dark:border-white/10 flex gap-3 justify-end">
              <button
                onClick={() => {
                  setIsAddGoalModalOpen(false)
                  setSelectedMetric('calls')
                  setTargetValue('')
                  setSelectedPeriod('daily')
                  setCustomMetricName('')
                }}
                className="px-4 py-2 text-gray-600 dark:text-white/60 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg text-sm transition-colors duration-150 ease-snappy"
              >
                Cancel
              </button>
              <button
                onClick={handleAddGoal}
                disabled={saving}
                className="px-4 py-2 bg-indigo-electric hover:bg-indigo-electric/80 text-white rounded-lg text-sm font-semibold transition-all duration-200 ease-snappy disabled:opacity-50"
              >
                {saving ? 'Creating...' : 'Add Goal'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDeleteDialog
        isOpen={deleteTarget !== null}
        itemType="Goal"
        itemName={deleteTarget?.name ?? ''}
        onConfirm={() => deleteTarget && handleDeleteGoalConfirmed(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
