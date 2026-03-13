import { cn } from "../../lib/utils";

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

function getColumnWidth(colIndex: number, totalColumns: number): string {
  if (totalColumns <= 3) {
    return colIndex === 0 ? "w-1/3" : colIndex === 1 ? "w-1/4" : "w-1/6";
  }
  return "flex-1";
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
                  getColumnWidth(colIndex, columns)
                )}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
