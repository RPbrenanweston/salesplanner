import { cn } from "../../lib/utils";

/** Color definition for a single status value */
export interface StatusColor {
  text: string;
  bg: string;
  border: string;
  pulse: string;
}

/**
 * Generic StatusPill — accepts any string union as status type
 * along with a color map that defines the visual treatment per status.
 */
export interface StatusPillProps<T extends string> {
  status: T;
  colorMap: Record<T, StatusColor>;
  showPulse?: boolean;
  className?: string;
}

export function StatusPill<T extends string>({
  status,
  colorMap,
  showPulse = false,
  className,
}: StatusPillProps<T>) {
  const colors = colorMap[status];
  const label = status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

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
        <span
          className={cn("size-1.5 rounded-full animate-pulse", colors.pulse)}
        />
      )}
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Pre-built color maps for SalesBlock domains
// ---------------------------------------------------------------------------

export type ContactStatus =
  | "new"
  | "engaged"
  | "qualified"
  | "unqualified"
  | "customer"
  | "churned"
  | "do_not_contact";

export const contactStatusColors: Record<ContactStatus, StatusColor> = {
  new: {
    text: "text-blue-600",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
    pulse: "bg-blue-500",
  },
  engaged: {
    text: "text-amber-600",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    pulse: "bg-amber-500",
  },
  qualified: {
    text: "text-emerald-600",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
    pulse: "bg-emerald-500",
  },
  unqualified: {
    text: "text-slate-500",
    bg: "bg-slate-400/10",
    border: "border-slate-400/20",
    pulse: "bg-slate-400",
  },
  customer: {
    text: "text-green-600",
    bg: "bg-green-500/10",
    border: "border-green-500/20",
    pulse: "bg-green-500",
  },
  churned: {
    text: "text-red-600",
    bg: "bg-red-500/10",
    border: "border-red-500/20",
    pulse: "bg-red-500",
  },
  do_not_contact: {
    text: "text-red-700",
    bg: "bg-red-600/10",
    border: "border-red-600/20",
    pulse: "bg-red-600",
  },
};

export type DealStatus =
  | "prospect"
  | "qualified"
  | "proposal"
  | "negotiation"
  | "won"
  | "lost"
  | "stalled";

export const dealStatusColors: Record<DealStatus, StatusColor> = {
  prospect: {
    text: "text-blue-600",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
    pulse: "bg-blue-500",
  },
  qualified: {
    text: "text-amber-600",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    pulse: "bg-amber-500",
  },
  proposal: {
    text: "text-purple-600",
    bg: "bg-purple-500/10",
    border: "border-purple-500/20",
    pulse: "bg-purple-500",
  },
  negotiation: {
    text: "text-amber-700",
    bg: "bg-amber-600/10",
    border: "border-amber-600/20",
    pulse: "bg-amber-600",
  },
  won: {
    text: "text-green-600",
    bg: "bg-green-500/10",
    border: "border-green-500/20",
    pulse: "bg-green-500",
  },
  lost: {
    text: "text-red-600",
    bg: "bg-red-500/10",
    border: "border-red-500/20",
    pulse: "bg-red-500",
  },
  stalled: {
    text: "text-slate-500",
    bg: "bg-slate-400/10",
    border: "border-slate-400/20",
    pulse: "bg-slate-400",
  },
};

export type SequenceStatus =
  | "active"
  | "paused"
  | "completed"
  | "bounced"
  | "replied"
  | "opted_out";

export const sequenceStatusColors: Record<SequenceStatus, StatusColor> = {
  active: {
    text: "text-green-600",
    bg: "bg-green-500/10",
    border: "border-green-500/20",
    pulse: "bg-green-500",
  },
  paused: {
    text: "text-slate-500",
    bg: "bg-slate-400/10",
    border: "border-slate-400/20",
    pulse: "bg-slate-400",
  },
  completed: {
    text: "text-blue-600",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
    pulse: "bg-blue-500",
  },
  bounced: {
    text: "text-red-600",
    bg: "bg-red-500/10",
    border: "border-red-500/20",
    pulse: "bg-red-500",
  },
  replied: {
    text: "text-emerald-600",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
    pulse: "bg-emerald-500",
  },
  opted_out: {
    text: "text-red-700",
    bg: "bg-red-600/10",
    border: "border-red-600/20",
    pulse: "bg-red-600",
  },
};
