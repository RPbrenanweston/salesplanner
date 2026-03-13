/**
 * @crumb
 * @id salesblock-ui-status-pill
 * @intent Render candidate application status badges with semantic coloring and optional animated pulse indicator
 * @responsibilities status-to-color mapping (8 StatusTypes → {text, bg, border, pulse} Tailwind classes), pill layout (inline-flex, gap-1.5, rounded-full), optional pulse animation, label capitalization
 * @contracts StatusPillProps {status: StatusType (union of 8 values), showPulse?: boolean (default false), className?: string}; exports StatusPill function component; renders <span> with semantic color classes
 * @hazards statusColorMap is hardcoded literal Record (not CVA) — adding new status types requires manual entry; color values tightly couple to domain semantics (blue→applied, amber→screening, #10b77f→interview); pulse animation depends on Tailwind config keyframes; showPulse creates visual rendering difference (pill height changes with pulse child)
 * @area UI
 * @refs packages/ui/src/utils.ts, packages/ui/src/index.ts, Tailwind config (animate-pulse)
 * @prompt When adding new StatusTypes, extend statusColorMap Record with {text, bg, border, pulse} entry. Keep color palette consistent with Frosted HUD primary green (#10b77f) for interview status. Test pulse animation timing with neighboring UI. For new colors, verify contrast ratios meet WCAG AA.
 */

import { cn } from "./utils";

type StatusType =
  | "applied"
  | "screening"
  | "interview"
  | "offer"
  | "rejected"
  | "wishlist"
  | "ghosted"
  | "withdrawn";

export interface StatusPillProps {
  status: StatusType;
  showPulse?: boolean;
  className?: string;
}

const statusColorMap: Record<StatusType, { text: string; bg: string; border: string; pulse: string }> = {
  applied: {
    text: "text-blue-600",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
    pulse: "bg-blue-500",
  },
  screening: {
    text: "text-amber-600",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    pulse: "bg-amber-500",
  },
  interview: {
    text: "text-[#10b77f]",
    bg: "bg-[#10b77f]/10",
    border: "border-[#10b77f]/20",
    pulse: "bg-[#10b77f]",
  },
  offer: {
    text: "text-purple-600",
    bg: "bg-purple-500/10",
    border: "border-purple-500/20",
    pulse: "bg-purple-500",
  },
  rejected: {
    text: "text-red-600",
    bg: "bg-red-500/10",
    border: "border-red-500/20",
    pulse: "bg-red-500",
  },
  wishlist: {
    text: "text-slate-600",
    bg: "bg-slate-500/10",
    border: "border-slate-500/20",
    pulse: "bg-slate-500",
  },
  ghosted: {
    text: "text-slate-500",
    bg: "bg-slate-400/10",
    border: "border-slate-400/20",
    pulse: "bg-slate-400",
  },
  withdrawn: {
    text: "text-slate-500",
    bg: "bg-slate-400/10",
    border: "border-slate-400/20",
    pulse: "bg-slate-400",
  },
};

export function StatusPill({ status, showPulse = false, className }: StatusPillProps) {
  const colors = statusColorMap[status];
  const label = status.charAt(0).toUpperCase() + status.slice(1);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-mono text-xs font-bold px-2 py-0.5 rounded-full border",
        colors.text,
        colors.bg,
        colors.border,
        className
      )}
    >
      {showPulse && (
        <span className={cn("size-1.5 rounded-full animate-pulse", colors.pulse)} />
      )}
      {label}
    </span>
  );
}
