import { cn } from "../../lib/utils";

interface DottedLeaderRowProps {
  label: string;
  value: string;
  className?: string;
}

export function DottedLeaderRow({
  label,
  value,
  className,
}: DottedLeaderRowProps) {
  return (
    <div className={cn("flex justify-between items-end", className)}>
      <span className="font-mono text-xs text-slate-500 shrink-0">{label}</span>
      <span className="dotted-leader" />
      <span className="font-mono text-sm font-bold text-slate-900 dark:text-slate-100 shrink-0">
        {value}
      </span>
    </div>
  );
}
