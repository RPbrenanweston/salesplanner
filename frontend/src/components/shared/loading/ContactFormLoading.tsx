export function ContactFormLoading() {
  return (
    <div aria-busy="true" className="space-y-6 p-6">
      <span className="sr-only">Loading...</span>

      {/* Form heading */}
      <div className="h-7 w-48 animate-pulse rounded bg-muted" />

      {/* Form fields */}
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <div className="h-4 w-24 animate-pulse rounded bg-muted" />
            <div className="h-10 w-full animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>

      {/* Action buttons */}
      <div className="flex gap-3 pt-2">
        <div className="h-10 w-24 animate-pulse rounded bg-muted" />
        <div className="h-10 w-24 animate-pulse rounded bg-muted" />
      </div>
    </div>
  )
}
