/** @id salesblock.components.productivity.available-hours-bar */
import { cn } from "../../lib/utils";

interface AvailableHoursBarProps {
  totalWorkMs: number;
  scheduledMs: number;
  completedMs: number;
  calendarBlockingMs: number;
  availableMs: number;
}

function formatHours(ms: number): string {
  const hours = ms / 3_600_000;
  if (hours < 0.1) return "0m";
  if (hours < 1) {
    const minutes = Math.round(ms / 60_000);
    return `${minutes}m`;
  }
  const rounded = Math.round(hours * 10) / 10;
  return `${rounded}h`;
}

interface SegmentConfig {
  key: string;
  label: string;
  value: number;
  barClass: string;
  dotClass: string;
}

export function AvailableHoursBar({
  totalWorkMs,
  scheduledMs,
  completedMs,
  calendarBlockingMs,
  availableMs,
}: AvailableHoursBarProps) {
  const segments: SegmentConfig[] = [
    {
      key: "completed",
      label: "done",
      value: completedMs,
      barClass: "bg-emerald-500 dark:bg-emerald-400",
      dotClass: "bg-emerald-500 dark:bg-emerald-400",
    },
    {
      key: "scheduled",
      label: "planned",
      value: scheduledMs,
      barClass: "bg-indigo-500 dark:bg-indigo-400",
      dotClass: "bg-indigo-500 dark:bg-indigo-400",
    },
    {
      key: "calendar",
      label: "meetings",
      value: calendarBlockingMs,
      barClass: "bg-amber-500 dark:bg-amber-400",
      dotClass: "bg-amber-500 dark:bg-amber-400",
    },
    {
      key: "available",
      label: "free",
      value: availableMs,
      barClass: "bg-gray-200 dark:bg-white/10",
      dotClass: "bg-gray-300 dark:bg-white/20",
    },
  ];

  const safeTotal = totalWorkMs > 0 ? totalWorkMs : 1;

  return (
    <div className="glass-card p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-700 dark:text-white/70">
          Available Hours
        </h3>
        <span className="text-xs font-medium text-gray-500 dark:text-white/40">
          {formatHours(totalWorkMs)} total
        </span>
      </div>

      {/* Stacked bar */}
      <div className="flex h-3 rounded-full overflow-hidden bg-gray-100 dark:bg-white/5">
        {segments.map((segment) => {
          const widthPct = (segment.value / safeTotal) * 100;
          if (widthPct <= 0) return null;
          return (
            <div
              key={segment.key}
              className={cn("transition-all duration-300", segment.barClass)}
              style={{ width: `${widthPct}%` }}
              role="meter"
              aria-label={`${segment.label}: ${formatHours(segment.value)}`}
              aria-valuenow={segment.value}
              aria-valuemin={0}
              aria-valuemax={totalWorkMs}
            />
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-3">
        {segments.map((segment) => (
          <div key={segment.key} className="flex items-center gap-1.5">
            <span
              className={cn("inline-block h-2 w-2 rounded-full", segment.dotClass)}
            />
            <span className="text-xs text-gray-500 dark:text-white/50">
              {formatHours(segment.value)} {segment.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default AvailableHoursBar;
