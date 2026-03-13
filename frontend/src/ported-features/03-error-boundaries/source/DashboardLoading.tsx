/**
 * @crumb dashboard-loading-shared
 * @id salesblock.components.shared.DashboardLoading
 * @intent Shared skeleton loading components for all /dashboard route segments.
 *   Reduces the 5 near-identical loading.tsx files to thin wrappers that delegate here.
 * @responsibilities
 *   DashboardPageLoading: generic page skeleton (title + 4 metric cards + content block)
 *   JobsListLoading: jobs list skeleton (header + filter pills + table)
 *   JobFormLoading: form page skeleton (back header + tall form card) — used by new + edit routes
 *   JobDetailLoading: detail page skeleton (header + status/details/notes cards)
 * @contracts
 *   - All exports are named; each loading.tsx re-exports the appropriate variant as default
 *   - No props — skeletons are fixed-layout by design to avoid prop-drilling
 *   - animate-pulse + bg-muted for shimmer; aria-busy + sr-only label for a11y
 * @hazards
 *   - Skeleton layouts are purposely approximate — exact fidelity is a deferred task
 *   - bg-muted and bg-card depend on CSS variable theming being active
 * @area Components/Shared
 * @refs SkeletonTable (@/components/ui)
 */

import { SkeletonTable } from "@/components/ui";

export function DashboardPageLoading() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading dashboard"
      className="container mx-auto max-w-4xl py-8 px-4"
    >
      <span className="sr-only">Loading dashboard…</span>
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-lg border bg-card p-6">
              <div className="h-4 w-20 rounded bg-muted" />
              <div className="mt-3 h-8 w-16 rounded bg-muted" />
            </div>
          ))}
        </div>
        <div className="animate-pulse rounded-lg border bg-card p-6">
          <div className="space-y-3">
            <div className="h-4 w-3/4 rounded bg-muted" />
            <div className="h-4 w-1/2 rounded bg-muted" />
            <div className="h-4 w-2/3 rounded bg-muted" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function JobsListLoading() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading jobs"
      className="container mx-auto max-w-4xl py-8 px-4"
    >
      <span className="sr-only">Loading jobs…</span>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-8 w-32 animate-pulse rounded bg-muted" />
          <div className="flex items-center gap-2">
            <div className="h-10 w-28 animate-pulse rounded bg-muted" />
            <div className="h-10 w-28 animate-pulse rounded bg-muted" />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-7 w-20 animate-pulse rounded-full bg-muted" />
          ))}
        </div>
        <SkeletonTable rows={4} columns={3} />
      </div>
    </div>
  );
}

export function JobFormLoading() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading form"
      className="container mx-auto max-w-2xl py-8 px-4"
    >
      <span className="sr-only">Loading…</span>
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 animate-pulse rounded bg-muted" />
          <div className="h-8 w-36 animate-pulse rounded bg-muted" />
        </div>
        <div className="h-96 animate-pulse rounded-lg border bg-muted" />
      </div>
    </div>
  );
}

export function JobDetailSkeletonLoading() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading job details"
      className="container mx-auto max-w-3xl py-8 px-4"
    >
      <span className="sr-only">Loading job details…</span>
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 animate-pulse rounded bg-muted" />
            <div className="space-y-2">
              <div className="h-7 w-56 animate-pulse rounded bg-muted" />
              <div className="h-4 w-32 animate-pulse rounded bg-muted" />
            </div>
          </div>
          <div className="flex gap-2">
            <div className="h-9 w-20 animate-pulse rounded bg-muted" />
            <div className="h-9 w-20 animate-pulse rounded bg-muted" />
          </div>
        </div>
        <div className="h-24 animate-pulse rounded-lg border bg-muted" />
        <div className="h-48 animate-pulse rounded-lg border bg-muted" />
        <div className="h-32 animate-pulse rounded-lg border bg-muted" />
      </div>
    </div>
  );
}
