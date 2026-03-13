# 03 — Error Boundaries + Loading Skeletons

## Source
**From:** JobTrackr (ported to SalesBlock) `src/components/shared/DashboardErrorBoundary.tsx` + `DashboardLoading.tsx`

## What You Get

- **DashboardErrorBoundary** — Reusable error UI with route context logging and retry button. Consolidated from 9 identical error.tsx files.
- **DashboardLoading** — 4 loading skeleton variants (Page, List, Form, Detail) with accessibility (aria-busy, sr-only labels). Uses SkeletonTable from UI library.

## Files Copied

| Source File | Purpose |
|---|---|
| `source/DashboardErrorBoundary.tsx` | Error boundary UI with context logging + retry |
| `source/DashboardLoading.tsx` | 4 loading skeleton variants |

## Implementation Steps

### Step 1: Rework Error Boundary

**Key changes for SalesBlock (Vite/React Router vs Next.js):**

1. Remove `"use client"` directive
2. Replace `@/components/ui` Button import with SalesBlock's button component
3. Replace `logError` import with SalesBlock's error logging (or create a simple one):

```typescript
// Simple error logger for SalesBlock:
export function logError(error: Error, context: string) {
  console.error(`[${context}]`, error.message, error.stack)
  // TODO: Send to Sentry/LogRocket if configured
}
```

4. The original version (ported from JobTrackr) is designed for Next.js `error.tsx` convention (receives `error` + `reset` props). For React Router, wrap it in a proper React Error Boundary class:

```typescript
import { Component, type ReactNode } from "react"

class ErrorBoundary extends Component<
  { children: ReactNode; context: string },
  { error: Error | null }
> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <DashboardErrorBoundary
          error={this.state.error}
          reset={() => this.setState({ error: null })}
          context={this.props.context}
        />
      )
    }
    return this.props.children
  }
}
```

### Step 2: Rework Loading Skeletons

**Create SalesBlock-specific skeleton variants:**

| Original Variant (from JobTrackr) | SalesBlock Equivalent | Usage |
|---|---|---|
| `DashboardPageLoading` | `DashboardPageLoading` | Main dashboard (greeting + metric cards + activity feed) |
| `JobsListLoading` | `ContactsListLoading` | Contacts list (header + filter pills + table) |
| `JobFormLoading` | `ContactFormLoading` | Contact/deal creation form |
| `JobDetailSkeletonLoading` | `ContactDetailLoading` | Contact detail page (header + info cards + notes) |
| _(new)_ | `PipelineLoading` | Deal pipeline kanban board |
| _(new)_ | `SequenceLoading` | Email sequence builder |
| _(new)_ | `SessionLoading` | Sales session view |

**Changes needed:**
1. Remove `"use client"` directives
2. Use SalesBlock's SkeletonTable (see feature 07) or inline the skeleton markup
3. Adjust skeleton layouts to match SalesBlock's actual page structures (different grid columns, different card arrangements)
4. Keep the accessibility pattern: `aria-busy="true"` + `<span className="sr-only">`

### Step 3: Place in SalesBlock Structure

```
frontend/src/components/shared/
├── ErrorBoundary.tsx          (class component wrapper)
├── ErrorBoundaryUI.tsx        (the visual error card — adapted from JobTrackr for SalesBlock)
├── error-logger.ts            (logError utility)
└── loading/
    ├── DashboardPageLoading.tsx
    ├── ContactsListLoading.tsx
    ├── ContactFormLoading.tsx
    ├── ContactDetailLoading.tsx
    ├── PipelineLoading.tsx
    └── SequenceLoading.tsx
```

### Step 4: Wrap Route Components

```typescript
// In React Router config:
<Route
  path="/dashboard"
  element={
    <ErrorBoundary context="Dashboard">
      <Suspense fallback={<DashboardPageLoading />}>
        <Dashboard />
      </Suspense>
    </ErrorBoundary>
  }
/>
```

## Dependencies

- SalesBlock's existing Button component (`@/components/ui`)
- Material Symbols icons (for error icon) — already needed for admin panel
- SkeletonTable from feature 07 (optional — can inline skeleton markup instead)

## Hazards (from @crumb metadata)

- `logError` is fire-and-forget — if it throws, the error is silently lost
- Skeleton layouts are approximate — won't exactly match final page layouts (by design)
- `bg-muted` and `bg-card` CSS variables must exist in SalesBlock's Tailwind theme

## Estimated Effort
**Low** — 1 day. Error boundary is near-direct copy. Skeletons need layout adjustment per SalesBlock page.
