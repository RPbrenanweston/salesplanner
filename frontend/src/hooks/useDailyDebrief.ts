/** @id salesblock.hooks.productivity.use-daily-debrief */
/**
 * Daily debrief hook — collects end-of-day reflection data from reps.
 *
 * Activation: today's day_plan has debrief_completed=false AND current
 * time is past the user's configured work_end_hour (default 18 / 6 PM).
 *
 * Auto-computes stats from today's salesblocks and focus_sessions,
 * then allows the rep to record wins, improvements, and tomorrow's priorities.
 */
import { useState, useCallback, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import type {
  ProductivityBlock,
  DayPlan,
  FocusSession,
  UserScheduleConfig,
} from '../types/productivity'
import {
  mapSalesblockToProductivityBlock,
  type LegacySalesblock,
} from '../lib/salesblock-adapter'

const DEFAULT_WORK_END_HOUR = 18

function getTodayDateString(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

export interface DebriefStats {
  blocksPlanned: number
  blocksCompleted: number
  blocksSkipped: number
  totalFocusMs: number
  totalBreakMs: number
  completionRate: number
}

export interface UseDailyDebriefReturn {
  isActive: boolean
  stats: DebriefStats
  wins: string
  setWins: (v: string) => void
  improvements: string
  setImprovements: (v: string) => void
  tomorrowPriorities: string
  setTomorrowPriorities: (v: string) => void
  submitDebrief: () => Promise<void>
  skipDebrief: () => void
  isSubmitting: boolean
}

export function useDailyDebrief(): UseDailyDebriefReturn {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const userId = user?.id

  const today = getTodayDateString()

  // --- Local form state ---
  const [wins, setWins] = useState('')
  const [improvements, setImprovements] = useState('')
  const [tomorrowPriorities, setTomorrowPriorities] = useState('')

  // --- Fetch today's day_plan ---
  const { data: todayPlan } = useQuery<DayPlan | null>({
    queryKey: ['day-plan', userId, today],
    queryFn: async () => {
      if (!userId) return null
      try {
        const { data, error } = await supabase
          .from('day_plans')
          .select('*')
          .eq('user_id', userId)
          .eq('plan_date', today)
          .maybeSingle()
        if (error) {
          console.warn('[useDailyDebrief] day_plans query failed (table may not exist):', error.message)
          return null
        }
        return data as DayPlan | null
      } catch {
        console.warn('[useDailyDebrief] day_plans query threw unexpectedly')
        return null
      }
    },
    enabled: !!userId,
    staleTime: 2 * 60 * 1000,
  })

  // --- Fetch user schedule config for work_end_hour ---
  const { data: scheduleConfig } = useQuery<UserScheduleConfig | null>({
    queryKey: ['user-schedule-config', userId],
    queryFn: async () => {
      if (!userId) return null
      const { data, error } = await supabase
        .from('user_schedule_config')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle()
      if (error) throw error
      return data as UserScheduleConfig | null
    },
    enabled: !!userId,
    staleTime: 10 * 60 * 1000,
  })

  // --- Fetch today's salesblocks for stats ---
  const { data: todayBlocks = [] } = useQuery<ProductivityBlock[]>({
    queryKey: ['today-blocks', userId, today],
    queryFn: async () => {
      if (!userId) return []
      const { data, error } = await supabase
        .from('salesblocks')
        .select('*')
        .eq('user_id', userId)
        .gte('scheduled_start', `${today}T00:00:00`)
        .lt('scheduled_start', `${today}T23:59:59`)
      if (error) throw error
      return (data ?? []).map((row, i) =>
        mapSalesblockToProductivityBlock(row as unknown as LegacySalesblock, i),
      )
    },
    enabled: !!userId,
    staleTime: 1 * 60 * 1000,
  })

  // --- Fetch today's focus_sessions for timing stats ---
  const { data: todaySessions = [] } = useQuery<FocusSession[]>({
    queryKey: ['today-focus-sessions', userId, today],
    queryFn: async () => {
      if (!userId) return []
      try {
        const dayStart = `${today}T00:00:00.000Z`
        const dayEnd = `${today}T23:59:59.999Z`
        const { data, error } = await supabase
          .from('focus_sessions')
          .select('*')
          .eq('user_id', userId)
          .gte('started_at', dayStart)
          .lte('started_at', dayEnd)
        if (error) {
          console.warn('[useDailyDebrief] focus_sessions query failed (table may not exist):', error.message)
          return []
        }
        return (data ?? []) as FocusSession[]
      } catch {
        console.warn('[useDailyDebrief] focus_sessions query threw unexpectedly')
        return []
      }
    },
    enabled: !!userId,
    staleTime: 1 * 60 * 1000,
  })

  // --- Compute stats ---
  const stats: DebriefStats = useMemo(() => {
    const blocksPlanned = todayBlocks.length
    const blocksCompleted = todayBlocks.filter((b) => b.status === 'completed').length
    const blocksSkipped = todayBlocks.filter((b) => b.status === 'skipped').length
    const totalFocusMs = todaySessions.reduce((sum, s) => sum + (s.duration_actual_ms ?? 0), 0)
    const totalBreakMs = todaySessions.reduce((sum, s) => sum + (s.break_time_ms ?? 0), 0)
    const completionRate = blocksPlanned > 0
      ? Math.round((blocksCompleted / blocksPlanned) * 100)
      : 0

    return {
      blocksPlanned,
      blocksCompleted,
      blocksSkipped,
      totalFocusMs,
      totalBreakMs,
      completionRate,
    }
  }, [todayBlocks, todaySessions])

  // --- Activation check ---
  const isActive = useMemo(() => {
    if (!userId) return false
    const now = new Date()
    const workEndHour = scheduleConfig?.work_end_hour ?? DEFAULT_WORK_END_HOUR
    if (now.getHours() < workEndHour) return false
    // If no day_plan exists, nothing to debrief
    if (todayPlan === undefined) return false // still loading
    if (todayPlan === null) return false
    return !todayPlan.debrief_completed
  }, [userId, todayPlan, scheduleConfig])

  // --- Submit debrief mutation ---
  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error('Not authenticated')

      // Insert session_debriefs record — skip gracefully if table doesn't exist
      try {
        const { error: debriefError } = await supabase
          .from('session_debriefs')
          .insert({
            user_id: userId,
            debrief_date: today,
            blocks_planned: stats.blocksPlanned,
            blocks_completed: stats.blocksCompleted,
            blocks_skipped: stats.blocksSkipped,
            total_focus_ms: stats.totalFocusMs,
            total_break_ms: stats.totalBreakMs,
            wins: wins || null,
            improvements: improvements || null,
            tomorrow_priorities: tomorrowPriorities || null,
          })
        if (debriefError) console.warn('[useDailyDebrief] session_debriefs insert failed:', debriefError.message)
      } catch {
        console.warn('[useDailyDebrief] session_debriefs insert threw unexpectedly')
      }

      // Mark day_plan as debriefed — skip gracefully if table doesn't exist
      if (todayPlan?.id) {
        try {
          const { error: planError } = await supabase
            .from('day_plans')
            .update({
              debrief_completed: true,
              updated_at: new Date().toISOString(),
            })
            .eq('id', todayPlan.id)
          if (planError) console.warn('[useDailyDebrief] day_plans update failed:', planError.message)
        } catch {
          console.warn('[useDailyDebrief] day_plans update threw unexpectedly')
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['day-plan', userId, today] })
      queryClient.invalidateQueries({ queryKey: ['session-debriefs', userId] })
    },
  })

  // --- Skip debrief mutation ---
  const skipMutation = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error('Not authenticated')
      if (!todayPlan?.id) return

      try {
        const { error } = await supabase
          .from('day_plans')
          .update({
            debrief_completed: true,
            updated_at: new Date().toISOString(),
          })
          .eq('id', todayPlan.id)
        if (error) console.warn('[useDailyDebrief] skip day_plans update failed:', error.message)
      } catch {
        console.warn('[useDailyDebrief] skip day_plans update threw unexpectedly')
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['day-plan', userId, today] })
    },
  })

  const submitDebrief = useCallback(async () => {
    await submitMutation.mutateAsync()
  }, [submitMutation])

  const skipDebrief = useCallback(() => {
    skipMutation.mutate()
  }, [skipMutation])

  return {
    isActive,
    stats,
    wins,
    setWins,
    improvements,
    setImprovements,
    tomorrowPriorities,
    setTomorrowPriorities,
    submitDebrief,
    skipDebrief,
    isSubmitting: submitMutation.isPending,
  }
}
