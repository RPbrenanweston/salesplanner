'use client'

/** @id salesblock.hooks.timer.use-timer */
/**
 * React hook wrapping the Zustand timer store with side effects:
 *  - 1Hz interval management (start/stop based on state)
 *  - Batch persistence to Supabase focus_sessions every 30s
 *  - Audio notification stubs on break transitions
 *
 * Interval is only active when state is 'running' or 'break'.
 * Cleanup is handled via useEffect return to prevent memory leaks.
 */

import { useEffect, useRef, useCallback } from 'react'
import { useTimerStore } from '../stores/timerStore'
import type { TimerStore } from '../stores/timerStore'
import { getSupabaseBrowser } from '@/lib/supabase/browser'
import { useAuth } from '@/hooks/useAuth'
import type { FocusMode } from '@/types/productivity'

const TICK_INTERVAL_MS = 1_000
const PERSIST_INTERVAL_MS = 30_000

// States that should run the tick interval
const TICKING_STATES = new Set(['running', 'break'])

/**
 * Persist current timer snapshot to Supabase focus_sessions.
 * Upserts using the sessionId if available, otherwise inserts a new row.
 */
async function persistSession(
  store: TimerStore,
  userId: string,
  orgId: string,
): Promise<string | null> {
  const supabase = getSupabaseBrowser()
  try {
    const row = {
      id: store.sessionId ?? undefined,
      user_id: userId,
      org_id: orgId,
      sales_block_id: store.blockId,
      mode: store.mode,
      state: store.state,
      duration_target_ms: store.targetMs || null,
      duration_actual_ms: store.elapsedMs,
      cycle_number: store.cycleNumber,
      started_at: store.startedAt,
      ended_at: store.state === 'completed' ? new Date().toISOString() : null,
      break_count: store.breakCount,
      break_time_ms: store.breakTimeMs,
    }

    if (store.sessionId) {
      // Update existing row
      const { error } = await supabase
        .from('focus_sessions')
        .update(row)
        .eq('id', store.sessionId)

      if (error) {
        console.warn('[useTimer] Failed to update focus_session (table may not exist):', error.message)
      }
      return store.sessionId
    }

    // Insert new row
    const { data, error } = await supabase
      .from('focus_sessions')
      .insert(row)
      .select('id')
      .single()

    if (error) {
      console.warn('[useTimer] Failed to insert focus_session (table may not exist):', error.message)
      return null
    }

    return data?.id ?? null
  } catch {
    console.warn('[useTimer] persistSession threw unexpectedly — skipping persistence')
    return null
  }
}

export function useTimer() {
  const supabase = getSupabaseBrowser()
  const { user } = useAuth()
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const persistingRef = useRef(false)

  // Pull individual values to avoid full-store subscription on every tick.
  // Components that render elapsed need the elapsedMs selector separately.
  const state = useTimerStore((s) => s.state)
  const mode = useTimerStore((s) => s.mode)
  const targetMs = useTimerStore((s) => s.targetMs)
  const elapsedMs = useTimerStore((s) => s.elapsedMs)
  const blockId = useTimerStore((s) => s.blockId)
  const sessionId = useTimerStore((s) => s.sessionId)
  const cycleNumber = useTimerStore((s) => s.cycleNumber)
  const breakCount = useTimerStore((s) => s.breakCount)
  const breakTimeMs = useTimerStore((s) => s.breakTimeMs)

  const tick = useTimerStore((s) => s.tick)
  const startTimer = useTimerStore((s) => s.start)
  const pause = useTimerStore((s) => s.pause)
  const resume = useTimerStore((s) => s.resume)
  const complete = useTimerStore((s) => s.complete)
  const startBreak = useTimerStore((s) => s.startBreak)
  const skipBreak = useTimerStore((s) => s.skipBreak)
  const cancel = useTimerStore((s) => s.cancel)
  const markPersisted = useTimerStore((s) => s.markPersisted)
  const setSessionId = useTimerStore((s) => s.setSessionId)

  // -------------------------------------------------------------------------
  // 1Hz interval — only active during ticking states
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (TICKING_STATES.has(state)) {
      intervalRef.current = setInterval(tick, TICK_INTERVAL_MS)
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [state, tick])

  // -------------------------------------------------------------------------
  // Batch persistence — persist to Supabase every 30s while ticking
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!TICKING_STATES.has(state) || !user) return

    const orgId = (user as any).user_metadata?.org_id ?? (user as any).org_id
    if (!orgId) return

    const persistInterval = setInterval(async () => {
      // Guard against overlapping persists
      if (persistingRef.current) return
      persistingRef.current = true

      try {
        const store = useTimerStore.getState()
        const id = await persistSession(store, user.id, orgId)
        if (id && !store.sessionId) {
          setSessionId(id)
        }
        markPersisted()
      } finally {
        persistingRef.current = false
      }
    }, PERSIST_INTERVAL_MS)

    return () => clearInterval(persistInterval)
  }, [state, user, setSessionId, markPersisted])

  // -------------------------------------------------------------------------
  // Persist on completion or cancellation (final write)
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (state !== 'completed') return
    if (!user) return

    const orgId = (user as any).user_metadata?.org_id ?? (user as any).org_id
    if (!orgId) return

    // Fire-and-forget final persist
    const store = useTimerStore.getState()
    persistSession(store, user.id, orgId).then((id) => {
      if (id && !store.sessionId) {
        setSessionId(id)
      }
      markPersisted()
    })

    // Audio notification stub
    console.log('[useTimer] Session completed — break time!')
  }, [state, user, setSessionId, markPersisted])

  // -------------------------------------------------------------------------
  // Break start notification
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (state === 'break') {
      console.log('[useTimer] Break started')
    }
  }, [state])

  // -------------------------------------------------------------------------
  // Derived helpers
  // -------------------------------------------------------------------------
  const remainingMs = targetMs > 0 ? Math.max(0, targetMs - elapsedMs) : 0
  const progressPct = targetMs > 0 ? Math.min(100, (elapsedMs / targetMs) * 100) : 0
  const isRunning = state === 'running'
  const isPaused = state === 'paused'
  const isBreak = state === 'break'
  const isIdle = state === 'idle'
  const isCompleted = state === 'completed'

  /** Convenience: start with typed mode and optional params */
  const start = useCallback(
    (focusMode: FocusMode, target?: number, block?: string) => {
      startTimer(focusMode, target, block)
    },
    [startTimer],
  )

  return {
    // State
    state,
    mode,
    targetMs,
    elapsedMs,
    remainingMs,
    progressPct,
    blockId,
    sessionId,
    cycleNumber,
    breakCount,
    breakTimeMs,

    // Derived booleans
    isRunning,
    isPaused,
    isBreak,
    isIdle,
    isCompleted,

    // Actions
    start,
    pause,
    resume,
    complete,
    startBreak,
    skipBreak,
    cancel,
  }
}
