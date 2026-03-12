# 01 — Admin Panel + RBAC

## Source
**From:** JobTrackr `packages/admin/` + `supabase/migrations/018_*`, `019_*` + `src/lib/auth/require-admin.ts`

## What You Get

A complete admin portal system with:
- **4 staff roles** (admin, moderator, analyst, support) with 8 granular permission flags
- **8 UI components** — AdminLayout, AdminNav, DataTable, ToggleCard, PermissionGate, ConfirmDialog, StatCard, StaffBadge
- **2 SQL migrations** — `staff_roles` + `staff_members` tables, `platform_settings` + `ai_config` singleton config tables, all with RLS
- **Auth guard** — dual-layer verification (JWT claim + DB check)
- **Zero external dependencies** beyond Tailwind and Material Symbols icons

## Files Copied

| Source File | Purpose |
|---|---|
| `source/types.ts` | StaffRole, StaffPermissions (8 flags), NavItem, AdminUser, TableColumn<T> |
| `source/utils.ts` | cn() utility (clsx + tailwind-merge) |
| `source/index.ts` | Barrel export |
| `source/AdminLayout.tsx` | Two-column layout (sidebar + content) |
| `source/AdminNav.tsx` | Permission-filtered navigation menu |
| `source/DataTable.tsx` | Generic table with search, sort, loading states |
| `source/ToggleCard.tsx` | Boolean toggle switch for settings |
| `source/PermissionGate.tsx` | Conditional render wrapper based on permissions |
| `source/ConfirmDialog.tsx` | Modal confirmation for destructive actions |
| `source/StatCard.tsx` | Metric card with delta indicator |
| `source/StaffBadge.tsx` | Color-coded role badge |
| `source/require-admin.ts` | Server-side admin auth guard |
| `migrations/018_staff_roles.sql` | staff_roles + staff_members tables |
| `migrations/019_admin_config_tables.sql` | platform_settings + ai_config tables |

## Implementation Steps

### Step 1: Rework Types (`types.ts`)

Rename roles to match SalesBlock's domain:

```
JobTrackr roles:  admin | moderator | analyst | support
SalesBlock roles: admin | manager | rep | viewer
```

Rework permission flags from JobTrackr's user-management focus to SalesBlock's sales focus:

```
JobTrackr flags:                  SalesBlock equivalents:
canViewUsers    → canViewTeam     (view team members)
canEditUsers    → canEditTeam     (edit team member settings)
canDeleteUsers  → canDeleteTeam   (remove team members)
canViewIntel    → canViewAnalytics (view sales analytics)
canEditSettings → canEditSettings (platform settings)
canViewAIConfig → canViewBilling  (view Stripe billing)
canEditAIConfig → canEditBilling  (modify billing)
canManageStaff  → canManageRoles  (assign roles)
```

### Step 2: Rework Migrations

**018_staff_roles.sql:**
- Change role CHECK constraint: `('admin', 'manager', 'rep', 'viewer')`
- Update permission JSON seeds to match new flag names
- SalesBlock uses org-scoped RLS — add `org_id` column to `staff_members` and update policies to filter by `auth.jwt() -> 'app_metadata' ->> 'org_id'`
- Rename table if desired: `staff_members` → `team_members`

**019_admin_config_tables.sql:**
- Rename `platform_settings` fields to SalesBlock context:
  - Remove: enableMentors, enableMatches, enableInterviewIntel, enableBenchmarks, enablePublicProfiles, maxJobsPerEmployer, maxAppsPerCandidate
  - Add: enableSequences, enableDialer, enableCalendarSync, enableLinkedInSync, maxContactsPerOrg, maxSequencesPerUser
- Rename `ai_config` fields:
  - Remove: enableJobMatchAI, enableInterviewAnalysis, enableResumeScoring
  - Add: enableEmailDrafting, enableContactScoring, enableDealPrediction

### Step 3: Rework Auth Guard (`require-admin.ts`)

- Replace `createServerSupabaseClient` import with SalesBlock's Supabase client pattern
- SalesBlock doesn't use Next.js server components — convert to a middleware or hook pattern:
  - **Option A:** Supabase Edge Function middleware that checks `app_metadata.role`
  - **Option B:** React hook `useRequireAdmin()` that redirects non-admins
- Add org_id scope to the DB verification query

### Step 4: Rework UI Components

All components use the same Tailwind + cn() pattern SalesBlock already uses. Key changes:

**AdminLayout.tsx:**
- Change brand from "JobTrackr" to SalesBlock's branding
- SalesBlock uses React Router (not Next.js `<a>` tags) — replace `<a href>` with `<Link to>` in AdminNav
- Add responsive sidebar collapse (flagged as missing in @crumb hazards)

**AdminNav.tsx:**
- Add `"use client"` directive is already present — SalesBlock uses Vite so remove it
- Replace `<a href>` with React Router `<Link to>`

**DataTable.tsx:**
- Remove `"use client"` directive
- Already generic (`<T extends object>`) — works as-is with SalesBlock data types

**PermissionGate.tsx:**
- Works as-is after types are updated — zero changes needed beyond the type import path

**All components:**
- Update import paths from `"./types"` / `"./utils"` to SalesBlock's structure (e.g., `@/lib/admin/types`)
- Replace `#10b77f` accent color with SalesBlock's brand color if different
- Remove `@crumb` comments or update them to SalesBlock breadcrumb format

### Step 5: Create Admin Routes

SalesBlock uses React Router. Create admin route structure:

```
src/pages/admin/
├── AdminDashboard.tsx    (uses StatCard grid + DataTable)
├── TeamManagement.tsx    (uses DataTable + StaffBadge + ConfirmDialog)
├── Settings.tsx          (uses ToggleCard grid)
├── BillingConfig.tsx     (uses ToggleCard + StatCard)
└── layout.tsx            (wraps children in AdminLayout + PermissionGate)
```

### Step 6: Wire Up Navigation

Define navItems array matching SalesBlock admin routes:

```typescript
const navItems: NavItem[] = [
  { label: "Dashboard", href: "/admin", icon: "dashboard" },
  { label: "Team", href: "/admin/team", icon: "group", requiredPermission: "canViewTeam" },
  { label: "Settings", href: "/admin/settings", icon: "settings", requiredPermission: "canEditSettings" },
  { label: "Billing", href: "/admin/billing", icon: "payments", requiredPermission: "canViewBilling" },
]
```

## Dependencies to Install

```bash
npm install clsx tailwind-merge
```

Material Symbols icons — add to `index.html`:
```html
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined" rel="stylesheet" />
```

## Hazards (from @crumb metadata)

- `AdminLayout`: Sidebar width fixed at 240px — no mobile responsive collapse
- `AdminNav`: Active detection uses `startsWith` — `/admin/settings` matches `/admin` (false positive). Fixed by exact match exception for root `/admin`
- `DataTable`: Sort uses `localeCompare` not numeric sort — "100" < "20" alphabetically
- `ConfirmDialog`: Backdrop click closes dialog — risky for destructive actions
- `PermissionGate`: Fallback defaults to `null` (hidden) — no "access denied" UI feedback
- `require-admin`: Extra DB query per admin request — acceptable for low-traffic admin pages

## Estimated Effort
**Medium** — 2-3 days. Migrations need org-scoping, auth guard needs conversion from Next.js server to Vite client pattern, all UI components need React Router integration.
