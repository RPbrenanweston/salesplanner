'use client'

/** @id salesblock.hooks.productivity.use-schedule */
/**
 * Available-hours calculation hook.
 *
 * Computes available work time for a given date by subtracting lunch,
 * calendar events, and planned sales blocks from the workday window.
 * Uses an interval-merge (sweep-line) algorithm to handle overlapping
 * calendar events correctly.
 */

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getSupabaseBrowser } from '@/lib/supabase/browser'
import { useAuth } from '@/hooks/useAuth'
import type {
  UserScheduleConfig,
  CalendarEvent,
  ProductivityBlock,
} from '@/types/productivity'
import { DEFAULT_SCHEDULE_CONFIG } from '@/types/productivity'
import {
  mapSalesblockToProductivityBlock,
  type LegacySalesblock,
} from '@/lib/planner/salesblock-adapter'

// ---------------------------------------------------------------------------
// Timeline entry type — fed to the visual timeline renderer
// ---------------------------------------------------------------------------

export type TimelineEntry =
  | { type: 'work-start'; timeMs: number }
  | { type: 'work-end'; timeMs: number }
  | { type: 'lunch'; startMs: number; endMs: number }
  | { type: 'calendar-event'; event: CalendarEvent; startMs: number; endMs: number }
  | { type: 'sales-block'; block: ProductivityBlock; startMs: number; endMs: number }
  | { type: 'available-slot'; startMs: number; endMs: number }

// ---------------------------------------------------------------------------
// Schedule result
// ---------------------------------------------------------------------------

export interface ScheduleResult {
  /** Total work window minus lunch, in ms */
  totalWorkMs: number
  /** Sum of planned (non-completed) block estimated durations */
  scheduledMs: number
  /** Sum of completed block actual durations */
  completedMs: number
  /** totalWorkMs minus calendar blocking minus scheduled */
  availableMs: number
  /** Merged non-overlapping blocking calendar event time within work hours */
  calendarBlockingMs: number
  /** (completedMs / totalWorkMs) * 100, clamped 0-100 */
  progressPct: number
}

// ---------------------------------------------------------------------------
// Helper: useScheduleConfig (reusable)
// ---------------------------------------------------------------------------

export function useScheduleConfig() {
  const supabase = getSupabaseBrowser()
  const { user } = useAuth()
  const userId = user?.id

  return useQuery<UserScheduleConfig>({
    queryKey: ['schedule-config', userId],
    queryFn: async () => {
      if (!userId) throw new Error('Not authenticated')

      try {
        const { data, error } = await supabase
          .from('user_schedule_config')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle()

        if (error) {
          // Table may not exist yet — return defaults
          console.warn('user_schedule_config query failed, using defaults:', error.message)
          return {
            ...DEFAULT_SCHEDULE_CONFIG,
            user_id: userId,
            org_id: '',
            updated_at: new Date().toISOString(),
          } as UserScheduleConfig
        }

        if (!data) {
          return {
            ...DEFAULT_SCHEDULE_CONFIG,
            user_id: userId,
            org_id: '',
            updated_at: new Date().toISOString(),
          } as UserScheduleConfig
        }

        return data as UserScheduleConfig
      } catch {
        // Graceful fallback
        return {
          ...DEFAULT_SCHEDULE_CONFIG,
          user_id: userId,
          org_id: '',
          updated_at: new Date().toISOString(),
        } as UserScheduleConfig
      }
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes — config changes rarely
  })
}

// ---------------------------------------------------------------------------
// Internal data-fetching queries
// ---------------------------------------------------------------------------

function useCalendarEvents(dateStr: string | undefined) {
  const supabase = getSupabaseBrowser()
  const { user } = useAuth()
  const userId = user?.id

  return useQuery<CalendarEvent[]>({
    queryKey: ['calendar-events', userId, dateStr],
    queryFn: async () => {
      if (!userId || !dateStr) return []

      const dayStart = `${dateStr}T00:00:00`
      const dayEnd = `${dateStr}T23:59:59`

      try {
        const { data, error } = await supabase
          .from('calendar_events')
          .select('*')
          .eq('user_id', userId)
          .gte('start_time', dayStart)
          .lte('start_time', dayEnd)
          .order('start_time', { ascending: true })

        if (error) {
          console.warn('calendar_events query failed:', error.message)
          return []
        }
        return (data ?? []) as CalendarEvent[]
      } catch {
        return []
      }
    },
    enabled: !!userId && !!dateStr,
    staleTime: 1 * 60 * 1000,
  })
}

function useSalesBlocks(dateStr: string | undefined) {
  const supabase = getSupabaseBrowser()
  const { user } = useAuth()
  const userId = user?.id

  return useQuery<ProductivityBlock[]>({
    queryKey: ['sales-blocks', userId, dateStr],
    queryFn: async () => {
      if (!userId || !dateStr) return []

      const { data, error } = await supabase
        .from('salesblocks')
        .select('*')
        .eq('user_id', userId)
        .gte('scheduled_start', `${dateStr}T00:00:00`)
        .lt('scheduled_start', `${dateStr}T23:59:59`)
        .order('scheduled_start', { ascending: true })

      if (error) throw error
      return (data ?? []).map((row, i) =>
        mapSalesblockToProductivityBlock(row as unknown as LegacySalesblock, i),
      )
    },
    enabled: !!userId && !!dateStr,
    staleTime: 30 * 1000,
  })
}

// ---------------------------------------------------------------------------
// Interval merge utility (sweep-line)
// ---------------------------------------------------------------------------

interface Interval {
  start: number
  end: number
}

/** Merge overlapping intervals and return the merged array */
function mergeIntervals(intervals: Interval[]): Interval[] {
  if (intervals.length === 0) return []

  const sorted = [...intervals].sort((a, b) => a.start - b.start)
  const merged: Interval[] = [{ ...sorted[0] }]

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i]
    const last = merged[merged.length - 1]

    if (current.start <= last.end) {
      last.end = Math.max(last.end, current.end)
    } else {
      merged.push({ ...current })
    }
  }

  return merged
}

// ---------------------------------------------------------------------------
// Core: convert hour config to ms-of-day
// ---------------------------------------------------------------------------

function hourToMs(hour: number): number {
  return hour * 60 * 60 * 1000
}

function isoToMsOfDay(iso: string): number {
  const d = new Date(iso)
  return (
    d.getHours() * 3_600_000 +
    d.getMinutes() * 60_000 +
    d.getSeconds() * 1_000 +
    d.getMilliseconds()
  )
}

/** Clamp an interval to the work window, returning null if no overlap */
function clampToWorkWindow(
  start: number,
  end: number,
  workStartMs: number,
  workEndMs: number,
): Interval | null {
  const clampedStart = Math.max(start, workStartMs)
  const clampedEnd = Math.min(end, workEndMs)
  if (clampedStart >= clampedEnd) return null
  return { start: clampedStart, end: clampedEnd }
}

// ---------------------------------------------------------------------------
// Main hook
// ---------------------------------------------------------------------------

export function useSchedule(dateStr: string | undefined) {
  const configQuery = useScheduleConfig()
  const eventsQuery = useCalendarEvents(dateStr)
  const blocksQuery = useSalesBlocks(dateStr)

  const isLoading =
    configQuery.isLoading || eventsQuery.isLoading || blocksQuery.isLoading
  const error = configQuery.error || eventsQuery.error || blocksQuery.error

  const result = useMemo(() => {
    const config = configQuery.data
    const events = eventsQuery.data ?? []
    const blocks = blocksQuery.data ?? []

    if (!config || !dateStr) {
      return {
        schedule: null,
        timelineEntries: [] as TimelineEntry[],
      }
    }

    // --- Workday boundaries (ms of day) ---
    const workStartMs = hourToMs(config.work_start_hour)
    const workEndMs = hourToMs(config.work_end_hour)
    const lunchStartMs = hourToMs(config.lunch_start_hour)
    const lunchEndMs = lunchStartMs + config.lunch_duration_min * 60_000

    const totalWorkMs = workEndMs - workStartMs - config.lunch_duration_min * 60_000

    // --- Calendar blocking (merged, clamped to work hours, minus lunch overlap) ---
    const blockingIntervals: Interval[] = events
      .filter((e) => e.is_blocking && !e.is_all_day)
      .map((e) => ({
        start: isoToMsOfDay(e.start_time),
        end: isoToMsOfDay(e.end_time),
      }))
      .map((iv) => clampToWorkWindow(iv.start, iv.end, workStartMs, workEndMs))
      .filter((iv): iv is Interval => iv !== null)

    // Add lunch as a blocking interval so calendar events overlapping lunch
    // don't double-count
    const allBlocking = mergeIntervals([
      ...blockingIntervals,
      { start: lunchStartMs, end: lunchEndMs },
    ])
    // Total blocking is merged total minus lunch (lunch is already subtracted from totalWorkMs)
    const calendarBlockingMs =
      allBlocking.reduce((sum, iv) => sum + (iv.end - iv.start), 0) -
      (lunchEndMs - lunchStartMs)

    // --- Sales blocks ---
    const scheduledMs = blocks
      .filter((b) => b.status === 'planned' || b.status === 'active' || b.status === 'paused')
      .reduce((sum, b) => sum + b.duration_estimate_ms, 0)

    const completedMs = blocks
      .filter((b) => b.status === 'completed')
      .reduce((sum, b) => sum + b.duration_actual_ms, 0)

    const availableMs = Math.max(0, totalWorkMs - Math.max(0, calendarBlockingMs) - scheduledMs)
    const progressPct =
      totalWorkMs > 0 ? Math.min(100, Math.max(0, (completedMs / totalWorkMs) * 100)) : 0

    const schedule: ScheduleResult = {
      totalWorkMs,
      scheduledMs,
      completedMs,
      availableMs,
      calendarBlockingMs: Math.max(0, calendarBlockingMs),
      progressPct,
    }

    // --- Timeline entries ---
    const timeline: TimelineEntry[] = []

    timeline.push({ type: 'work-start', timeMs: workStartMs })
    timeline.push({ type: 'work-end', timeMs: workEndMs })
    timeline.push({ type: 'lunch', startMs: lunchStartMs, endMs: lunchEndMs })

    for (const event of events) {
      timeline.push({
        type: 'calendar-event',
        event,
        startMs: isoToMsOfDay(event.start_time),
        endMs: isoToMsOfDay(event.end_time),
      })
    }

    for (const block of blocks) {
      if (block.start_time) {
        const startMs = isoToMsOfDay(block.start_time)
        const endMs = block.end_time
          ? isoToMsOfDay(block.end_time)
          : startMs + block.duration_estimate_ms
        timeline.push({ type: 'sales-block', block, startMs, endMs })
      }
    }

    // Compute available slots: gaps in the occupied intervals within work hours
    const occupiedIntervals: Interval[] = [
      { start: lunchStartMs, end: lunchEndMs },
      ...blockingIntervals,
      ...blocks
        .filter((b) => b.start_time)
        .map((b) => {
          const s = isoToMsOfDay(b.start_time!)
          return {
            start: s,
            end: b.end_time ? isoToMsOfDay(b.end_time) : s + b.duration_estimate_ms,
          }
        }),
    ]

    const mergedOccupied = mergeIntervals(
      occupiedIntervals
        .map((iv) => clampToWorkWindow(iv.start, iv.end, workStartMs, workEndMs))
        .filter((iv): iv is Interval => iv !== null),
    )

    let cursor = workStartMs
    for (const occupied of mergedOccupied) {
      if (cursor < occupied.start) {
        timeline.push({ type: 'available-slot', startMs: cursor, endMs: occupied.start })
      }
      cursor = Math.max(cursor, occupied.end)
    }
    if (cursor < workEndMs) {
      timeline.push({ type: 'available-slot', startMs: cursor, endMs: workEndMs })
    }

    // Sort by start time
    const sortKey = (entry: TimelineEntry): number => {
      if ('timeMs' in entry) return entry.timeMs
      return entry.startMs
    }
    timeline.sort((a, b) => sortKey(a) - sortKey(b))

    return { schedule, timelineEntries: timeline }
  }, [configQuery.data, eventsQuery.data, blocksQuery.data, dateStr])

  return {
    data: result.schedule,
    timelineEntries: result.timelineEntries,
    isLoading,
    error,
  }
}
