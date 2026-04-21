'use client'

/** @id salesblock.hooks.productivity.use-break-reminder */
/**
 * Sprint break reminder hook.
 *
 * Tracks continuous work time (timer in 'running' state) and surfaces
 * a break reminder after sprint_duration_ms (default 90 min) of
 * uninterrupted focus. Supports dismiss, snooze, and take-break actions.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTimerStore } from '@/stores/timerStore'
import { useScheduleConfig } from './useSchedule'
import { DEFAULT_SCHEDULE_CONFIG } from '../types/productivity'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BreakReminderState {
  /** Whether the reminder should be displayed */
  shouldShowReminder: boolean
  /** Minutes of continuous work elapsed */
  minutesWorked: number
  /** Dismiss the reminder until next sprint threshold crossing */
  dismiss: () => void
  /** Hide the reminder for N minutes, then re-surface */
  snooze: (minutes: number) => void
  /** Start a break via the timer store */
  takeBreak: () => void
}

// ---------------------------------------------------------------------------
// Main hook
// ---------------------------------------------------------------------------

export function useBreakReminder(): BreakReminderState {
  const timerState = useTimerStore((s) => s.state)
  const timerElapsedMs = useTimerStore((s) => s.elapsedMs)
  const startBreak = useTimerStore((s) => s.startBreak)

  const { data: config } = useScheduleConfig()

  const sprintDurationMs = config?.sprint_duration_ms ?? DEFAULT_SCHEDULE_CONFIG.sprint_duration_ms
  const breakDurationMs = config?.break_duration_ms ?? DEFAULT_SCHEDULE_CONFIG.break_duration_ms

  // Track whether the user has dismissed/snoozed the current reminder
  const [isDismissed, setIsDismissed] = useState(false)
  const snoozeUntilRef = useRef<number>(0)

  // Track continuous running time across pauses
  // When timer is 'running', we use timerElapsedMs directly.
  // Reset tracking when timer goes to idle/completed.
  const [showReminder, setShowReminder] = useState(false)

  // Compute continuous work minutes
  const minutesWorked = timerState === 'running' || timerState === 'paused'
    ? Math.floor(timerElapsedMs / 60_000)
    : 0

  // Check whether reminder should fire
  useEffect(() => {
    if (timerState !== 'running') {
      // Not actively working — hide reminder
      setShowReminder(false)
      return
    }

    // Check if past sprint threshold
    if (timerElapsedMs < sprintDurationMs) {
      setShowReminder(false)
      return
    }

    // Check snooze
    if (Date.now() < snoozeUntilRef.current) {
      setShowReminder(false)
      return
    }

    // Check dismissed
    if (isDismissed) {
      setShowReminder(false)
      return
    }

    setShowReminder(true)
  }, [timerState, timerElapsedMs, sprintDurationMs, isDismissed])

  // Reset dismissed state when timer resets to idle
  useEffect(() => {
    if (timerState === 'idle' || timerState === 'completed') {
      setIsDismissed(false)
      snoozeUntilRef.current = 0
    }
  }, [timerState])

  // Re-check snooze expiry with an interval
  useEffect(() => {
    if (snoozeUntilRef.current === 0) return
    if (timerState !== 'running') return

    const interval = setInterval(() => {
      if (Date.now() >= snoozeUntilRef.current) {
        snoozeUntilRef.current = 0
        // Let the main effect re-evaluate
        setIsDismissed(false)
      }
    }, 10_000) // Check every 10s

    return () => clearInterval(interval)
  }, [timerState])

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  const dismiss = useCallback(() => {
    setIsDismissed(true)
    setShowReminder(false)
  }, [])

  const snooze = useCallback((minutes: number) => {
    snoozeUntilRef.current = Date.now() + minutes * 60_000
    setShowReminder(false)
  }, [])

  const takeBreak = useCallback(() => {
    startBreak(breakDurationMs)
    setShowReminder(false)
    setIsDismissed(false)
    snoozeUntilRef.current = 0
  }, [startBreak, breakDurationMs])

  return {
    shouldShowReminder: showReminder,
    minutesWorked,
    dismiss,
    snooze,
    takeBreak,
  }
}
