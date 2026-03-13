# 08 — Analytics Computation

## Source
**From:** JobTrackr (ported to SalesBlock) `src/lib/analytics.ts`

## What You Get

Pure computation functions for analytics dashboards:
- `computeStatusDistribution(jobs)` — groups items by status, returns counts + percentages
- `computeApplicationTimeline(jobs)` — groups items by date (ISO date string), returns daily counts
- `computeMetrics(jobs)` — computes aggregate metrics (total, active, response rate, avg time)
- **Zero external dependencies** — pure TypeScript, no async, no DB calls

## Files Copied

| Source File | Purpose |
|---|---|
| `source/analytics.ts` | 3 pure computation functions + types |

## Implementation Steps

### Step 1: Rework Types

Original types (from JobTrackr) → SalesBlock equivalents:

```typescript
// Original (from JobTrackr)
type AnalyticsJob = { status: JobStatus; created_at: string; updated_at: string }
type StatusDistributionEntry = { status: string; count: number; percentage: number; label: string }
type TimelineEntry = { date: string; count: number }
type AnalyticsMetrics = { total: number; active: number; responseRate: number; avgDaysToResponse: number }

// SalesBlock — rework to:
type AnalyticsContact = { status: string; created_at: string; last_activity_at: string }
type AnalyticsDeal = { stage: string; value: number; created_at: string; closed_at: string | null }
type AnalyticsActivity = { type: string; created_at: string; outcome: string }
```

### Step 2: Rework computeStatusDistribution

The core algorithm is generic — it groups by a field and counts. Rework to accept any field:

```typescript
function computeDistribution<T>(
  items: T[],
  groupBy: (item: T) => string,
  labelMap?: Record<string, string>
): DistributionEntry[] {
  const counts = new Map<string, number>()
  for (const item of items) {
    const key = groupBy(item)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const total = items.length
  return Array.from(counts.entries()).map(([key, count]) => ({
    key,
    label: labelMap?.[key] ?? key.charAt(0).toUpperCase() + key.slice(1),
    count,
    percentage: total > 0 ? Math.round((count / total) * 100) : 0,
  }))
}
```

**SalesBlock usage:**
```typescript
// Contact status distribution
const contactDist = computeDistribution(contacts, c => c.status)

// Deal stage distribution
const dealDist = computeDistribution(deals, d => d.stage)

// Activity type distribution
const activityDist = computeDistribution(activities, a => a.type)
```

### Step 3: Rework computeApplicationTimeline

The timeline function groups by date — this is fully generic. Rename and keep:

```typescript
function computeTimeline<T>(
  items: T[],
  getDate: (item: T) => string  // ISO date string
): TimelineEntry[] {
  const counts = new Map<string, number>()
  for (const item of items) {
    const date = getDate(item).split("T")[0] // Extract YYYY-MM-DD
    counts.set(date, (counts.get(date) ?? 0) + 1)
  }
  return Array.from(counts.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }))
}
```

**SalesBlock usage:**
```typescript
// Contacts created per day
const contactTimeline = computeTimeline(contacts, c => c.created_at)

// Activities per day
const activityTimeline = computeTimeline(activities, a => a.created_at)

// Deals closed per day
const dealTimeline = computeTimeline(
  deals.filter(d => d.closed_at),
  d => d.closed_at!
)
```

### Step 4: Rework computeMetrics

The original implementation (ported from JobTrackr) computes job-search metrics. Rework for SalesBlock sales metrics:

```typescript
interface SalesMetrics {
  totalContacts: number
  activeContacts: number       // contacted in last 30 days
  conversionRate: number       // contacts → deals percentage
  avgDealCycledays: number     // average days from deal creation to close
  totalPipelineValue: number   // sum of open deal values
  wonDealsValue: number        // sum of won deal values
  activitiesThisWeek: number
  avgActivitiesPerDay: number
}

function computeSalesMetrics(
  contacts: AnalyticsContact[],
  deals: AnalyticsDeal[],
  activities: AnalyticsActivity[]
): SalesMetrics {
  // ... implement based on SalesBlock's specific metric definitions
}
```

### Step 5: Add SalesBlock-Specific Computations

Beyond the ported functions, consider adding:

```typescript
// Sequence performance
function computeSequenceMetrics(sequences: Sequence[]) {
  return {
    openRate: ...,
    replyRate: ...,
    bounceRate: ...,
    optOutRate: ...,
  }
}

// Pipeline velocity
function computePipelineVelocity(deals: Deal[]) {
  return {
    avgDaysInStage: Record<string, number>,
    stageConversionRates: Record<string, number>,
    projectedRevenue: number,
  }
}
```

### Step 6: Place in SalesBlock Structure

```
frontend/src/lib/analytics/
├── distribution.ts    (generic computeDistribution)
├── timeline.ts        (generic computeTimeline)
├── sales-metrics.ts   (SalesBlock-specific computeSalesMetrics)
└── index.ts           (barrel export)
```

### Step 7: Wire to Dashboard

```typescript
// Dashboard.tsx
import { computeDistribution, computeTimeline, computeSalesMetrics } from "@/lib/analytics"

const statusDist = useMemo(
  () => computeDistribution(contacts, c => c.status),
  [contacts]
)
```

Feed results into Recharts charts (SalesBlock already uses Recharts).

## Dependencies

**None.** Pure TypeScript computation functions.

## Hazards (from @crumb metadata)

- `STATUS_LABELS` mapping should use SalesBlock's status labels from `@/types` or an inline mapping
- Timeline function sorts by string comparison (`localeCompare`) — works for ISO dates but not for other date formats
- `computeMetrics` calculates `avgDaysToResponse` using `updated_at - created_at` — this is a proxy, not actual response tracking. SalesBlock should use actual activity timestamps for accuracy.

## Estimated Effort
**Low** — 2-3 hours. Core algorithms are generic. Rework is mostly type mapping and adding SalesBlock-specific metric calculations.
