'use client'

import { useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Sun,
  CheckCircle2,
  Circle,
  ChevronRight,
  ChevronLeft,
  GripVertical,
  Clock,
  AlertTriangle,
  Sparkles,
  Trophy,
  TrendingUp,
  Target,
  MessageSquare,
  BarChart3,
} from 'lucide-react'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import { useAuth } from '@/hooks/useAuth'
import { useMorningBriefing } from '@/hooks/useMorningBriefing'
import type { ProductivityBlock } from '@/types/productivity'

// ---------- Helpers ----------

function formatMs(ms: number): string {
  const totalMin = Math.round(ms / 60_000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

function msToMinutes(ms: number): number {
  return Math.round(ms / 60_000)
}

// ---------- Step Indicator ----------

const STEPS = ['Review', 'Prioritize', 'Commit'] as const
const STEP_MAP = { review: 0, prioritize: 1, commit: 2 } as const

function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center justify-center gap-2">
      {STEPS.map((label, idx) => {
        const isActive = idx === currentStep
        const isComplete = idx < currentStep
        return (
          <div key={label} className="flex items-center gap-2">
            {idx > 0 && (
              <div
                className={`w-12 h-0.5 ${
                  isComplete ? 'bg-indigo-electric' : 'bg-gray-200 dark:bg-white/10'
                }`}
              />
            )}
            <div className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors duration-200 ${
                  isActive
                    ? 'bg-indigo-electric text-white'
                    : isComplete
                      ? 'bg-indigo-electric/20 text-indigo-electric'
                      : 'bg-gray-200 dark:bg-white/10 text-gray-400 dark:text-white/30'
                }`}
              >
                {isComplete ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  idx + 1
                )}
              </div>
              <span
                className={`text-sm font-medium ${
                  isActive
                    ? 'text-gray-900 dark:text-white'
                    : isComplete
                      ? 'text-indigo-electric'
                      : 'text-gray-400 dark:text-white/30'
                }`}
              >
                {label}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ---------- Main Component ----------

export default function MorningBriefingPage() {
  const { user } = useAuth()
  const router = useRouter()

  const {
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
    isCommitting,
    yesterdayDebrief,
  } = useMorningBriefing()

  const currentStepIdx = STEP_MAP[step]

  // All review blocks: overdue + carry forward
  const allReviewBlocks: ProductivityBlock[] = [
    ...overdueBlocks,
    ...carryForwardBlocks,
  ]

  // Selected blocks in order for steps 2 and 3
  const selectedBlocks = suggestedBlocks.length > 0
    ? suggestedBlocks.filter((b) => selectedBlockIds.includes(b.id))
    : allReviewBlocks.filter((b) => selectedBlockIds.includes(b.id))

  const totalPlannedMs = selectedBlocks.reduce(
    (sum, b) => sum + b.duration_estimate_ms,
    0
  )

  // ---------- DnD for prioritize step ----------

  const handleDragEnd = useCallback(
    (result: DropResult) => {
      if (!result.destination) return
      const ids = [...selectedBlockIds]
      const [moved] = ids.splice(result.source.index, 1)
      ids.splice(result.destination.index, 0, moved)
      reorderSelected(ids)
    },
    [selectedBlockIds, reorderSelected]
  )

  // ---------- Actions ----------

  const selectAll = useCallback(() => {
    allReviewBlocks.forEach((b) => {
      if (!selectedBlockIds.includes(b.id)) {
        toggleBlock(b.id)
      }
    })
  }, [allReviewBlocks, selectedBlockIds, toggleBlock])

  const clearAll = useCallback(() => {
    selectedBlockIds.forEach((id) => {
      toggleBlock(id)
    })
  }, [selectedBlockIds, toggleBlock])

  const handleCommit = useCallback(async () => {
    await commitPlan()
    router.push('/dashboard/planner')
  }, [commitPlan, router])

  const handleSkip = useCallback(() => {
    skipBriefing()
    router.push('/dashboard/planner')
  }, [skipBriefing, router])

  // ---------- Render ----------

  return (
    <div className="min-h-full bg-gray-50 dark:bg-void-950 p-6 space-y-6">
      {/* Header */}
      <div className="text-center">
        <p className="vv-section-title mb-1">Daily Planning</p>
        <h1 className="font-display text-3xl font-bold text-gray-900 dark:text-white">
          Morning Briefing
        </h1>
      </div>

      {/* Step Indicator */}
      <StepIndicator currentStep={currentStepIdx} />

      {/* Step Content */}
      <div className="max-w-2xl mx-auto">
        {/* ========== STEP 1: REVIEW ========== */}
        {step === 'review' && (
          <div className="space-y-6">
            <div className="glass-card p-6">
              <div className="flex items-center gap-3 mb-4">
                <Sun className="w-6 h-6 text-amber-400" />
                <h2 className="font-display text-xl font-semibold text-gray-900 dark:text-white">
                  Good morning{user?.email ? `, ${user.email.split('@')[0]}` : ''}
                </h2>
              </div>
              <p className="text-sm text-gray-500 dark:text-white/50">
                Review what needs your attention today. Select the blocks you want to carry forward.
              </p>
            </div>

            {/* Yesterday's Debrief — Feedback Loop */}
            <div className="glass-card p-5 space-y-4">
              <div className="flex items-center gap-3">
                <MessageSquare className="w-5 h-5 text-indigo-electric" />
                <h3 className="font-display font-semibold text-gray-900 dark:text-white text-sm">
                  Yesterday's Reflections
                </h3>
              </div>

              {yesterdayDebrief ? (
                <>
                  {/* Completion stats mini-bar */}
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10">
                    <BarChart3 className="w-4 h-4 text-gray-400 dark:text-white/30 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-500 dark:text-white/40">
                          {yesterdayDebrief.blocks_completed}/{yesterdayDebrief.blocks_planned} blocks completed
                        </span>
                        <span className="text-xs font-mono font-semibold text-gray-900 dark:text-white">
                          {yesterdayDebrief.completion_rate}%
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            yesterdayDebrief.completion_rate >= 80
                              ? 'bg-emerald-500'
                              : yesterdayDebrief.completion_rate >= 50
                                ? 'bg-amber-400'
                                : 'bg-red-400'
                          }`}
                          style={{ width: `${yesterdayDebrief.completion_rate}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Wins */}
                  {yesterdayDebrief.wins && (
                    <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20">
                      <div className="flex items-start gap-2">
                        <Trophy className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                        <div>
                          <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                            Wins
                          </span>
                          <p className="text-sm text-emerald-800 dark:text-emerald-300 mt-1 whitespace-pre-line">
                            {yesterdayDebrief.wins}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Improvements */}
                  {yesterdayDebrief.improvements && (
                    <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20">
                      <div className="flex items-start gap-2">
                        <TrendingUp className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                        <div>
                          <span className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                            To Improve
                          </span>
                          <p className="text-sm text-amber-800 dark:text-amber-300 mt-1 whitespace-pre-line">
                            {yesterdayDebrief.improvements}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Tomorrow's Priorities (yesterday's "tomorrow" = today) */}
                  {yesterdayDebrief.tomorrow_priorities && (
                    <div className="p-3 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20">
                      <div className="flex items-start gap-2">
                        <Target className="w-4 h-4 text-indigo-electric mt-0.5 flex-shrink-0" />
                        <div>
                          <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider">
                            Today's Focus (from yesterday's plan)
                          </span>
                          <p className="text-sm text-indigo-800 dark:text-indigo-300 mt-1 whitespace-pre-line">
                            {yesterdayDebrief.tomorrow_priorities}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* No reflections recorded */}
                  {!yesterdayDebrief.wins && !yesterdayDebrief.improvements && !yesterdayDebrief.tomorrow_priorities && (
                    <p className="text-xs text-gray-400 dark:text-white/30 italic">
                      Debrief was completed but no reflection notes were recorded.
                    </p>
                  )}
                </>
              ) : (
                <div className="p-4 rounded-lg bg-white dark:bg-white/5 border border-dashed border-gray-300 dark:border-white/15 text-center">
                  <MessageSquare className="w-6 h-6 text-gray-300 dark:text-white/20 mx-auto mb-2" />
                  <p className="text-sm text-gray-500 dark:text-white/40">
                    No debrief from yesterday yet.
                  </p>
                  <p className="text-xs text-gray-400 dark:text-white/30 mt-1">
                    Complete your <a href="/dashboard/debrief" className="text-indigo-electric hover:underline">Daily Debrief</a> each
                    evening to see your wins, improvements, and focus areas here every morning.
                  </p>
                </div>
              )}
            </div>

            {/* Overdue blocks */}
            {overdueBlocks.length > 0 && (
              <div className="glass-card p-4">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <h3 className="font-display font-semibold text-gray-900 dark:text-white text-sm">
                    Overdue Blocks
                  </h3>
                  <span className="text-xs font-mono text-gray-400 dark:text-white/30">
                    ({overdueBlocks.length})
                  </span>
                </div>
                <div className="space-y-2">
                  {overdueBlocks.map((block) => (
                    <label
                      key={block.id}
                      className="flex items-center gap-3 p-3 rounded-lg bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 cursor-pointer hover:bg-gray-50 dark:hover:bg-white/[0.08] transition-colors duration-150"
                    >
                      <input
                        type="checkbox"
                        checked={selectedBlockIds.includes(block.id)}
                        onChange={() => toggleBlock(block.id)}
                        className="w-4 h-4 rounded border-gray-300 dark:border-white/20 text-indigo-electric focus:ring-indigo-electric"
                      />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {block.title}
                        </span>
                        <span className="ml-2 text-xs font-mono text-gray-400 dark:text-white/30">
                          {msToMinutes(block.duration_estimate_ms)}m
                        </span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Carry-forward blocks */}
            {carryForwardBlocks.length > 0 && (
              <div className="glass-card p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Circle className="w-4 h-4 text-gray-400 dark:text-white/30" />
                  <h3 className="font-display font-semibold text-gray-900 dark:text-white text-sm">
                    Yesterday's Unfinished
                  </h3>
                  <span className="text-xs font-mono text-gray-400 dark:text-white/30">
                    ({carryForwardBlocks.length})
                  </span>
                </div>
                <div className="space-y-2">
                  {carryForwardBlocks.map((block) => (
                    <label
                      key={block.id}
                      className="flex items-center gap-3 p-3 rounded-lg bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 cursor-pointer hover:bg-gray-50 dark:hover:bg-white/[0.08] transition-colors duration-150"
                    >
                      <input
                        type="checkbox"
                        checked={selectedBlockIds.includes(block.id)}
                        onChange={() => toggleBlock(block.id)}
                        className="w-4 h-4 rounded border-gray-300 dark:border-white/20 text-indigo-electric focus:ring-indigo-electric"
                      />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {block.title}
                        </span>
                        <span className="ml-2 text-xs font-mono text-gray-400 dark:text-white/30">
                          {msToMinutes(block.duration_estimate_ms)}m
                        </span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Empty state */}
            {allReviewBlocks.length === 0 && (
              <div className="glass-card p-8 text-center">
                <Sparkles className="w-8 h-8 text-indigo-electric mx-auto mb-3" />
                <p className="text-sm text-gray-500 dark:text-white/50">
                  No overdue or unfinished blocks. You're starting fresh today!
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {allReviewBlocks.length > 0 && (
                  <>
                    <button
                      onClick={selectAll}
                      className="text-xs font-medium text-indigo-electric hover:text-indigo-electric/80 transition-colors duration-150"
                    >
                      Select All
                    </button>
                    <span className="text-gray-300 dark:text-white/10">|</span>
                    <button
                      onClick={clearAll}
                      className="text-xs font-medium text-gray-500 dark:text-white/40 hover:text-gray-700 dark:hover:text-white/60 transition-colors duration-150"
                    >
                      Clear
                    </button>
                  </>
                )}
              </div>
              <button
                onClick={nextStep}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-indigo-electric text-white font-semibold rounded-lg hover:bg-indigo-electric/80 transition-colors duration-150 ease-snappy text-sm"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ========== STEP 2: PRIORITIZE ========== */}
        {step === 'prioritize' && (
          <div className="space-y-6">
            <div className="glass-card p-6">
              <h2 className="font-display text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Drag to reorder your day
              </h2>
              <p className="text-sm text-gray-500 dark:text-white/50">
                Arrange blocks in the order you want to tackle them. Top items get done first.
              </p>
            </div>

            {/* Available hours indicator */}
            <div className="glass-card p-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-400 dark:text-white/30" />
              <span className="text-sm text-gray-700 dark:text-white/60">
                {selectedBlocks.length} blocks totaling{' '}
                <span className="font-mono font-semibold">{formatMs(totalPlannedMs)}</span>
              </span>
            </div>

            {/* Draggable list */}
            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId="prioritize-list">
                {(provided) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className="space-y-2"
                  >
                    {selectedBlocks.map((block, index) => (
                      <Draggable key={block.id} draggableId={block.id} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className={`bg-white dark:bg-white/5 rounded-lg p-4 border border-gray-200 dark:border-white/10 transition-all duration-150 ease-snappy ${
                              snapshot.isDragging ? 'shadow-lg ring-2 ring-indigo-electric' : ''
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div
                                {...provided.dragHandleProps}
                                className="text-gray-300 dark:text-white/20 hover:text-gray-500 dark:hover:text-white/40 cursor-grab"
                              >
                                <GripVertical className="w-4 h-4" />
                              </div>
                              <span className="w-6 h-6 rounded-full bg-indigo-electric/10 text-indigo-electric flex items-center justify-center text-xs font-semibold">
                                {index + 1}
                              </span>
                              <div className="flex-1 min-w-0">
                                <span className="text-sm font-medium text-gray-900 dark:text-white">
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
            </DragDropContext>

            {selectedBlocks.length === 0 && (
              <div className="glass-card p-8 text-center">
                <p className="text-sm text-gray-500 dark:text-white/50">
                  No blocks selected. Go back to add blocks to your plan.
                </p>
              </div>
            )}

            {/* Navigation */}
            <div className="flex items-center justify-between">
              <button
                onClick={prevStep}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-white/60 font-semibold rounded-lg hover:bg-gray-200 dark:hover:bg-white/10 transition-colors duration-150 text-sm"
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </button>
              <button
                onClick={nextStep}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-indigo-electric text-white font-semibold rounded-lg hover:bg-indigo-electric/80 transition-colors duration-150 ease-snappy text-sm"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ========== STEP 3: COMMIT ========== */}
        {step === 'commit' && (
          <div className="space-y-6">
            <div className="glass-card p-6 text-center">
              <Sparkles className="w-8 h-8 text-indigo-electric mx-auto mb-3" />
              <h2 className="font-display text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Ready to commit
              </h2>
              <p className="text-sm text-gray-500 dark:text-white/50">
                You have{' '}
                <span className="font-semibold text-gray-900 dark:text-white">
                  {selectedBlocks.length} blocks
                </span>{' '}
                planned for{' '}
                <span className="font-mono font-semibold text-gray-900 dark:text-white">
                  {formatMs(totalPlannedMs)}
                </span>
              </p>
            </div>

            {/* Time bar preview */}
            <div className="glass-card p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="vv-section-title">Time Allocation</span>
                <span className="text-xs font-mono text-gray-500 dark:text-white/40">
                  {formatMs(totalPlannedMs)} planned
                </span>
              </div>
              <div className="w-full h-3 bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-electric transition-all duration-300 rounded-full"
                  style={{ width: `${Math.min(100, (selectedBlocks.length / Math.max(selectedBlocks.length, 1)) * 100)}%` }}
                />
              </div>
            </div>

            {/* Block summary */}
            <div className="glass-card p-4">
              <h3 className="vv-section-title mb-3">Plan Summary</h3>
              <div className="space-y-2">
                {selectedBlocks.map((block, idx) => (
                  <div
                    key={block.id}
                    className="flex items-center gap-3 text-sm text-gray-700 dark:text-white/60"
                  >
                    <span className="w-5 h-5 rounded-full bg-indigo-electric/10 text-indigo-electric flex items-center justify-center text-xs font-semibold flex-shrink-0">
                      {idx + 1}
                    </span>
                    <span className="truncate">{block.title}</span>
                    <span className="ml-auto text-xs font-mono text-gray-400 dark:text-white/30 flex-shrink-0">
                      {msToMinutes(block.duration_estimate_ms)}m
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col items-center gap-3">
              <div className="flex items-center gap-3 w-full">
                <button
                  onClick={prevStep}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-white/60 font-semibold rounded-lg hover:bg-gray-200 dark:hover:bg-white/10 transition-colors duration-150 text-sm"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Back
                </button>
                <button
                  onClick={handleCommit}
                  disabled={isCommitting}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 bg-indigo-electric text-white font-semibold rounded-lg hover:bg-indigo-electric/80 transition-colors duration-150 ease-snappy text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isCommitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Committing...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Commit Plan
                    </>
                  )}
                </button>
              </div>
              <button
                onClick={handleSkip}
                className="text-xs text-gray-400 dark:text-white/30 hover:text-gray-600 dark:hover:text-white/50 transition-colors duration-150"
              >
                Skip Briefing
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
