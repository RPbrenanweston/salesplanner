/**
 * @crumb
 * @id jobtrackr-ui-skeleton-table
 * @intent Render animated pulse placeholders for table/list loading states — visual feedback while data fetches
 * @responsibilities skeleton grid composition (space-y-4 wrapper, optional header, rows/columns), width variance by column index (w-1/3, w-1/4, w-1/6), animate-pulse class application to all skeletons
 * @contracts SkeletonTableProps {rows?: number (default 3), columns?: number (default 3), showHeader?: boolean (default false), className?: string}; exports SkeletonTable function component; renders <div> grid of h-4 skeleton elements with animate-pulse
 * @hazards animate-pulse animation requires Tailwind keyframes (verify tailwind.config.ts includes animation); width variance hardcoded by colIndex (w-1/3, w-1/4, w-1/6) — does not scale for 4+ columns; data-testid="skeleton-header" assumes test env (DOM bloat for non-test code)
 * @area UI
 * @refs packages/ui/src/utils.ts, packages/ui/src/index.ts, tailwind.config.ts (animation)
 * @prompt For multi-column support (4+ columns), extend colIndex width logic or use flex-1 for uniform width. Do not add variant support — this is a single-use skeleton component. Keep animate-pulse timing consistent across all skeleton elements.
 */

import { cn } from "./utils";

interface SkeletonTableProps {
  /** Number of skeleton rows to render */
  rows?: number;
  /** Number of columns per row */
  columns?: number;
  /** Whether to show a header skeleton */
  showHeader?: boolean;
  /** Additional class names */
  className?: string;
}
export function SkeletonTable({
  rows = 3,
  columns = 3,
  showHeader = false,
  className,
}: SkeletonTableProps) {
  return (
    <div className={cn("space-y-4", className)}>
      {showHeader && (
        <div
          data-testid="skeleton-header"
          className="flex items-center justify-between"
        >
          <div className="h-8 w-40 animate-pulse rounded bg-muted" />
          <div className="h-10 w-28 animate-pulse rounded bg-muted" />
        </div>
      )}

      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div
          key={rowIndex}
          className="animate-pulse rounded-lg border bg-card p-4"
        >
          <div className="flex items-center gap-4">
            {Array.from({ length: columns }).map((_, colIndex) => (
              <div
                key={colIndex}
                className={cn(
                  "h-4 rounded bg-muted",
                  colIndex === 0 ? "w-1/3" : colIndex === 1 ? "w-1/4" : "w-1/6"
                )}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
