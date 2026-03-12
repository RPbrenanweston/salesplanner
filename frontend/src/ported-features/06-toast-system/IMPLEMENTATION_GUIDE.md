# 06 — Toast Notification System

## Source
**From:** JobTrackr `packages/ui/src/toast.tsx` + `toaster.tsx` + `hooks/use-toast.ts`

## What You Get

A complete toast notification system built on Radix UI:
- **8 composable components** — ToastProvider, ToastViewport, Toast, ToastAction, ToastClose, ToastTitle, ToastDescription + types
- **State management hook** — `useToast()` with global memoryState + listener pattern, `toast()` imperative function
- **Toaster orchestration** — maps toast state into rendered Toast components
- Variant support via CVA (class-variance-authority): default + destructive styles
- Auto-dismiss, swipe-to-close, keyboard accessible

## Files Copied

| Source File | Purpose |
|---|---|
| `source/toast.tsx` | 8 Radix UI toast components with CVA variants |
| `source/toaster.tsx` | Toaster orchestration component |
| `source/use-toast.ts` | Toast state hook + imperative toast() function |

## Implementation Steps

### Step 1: Check if SalesBlock Already Has Toasts

SalesBlock may already have a toast/notification system. Check:
- `frontend/src/components/ui/` for toast-related files
- `package.json` for `sonner`, `react-hot-toast`, or `@radix-ui/react-toast`

**If SalesBlock already has toasts:** Skip this feature or cherry-pick specific improvements (e.g., the imperative `toast()` function pattern).

**If no existing toast system:** Proceed with full port.

### Step 2: Install Dependencies

```bash
npm install @radix-ui/react-toast class-variance-authority
```

`clsx` and `tailwind-merge` should already be installed (from cn() utility).

### Step 3: Rework Files

**toast.tsx:**
1. Remove `"use client"` directive (Vite doesn't need it)
2. Update import: `import { cn } from "./utils"` → `import { cn } from "@/lib/utils"` (or wherever SalesBlock keeps cn())
3. The component is otherwise framework-agnostic — works as-is

**use-toast.ts:**
1. Remove `"use client"` directive
2. Review constants:
   - `TOAST_LIMIT = 1` — only one toast visible at a time. Consider increasing to 3 for SalesBlock (sales actions often trigger rapid feedback)
   - `TOAST_REMOVE_DELAY = 1000000` — effectively infinite (toast stays until dismissed). Consider reducing to 5000ms for auto-dismiss

**toaster.tsx:**
1. Remove `"use client"` directive
2. Update import paths

### Step 4: Place in SalesBlock Structure

```
frontend/src/components/ui/
├── toast.tsx           (Radix components)
└── toaster.tsx         (orchestration)

frontend/src/hooks/
└── use-toast.ts        (state hook)
```

### Step 5: Mount Toaster

Add `<Toaster />` to SalesBlock's root layout:

```typescript
// App.tsx or layout.tsx
import { Toaster } from "@/components/ui/toaster"

function App() {
  return (
    <>
      {/* ... routes ... */}
      <Toaster />
    </>
  )
}
```

### Step 6: Use in Components

```typescript
import { toast } from "@/hooks/use-toast"

// Success toast
toast({
  title: "Contact saved",
  description: "John Doe has been added to your contacts.",
})

// Destructive toast
toast({
  title: "Failed to send email",
  description: "Check your email integration settings.",
  variant: "destructive",
})

// Toast with action
toast({
  title: "Contact deleted",
  description: "John Doe removed from contacts.",
  action: <ToastAction altText="Undo" onClick={undoDelete}>Undo</ToastAction>,
})
```

## Dependencies to Install

```bash
npm install @radix-ui/react-toast class-variance-authority
```

## Hazards (from @crumb metadata)

- `"use client"` directives — remove for Vite (SalesBlock doesn't use Next.js Server Components)
- `toast.tsx` imports from `./utils` — update path to match SalesBlock's cn() location
- `ToastProvider` must wrap the entire toasts.map output or React context breaks
- `TOAST_REMOVE_DELAY = 1000000` (277 hours) — effectively never auto-removes. Intentional in JobTrackr, but SalesBlock likely wants 5-second auto-dismiss
- Circular dependency risk: if `./toast` imports from `Toaster`, context breaks

## Estimated Effort
**Low** — 1-2 hours. Near-direct copy with path updates and constant tuning.
