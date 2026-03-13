/** @id salesblock.hooks.goals.use-goal-progress */
/**
 * Hook for calculating goal progress
 */
import { useState, useEffect } from 'react'
import { useAuth } from './useAuth'
import { supabase } from '../lib/supabase'
import { getGoalLabel } from '../lib/goals'
import type { Goal, GoalProgress } from '../types'

export type { Goal, GoalProgress }

interface UseGoalProgressReturn {
  goalProgress: GoalProgress[]
  loading: boolean
}

export function useGoalProgress(): UseGoalProgressReturn {
  const [goalProgress, setGoalProgress] = useState<GoalProgress[]>([])
  const [loading, setLoading] = useState(true)
  const { user } = useAuth()

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

  const loadGoalProgress = async () => {
    if (!user) {
      setLoading(false)
      return
    }

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

  useEffect(() => {
    if (user) {
      setLoading(true)
      loadGoalProgress().finally(() => setLoading(false))
    }
  }, [user])

  return {
    goalProgress,
    loading,
  }
}
