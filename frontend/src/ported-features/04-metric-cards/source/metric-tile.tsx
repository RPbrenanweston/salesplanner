/**
 * @crumb
 * @id salesblock-ui-metric-tile
 * @intent Render analytics dashboard metric card with label, large value, optional delta indicator, and icon badge
 * @responsibilities layout composition (glass-panel wrapper, flex row for value+delta, optional icon overlay), delta color-coding logic (positive/negative/neutral branching), icon opacity hover effect (group-hover:opacity-40)
 * @contracts MetricTileProps {label: string, value: string, delta?: string, icon?: string, className?: string}; exports MetricTile function component; renders <div> with glass-panel class + group hover state + slot icon (Material Symbols Outlined)
 * @hazards Hardcoded delta colors (#10b77f green / red-500 / slate-500) tightly couple to analytics semantics — changing colors requires code modification; glass-panel CSS class dependency (must exist in globals.css); Material Symbols icon via CDN; delta detection via string.startsWith("-") assumes format "-X%" (brittle parsing); group-hover opacity change applies to icon only, affects visual hierarchy inconsistently
 * @area UI
 * @refs packages/ui/src/utils.ts, packages/ui/src/index.ts, globals.css (glass-panel class), Material Symbols Outlined (CDN)
 * @prompt For new delta formats (e.g., "±X%", "+X%"), extend isPositive/isNegative logic before startsWith check. Avoid adding new color schemes per delta type — keep triadic (positive/negative/neutral). For non-analytics use, extract delta styling into separate variant configuration (consider future CVA if patterns emerge).
 */
import { cn } from "./utils";

interface MetricTileProps {
  label: string;
  value: string;
  delta?: string;
  icon?: string;
  className?: string;
}

export function MetricTile({ label, value, delta, icon, className }: MetricTileProps) {
  const isPositive = delta && !delta.startsWith("-");
  const isNegative = delta && delta.startsWith("-");

  return (
    <div className={cn("glass-panel rounded-xl p-5 relative overflow-hidden group", className)}>
      {icon && (
        <div className="absolute top-0 right-0 p-3 opacity-20 group-hover:opacity-40 transition-opacity">
          <span className="material-symbols-outlined text-4xl">{icon}</span>
        </div>
      )}
      <p className="font-mono text-[10px] font-bold text-slate-400 tracking-widest uppercase mb-4" style={{ paddingRight: '3.5rem' }}>
        {label}
      </p>
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-4xl font-bold text-slate-900">{value}</span>
        {delta && (
          <span
            className={cn(
              "font-mono text-xs px-1.5 py-0.5 rounded border",
              isPositive && "text-[#10b77f] bg-[#10b77f]/10 border-[#10b77f]/20",
              isNegative && "text-red-500 bg-red-500/10 border-red-500/20",
              !isPositive && !isNegative && "text-slate-500 bg-slate-100 border-slate-200"
            )}
          >
            {delta}
          </span>
        )}
      </div>
    </div>
  );
}
