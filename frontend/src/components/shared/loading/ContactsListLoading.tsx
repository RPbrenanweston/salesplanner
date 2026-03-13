import { SkeletonTable } from "@/components/ui/skeleton-table"

export function ContactsListLoading() {
  return (
    <div aria-busy="true" className="space-y-4 p-6">
      <span className="sr-only">Loading...</span>

      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="h-8 w-40 animate-pulse rounded bg-muted" />
        <div className="h-10 w-32 animate-pulse rounded bg-muted" />
      </div>

      {/* Filter pills */}
      <div className="flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-8 w-20 animate-pulse rounded-full bg-muted" />
        ))}
      </div>

      {/* Table */}
      <SkeletonTable rows={8} columns={5} showHeader />
    </div>
  )
}
