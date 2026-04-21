'use client'

/** @id salesplanner.app.dashboard.settings.page */
/**
 * Settings page.
 *
 * Sections:
 *   1. Account     — read-only email
 *   2. Appearance  — theme picker (light / dark / system) via useTheme
 *   3. Work Hours  — work_start_hour / work_end_hour / lunch / timezone (Supabase)
 *   4. Focus Timer — pomodoro + sprint durations (Supabase)
 *
 * Data lifecycle:
 *   - Loads via useScheduleConfig() (hooks/useSchedule.ts)
 *   - Saves via upsert to user_schedule_config on { onConflict: 'user_id' }
 *   - Invalidates ['schedule-config', userId] after save
 */

import { useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { useTheme, type Theme } from '@/hooks/useTheme'
import { useScheduleConfig } from '@/hooks/useSchedule'
import { getSupabaseBrowser } from '@/lib/supabase/browser'
import { DEFAULT_SCHEDULE_CONFIG } from '@/types/productivity'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TIMEZONES: readonly string[] = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Asia/Tokyo',
  'Australia/Sydney',
]

const HOURS: readonly number[] = Array.from({ length: 24 }, (_, i) => i)

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function msToMinutes(ms: number): number {
  return Math.round(ms / 60_000)
}

function minutesToMs(min: number): number {
  return Math.max(0, Math.round(min)) * 60_000
}

function formatHourLabel(hour: number): string {
  const h = String(hour).padStart(2, '0')
  return `${h}:00`
}

// ---------------------------------------------------------------------------
// Shared tokens
// ---------------------------------------------------------------------------

const inputCls =
  'rounded-lg border border-gray-200 dark:border-white/10 bg-transparent px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-600/40'

const labelCls = 'block text-xs text-gray-500 dark:text-white/40 mb-1'

const cardCls =
  'rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 p-4'

const sectionTitleCls =
  'text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-white/50 mb-4'

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SettingsPage() {
  const { user } = useAuth()
  const { theme, setTheme } = useTheme()
  const queryClient = useQueryClient()
  const { data: config, isLoading } = useScheduleConfig()

  const userId = user?.id
  const orgId = (user?.user_metadata?.org_id as string | undefined) ?? ''

  // -------------------------------------------------------------------------
  // Local form state — hydrated from config
  // -------------------------------------------------------------------------

  const [workStartHour, setWorkStartHour] = useState<number>(
    DEFAULT_SCHEDULE_CONFIG.work_start_hour,
  )
  const [workEndHour, setWorkEndHour] = useState<number>(
    DEFAULT_SCHEDULE_CONFIG.work_end_hour,
  )
  const [lunchStartHour, setLunchStartHour] = useState<number>(
    DEFAULT_SCHEDULE_CONFIG.lunch_start_hour,
  )
  const [lunchDurationMin, setLunchDurationMin] = useState<number>(
    DEFAULT_SCHEDULE_CONFIG.lunch_duration_min,
  )
  const [timezone, setTimezone] = useState<string>(DEFAULT_SCHEDULE_CONFIG.timezone)

  const [pomodoroWorkMin, setPomodoroWorkMin] = useState<number>(
    msToMinutes(DEFAULT_SCHEDULE_CONFIG.pomodoro_work_ms),
  )
  const [pomodoroShortBreakMin, setPomodoroShortBreakMin] = useState<number>(
    msToMinutes(DEFAULT_SCHEDULE_CONFIG.pomodoro_short_break_ms),
  )
  const [pomodoroLongBreakMin, setPomodoroLongBreakMin] = useState<number>(
    msToMinutes(DEFAULT_SCHEDULE_CONFIG.pomodoro_long_break_ms),
  )
  const [pomodoroCyclesBeforeLong, setPomodoroCyclesBeforeLong] = useState<number>(
    DEFAULT_SCHEDULE_CONFIG.pomodoro_cycles_before_long,
  )
  const [sprintDurationMin, setSprintDurationMin] = useState<number>(
    msToMinutes(DEFAULT_SCHEDULE_CONFIG.sprint_duration_ms),
  )

  const [workHoursSave, setWorkHoursSave] = useState<SaveState>('idle')
  const [focusTimerSave, setFocusTimerSave] = useState<SaveState>('idle')

  // Hydrate from config once loaded
  useEffect(() => {
    if (!config) return
    setWorkStartHour(config.work_start_hour)
    setWorkEndHour(config.work_end_hour)
    setLunchStartHour(config.lunch_start_hour)
    setLunchDurationMin(config.lunch_duration_min)
    setTimezone(config.timezone)

    setPomodoroWorkMin(msToMinutes(config.pomodoro_work_ms))
    setPomodoroShortBreakMin(msToMinutes(config.pomodoro_short_break_ms))
    setPomodoroLongBreakMin(msToMinutes(config.pomodoro_long_break_ms))
    setPomodoroCyclesBeforeLong(config.pomodoro_cycles_before_long)
    setSprintDurationMin(msToMinutes(config.sprint_duration_ms))
  }, [config])

  // -------------------------------------------------------------------------
  // Save helpers
  // -------------------------------------------------------------------------

  const saveFields = useMemo(
    () =>
      async (
        patch: Record<string, unknown>,
        setState: (s: SaveState) => void,
      ): Promise<void> => {
        if (!userId) {
          setState('error')
          return
        }

        setState('saving')
        try {
          const supabase = getSupabaseBrowser()
          const { error } = await supabase
            .from('user_schedule_config')
            .upsert(
              {
                user_id: userId,
                org_id: orgId,
                ...patch,
                updated_at: new Date().toISOString(),
              },
              { onConflict: 'user_id' },
            )

          if (error) throw error

          await queryClient.invalidateQueries({ queryKey: ['schedule-config', userId] })
          setState('saved')
          setTimeout(() => setState('idle'), 2000)
        } catch (err) {
          console.error('settings: save failed', err)
          setState('error')
          setTimeout(() => setState('idle'), 3000)
        }
      },
    [userId, orgId, queryClient],
  )

  const handleSaveWorkHours = () =>
    saveFields(
      {
        work_start_hour: workStartHour,
        work_end_hour: workEndHour,
        lunch_start_hour: lunchStartHour,
        lunch_duration_min: lunchDurationMin,
        timezone,
      },
      setWorkHoursSave,
    )

  const handleSaveFocusTimer = () =>
    saveFields(
      {
        pomodoro_work_ms: minutesToMs(pomodoroWorkMin),
        pomodoro_short_break_ms: minutesToMs(pomodoroShortBreakMin),
        pomodoro_long_break_ms: minutesToMs(pomodoroLongBreakMin),
        pomodoro_cycles_before_long: Math.max(1, Math.round(pomodoroCyclesBeforeLong)),
        sprint_duration_ms: minutesToMs(sprintDurationMin),
      },
      setFocusTimerSave,
    )

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-1 text-xs font-medium uppercase tracking-widest text-gray-400 dark:text-white/40">
        Preferences
      </div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-8">Settings</h1>

      {/* Account */}
      <section className="mb-8">
        <h2 className={sectionTitleCls}>Account</h2>
        <div className={`${cardCls} space-y-3`}>
          <div>
            <label className={labelCls}>Email</label>
            <p className="text-sm text-gray-900 dark:text-white">{user?.email ?? '—'}</p>
          </div>
        </div>
      </section>

      {/* Appearance */}
      <section className="mb-8">
        <h2 className={sectionTitleCls}>Appearance</h2>
        <div className={cardCls}>
          <label className="block text-xs text-gray-500 dark:text-white/40 mb-2">Theme</label>
          <div className="flex gap-2">
            {(['light', 'dark', 'system'] as Theme[]).map((t) => (
              <button
                key={t}
                onClick={() => setTheme(t)}
                className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
                  theme === t
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-white/60 hover:bg-gray-200 dark:hover:bg-white/20'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Work Hours */}
      <section className="mb-8">
        <h2 className={sectionTitleCls}>Work Hours</h2>
        {isLoading ? (
          <WorkHoursSkeleton />
        ) : (
          <div className={`${cardCls} space-y-4`}>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Start time</label>
                <select
                  value={workStartHour}
                  onChange={(e) => setWorkStartHour(Number(e.target.value))}
                  className={`${inputCls} w-full`}
                >
                  {HOURS.map((h) => (
                    <option key={h} value={h} className="bg-white dark:bg-gray-900">
                      {formatHourLabel(h)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>End time</label>
                <select
                  value={workEndHour}
                  onChange={(e) => setWorkEndHour(Number(e.target.value))}
                  className={`${inputCls} w-full`}
                >
                  {HOURS.map((h) => (
                    <option key={h} value={h} className="bg-white dark:bg-gray-900">
                      {formatHourLabel(h)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Lunch start</label>
                <select
                  value={lunchStartHour}
                  onChange={(e) => setLunchStartHour(Number(e.target.value))}
                  className={`${inputCls} w-full`}
                >
                  {HOURS.map((h) => (
                    <option key={h} value={h} className="bg-white dark:bg-gray-900">
                      {formatHourLabel(h)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Lunch duration (min)</label>
                <input
                  type="number"
                  min={0}
                  max={240}
                  step={5}
                  value={lunchDurationMin}
                  onChange={(e) => setLunchDurationMin(Number(e.target.value))}
                  className={`${inputCls} w-full`}
                />
              </div>
            </div>

            <div>
              <label className={labelCls}>Timezone</label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className={`${inputCls} w-full`}
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz} className="bg-white dark:bg-gray-900">
                    {tz}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleSaveWorkHours}
                disabled={workHoursSave === 'saving'}
                className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60"
              >
                {workHoursSave === 'saving' ? 'Saving…' : 'Save settings'}
              </button>
              <SaveStatus state={workHoursSave} />
            </div>
          </div>
        )}
      </section>

      {/* Focus Timer */}
      <section className="mb-8">
        <h2 className={sectionTitleCls}>Focus Timer</h2>
        {isLoading ? (
          <FocusTimerSkeleton />
        ) : (
          <div className={`${cardCls} space-y-4`}>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Pomodoro work (min)</label>
                <input
                  type="number"
                  min={1}
                  max={240}
                  value={pomodoroWorkMin}
                  onChange={(e) => setPomodoroWorkMin(Number(e.target.value))}
                  className={`${inputCls} w-full`}
                />
              </div>
              <div>
                <label className={labelCls}>Sprint duration (min)</label>
                <input
                  type="number"
                  min={1}
                  max={480}
                  value={sprintDurationMin}
                  onChange={(e) => setSprintDurationMin(Number(e.target.value))}
                  className={`${inputCls} w-full`}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Short break (min)</label>
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={pomodoroShortBreakMin}
                  onChange={(e) => setPomodoroShortBreakMin(Number(e.target.value))}
                  className={`${inputCls} w-full`}
                />
              </div>
              <div>
                <label className={labelCls}>Long break (min)</label>
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={pomodoroLongBreakMin}
                  onChange={(e) => setPomodoroLongBreakMin(Number(e.target.value))}
                  className={`${inputCls} w-full`}
                />
              </div>
            </div>

            <div>
              <label className={labelCls}>Cycles before long break</label>
              <input
                type="number"
                min={1}
                max={10}
                value={pomodoroCyclesBeforeLong}
                onChange={(e) => setPomodoroCyclesBeforeLong(Number(e.target.value))}
                className={`${inputCls} w-full`}
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleSaveFocusTimer}
                disabled={focusTimerSave === 'saving'}
                className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60"
              >
                {focusTimerSave === 'saving' ? 'Saving…' : 'Save settings'}
              </button>
              <SaveStatus state={focusTimerSave} />
            </div>
          </div>
        )}
      </section>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Save status pill
// ---------------------------------------------------------------------------

function SaveStatus({ state }: { state: SaveState }) {
  if (state === 'saved') {
    return (
      <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
        Saved ✓
      </span>
    )
  }
  if (state === 'error') {
    return (
      <span className="text-xs font-medium text-red-600 dark:text-red-400">
        Error saving
      </span>
    )
  }
  return null
}

// ---------------------------------------------------------------------------
// Skeletons (match card footprint while loading)
// ---------------------------------------------------------------------------

function WorkHoursSkeleton() {
  return (
    <div className={`${cardCls} space-y-4 animate-pulse`}>
      <div className="grid grid-cols-2 gap-4">
        <div className="h-9 rounded-lg bg-gray-100 dark:bg-white/5" />
        <div className="h-9 rounded-lg bg-gray-100 dark:bg-white/5" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="h-9 rounded-lg bg-gray-100 dark:bg-white/5" />
        <div className="h-9 rounded-lg bg-gray-100 dark:bg-white/5" />
      </div>
      <div className="h-9 rounded-lg bg-gray-100 dark:bg-white/5" />
      <div className="h-9 w-32 rounded-lg bg-gray-100 dark:bg-white/5" />
    </div>
  )
}

function FocusTimerSkeleton() {
  return (
    <div className={`${cardCls} space-y-4 animate-pulse`}>
      <div className="grid grid-cols-2 gap-4">
        <div className="h-9 rounded-lg bg-gray-100 dark:bg-white/5" />
        <div className="h-9 rounded-lg bg-gray-100 dark:bg-white/5" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="h-9 rounded-lg bg-gray-100 dark:bg-white/5" />
        <div className="h-9 rounded-lg bg-gray-100 dark:bg-white/5" />
      </div>
      <div className="h-9 rounded-lg bg-gray-100 dark:bg-white/5" />
      <div className="h-9 w-32 rounded-lg bg-gray-100 dark:bg-white/5" />
    </div>
  )
}
