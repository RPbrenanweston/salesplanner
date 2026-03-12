/**
 * @crumb
 * @id jobtrackr-ui-dotted-leader-row
 * @intent Render label-value pair with visual dotted leader separator for compact data display in metrics, analytics, and detail panels
 * @responsibilities layout composition (flex justify-between), dotted-leader CSS class application, label/value typography pairing
 * @contracts DottedLeaderRowProps requires label (string) + value (string) + optional className; exports DottedLeaderRow function component
 * @hazards dotted-leader class must be defined in global CSS — missing CSS breaks layout (no separator visible); shrink-0 applied to prevent label/value compression but may conflict with very long text; className merge happens after container, may override flex properties
 * @area UI
 * @refs packages/ui/src/utils.ts, packages/ui/src/index.ts, (global CSS for dotted-leader class)
 * @prompt Before using, verify dotted-leader CSS class is defined in Tailwind config or globals.css. For variable-width leaders, consider wrapping value in flex-1 container instead of shrink-0 approach. Test with longest expected label/value pairs.
 */

import { cn } from "./utils";

interface DottedLeaderRowProps {
  label: string;
  value: string;
  className?: string;
}

export function DottedLeaderRow({ label, value, className }: DottedLeaderRowProps) {
  return (
    <div className={cn("flex justify-between items-end", className)}>
      <span className="font-mono text-xs text-slate-500 shrink-0">{label}</span>
      <span className="dotted-leader" />
      <span className="font-mono text-sm font-bold text-slate-900 shrink-0">{value}</span>
    </div>
  );
}
