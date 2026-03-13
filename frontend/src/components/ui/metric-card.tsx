import { cn } from "@/lib/utils"

interface MetricCardProps {
  label: string
  value: string | number
  delta?: string
  deltaDirection?: "up" | "down" | "neutral"
  icon?: string
  className?: string
}

const deltaConfig = {
  up: { color: "text-emerald-600", prefix: "\u2191" },
  down: { color: "text-red-500", prefix: "\u2193" },
  neutral: { color: "text-slate-400", prefix: "\u2192" },
} as const

export function MetricCard({
  label,
  value,
  delta,
  deltaDirection = "neutral",
  icon,
  className,
}: MetricCardProps) {
  const { color, prefix } = deltaConfig[deltaDirection]

  return (
    <div
      className={cn(
        "relative bg-white/65 backdrop-blur-md rounded-[12px] border border-black/[0.08] p-5",
        className,
      )}
    >
      {icon && (
        <span className="material-symbols-outlined absolute top-4 right-4 text-slate-400 text-[20px]">
          {icon}
        </span>
      )}

      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
        {label}
      </p>

      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>

      {delta && (
        <p className={cn("mt-1 text-sm font-medium", color)}>
          {prefix} {delta}
        </p>
      )}
    </div>
  )
}

export default MetricCard
