# 04 — Metric Cards (MetricTile + StatCard)

## Source
**From:** JobTrackr `packages/ui/src/metric-tile.tsx` + `packages/admin/src/StatCard.tsx`

## What You Get

Two metric card components with slightly different use cases:

- **MetricTile** — Dashboard metric card with icon, label, value, and delta (change indicator). Uses glass-panel CSS class and Material Symbols icons.
- **StatCard** — Admin metric card with frosted glass styling, label, value, optional delta with direction (up/down/neutral), optional icon.

Both render a card with a numeric value and optional trend indicator. StatCard is simpler; MetricTile has more visual polish with glass-panel effects.

## Files Copied

| Source File | Purpose |
|---|---|
| `source/metric-tile.tsx` | Dashboard metric card with glass-panel + delta |
| `source/StatCard.tsx` | Admin metric card with delta direction |

## Implementation Steps

### Step 1: Choose Your Component

You likely want **one** unified metric card, not two. Recommendation: merge into a single `MetricCard` component that takes the best of both:

```typescript
interface MetricCardProps {
  label: string
  value: string | number
  delta?: string
  deltaDirection?: "up" | "down" | "neutral"
  icon?: string  // Material Symbols icon name
  className?: string
}
```

**From MetricTile, take:** glass-panel CSS class, icon support, layout
**From StatCard, take:** deltaDirection prop (cleaner than MetricTile's separate sign detection), frosted glass inline styling

### Step 2: Rework for SalesBlock Context

SalesBlock's dashboard currently has metric sections for:
- Total contacts
- Calls made today/week
- Emails sent today/week
- Meetings booked
- Pipeline value
- Conversion rates
- Sequence performance

Map these to MetricCard instances:

```typescript
<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
  <MetricCard label="Pipeline Value" value="$142,500" delta="+12.3%" deltaDirection="up" icon="payments" />
  <MetricCard label="Calls Today" value="23" delta="+5" deltaDirection="up" icon="call" />
  <MetricCard label="Emails Sent" value="47" delta="-3" deltaDirection="down" icon="mail" />
  <MetricCard label="Meetings" value="8" delta="0" deltaDirection="neutral" icon="event" />
</div>
```

### Step 3: Handle the Glass-Panel CSS

MetricTile depends on a `glass-panel` CSS class. Two options:

**Option A (Recommended):** Inline the glass styling using Tailwind:
```typescript
className="bg-white/65 backdrop-blur-md rounded-[12px] border border-black/[0.08]"
```

**Option B:** Add glass-panel CSS class to SalesBlock's global styles:
```css
.glass-panel {
  background: rgba(255, 255, 255, 0.65);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 12px;
}
```

### Step 4: Place in SalesBlock Structure

```
frontend/src/components/ui/
└── metric-card.tsx    (merged MetricTile + StatCard)
```

Import cn() from SalesBlock's existing utils.

### Step 5: Connect to Real Data

Wire MetricCard to SalesBlock's TanStack Query hooks:

```typescript
const { data: metrics } = useQuery({
  queryKey: ["dashboard-metrics"],
  queryFn: fetchDashboardMetrics,
})
```

## Dependencies

- `clsx` + `tailwind-merge` (for cn() — likely already in SalesBlock)
- Material Symbols icons (link in index.html)

## Hazards (from @crumb metadata)

- **MetricTile:** glass-panel CSS class required — missing = invisible card background
- **MetricTile:** Material Symbols icons loaded via CDN — no npm dependency, verify network access
- **StatCard:** Delta prefix symbols (arrows) render before value without validation — negative numbers with "up" direction are visually misleading
- **StatCard:** Icon field expects Material Symbols name only — no validation

## Estimated Effort
**Low** — 2-3 hours. Merge components, add glass styling, wire to existing data hooks.
