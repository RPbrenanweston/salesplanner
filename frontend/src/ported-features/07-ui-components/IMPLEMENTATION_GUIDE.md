# 07 — UI Components (GlassPanel, StatusPill, DottedLeaderRow, SkeletonTable)

## Source
**From:** JobTrackr `packages/ui/src/` — 4 standalone components + utils

## What You Get

4 reusable UI primitives:

| Component | Purpose |
|---|---|
| **GlassPanel** | Frosted glass surface with 3 variants (default/darker/card). Container for dashboard cards. |
| **StatusPill** | Color-coded status badge with 8 status types and optional pulse animation |
| **DottedLeaderRow** | `Label···Value` display with dotted leader separator (like a restaurant menu) |
| **SkeletonTable** | Animated loading placeholder with configurable rows/columns |
| **utils.ts** | cn() function (clsx + tailwind-merge) — foundation for all components |

## Files Copied

| Source File | Purpose |
|---|---|
| `source/glass-panel.tsx` | Frosted glass container, 3 variants |
| `source/status-pill.tsx` | 8-status color-coded badge with pulse |
| `source/dotted-leader-row.tsx` | Label···Value with dotted leader |
| `source/skeleton-table.tsx` | Animated skeleton loading grid |
| `source/utils.ts` | cn() utility |

## Implementation Steps

### Step 1: Port cn() Utility

If SalesBlock doesn't already have a `cn()` function:

```typescript
// frontend/src/lib/utils.ts
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

If SalesBlock already has this (likely), skip — just update import paths in the components.

### Step 2: GlassPanel — Rework

**Changes needed:**
1. Remove `@crumb` comment or update
2. The component requires a `glass-panel` CSS class in global styles. Add to SalesBlock's globals:

```css
/* frontend/src/index.css or globals.css */
.glass-panel {
  background: rgba(255, 255, 255, 0.65);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 12px;
}

.glass-panel-darker {
  background: rgba(255, 255, 255, 0.75);
}

.glass-panel-card {
  background: rgba(255, 255, 255, 0.45);
}
```

3. Uses CVA (class-variance-authority) for variants — ensure it's installed
4. Otherwise works as-is — no domain-specific logic

### Step 3: StatusPill — Rework Status Types

JobTrackr statuses (job application lifecycle):
```
applied | screening | interview | offer | rejected | wishlist | ghosted | withdrawn
```

SalesBlock needs different status types. Map to sales domain:

**For contacts:**
```typescript
type ContactStatus = "new" | "engaged" | "qualified" | "unqualified" | "customer" | "churned" | "do_not_contact"
```

**For deals:**
```typescript
type DealStatus = "prospect" | "qualified" | "proposal" | "negotiation" | "won" | "lost" | "stalled"
```

**For sequences:**
```typescript
type SequenceStatus = "active" | "paused" | "completed" | "bounced" | "replied" | "opted_out"
```

Update `statusColorMap` Record for each status type. Keep the same color-coding pattern:
- Green (#10b77f) for positive states (qualified, won, active)
- Blue for neutral/early states (new, prospect)
- Amber for in-progress states (engaged, negotiation)
- Red for negative states (lost, churned, bounced)
- Slate for inactive states (paused, stalled)

**Consider making StatusPill generic** — accept a `colorMap` prop instead of hardcoding:
```typescript
interface StatusPillProps<T extends string> {
  status: T
  colorMap: Record<T, { text: string; bg: string; border: string; pulse: string }>
  showPulse?: boolean
  className?: string
}
```

### Step 4: DottedLeaderRow — Rework

**Changes needed:**
1. Requires a `dotted-leader` CSS class. Add to globals:

```css
.dotted-leader::after {
  content: "";
  flex: 1;
  border-bottom: 2px dotted rgba(0, 0, 0, 0.12);
  margin: 0 8px;
}
```

2. No domain-specific logic — works as-is for displaying key-value pairs like:
   - Contact details: `Email···john@acme.com`
   - Deal info: `Value···$50,000`
   - Activity stats: `Calls Today···12`

### Step 5: SkeletonTable — Rework

**Changes needed:**
1. Width variance is hardcoded by column index (`w-1/3`, `w-1/4`, `w-1/6`) — only handles 3 columns. For SalesBlock tables with more columns, update the width logic:

```typescript
const getColumnWidth = (colIndex: number, totalColumns: number) => {
  if (totalColumns <= 3) {
    return colIndex === 0 ? "w-1/3" : colIndex === 1 ? "w-1/4" : "w-1/6"
  }
  return "flex-1" // uniform width for 4+ columns
}
```

2. Uses `animate-pulse` + `bg-muted` — ensure these classes exist in SalesBlock's Tailwind config
3. `data-testid="skeleton-header"` can be kept for testing

### Step 6: Place in SalesBlock Structure

```
frontend/src/components/ui/
├── glass-panel.tsx
├── status-pill.tsx      (with SalesBlock status types)
├── dotted-leader-row.tsx
└── skeleton-table.tsx
```

## Dependencies to Install

```bash
npm install clsx tailwind-merge class-variance-authority
```

## CSS Required in Globals

```css
/* Glass panel */
.glass-panel { ... }
.glass-panel-darker { ... }
.glass-panel-card { ... }

/* Dotted leader */
.dotted-leader::after { ... }
```

## Hazards (from @crumb metadata)

- **GlassPanel:** Requires glass-panel CSS classes in globals — missing = no background/blur
- **GlassPanel:** `backdrop-blur` has limited support on older browsers
- **StatusPill:** `statusColorMap` is hardcoded — adding new status types requires manual entry
- **StatusPill:** `#10b77f` color is tightly coupled to JobTrackr brand — verify it matches SalesBlock
- **StatusPill:** `showPulse` changes pill height (pulse child adds vertical space)
- **DottedLeaderRow:** Requires `dotted-leader` CSS class in globals
- **SkeletonTable:** Width variance hardcoded for 3 columns max — breaks for wider tables

## Estimated Effort
**Low** — 3-4 hours. GlassPanel and DottedLeaderRow copy directly with CSS additions. StatusPill needs status type remapping. SkeletonTable needs minor width fix.
