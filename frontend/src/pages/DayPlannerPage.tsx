import { useState, useCallback, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Clock,
  Sun,
  Plus,
  GripVertical,
  Coffee,
  Phone,
  Mail,
  Linkedin,
  Calendar,
  Search,
  Briefcase,
  Play,
  Check,
  Minus,
  AlertTriangle,
} from 'lucide-react'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import { useDayPlan } from '../hooks/useDayPlan'
import { useSchedule, type TimelineEntry } from '../hooks/useSchedule'
import { useTimer } from '../hooks/useTimer'
import { useActivityCounters, type CounterField } from '../hooks/useActivityCounters'
import { useBreakReminder } from '../hooks/useBreakReminder'
import { TimerWidget } from '../components/productivity/TimerWidget'
import { BlockRow } from '../components/productivity/BlockRow'
import type { ProductivityBlock, BlockType } from '../types/productivity'

// ---------- Constants ----------

const TIMELINE_START_HOUR = 7
const TIMELINE_END_HOUR = 19 // 7pm
const LUNCH_START_HOUR = 12
const LUNCH_END_HOUR = 13
const HOUR_HEIGHT_PX = 72

const HOURS = Array.from(
  { length: TIMELINE_END_HOUR - TIMELINE_START_HOUR },
  (_, i) => TIMELINE_START_HOUR + i
)

const BLOCK_TYPES: { value: BlockType; label: string; Icon: React.ElementType }[] = [
  { value: 'call', label: 'Call', Icon: Phone },
  { value: 'email', label: 'Email', Icon: Mail },
  { value: 'linkedin', label: 'LinkedIn', Icon: Linkedin },
  { value: 'meeting', label: 'Meeting', Icon: Calendar },
  { value: 'research', label: 'Research', Icon: Search },
  { value: 'admin', label: 'Admin', Icon: Briefcase },
]

const DURATION_OPTIONS = [
  { label: '15m', ms: 15 * 60_000 },
  { label: '30m', ms: 30 * 60_000 },
  { label: '45m', ms: 45 * 60_000 },
  { label: '60m', ms: 60 * 60_000 },
  { label: '90m', ms: 90 * 60_000 },
]

const COUNTER_LABELS: { field: CounterField; label: string; Icon: React.ElementType }[] = [
  { field: 'dials', label: 'Dials', Icon: Phone },
  { field: 'connects', label: 'Connects', Icon: Phone },
  { field: 'emails_sent', label: 'Emails', Icon: Mail },
  { field: 'linkedin_messages', label: 'LinkedIn', Icon: Linkedin },
  { field: 'meetings_booked', label: 'Meetings', Icon: Calendar },
  { field: 'proposals_sent', label: 'Proposals', Icon: Briefcase },
]

// ---------- Helpers ----------

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function formatMs(ms: number): string {
  const totalMin = Math.round(ms / 60_000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

function formatHour(hour: number): string {
  const suffix = hour < 12 ? 'AM' : 'PM'
  const display = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
  return `${display}:00 ${suffix}`
}

function msToMinutes(ms: number): number {
  return Math.round(ms / 60_000)
}

/** Convert ISO start_time to pixel offset from top of timeline */
function blockTopPx(startTime: string): number {
  const d = new Date(startTime)
  const h = d.getHours()
  const m = d.getMinutes()
  return (h - TIMELINE_START_HOUR) * HOUR_HEIGHT_PX + (m / 60) * HOUR_HEIGHT_PX
}

/** Convert ms-of-day to pixel offset from top of timeline */
function msOfDayToTopPx(ms: number): number {
  const hours = ms / 3_600_000
  return (hours - TIMELINE_START_HOUR) * HOUR_HEIGHT_PX
}

function durationMsToHeightPx(ms: number): number {
  const minutes = ms / 60_000
  return (minutes / 60) * HOUR_HEIGHT_PX
}

/** Get current time as ms-of-day */
function currentTimeMsOfDay(): number {
  const now = new Date()
  return (now.getHours() * 3_600_000) + (now.getMinutes() * 60_000) + (now.getSeconds() * 1_000)
}

// ---------- AvailableHoursBar ----------

function AvailableHoursBar({
  scheduledMs,
  completedMs,
  totalWorkMs,
}: {
  scheduledMs: number
  completedMs: number
  totalWorkMs: number
}) {
  const scheduledPct = totalWorkMs > 0 ? Math.min((scheduledMs / totalWorkMs) * 100, 100) : 0
  const completedPct = totalWorkMs > 0 ? Math.min((completedMs / totalWorkMs) * 100, 100) : 0

  return (
    <div className="glass-card p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="vv-section-title">Time Allocation</span>
        <span className="text-xs font-mono text-gray-500 dark:text-white/40">
          {formatMs(scheduledMs)} scheduled / {formatMs(totalWorkMs)} available
        </span>
      </div>
      <div className="w-full h-3 bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden">
        <div className="h-full flex">
          <div
            className="bg-emerald-signal transition-all duration-300"
            style={{ width: `${completedPct}%` }}
          />
          <div
            className="bg-indigo-electric transition-all duration-300"
            style={{ width: `${Math.max(scheduledPct - completedPct, 0)}%` }}
          />
        </div>
      </div>
      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 dark:text-white/40">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-emerald-signal" /> Completed
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-indigo-electric" /> Scheduled
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-gray-200 dark:bg-white/10" /> Available
        </span>
      </div>
    </div>
  )
}

// ---------- ActivityCountersRow ----------

function ActivityCountersRow({ selectedDate }: { selectedDate: string }) {
  const { counters, increment, decrement } = useActivityCounters(selectedDate)

  return (
    <div className="glass-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="vv-section-title">Activity Counters</span>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {COUNTER_LABELS.map(({ field, label, Icon }) => (
          <div
            key={field}
            className="flex flex-col items-center gap-1 p-2 rounded-lg bg-white/5 border border-white/10"
          >
            <Icon className="w-3.5 h-3.5 text-gray-400 dark:text-white/30" />
            <span className="text-xs text-gray-500 dark:text-white/40">{label}</span>
            <span className="text-lg font-mono font-semibold text-indigo-500 dark:text-indigo-400 tabular-nums">
              {counters[field]}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => decrement.mutate(field)}
                className="flex items-center justify-center h-6 w-6 rounded bg-white/5 hover:bg-white/10 text-gray-400 dark:text-white/30 transition-colors duration-150"
                aria-label={`Decrement ${label}`}
              >
                <Minus className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => increment.mutate(field)}
                className="flex items-center justify-center h-6 w-6 rounded bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-500 dark:text-indigo-400 transition-colors duration-150"
                aria-label={`Increment ${label}`}
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------- BreakReminderBanner ----------

function BreakReminderBanner() {
  const { shouldShowReminder, minutesWorked, dismiss, snooze, takeBreak } = useBreakReminder()

  if (!shouldShowReminder) return null

  return (
    <div className="glass-card p-4 border-l-4 border-amber-500 bg-amber-500/5 dark:bg-amber-500/10">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-900 dark:text-white">
            Time for a break!
          </p>
          <p className="text-xs text-gray-500 dark:text-white/40 mt-0.5">
            You&apos;ve been focused for {minutesWorked} minutes straight. Taking a break improves productivity.
          </p>
          <div className="flex items-center gap-2 mt-3">
            <button
              type="button"
              onClick={takeBreak}
              className="px-3 py-1.5 text-xs font-semibold bg-cyan-500/10 text-cyan-500 dark:text-cyan-400 rounded-lg hover:bg-cyan-500/20 transition-colors duration-150"
            >
              Take Break
            </button>
            <button
              type="button"
              onClick={() => snooze(5)}
              className="px-3 py-1.5 text-xs font-medium text-gray-500 dark:text-white/40 hover:bg-white/5 rounded-lg transition-colors duration-150"
            >
              5 min
            </button>
            <button
              type="button"
              onClick={() => snooze(10)}
              className="px-3 py-1.5 text-xs font-medium text-gray-500 dark:text-white/40 hover:bg-white/5 rounded-lg transition-colors duration-150"
            >
              10 min
            </button>
            <button
              type="button"
              onClick={() => snooze(15)}
              className="px-3 py-1.5 text-xs font-medium text-gray-500 dark:text-white/40 hover:bg-white/5 rounded-lg transition-colors duration-150"
            >
              15 min
            </button>
            <button
              type="button"
              onClick={dismiss}
              className="px-3 py-1.5 text-xs font-medium text-gray-400 dark:text-white/30 hover:bg-white/5 rounded-lg transition-colors duration-150"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------- CreateBlockForm ----------

function CreateBlockForm({
  onSubmit,
  onCancel,
  isPending,
}: {
  onSubmit: (title: string, blockType: BlockType, durationMs: number) => void
  onCancel: () => void
  isPending: boolean
}) {
  const [title, setTitle] = useState('')
  const [blockType, setBlockType] = useState<BlockType>('call')
  const [durationMs, setDurationMs] = useState(30 * 60_000)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    onSubmit(title.trim(), blockType, durationMs)
    setTitle('')
  }

  return (
    <form onSubmit={handleSubmit} className="glass-card p-4 space-y-3">
      <input
        ref={inputRef}
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Block title..."
        className="w-full px-3 py-2 text-sm bg-white/5 border border-white/10 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-colors duration-150"
      />

      {/* Block type selector */}
      <div className="flex flex-wrap gap-1">
        {BLOCK_TYPES.map(({ value, label, Icon }) => (
          <button
            key={value}
            type="button"
            onClick={() => setBlockType(value)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors duration-150 ${
              blockType === value
                ? 'bg-indigo-500/20 text-indigo-500 dark:text-indigo-400 ring-1 ring-indigo-500/30'
                : 'text-gray-500 dark:text-white/40 hover:bg-white/5'
            }`}
          >
            <Icon className="w-3 h-3" />
            {label}
          </button>
        ))}
      </div>

      {/* Duration selector */}
      <div className="flex flex-wrap gap-1">
        {DURATION_OPTIONS.map(({ label, ms }) => (
          <button
            key={ms}
            type="button"
            onClick={() => setDurationMs(ms)}
            className={`px-3 py-1.5 text-xs font-mono font-medium rounded-lg transition-colors duration-150 ${
              durationMs === ms
                ? 'bg-indigo-500/20 text-indigo-500 dark:text-indigo-400 ring-1 ring-indigo-500/30'
                : 'text-gray-500 dark:text-white/40 hover:bg-white/5'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={!title.trim() || isPending}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Block
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-xs font-medium text-gray-500 dark:text-white/40 hover:bg-white/5 rounded-lg transition-colors duration-150"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

// ---------- CurrentTimeIndicator ----------

function CurrentTimeIndicator() {
  const [msOfDay, setMsOfDay] = useState(currentTimeMsOfDay)

  useEffect(() => {
    const interval = setInterval(() => {
      setMsOfDay(currentTimeMsOfDay())
    }, 60_000) // update every 60 seconds
    return () => clearInterval(interval)
  }, [])

  const topPx = msOfDayToTopPx(msOfDay)
  const timelineHeightPx = HOURS.length * HOUR_HEIGHT_PX

  // Only show if within timeline bounds
  if (topPx < 0 || topPx > timelineHeightPx) return null

  return (
    <div
      className="absolute left-0 right-0 z-20 pointer-events-none"
      style={{ top: topPx }}
    >
      <div className="flex items-center">
        <div className="w-2.5 h-2.5 rounded-full bg-red-500 -ml-1" />
        <div className="flex-1 h-0.5 bg-red-500" />
      </div>
    </div>
  )
}

// ---------- Main Component ----------

export default function DayPlannerPage() {
  const navigate = useNavigate()
  const [selectedDate, setSelectedDate] = useState(todayStr())
  const [showCreateForm, setShowCreateForm] = useState(false)

  // Day plan data
  const {
    plan,
    blocks,
    addBlock,
    reorderBlocks,
    updateBlock,
    isLoading: planLoading,
  } = useDayPlan(selectedDate)

  // Schedule data
  const {
    data: schedule,
    timelineEntries,
    isLoading: scheduleLoading,
  } = useSchedule(selectedDate)

  // Timer
  const timer = useTimer()

  const isLoading = planLoading || scheduleLoading
  const isToday = selectedDate === todayStr()

  const scheduledBlocks = blocks.filter((b: ProductivityBlock) => b.start_time)
  const unscheduledBlocks = blocks.filter((b: ProductivityBlock) => !b.start_time)

  // ---------- Block action handlers ----------

  const handleStartTimer = useCallback(
    (blockId: string) => {
      const block = blocks.find((b) => b.id === blockId)
      if (!block) return

      // Start timer for this block
      timer.start('pomodoro', block.duration_estimate_ms, blockId)

      // Update block status to active
      updateBlock.mutate({ blockId, updates: { status: 'active' } })
    },
    [blocks, timer, updateBlock]
  )

  const handleCompleteBlock = useCallback(
    (blockId: string) => {
      // If timer is running for this block, cancel it
      if (timer.blockId === blockId && (timer.isRunning || timer.isPaused)) {
        timer.cancel()
      }

      // Update block status to completed
      updateBlock.mutate({
        blockId,
        updates: { status: 'completed', completed_at: new Date().toISOString() },
      })
    },
    [timer, updateBlock]
  )

  const handleSkipBlock = useCallback(
    (blockId: string) => {
      // If timer is running for this block, cancel it
      if (timer.blockId === blockId && (timer.isRunning || timer.isPaused)) {
        timer.cancel()
      }

      updateBlock.mutate({ blockId, updates: { status: 'skipped' } })
    },
    [timer, updateBlock]
  )

  // ---------- Drag and drop ----------

  const handleDragEnd = useCallback(
    (result: DropResult) => {
      const { source, destination, draggableId } = result
      if (!destination) return

      // Dropped on a timeline hour slot
      if (destination.droppableId.startsWith('hour-')) {
        const hour = parseInt(destination.droppableId.replace('hour-', ''), 10)
        const startTimeIso = `${selectedDate}T${String(hour).padStart(2, '0')}:00:00`
        updateBlock.mutate({ blockId: draggableId, updates: { start_time: startTimeIso } })
        return
      }

      // Dropped back on unscheduled list
      if (destination.droppableId === 'unscheduled') {
        if (source.droppableId !== 'unscheduled') {
          updateBlock.mutate({ blockId: draggableId, updates: { start_time: null } })
        } else {
          // Reorder within unscheduled
          const ids = unscheduledBlocks.map((b) => b.id)
          const [removed] = ids.splice(source.index, 1)
          ids.splice(destination.index, 0, removed)
          const scheduledIds = scheduledBlocks.map((b) => b.id)
          reorderBlocks.mutate([...scheduledIds, ...ids])
        }
      }
    },
    [unscheduledBlocks, scheduledBlocks, updateBlock, reorderBlocks, selectedDate]
  )

  // ---------- Add block via form ----------

  const handleAddBlock = useCallback(
    (title: string, blockType: BlockType, durationMs: number) => {
      addBlock.mutate({
        title,
        scheduled_date: selectedDate,
        block_type: blockType,
        duration_estimate_ms: durationMs,
      })
      setShowCreateForm(false)
    },
    [addBlock, selectedDate]
  )

  // ---------- Loading state ----------

  if (isLoading) {
    return (
      <div className="min-h-full bg-gray-50 dark:bg-void-950 p-6 flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-400 dark:text-white/40">
          <div className="w-5 h-5 border-2 border-indigo-electric border-t-transparent rounded-full animate-spin" />
          <span className="font-mono text-sm tracking-widest uppercase">Loading Day Planner...</span>
        </div>
      </div>
    )
  }

  // ---------- Calendar events from timeline entries ----------

  const calendarEvents = (timelineEntries ?? []).filter(
    (e): e is Extract<TimelineEntry, { type: 'calendar-event' }> => e.type === 'calendar-event'
  )

  // ---------- Render ----------

  return (
    <div className="min-h-full bg-gray-50 dark:bg-void-950 p-6 space-y-6">
      {/* Break Reminder Banner */}
      <BreakReminderBanner />

      {/* Header with Timer */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <p className="vv-section-title mb-1">Productivity</p>
          <h1 className="font-display text-3xl font-bold text-gray-900 dark:text-white">
            Day Planner
          </h1>
        </div>

        <div className="flex items-center gap-3">
          {/* Available time badge */}
          {schedule && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-signal/10 text-emerald-signal text-sm font-mono font-medium">
              <Clock className="w-3.5 h-3.5" />
              Available: {formatMs(schedule.availableMs)}
            </span>
          )}

          {/* Morning Briefing button */}
          {plan && !plan.briefing_completed && isToday && (
            <button
              onClick={() => navigate('/morning-briefing')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-electric text-white font-semibold rounded-lg hover:bg-indigo-electric/80 transition-colors duration-150 ease-snappy text-sm"
            >
              <Sun className="w-4 h-4" />
              Morning Briefing
            </button>
          )}
        </div>
      </div>

      {/* Timer Widget — shown when active or in compact idle form */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4 items-start">
        <div>
          {/* Date selector */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedDate(shiftDate(selectedDate, -1))}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 text-gray-500 dark:text-white/40 transition-colors duration-150"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => setSelectedDate(todayStr())}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors duration-150 ${
                isToday
                  ? 'bg-indigo-electric text-white'
                  : 'bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-white/60 hover:bg-gray-200 dark:hover:bg-white/10'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => setSelectedDate(shiftDate(selectedDate, 1))}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 text-gray-500 dark:text-white/40 transition-colors duration-150"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
            <span className="ml-2 font-display text-lg font-semibold text-gray-900 dark:text-white">
              {formatDateLabel(selectedDate)}
            </span>
          </div>
        </div>

        {/* Timer Widget */}
        <div className="w-full lg:w-auto">
          <TimerWidget
            state={timer.state}
            mode={timer.mode}
            elapsedMs={timer.elapsedMs}
            targetMs={timer.targetMs > 0 ? timer.targetMs : null}
            cycle={timer.cycleNumber}
            totalCycles={4}
            onStart={(mode, targetMs) => timer.start(mode as any, targetMs)}
            onPause={timer.pause}
            onResume={timer.resume}
            onComplete={timer.complete}
            onCancel={timer.cancel}
            onStartBreak={timer.startBreak as any}
            onSkipBreak={timer.skipBreak}
            compact={timer.isIdle}
          />
          {/* Active block label */}
          {timer.blockId && !timer.isIdle && (
            <div className="mt-2 text-center">
              <span className="text-xs text-gray-500 dark:text-white/40">
                Working on:{' '}
                <span className="font-medium text-gray-700 dark:text-white/60">
                  {blocks.find((b) => b.id === timer.blockId)?.title ?? 'Unknown block'}
                </span>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Available Hours Bar */}
      {schedule && (
        <AvailableHoursBar
          scheduledMs={schedule.scheduledMs}
          completedMs={schedule.completedMs}
          totalWorkMs={schedule.totalWorkMs}
        />
      )}

      {/* Activity Counters */}
      <ActivityCountersRow selectedDate={selectedDate} />

      {/* Main content: Timeline + Unscheduled */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
          {/* Left: Timeline */}
          <div className="glass-card p-4 overflow-y-auto max-h-[calc(100vh-320px)]">
            <div className="flex items-center gap-2 mb-4">
              <CalendarDays className="w-4 h-4 text-gray-400 dark:text-white/30" />
              <h2 className="font-display font-semibold text-gray-900 dark:text-white text-sm">
                Timeline
              </h2>
            </div>

            <div
              className="relative"
              style={{ height: HOURS.length * HOUR_HEIGHT_PX }}
            >
              {/* Current time indicator */}
              {isToday && <CurrentTimeIndicator />}

              {/* Hour markers */}
              {HOURS.map((hour) => {
                const isLunch = hour >= LUNCH_START_HOUR && hour < LUNCH_END_HOUR
                return (
                  <Droppable key={`hour-${hour}`} droppableId={`hour-${hour}`}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`absolute left-0 right-0 border-t border-gray-200 dark:border-white/10 ${
                          isLunch ? 'bg-gray-100/50 dark:bg-white/[0.02]' : ''
                        } ${snapshot.isDraggingOver ? 'bg-indigo-electric/5 dark:bg-indigo-electric/10' : ''}`}
                        style={{
                          top: (hour - TIMELINE_START_HOUR) * HOUR_HEIGHT_PX,
                          height: HOUR_HEIGHT_PX,
                        }}
                      >
                        <div className="flex items-start">
                          <span className="w-20 flex-shrink-0 text-xs font-mono text-gray-400 dark:text-white/30 py-1 px-2">
                            {formatHour(hour)}
                          </span>
                          {isLunch && (
                            <span className="inline-flex items-center gap-1 text-xs text-gray-400 dark:text-white/30 py-1">
                              <Coffee className="w-3 h-3" /> Lunch
                            </span>
                          )}
                        </div>
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                )
              })}

              {/* Scheduled blocks overlay */}
              {scheduledBlocks.map((block) => {
                const isActiveBlock = timer.blockId === block.id && !timer.isIdle
                return (
                  <div
                    key={block.id}
                    className={`absolute left-20 right-2 rounded-r-lg px-3 py-2 cursor-pointer transition-colors duration-150 group ${
                      block.status === 'completed'
                        ? 'bg-emerald-signal/10 dark:bg-emerald-signal/20 border-l-4 border-emerald-signal opacity-60'
                        : block.status === 'skipped'
                        ? 'bg-red-500/10 dark:bg-red-500/20 border-l-4 border-red-500 opacity-60'
                        : isActiveBlock
                        ? 'bg-indigo-electric/20 dark:bg-indigo-electric/30 border-l-4 border-indigo-electric ring-1 ring-indigo-electric/30'
                        : 'bg-indigo-electric/10 dark:bg-indigo-electric/20 border-l-4 border-indigo-electric hover:bg-indigo-electric/15 dark:hover:bg-indigo-electric/25'
                    }`}
                    style={{
                      top: blockTopPx(block.start_time!),
                      height: Math.max(durationMsToHeightPx(block.duration_estimate_ms), 36),
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-sm font-medium text-gray-900 dark:text-white truncate ${
                        block.status === 'completed' || block.status === 'skipped' ? 'line-through' : ''
                      }`}>
                        {block.title}
                      </span>
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-mono text-gray-500 dark:text-white/40 flex-shrink-0 ml-2">
                          {msToMinutes(block.duration_estimate_ms)}m
                        </span>
                        {/* Action buttons on hover */}
                        {(block.status === 'planned' || block.status === 'active') && (
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-1">
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleStartTimer(block.id) }}
                              className="flex items-center justify-center h-6 w-6 rounded bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 hover:bg-indigo-500/20 transition-colors"
                              aria-label="Start timer"
                            >
                              <Play className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleCompleteBlock(block.id) }}
                              className="flex items-center justify-center h-6 w-6 rounded bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                              aria-label="Complete"
                            >
                              <Check className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-gray-500 dark:text-white/40 capitalize">
                      {block.block_type}
                    </span>
                  </div>
                )
              })}

              {/* Calendar events from timeline entries */}
              {calendarEvents.map((entry) => {
                const durationMs = entry.endMs - entry.startMs
                return (
                  <div
                    key={entry.event.id}
                    className="absolute left-20 right-2 bg-cyan-neon/10 dark:bg-cyan-neon/15 border-l-4 border-cyan-neon rounded-r-lg px-3 py-2 opacity-80"
                    style={{
                      top: msOfDayToTopPx(entry.startMs),
                      height: Math.max(durationMsToHeightPx(durationMs), 28),
                    }}
                  >
                    <span className="text-sm font-medium text-gray-900 dark:text-white truncate block">
                      {entry.event.title ?? 'Calendar Event'}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Right: Unscheduled blocks */}
          <div className="glass-card p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-semibold text-gray-900 dark:text-white text-sm">
                Unscheduled
              </h2>
              <button
                onClick={() => setShowCreateForm(true)}
                disabled={showCreateForm}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-indigo-electric bg-indigo-electric/10 rounded-lg hover:bg-indigo-electric/20 transition-colors duration-150 disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Block
              </button>
            </div>

            {/* Create block form */}
            {showCreateForm && (
              <div className="mb-4">
                <CreateBlockForm
                  onSubmit={handleAddBlock}
                  onCancel={() => setShowCreateForm(false)}
                  isPending={addBlock.isPending}
                />
              </div>
            )}

            <Droppable droppableId="unscheduled">
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={`space-y-2 min-h-[120px] rounded-lg transition-colors duration-150 ${
                    snapshot.isDraggingOver ? 'bg-indigo-electric/5 dark:bg-indigo-electric/10' : ''
                  }`}
                >
                  {unscheduledBlocks.length === 0 && !showCreateForm && (
                    <div className="text-center py-8 text-sm text-gray-400 dark:text-white/30">
                      No unscheduled blocks
                    </div>
                  )}

                  {unscheduledBlocks.map((block, index) => (
                    <Draggable key={block.id} draggableId={block.id} index={index}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                        >
                          <div className="flex items-center gap-1">
                            <div
                              {...provided.dragHandleProps}
                              className="text-gray-300 dark:text-white/20 hover:text-gray-500 dark:hover:text-white/40 cursor-grab flex-shrink-0"
                            >
                              <GripVertical className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <BlockRow
                                block={block}
                                isDragging={snapshot.isDragging}
                                isActive={timer.blockId === block.id && !timer.isIdle}
                                onStartTimer={handleStartTimer}
                                onComplete={handleCompleteBlock}
                                onSkip={handleSkipBlock}
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </div>
        </div>
      </DragDropContext>
    </div>
  )
}
