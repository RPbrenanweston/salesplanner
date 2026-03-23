/** @id salesblock.stores.timer */
/**
 * Zustand store for focus timer state machine.
 *
 * State machine: idle -> running -> paused -> running (resume) -> completed -> break -> idle
 *
 * Why Zustand instead of React state:
 *  - 1Hz tick updates are too fast for server round-trips
 *  - Timer state must survive page navigation
 *  - Multiple components read timer state simultaneously
 */

import { create } from 'zustand'
import type { FocusMode, FocusState } from '../types/productivity'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TimerState {
  /** Current state machine position */
  state: FocusState
  /** Active focus mode */
  mode: FocusMode
  /** Target duration in ms (0 = no target, e.g. flowtime) */
  targetMs: number
  /** Milliseconds elapsed in current work/break segment */
  elapsedMs: number
  /** ISO timestamp when current segment started (wall clock) */
  startedAt: string | null
  /** Associated sales block id */
  blockId: string | null
  /** Supabase focus_session row id for the active session */
  sessionId: string | null
  /** Current pomodoro cycle (1-indexed, resets after long break) */
  cycleNumber: number
  /** Total break time accumulated this session */
  breakTimeMs: number
  /** Number of breaks taken this session */
  breakCount: number
  /** Timestamp of last Supabase persist (for 30s batching) */
  lastPersistedAt: number
}

export interface TimerActions {
  /** Start a new focus session */
  start: (mode: FocusMode, targetMs?: number, blockId?: string) => void
  /** Called every 1s by the interval — increments elapsed, auto-completes if target reached */
  tick: () => void
  /** Pause the running timer */
  pause: () => void
  /** Resume a paused timer */
  resume: () => void
  /** Mark the work segment as completed */
  complete: () => void
  /** Transition to break state */
  startBreak: (breakDurationMs: number) => void
  /** Skip the break and return to idle */
  skipBreak: () => void
  /** Hard reset — cancel everything back to idle */
  cancel: () => void
  /** Mark that we just persisted to Supabase */
  markPersisted: () => void
  /** Set the Supabase session row id after insert */
  setSessionId: (id: string) => void
}

export type TimerStore = TimerState & TimerActions

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

const INITIAL_STATE: TimerState = {
  state: 'idle',
  mode: 'pomodoro',
  targetMs: 0,
  elapsedMs: 0,
  startedAt: null,
  blockId: null,
  sessionId: null,
  cycleNumber: 1,
  breakTimeMs: 0,
  breakCount: 0,
  lastPersistedAt: 0,
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useTimerStore = create<TimerStore>((set, get: () => TimerStore) => ({
  ...INITIAL_STATE,

  start(mode: FocusMode, targetMs: number = 0, blockId?: string) {
    const now = new Date().toISOString()
    set({
      state: 'running',
      mode,
      targetMs,
      elapsedMs: 0,
      startedAt: now,
      blockId: blockId ?? null,
      sessionId: null,
      cycleNumber: 1,
      breakTimeMs: 0,
      breakCount: 0,
      lastPersistedAt: Date.now(),
    })
  },

  tick() {
    const { state, elapsedMs, targetMs } = get()

    if (state === 'running') {
      const nextElapsed = elapsedMs + 1_000
      // Auto-complete when target reached (skip for flowtime where targetMs === 0)
      if (targetMs > 0 && nextElapsed >= targetMs) {
        set({ elapsedMs: targetMs, state: 'completed' })
        return
      }
      set({ elapsedMs: nextElapsed })
      return
    }

    if (state === 'break') {
      const nextElapsed = elapsedMs + 1_000
      // Break timer counts up; auto-complete when break target reached
      if (targetMs > 0 && nextElapsed >= targetMs) {
        // Break finished — advance cycle, return to idle
        const { cycleNumber, breakTimeMs } = get()
        set({
          state: 'idle',
          elapsedMs: 0,
          targetMs: 0,
          cycleNumber: cycleNumber + 1,
          breakTimeMs: breakTimeMs + targetMs,
        })
        return
      }
      set({ elapsedMs: nextElapsed })
    }
  },

  pause() {
    if (get().state !== 'running') return
    set({ state: 'paused' })
  },

  resume() {
    if (get().state !== 'paused') return
    set({ state: 'running' })
  },

  complete() {
    const { state } = get()
    if (state !== 'running' && state !== 'paused') return
    set({ state: 'completed' })
  },

  startBreak(breakDurationMs: number) {
    const { state, breakCount } = get()
    if (state !== 'completed' && state !== 'idle') return
    set({
      state: 'break',
      elapsedMs: 0,
      targetMs: breakDurationMs,
      breakCount: breakCount + 1,
    })
  },

  skipBreak() {
    const { state, cycleNumber } = get()
    if (state !== 'completed' && state !== 'break') return
    set({
      state: 'idle',
      elapsedMs: 0,
      targetMs: 0,
      cycleNumber: cycleNumber + 1,
    })
  },

  cancel() {
    set({ ...INITIAL_STATE })
  },

  markPersisted() {
    set({ lastPersistedAt: Date.now() })
  },

  setSessionId(id: string) {
    set({ sessionId: id })
  },
}))
