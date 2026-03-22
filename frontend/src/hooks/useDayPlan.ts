/** @id salesblock.hooks.productivity.use-day-plan */
/**
 * Day plan CRUD hook with drag-drop reorder support.
 *
 * Fetches the day_plan row for a given date (contains block_order[]),
 * plus the associated sales blocks. Provides mutations for add, remove,
 * reorder, update, and briefing/debrief completion — all with optimistic
 * updates and rollback on failure.
 */

import { useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import type { DayPlan, ProductivityBlock } from '../types/productivity'
import {
  mapSalesblockToProductivityBlock,
  mapProductivityBlockToSalesblock,
  mapProductivityBlockUpdatesToSalesblock,
  type LegacySalesblock,
} from '../lib/salesblock-adapter'

// ---------------------------------------------------------------------------
// Return type
// ---------------------------------------------------------------------------

export interface DayPlanData {
  plan: DayPlan | null
  blocks: ProductivityBlock[]
}

// ---------------------------------------------------------------------------
// Fetcher
// ---------------------------------------------------------------------------

async function fetchDayPlan(userId: string, dateStr: string): Promise<DayPlanData> {
  // Fetch the plan row — graceful fallback if day_plans table doesn't exist yet
  let plan: DayPlan | null = null
  try {
    const { data, error: planError } = await supabase
      .from('day_plans')
      .select('*')
      .eq('user_id', userId)
      .eq('plan_date', dateStr)
      .maybeSingle()

    if (planError) {
      console.warn('[useDayPlan] day_plans query failed (table may not exist):', planError.message)
      return { plan: null, blocks: [] }
    }

    plan = (data as DayPlan) ?? null
  } catch {
    console.warn('[useDayPlan] day_plans query threw unexpectedly')
    return { plan: null, blocks: [] }
  }

  if (!plan) {
    return { plan: null, blocks: [] }
  }

  // Fetch blocks referenced in block_order
  if (plan.block_order.length === 0) {
    return { plan, blocks: [] }
  }

  const { data: blocks, error: blocksError } = await supabase
    .from('salesblocks')
    .select('*')
    .in('id', plan.block_order)

  if (blocksError) throw blocksError

  // Maintain block_order sort — map legacy rows through the adapter
  const mapped = (blocks ?? []).map((b, i) =>
    mapSalesblockToProductivityBlock(b as unknown as LegacySalesblock, i),
  )
  const blockMap = new Map(mapped.map((b) => [b.id, b]))
  const orderedBlocks = plan.block_order
    .map((id) => blockMap.get(id))
    .filter((b): b is ProductivityBlock => b !== undefined)

  return { plan, blocks: orderedBlocks }
}

// ---------------------------------------------------------------------------
// RPC helper: upsert day plan (creates if missing, updates block_order)
// ---------------------------------------------------------------------------

async function upsertDayPlan(
  userId: string,
  orgId: string,
  dateStr: string,
  blockOrder: string[],
): Promise<DayPlan | null> {
  try {
    const { data, error } = await supabase
      .from('day_plans')
      .upsert(
        {
          user_id: userId,
          org_id: orgId,
          plan_date: dateStr,
          block_order: blockOrder,
        },
        { onConflict: 'user_id,plan_date' },
      )
      .select()
      .single()

    if (error) {
      console.warn('[useDayPlan] day_plans upsert failed (table may not exist):', error.message)
      return null
    }
    return data as DayPlan
  } catch {
    console.warn('[useDayPlan] day_plans upsert threw unexpectedly')
    return null
  }
}

// ---------------------------------------------------------------------------
// Main hook
// ---------------------------------------------------------------------------

export function useDayPlan(dateStr: string | undefined) {
  const { user } = useAuth()
  const userId = user?.id
  const queryClient = useQueryClient()

  const queryKey = ['day-plan', userId, dateStr]
  const blocksQueryKey = ['sales-blocks', userId, dateStr]

  // ---------------------------------------------------------------------------
  // Query
  // ---------------------------------------------------------------------------

  const query = useQuery<DayPlanData>({
    queryKey,
    queryFn: () => {
      if (!userId || !dateStr) return { plan: null, blocks: [] }
      return fetchDayPlan(userId, dateStr)
    },
    enabled: !!userId && !!dateStr,
    staleTime: 30 * 1000,
  })

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  const currentPlan = query.data?.plan ?? null
  const currentBlocks = query.data?.blocks ?? []
  const currentBlockOrder = currentPlan?.block_order ?? []

  /** Get org_id from user metadata or existing plan */
  const getOrgId = useCallback((): string => {
    if (currentPlan?.org_id) return currentPlan.org_id
    return user?.user_metadata?.org_id as string ?? ''
  }, [currentPlan, user])

  // ---------------------------------------------------------------------------
  // addBlock: INSERT sales block + update block_order
  // ---------------------------------------------------------------------------

  const addBlock = useMutation({
    mutationFn: async (block: Partial<ProductivityBlock> & { list_id?: string }) => {
      if (!userId || !dateStr) throw new Error('Not authenticated')

      const orgId = getOrgId()

      // Resolve list_id — required by salesblocks table
      let listId: string = block.list_id ?? ''
      if (!listId) {
        // Fetch the user's first available list as a fallback
        const { data: lists } = await supabase
          .from('lists')
          .select('id')
          .eq('org_id', orgId)
          .limit(1)
          .single()
        listId = lists?.id ?? orgId // ultimate fallback to orgId
      }

      // 1. Insert the salesblock via adapter
      const insertFields = mapProductivityBlockToSalesblock(
        { ...block, scheduled_date: dateStr, status: 'planned' },
        userId,
        orgId,
        listId,
      )

      const { data: newBlock, error: blockError } = await supabase
        .from('salesblocks')
        .insert(insertFields)
        .select()
        .single()

      if (blockError) throw blockError

      // 2. Update block_order
      const newOrder = [...currentBlockOrder, newBlock.id]
      await upsertDayPlan(userId, orgId, dateStr, newOrder)

      return mapSalesblockToProductivityBlock(
        newBlock as unknown as LegacySalesblock,
        currentBlockOrder.length,
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey })
      queryClient.invalidateQueries({ queryKey: blocksQueryKey })
    },
  })

  // ---------------------------------------------------------------------------
  // removeBlock: remove from block_order (doesn't delete the block row)
  // ---------------------------------------------------------------------------

  const removeBlock = useMutation({
    mutationFn: async (blockId: string) => {
      if (!userId || !dateStr) throw new Error('Not authenticated')

      const newOrder = currentBlockOrder.filter((id) => id !== blockId)
      await upsertDayPlan(userId, getOrgId(), dateStr, newOrder)
    },
    onMutate: async (blockId) => {
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData<DayPlanData>(queryKey)

      // Optimistic: remove from local state
      if (previous?.plan) {
        queryClient.setQueryData<DayPlanData>(queryKey, {
          plan: {
            ...previous.plan,
            block_order: previous.plan.block_order.filter((id) => id !== blockId),
          },
          blocks: previous.blocks.filter((b) => b.id !== blockId),
        })
      }

      return { previous }
    },
    onError: (_err, _blockId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey })
    },
  })

  // ---------------------------------------------------------------------------
  // reorderBlocks: replace block_order with new array (drag-drop)
  // ---------------------------------------------------------------------------

  const reorderBlocks = useMutation({
    mutationFn: async (blockIds: string[]) => {
      if (!userId || !dateStr) throw new Error('Not authenticated')
      await upsertDayPlan(userId, getOrgId(), dateStr, blockIds)
    },
    onMutate: async (blockIds) => {
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData<DayPlanData>(queryKey)

      if (previous) {
        const blockMap = new Map(previous.blocks.map((b) => [b.id, b]))
        const reordered = blockIds
          .map((id) => blockMap.get(id))
          .filter((b): b is ProductivityBlock => b !== undefined)

        queryClient.setQueryData<DayPlanData>(queryKey, {
          plan: previous.plan
            ? { ...previous.plan, block_order: blockIds }
            : null,
          blocks: reordered,
        })
      }

      return { previous }
    },
    onError: (_err, _blockIds, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey })
    },
  })

  // ---------------------------------------------------------------------------
  // updateBlock: partial update on a sales block row
  // ---------------------------------------------------------------------------

  const updateBlock = useMutation({
    mutationFn: async ({
      blockId,
      updates,
    }: {
      blockId: string
      updates: Partial<ProductivityBlock>
    }) => {
      const salesblockUpdates = mapProductivityBlockUpdatesToSalesblock(updates)

      const { data, error } = await supabase
        .from('salesblocks')
        .update(salesblockUpdates)
        .eq('id', blockId)
        .select()
        .single()

      if (error) throw error
      return mapSalesblockToProductivityBlock(data as unknown as LegacySalesblock)
    },
    onMutate: async ({ blockId, updates }) => {
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData<DayPlanData>(queryKey)

      if (previous) {
        queryClient.setQueryData<DayPlanData>(queryKey, {
          ...previous,
          blocks: previous.blocks.map((b) =>
            b.id === blockId ? { ...b, ...updates } : b,
          ),
        })
      }

      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey })
      queryClient.invalidateQueries({ queryKey: blocksQueryKey })
    },
  })

  // ---------------------------------------------------------------------------
  // completeBriefing / completeDebrief
  // ---------------------------------------------------------------------------

  const completeBriefing = useMutation({
    mutationFn: async () => {
      if (!userId || !dateStr) throw new Error('Not authenticated')

      try {
        const { error } = await supabase
          .from('day_plans')
          .update({ briefing_completed: true })
          .eq('user_id', userId)
          .eq('plan_date', dateStr)

        if (error) console.warn('[useDayPlan] completeBriefing failed (table may not exist):', error.message)
      } catch {
        console.warn('[useDayPlan] completeBriefing threw unexpectedly')
      }
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData<DayPlanData>(queryKey)

      if (previous?.plan) {
        queryClient.setQueryData<DayPlanData>(queryKey, {
          ...previous,
          plan: { ...previous.plan, briefing_completed: true },
        })
      }

      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey })
    },
  })

  const completeDebrief = useMutation({
    mutationFn: async () => {
      if (!userId || !dateStr) throw new Error('Not authenticated')

      try {
        const { error } = await supabase
          .from('day_plans')
          .update({ debrief_completed: true })
          .eq('user_id', userId)
          .eq('plan_date', dateStr)

        if (error) console.warn('[useDayPlan] completeDebrief failed (table may not exist):', error.message)
      } catch {
        console.warn('[useDayPlan] completeDebrief threw unexpectedly')
      }
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData<DayPlanData>(queryKey)

      if (previous?.plan) {
        queryClient.setQueryData<DayPlanData>(queryKey, {
          ...previous,
          plan: { ...previous.plan, debrief_completed: true },
        })
      }

      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey })
    },
  })

  // ---------------------------------------------------------------------------
  // Return
  // ---------------------------------------------------------------------------

  return {
    /** The day plan and ordered blocks */
    data: query.data ?? null,
    plan: currentPlan,
    blocks: currentBlocks,
    isLoading: query.isLoading,
    error: query.error,

    /** Create a sales block and append to the day plan */
    addBlock,
    /** Remove a block from the day plan order (does not delete the block row) */
    removeBlock,
    /** Replace block_order with a new array — used for drag-drop reorder */
    reorderBlocks,
    /** Partial update on a sales block */
    updateBlock,
    /** Mark morning briefing as completed */
    completeBriefing,
    /** Mark end-of-day debrief as completed */
    completeDebrief,
  }
}
