/**
 * @crumb stat-card-metric
 * @intent Metric display card for admin dashboards with optional delta indicator and icon
 * @responsibilities Render glass-morphic card with label, numeric value, optional delta (up/down/neutral), optional Material Symbols icon
 * @contracts Props: { label: string, value: string | number, delta?: string, deltaDirection?: "up" | "down" | "neutral", icon?: string } | Returns: React.ReactNode
 * @hazards Delta prefix symbols (↑/↓) render before value without validation—negative numbers with "up" direction visually misleading; icon field expects Material Symbols name only, no validation
 * @area admin-ui/metrics
 * @refs AdminLayout (dashboard integration), Material Symbols icon system (no npm dependency), frosted HUD design tokens
 * @prompt Validate deltaDirection matches actual delta value sign in parent component. Material Symbols icons load via CDN—verify icon name validity before render.
 */

import { cn } from "./utils"

interface StatCardProps {
  label: string
  value: string | number
  delta?: string
  deltaDirection?: "up" | "down" | "neutral"
  icon?: string
}

export function StatCard({
  label,
  value,
  delta,
  deltaDirection = "neutral",
  icon,
}: StatCardProps) {
  return (
    <div className="bg-white/65 backdrop-blur-md rounded-[12px] border border-black/[0.08] px-5 py-4">
      <div className="flex items-start justify-between gap-2">
        <div className="font-mono text-[10px] uppercase tracking-widest text-slate-400">
          {label}
        </div>
        {icon && (
          <span className="material-symbols-outlined text-[18px] text-slate-300">
            {icon}
          </span>
        )}
      </div>
      <div className="mt-2 font-display text-2xl font-bold text-slate-800">
        {value}
      </div>
      {delta && (
        <div
          className={cn(
            "mt-1 font-mono text-[11px]",
            deltaDirection === "up" && "text-[#10b77f]",
            deltaDirection === "down" && "text-red-500",
            deltaDirection === "neutral" && "text-slate-400"
          )}
        >
          {deltaDirection === "up" && "↑ "}
          {deltaDirection === "down" && "↓ "}
          {delta}
        </div>
      )}
    </div>
  )
}
