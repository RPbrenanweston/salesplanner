export function PipelineLoading() {
  return (
    <div aria-busy="true" className="space-y-4 p-6">
      <span className="sr-only">Loading...</span>

      {/* Pipeline header */}
      <div className="flex items-center justify-between">
        <div className="h-8 w-40 animate-pulse rounded bg-muted" />
        <div className="h-10 w-28 animate-pulse rounded bg-muted" />
      </div>

      {/* Kanban columns */}
      <div className="flex gap-4 overflow-x-auto">
        {Array.from({ length: 3 }).map((_, colIndex) => (
          <div
            key={colIndex}
            className="w-72 shrink-0 rounded-lg border bg-card p-3"
          >
            {/* Column header */}
            <div className="mb-3 flex items-center justify-between">
              <div className="h-5 w-24 animate-pulse rounded bg-muted" />
              <div className="h-5 w-6 animate-pulse rounded bg-muted" />
            </div>

            {/* Card stacks */}
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, cardIndex) => (
                <div
                  key={cardIndex}
                  className="rounded-md border bg-card p-3"
                >
                  <div className="mb-2 h-4 w-3/4 animate-pulse rounded bg-muted" />
                  <div className="mb-2 h-3 w-1/2 animate-pulse rounded bg-muted" />
                  <div className="flex items-center gap-2">
                    <div className="h-5 w-5 animate-pulse rounded-full bg-muted" />
                    <div className="h-3 w-16 animate-pulse rounded bg-muted" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
