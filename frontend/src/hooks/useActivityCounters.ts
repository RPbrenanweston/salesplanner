/** @id salesblock.hooks.productivity.use-activity-counters */
/**
 * Daily activity disposition counters hook.
 *
 * Fetches the activity_counters row for a given date and provides
 * increment/decrement mutations with optimistic updates.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import type { ActivityCounter } from '../types/productivity'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CounterField =
  | 'dials'
  | 'connects'
  | 'emails_sent'
  | 'linkedin_messages'
  | 'meetings_booked'
  | 'proposals_sent'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function todayDateStr(): string {
  return new Date().toISOString().slice(0, 10)
}

const EMPTY_COUNTERS: Omit<ActivityCounter, 'id' | 'user_id' | 'org_id' | 'counter_date' | 'created_at' | 'updated_at'> = {
  dials: 0,
  connects: 0,
  emails_sent: 0,
  linkedin_messages: 0,
  meetings_booked: 0,
  proposals_sent: 0,
}

// ---------------------------------------------------------------------------
// Main hook
// ---------------------------------------------------------------------------

export function useActivityCounters(dateStr?: string) {
  const { user } = useAuth()
  const userId = user?.id
  const resolvedDate = dateStr ?? todayDateStr()
  const queryClient = useQueryClient()

  const queryKey = ['activity-counters', userId, resolvedDate]

  // ---------------------------------------------------------------------------
  // Query
  // ---------------------------------------------------------------------------

  const query = useQuery<ActivityCounter | null>({
    queryKey,
    queryFn: async () => {
      if (!userId) return null

      const { data, error } = await supabase
        .from('activity_counters')
        .select('*')
        .eq('user_id', userId)
        .eq('counter_date', resolvedDate)
        .maybeSingle()

      if (error) throw error
      return (data as ActivityCounter) ?? null
    },
    enabled: !!userId,
    staleTime: 30 * 1000,
  })

  // ---------------------------------------------------------------------------
  // Upsert helper — creates the row if it doesn't exist yet
  // ---------------------------------------------------------------------------

  async function upsertCounter(field: CounterField, delta: number): Promise<ActivityCounter> {
    if (!userId) throw new Error('Not authenticated')

    const current = query.data
    const orgId = current?.org_id ?? user?.user_metadata?.org_id as string ?? ''

    const currentValue = current ? current[field] : 0
    const newValue = Math.max(0, currentValue + delta)

    const { data, error } = await supabase
      .from('activity_counters')
      .upsert(
        {
          user_id: userId,
          org_id: orgId,
          counter_date: resolvedDate,
          ...EMPTY_COUNTERS,
          ...(current ? {
            dials: current.dials,
            connects: current.connects,
            emails_sent: current.emails_sent,
            linkedin_messages: current.linkedin_messages,
            meetings_booked: current.meetings_booked,
            proposals_sent: current.proposals_sent,
          } : {}),
          [field]: newValue,
        },
        { onConflict: 'user_id,counter_date' },
      )
      .select()
      .single()

    if (error) throw error
    return data as ActivityCounter
  }

  // ---------------------------------------------------------------------------
  // Increment mutation
  // ---------------------------------------------------------------------------

  const increment = useMutation({
    mutationFn: (field: CounterField) => upsertCounter(field, 1),
    onMutate: async (field) => {
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData<ActivityCounter | null>(queryKey)

      if (previous) {
        queryClient.setQueryData<ActivityCounter>(queryKey, {
          ...previous,
          [field]: previous[field] + 1,
        })
      }

      return { previous }
    },
    onError: (_err, _field, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(queryKey, context.previous)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey })
    },
  })

  // ---------------------------------------------------------------------------
  // Decrement mutation
  // ---------------------------------------------------------------------------

  const decrement = useMutation({
    mutationFn: (field: CounterField) => upsertCounter(field, -1),
    onMutate: async (field) => {
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData<ActivityCounter | null>(queryKey)

      if (previous) {
        queryClient.setQueryData<ActivityCounter>(queryKey, {
          ...previous,
          [field]: Math.max(0, previous[field] - 1),
        })
      }

      return { previous }
    },
    onError: (_err, _field, context) => {
      if (context?.previous !== undefined) {
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
    /** Current counter values (null if no row exists yet for this date) */
    data: query.data ?? null,
    /** Convenience accessors — default to 0 */
    counters: {
      dials: query.data?.dials ?? 0,
      connects: query.data?.connects ?? 0,
      emails_sent: query.data?.emails_sent ?? 0,
      linkedin_messages: query.data?.linkedin_messages ?? 0,
      meetings_booked: query.data?.meetings_booked ?? 0,
      proposals_sent: query.data?.proposals_sent ?? 0,
    },
    isLoading: query.isLoading,
    error: query.error,

    /** Increment a counter field by 1 */
    increment,
    /** Decrement a counter field by 1 (floors at 0) */
    decrement,
  }
}
