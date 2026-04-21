'use client'

import { useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  CheckCircle2,
  Clock,
  Coffee,
  TrendingUp,
  Trophy,
  ArrowUp,
  Lightbulb,
} from 'lucide-react'
import { useDailyDebrief } from '@/hooks/useDailyDebrief'

// ---------- Helpers ----------

function formatMs(ms: number): string {
  const totalMin = Math.round(ms / 60_000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

function formatDateDisplay(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
}

// ---------- StatCard ----------

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string
  value: string
  icon: React.ComponentType<{ className?: string }>
  color: string
}) {
  const colorMap: Record<string, string> = {
    indigo: 'text-indigo-electric bg-indigo-electric/10',
    emerald: 'text-emerald-signal bg-emerald-signal/10',
    cyan: 'text-cyan-neon bg-cyan-neon/10',
    amber: 'text-amber-400 bg-amber-400/10',
  }
  const classes = colorMap[color] || colorMap.indigo

  return (
    <div className="glass-card p-4">
      <div className="flex items-center gap-3 mb-2">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${classes}`}>
          <Icon className="w-4 h-4" />
        </div>
        <span className="vv-section-title">{label}</span>
      </div>
      <div className="font-mono text-2xl font-bold text-gray-900 dark:text-white">
        {value}
      </div>
    </div>
  )
}

// ---------- Main Component ----------

export default function DailyDebriefPage() {
  const router = useRouter()

  const {
    stats,
    wins,
    setWins,
    improvements,
    setImprovements,
    tomorrowPriorities,
    setTomorrowPriorities,
    submitDebrief,
    skipDebrief,
    isSubmitting,
  } = useDailyDebrief()

  // ---------- Actions ----------

  const handleSubmit = useCallback(async () => {
    await submitDebrief()
    router.push('/dashboard/planner')
  }, [submitDebrief, router])

  const handleSkip = useCallback(() => {
    skipDebrief()
    router.push('/dashboard/planner')
  }, [skipDebrief, router])

  // Derive display values from DebriefStats
  const blocksCompleted = stats.blocksCompleted
  const blocksPlanned = stats.blocksPlanned
  const totalFocusMs = stats.totalFocusMs
  const totalBreakMs = stats.totalBreakMs
  const completionRate = stats.completionRate

  // ---------- Render ----------

  return (
    <div className="min-h-full bg-gray-50 dark:bg-void-950 p-6 space-y-6">
      {/* Header */}
      <div>
        <p className="vv-section-title mb-1">Reflection</p>
        <h1 className="font-display text-3xl font-bold text-gray-900 dark:text-white">
          Daily Debrief
        </h1>
        <p className="text-sm text-gray-500 dark:text-white/50 mt-1">
          {formatDateDisplay(todayStr())}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Blocks Completed"
          value={`${blocksCompleted}/${blocksPlanned}`}
          icon={CheckCircle2}
          color="indigo"
        />
        <StatCard
          label="Focus Time"
          value={formatMs(totalFocusMs)}
          icon={Clock}
          color="emerald"
        />
        <StatCard
          label="Break Time"
          value={formatMs(totalBreakMs)}
          icon={Coffee}
          color="cyan"
        />
        <StatCard
          label="Completion Rate"
          value={`${completionRate}%`}
          icon={TrendingUp}
          color={completionRate >= 80 ? 'emerald' : completionRate >= 50 ? 'amber' : 'indigo'}
        />
      </div>

      {/* Completion progress bar */}
      <div className="glass-card p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="vv-section-title">Day Progress</span>
          <span className="text-xs font-mono text-gray-500 dark:text-white/40">
            {completionRate}% complete
          </span>
        </div>
        <div className="w-full h-3 bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              completionRate >= 80
                ? 'bg-emerald-signal'
                : completionRate >= 50
                  ? 'bg-amber-400'
                  : 'bg-indigo-electric'
            }`}
            style={{ width: `${completionRate}%` }}
          />
        </div>
      </div>

      {/* Reflection Form */}
      <div className="space-y-4">
        {/* Wins */}
        <div className="glass-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Trophy className="w-4 h-4 text-amber-400" />
            <h3 className="font-display font-semibold text-gray-900 dark:text-white text-sm">
              Wins
            </h3>
          </div>
          <textarea
            value={wins}
            onChange={(e) => setWins(e.target.value)}
            placeholder="What went well today?"
            rows={3}
            className="w-full px-3 py-2 border border-gray-200 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-indigo-electric focus:outline-none bg-white dark:bg-white/5 text-gray-900 dark:text-white text-sm placeholder-gray-400 dark:placeholder-white/30 resize-none transition-colors duration-150"
          />
        </div>

        {/* Improvements */}
        <div className="glass-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <ArrowUp className="w-4 h-4 text-indigo-electric" />
            <h3 className="font-display font-semibold text-gray-900 dark:text-white text-sm">
              Improvements
            </h3>
          </div>
          <textarea
            value={improvements}
            onChange={(e) => setImprovements(e.target.value)}
            placeholder="What could be better?"
            rows={3}
            className="w-full px-3 py-2 border border-gray-200 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-indigo-electric focus:outline-none bg-white dark:bg-white/5 text-gray-900 dark:text-white text-sm placeholder-gray-400 dark:placeholder-white/30 resize-none transition-colors duration-150"
          />
        </div>

        {/* Tomorrow's Priorities */}
        <div className="glass-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="w-4 h-4 text-cyan-neon" />
            <h3 className="font-display font-semibold text-gray-900 dark:text-white text-sm">
              Tomorrow's Priorities
            </h3>
          </div>
          <textarea
            value={tomorrowPriorities}
            onChange={(e) => setTomorrowPriorities(e.target.value)}
            placeholder="What's most important tomorrow?"
            rows={3}
            className="w-full px-3 py-2 border border-gray-200 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-indigo-electric focus:outline-none bg-white dark:bg-white/5 text-gray-900 dark:text-white text-sm placeholder-gray-400 dark:placeholder-white/30 resize-none transition-colors duration-150"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col items-center gap-3">
        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="w-full max-w-md inline-flex items-center justify-center gap-2 px-6 py-3 bg-indigo-electric text-white font-semibold rounded-lg hover:bg-indigo-electric/80 focus:outline-none focus:ring-2 focus:ring-indigo-electric/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150 ease-snappy text-sm"
        >
          {isSubmitting ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4" />
              Complete Debrief
            </>
          )}
        </button>
        <button
          onClick={handleSkip}
          className="text-xs text-gray-400 dark:text-white/30 hover:text-gray-600 dark:hover:text-white/50 transition-colors duration-150"
        >
          Skip for today
        </button>
      </div>
    </div>
  )
}
