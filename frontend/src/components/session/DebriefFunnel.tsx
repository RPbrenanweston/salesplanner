// @crumb frontend-component-debrief-funnel
// UI/Session/Analytics | sales_funnel_visualization | conversion_metrics | stage_progression | elapsed_time_display
// why: Session debrief funnel — visualize call session progression through sales pipeline stages (Dials > Connects > Intros > Conversations > Asks > Meetings)
// in:totalDials,connects,intros,conversations,asks,meetings,elapsedSeconds numbers out:Animated horizontal bar funnel with stage labels,conversion rates,elapsed time display err:Missing/invalid metric (render as 0),NaN in calculations
// hazard: Conversion rate assumes linear progression Dials → Connects → Intros — skips to higher stage without intermediate step shows negative rates visually
// hazard: elapsedSeconds formatted as MM:SS — values >59 minutes format ambiguously (e.g., 3661s → 61:01 instead of 1:01:01)
// edge:frontend/src/pages/SalesBlockSessionPage.tsx -> RELATES
// edge:frontend/src/components/session/ConnectedFlowPanel.tsx -> RELATES
// prompt: Add stage-progression validation (ensures Connects ≤ Dials). Format elapsed time as H:MM:SS for clarity. Display funnel drop-off percentages between stages.

/**
 * DebriefFunnel — 7-Rate Session Debrief Visualization
 *
 * Renders a cascading horizontal bar funnel showing conversion rates
 * through each stage of a sales session: Dials -> Connects -> Intros ->
 * Conversations -> Asks -> Meetings Booked.
 *
 * Uses the Void Vault (VV) design system with glass-card panels,
 * indigo-to-emerald color gradient, and animated bar transitions.
 */
import { useEffect, useState } from 'react'

// ---------- Types ----------

export interface DebriefFunnelProps {
  totalDials: number
  connects: number
  intros: number
  conversations: number
  asks: number
  meetings: number
  elapsedSeconds: number
}

interface FunnelStage {
  label: string
  count: number
  color: string
}

// ---------- Helpers ----------

function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`
  }
  return `${seconds}s`
}

function calculateConversionRate(current: number, previous: number): number {
  if (previous === 0) return 0
  return Math.round((current / previous) * 100)
}

function calculateBarWidthPercent(count: number, maxCount: number): number {
  if (maxCount === 0) return 0
  return Math.max(Math.round((count / maxCount) * 100), count > 0 ? 8 : 0)
}

/**
 * Session Score (1-10): weighted average of stage conversion rates.
 * Weights bias toward deeper funnel stages (meetings weighted highest).
 */
function calculateSessionScore(stages: FunnelStage[]): number {
  // Conversion rates between consecutive stages
  const rates: number[] = []
  for (let i = 1; i < stages.length; i++) {
    rates.push(calculateConversionRate(stages[i].count, stages[i - 1].count))
  }

  // Weights: connect rate=1, intro rate=1, convo rate=2, ask rate=2, meeting rate=4
  const weights = [1, 1, 2, 2, 4]
  const totalWeight = weights.reduce((sum, w) => sum + w, 0)

  let weightedSum = 0
  for (let i = 0; i < rates.length; i++) {
    weightedSum += rates[i] * (weights[i] ?? 1)
  }

  const weightedAvg = weightedSum / totalWeight
  // Scale 0-100% average to 1-10 score
  const raw = (weightedAvg / 100) * 10
  return Math.max(1, Math.min(10, Math.round(raw * 10) / 10))
}

// ---------- Stage colors (indigo -> emerald gradient) ----------

const STAGE_COLORS = [
  'bg-indigo-electric',           // Dials
  'bg-[#7366f1]',                 // Connects (indigo-purple blend)
  'bg-purple-neon',               // Intros
  'bg-[#6b8cf1]',                 // Conversations (blue-indigo blend)
  'bg-cyan-neon',                 // Asks
  'bg-emerald-signal',            // Meetings
] as const

const STAGE_TEXT_COLORS = [
  'text-indigo-electric',
  'text-[#7366f1]',
  'text-purple-neon',
  'text-[#6b8cf1]',
  'text-cyan-neon',
  'text-emerald-signal',
] as const

// ---------- Component ----------

export default function DebriefFunnel({
  totalDials,
  connects,
  intros,
  conversations,
  asks,
  meetings,
  elapsedSeconds,
}: DebriefFunnelProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 100)
    return () => clearTimeout(timer)
  }, [])

  const stages: FunnelStage[] = [
    { label: 'Dials', count: totalDials, color: STAGE_COLORS[0] },
    { label: 'Connects', count: connects, color: STAGE_COLORS[1] },
    { label: 'Intros Given', count: intros, color: STAGE_COLORS[2] },
    { label: 'Conversations', count: conversations, color: STAGE_COLORS[3] },
    { label: 'Asked for Meeting', count: asks, color: STAGE_COLORS[4] },
    { label: 'Meetings Booked', count: meetings, color: STAGE_COLORS[5] },
  ]

  const allZero = stages.every((s) => s.count === 0)
  const dialsPerHour =
    elapsedSeconds > 0 ? ((totalDials / elapsedSeconds) * 3600).toFixed(1) : '0.0'
  const sessionScore = allZero ? 0 : calculateSessionScore(stages)

  // ---------- Empty state ----------

  if (allZero) {
    return (
      <div className="glass-card p-8 text-center">
        <p className="font-display text-xl font-semibold text-gray-900 dark:text-white mb-2">
          No dials yet — but every session is practice!
        </p>
        <p className="text-sm text-gray-500 dark:text-white/50">
          Session Duration: {formatDuration(elapsedSeconds)}
        </p>
      </div>
    )
  }

  // ---------- Render ----------

  return (
    <div className="space-y-4">
      {/* Header stats row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="glass-card p-4">
          <p className="vv-section-title mb-1">Session Duration</p>
          <p className="font-mono text-2xl font-bold text-gray-900 dark:text-white">
            {formatDuration(elapsedSeconds)}
          </p>
        </div>
        <div className="glass-card p-4">
          <p className="vv-section-title mb-1">Dials per Hour</p>
          <p className="font-mono text-2xl font-bold text-gray-900 dark:text-white">
            {dialsPerHour}
          </p>
        </div>
        <div className="glass-card p-4">
          <p className="vv-section-title mb-1">Session Score</p>
          <p className="font-display text-2xl font-bold text-gray-900 dark:text-white">
            <span className={sessionScore >= 7 ? 'text-emerald-signal' : sessionScore >= 4 ? 'text-cyan-neon' : 'text-indigo-electric'}>
              {sessionScore}
            </span>
            <span className="text-sm font-normal text-gray-400 dark:text-white/40">
              {' '}/ 10
            </span>
          </p>
        </div>
      </div>

      {/* Funnel visualization */}
      <div className="glass-card p-6">
        <h3 className="font-display font-semibold text-gray-900 dark:text-white mb-6">
          7-Rate Funnel
        </h3>
        <div className="space-y-3">
          {stages.map((stage, index) => {
            const widthPct = calculateBarWidthPercent(stage.count, totalDials)
            const prevCount = index > 0 ? stages[index - 1].count : 0
            const conversionRate =
              index > 0 ? calculateConversionRate(stage.count, prevCount) : 100

            return (
              <div key={stage.label} className="flex items-center gap-3">
                {/* Label */}
                <div className="w-36 flex-shrink-0 text-right">
                  <span className="text-sm font-medium text-gray-700 dark:text-white/70">
                    {stage.label}
                  </span>
                </div>

                {/* Bar */}
                <div className="flex-1 relative">
                  <div className="w-full bg-gray-100 dark:bg-white/5 rounded h-8 overflow-hidden">
                    <div
                      className={`${stage.color} h-8 rounded transition-all duration-700 ease-snappy flex items-center justify-center`}
                      style={{ width: mounted ? `${widthPct}%` : '0%' }}
                    >
                      {widthPct > 15 && (
                        <span className="font-mono text-sm font-bold text-white">
                          {stage.count}
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Count label when bar is too narrow */}
                  {widthPct <= 15 && stage.count > 0 && (
                    <span
                      className={`absolute top-1/2 -translate-y-1/2 font-mono text-sm font-bold ${STAGE_TEXT_COLORS[index]}`}
                      style={{ left: `calc(${widthPct}% + 8px)` }}
                    >
                      {stage.count}
                    </span>
                  )}
                </div>

                {/* Conversion rate from previous stage */}
                <div className="w-16 flex-shrink-0 text-right">
                  {index > 0 ? (
                    <span className="font-mono text-xs text-gray-500 dark:text-white/40">
                      {conversionRate}%
                    </span>
                  ) : (
                    <span className="font-mono text-xs text-gray-400 dark:text-white/20">
                      --
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
