import { useState, useCallback } from 'react'
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
} from 'lucide-react'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import { useDayPlan } from '../hooks/useDayPlan'
import { useSchedule, type TimelineEntry } from '../hooks/useSchedule'
import type { ProductivityBlock } from '../types/productivity'

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

// ---------- Main Component ----------

export default function DayPlannerPage() {
  const navigate = useNavigate()
  const [selectedDate, setSelectedDate] = useState(todayStr())

  const {
    plan,
    blocks,
    addBlock,
    reorderBlocks,
    updateBlock,
    isLoading: planLoading,
  } = useDayPlan(selectedDate)

  const {
    data: schedule,
    timelineEntries,
    isLoading: scheduleLoading,
  } = useSchedule(selectedDate)

  const isLoading = planLoading || scheduleLoading
  const isToday = selectedDate === todayStr()

  const scheduledBlocks = blocks.filter((b: ProductivityBlock) => b.start_time)
  const unscheduledBlocks = blocks.filter((b: ProductivityBlock) => !b.start_time)

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

  // ---------- Add block ----------

  const handleAddBlock = useCallback(() => {
    addBlock.mutate({
      title: 'New Block',
      scheduled_date: selectedDate,
      block_type: 'call',
    })
  }, [addBlock, selectedDate])

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
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
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

      {/* Main content: Timeline + Unscheduled */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
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
              {scheduledBlocks.map((block) => (
                <div
                  key={block.id}
                  className="absolute left-20 right-2 bg-indigo-electric/10 dark:bg-indigo-electric/20 border-l-4 border-indigo-electric rounded-r-lg px-3 py-2 cursor-pointer hover:bg-indigo-electric/15 dark:hover:bg-indigo-electric/25 transition-colors duration-150"
                  style={{
                    top: blockTopPx(block.start_time!),
                    height: Math.max(durationMsToHeightPx(block.duration_estimate_ms), 28),
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {block.title}
                    </span>
                    <span className="text-xs font-mono text-gray-500 dark:text-white/40 flex-shrink-0 ml-2">
                      {msToMinutes(block.duration_estimate_ms)}m
                    </span>
                  </div>
                  <span className="text-xs text-gray-500 dark:text-white/40 capitalize">
                    {block.block_type}
                  </span>
                </div>
              ))}

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
                onClick={handleAddBlock}
                disabled={addBlock.isPending}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-indigo-electric bg-indigo-electric/10 rounded-lg hover:bg-indigo-electric/20 transition-colors duration-150 disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Block
              </button>
            </div>

            <Droppable droppableId="unscheduled">
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={`space-y-2 min-h-[120px] rounded-lg transition-colors duration-150 ${
                    snapshot.isDraggingOver ? 'bg-indigo-electric/5 dark:bg-indigo-electric/10' : ''
                  }`}
                >
                  {unscheduledBlocks.length === 0 && (
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
                          className={`bg-white dark:bg-white/5 rounded-lg p-3 border border-gray-200 dark:border-white/10 transition-all duration-150 ease-snappy ${
                            snapshot.isDragging ? 'shadow-lg ring-2 ring-indigo-electric' : ''
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <div
                              {...provided.dragHandleProps}
                              className="text-gray-300 dark:text-white/20 hover:text-gray-500 dark:hover:text-white/40 cursor-grab"
                            >
                              <GripVertical className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="text-sm font-medium text-gray-900 dark:text-white truncate block">
                                {block.title}
                              </span>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-xs text-gray-500 dark:text-white/40 capitalize">
                                  {block.block_type}
                                </span>
                                <span className="text-xs font-mono text-gray-400 dark:text-white/30">
                                  {msToMinutes(block.duration_estimate_ms)}m
                                </span>
                              </div>
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

      {/* Bottom: Available Hours Bar */}
      {schedule && (
        <AvailableHoursBar
          scheduledMs={schedule.scheduledMs}
          completedMs={schedule.completedMs}
          totalWorkMs={schedule.totalWorkMs}
        />
      )}
    </div>
  )
}
