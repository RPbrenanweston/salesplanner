/** @id salesblock.hooks.productivity.use-morning-briefing */
/**
 * Morning briefing wizard hook — helps reps plan their day by reviewing
 * overdue blocks, carrying forward yesterday's incomplete work, and
 * committing a prioritized plan for today.
 *
 * Activation: today's day_plan has briefing_completed=false AND current
 * time is before 3 PM local.
 *
 * Steps: review -> prioritize -> commit
 */
import { useState, useCallback, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import type { ProductivityBlock, DayPlan } from '../types/productivity'
import {
  mapSalesblockToProductivityBlock,
  type LegacySalesblock,
} from '../lib/salesblock-adapter'

type BriefingStep = 'review' | 'prioritize' | 'commit'

const BRIEFING_CUTOFF_HOUR = 15 // 3 PM

function getTodayDateString(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function getYesterdayDateString(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export interface UseMorningBriefingReturn {
  isActive: boolean
  step: BriefingStep
  overdueBlocks: ProductivityBlock[]
  carryForwardBlocks: ProductivityBlock[]
  suggestedBlocks: ProductivityBlock[]
  selectedBlockIds: string[]
  toggleBlock: (id: string) => void
  reorderSelected: (ids: string[]) => void
  nextStep: () => void
  prevStep: () => void
  commitPlan: () => Promise<void>
  skipBriefing: () => void
  isCommitting: boolean
}

export function useMorningBriefing(): UseMorningBriefingReturn {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const userId = user?.id

  const today = getTodayDateString()
  const yesterday = getYesterdayDateString()

  // --- Local wizard state ---
  const [step, setStep] = useState<BriefingStep>('review')
  const [selectedBlockIds, setSelectedBlockIds] = useState<string[]>([])

  // --- Fetch today's day_plan to check briefing_completed ---
  const { data: todayPlan } = useQuery<DayPlan | null>({
    queryKey: ['day-plan', userId, today],
    queryFn: async () => {
      if (!userId) return null
      const { data, error } = await supabase
        .from('day_plans')
        .select('*')
        .eq('user_id', userId)
        .eq('plan_date', today)
        .maybeSingle()
      if (error) throw error
      return data as DayPlan | null
    },
    enabled: !!userId,
    staleTime: 2 * 60 * 1000,
  })

  // --- Fetch overdue blocks (scheduled_date < today, still incomplete) ---
  const { data: overdueBlocks = [] } = useQuery<ProductivityBlock[]>({
    queryKey: ['overdue-blocks', userId, today],
    queryFn: async () => {
      if (!userId) return []
      const { data, error } = await supabase
        .from('salesblocks')
        .select('*')
        .eq('user_id', userId)
        .lt('scheduled_start', `${today}T00:00:00`)
        .in('status', ['scheduled', 'in_progress'])
        .order('scheduled_start', { ascending: true })
      if (error) throw error
      return (data ?? []).map((row, i) =>
        mapSalesblockToProductivityBlock(row as unknown as LegacySalesblock, i),
      )
    },
    enabled: !!userId,
    staleTime: 2 * 60 * 1000,
  })

  // --- Fetch yesterday's day_plan to find carry-forward blocks ---
  const { data: yesterdayPlan } = useQuery<DayPlan | null>({
    queryKey: ['day-plan', userId, yesterday],
    queryFn: async () => {
      if (!userId) return null
      const { data, error } = await supabase
        .from('day_plans')
        .select('*')
        .eq('user_id', userId)
        .eq('plan_date', yesterday)
        .maybeSingle()
      if (error) throw error
      return data as DayPlan | null
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  })

  // --- Fetch yesterday's incomplete blocks ---
  const { data: carryForwardBlocks = [] } = useQuery<ProductivityBlock[]>({
    queryKey: ['carry-forward-blocks', userId, yesterday],
    queryFn: async () => {
      if (!userId || !yesterdayPlan) return []
      const blockIds = yesterdayPlan.block_order
      if (!blockIds.length) return []

      const { data, error } = await supabase
        .from('salesblocks')
        .select('*')
        .in('id', blockIds)
        .in('status', ['scheduled', 'in_progress'])
      if (error) throw error
      return (data ?? []).map((row, i) =>
        mapSalesblockToProductivityBlock(row as unknown as LegacySalesblock, i),
      )
    },
    enabled: !!userId && !!yesterdayPlan,
    staleTime: 2 * 60 * 1000,
  })

  // --- Derived: combined suggestion list (deduplicated) ---
  const suggestedBlocks = useMemo(() => {
    const seen = new Set<string>()
    const combined: ProductivityBlock[] = []
    for (const block of [...overdueBlocks, ...carryForwardBlocks]) {
      if (!seen.has(block.id)) {
        seen.add(block.id)
        combined.push(block)
      }
    }
    return combined
  }, [overdueBlocks, carryForwardBlocks])

  // --- Activation check ---
  const isActive = useMemo(() => {
    if (!userId) return false
    const now = new Date()
    if (now.getHours() >= BRIEFING_CUTOFF_HOUR) return false
    // If no day_plan exists yet, briefing is active (it hasn't been done)
    if (todayPlan === undefined) return false // still loading
    if (todayPlan === null) return true
    return !todayPlan.briefing_completed
  }, [userId, todayPlan])

  // --- Selection toggles ---
  const toggleBlock = useCallback((id: string) => {
    setSelectedBlockIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }, [])

  const reorderSelected = useCallback((ids: string[]) => {
    setSelectedBlockIds(ids)
  }, [])

  // --- Step navigation ---
  const nextStep = useCallback(() => {
    setStep((prev) => {
      if (prev === 'review') return 'prioritize'
      if (prev === 'prioritize') return 'commit'
      return prev
    })
  }, [])

  const prevStep = useCallback(() => {
    setStep((prev) => {
      if (prev === 'commit') return 'prioritize'
      if (prev === 'prioritize') return 'review'
      return prev
    })
  }, [])

  // --- Commit mutation: reschedule selected blocks + upsert day_plan ---
  const commitMutation = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error('Not authenticated')

      // Reschedule selected blocks to today
      if (selectedBlockIds.length > 0) {
        const { error: updateError } = await supabase
          .from('salesblocks')
          .update({
            scheduled_start: `${today}T09:00:00.000Z`,
            scheduled_end: `${today}T09:30:00.000Z`,
            status: 'scheduled',
          })
          .in('id', selectedBlockIds)

        if (updateError) throw updateError
      }

      // Upsert today's day_plan
      const planPayload = {
        user_id: userId,
        plan_date: today,
        block_order: selectedBlockIds,
        briefing_completed: true,
        updated_at: new Date().toISOString(),
      }

      if (todayPlan?.id) {
        const { error } = await supabase
          .from('day_plans')
          .update({
            block_order: selectedBlockIds,
            briefing_completed: true,
            updated_at: new Date().toISOString(),
          })
          .eq('id', todayPlan.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('day_plans')
          .insert(planPayload)
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['day-plan', userId, today] })
      queryClient.invalidateQueries({ queryKey: ['overdue-blocks', userId] })
      queryClient.invalidateQueries({ queryKey: ['carry-forward-blocks', userId] })
    },
  })

  // --- Skip mutation: just mark briefing as done ---
  const skipMutation = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error('Not authenticated')

      if (todayPlan?.id) {
        const { error } = await supabase
          .from('day_plans')
          .update({
            briefing_completed: true,
            updated_at: new Date().toISOString(),
          })
          .eq('id', todayPlan.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('day_plans')
          .insert({
            user_id: userId,
            plan_date: today,
            block_order: [],
            briefing_completed: true,
            updated_at: new Date().toISOString(),
          })
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['day-plan', userId, today] })
    },
  })

  const commitPlan = useCallback(async () => {
    await commitMutation.mutateAsync()
  }, [commitMutation])

  const skipBriefing = useCallback(() => {
    skipMutation.mutate()
  }, [skipMutation])

  return {
    isActive,
    step,
    overdueBlocks,
    carryForwardBlocks,
    suggestedBlocks,
    selectedBlockIds,
    toggleBlock,
    reorderSelected,
    nextStep,
    prevStep,
    commitPlan,
    skipBriefing,
    isCommitting: commitMutation.isPending,
  }
}
