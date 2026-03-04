# SalesBlock.io Code Quality Review

**Date**: 2026-02-27
**Scope**: Frontend codebase review against Clean Code, SOLID, DRY, KISS, YAGNI, meaningful naming, and file organization principles.

---

## Executive Summary

The codebase has **solid foundational structure** but exhibits several recurring issues that violate the standing orders:

- **DRY violations**: Repeated utility functions and data fetching patterns across multiple pages
- **Large components**: Some page components exceed 600+ lines (violates KISS and separation of concerns)
- **Mixed concerns**: Data fetching, UI logic, and formatting utilities mixed in the same component
- **Inconsistent abstraction**: Data fetching sometimes in hooks, sometimes in components
- **File organization**: Could benefit from stronger feature-based grouping
- **Type management**: Some implicit types that should be explicit/centralized

---

## Critical Issues (Must Fix)

### 1. **Large Component Files Violate KISS + Single Responsibility**

**File**: `frontend/src/pages/Home.tsx` (696 lines)

**Issues**:
- Loads dashboard data, formats dates, calculates goal progress, manages modals, and renders entire dashboard
- Multiple concerns mixed: data fetching, formatting, state management, UI rendering
- Multiple utility functions embedded (`formatTimeAgo`, `formatDate`, `getActivityIcon`, etc.)
- Makes it hard to test individual concerns

**Required Refactor**:
```
frontend/src/pages/Home.tsx → Extract into:
├── Home.tsx (100 lines: route container only)
├── components/
│   ├── dashboard-greeting.tsx (greeting section)
│   ├── todays-salesblocks-section.tsx (today's blocks)
│   ├── activity-feed-section.tsx (recent activities)
│   ├── goal-progress-section.tsx (goals)
│   └── upcoming-salesblocks-section.tsx (next week)
├── hooks/
│   ├── useDashboardData.ts (fetch all data)
│   ├── useGoalProgress.ts (goal calculation logic)
│   └── useRecentActivities.ts (activity loading)
└── lib/
    └── formatters.ts (all time/date formatters)
```

---

### 2. **DRY Violation: Repeated Data Fetching Patterns**

**Location**: Multiple pages and components

**Examples**:
- `Home.tsx` (lines 74-149): Loading user data, org data
- `AppLayout.tsx` (lines 61-90): Loading user data, org logo
- `SalesBlocks.tsx`: Likely repeats similar data loading

**Issue**: Duplicated query logic for users, organizations, preferences

**Solution**:
```typescript
// Create: lib/queries/userQueries.ts
export async function fetchUserProfile(userId: string) {
  const { data } = await supabase
    .from('users')
    .select('display_name, preferences, org_id')
    .eq('id', userId)
    .single()
  return data
}

export async function fetchOrgLogo(orgId: string) {
  const { data } = await supabase
    .from('organizations')
    .select('logo_url')
    .eq('id', orgId)
    .single()
  return data
}

// Create: hooks/useUserProfile.ts
export function useUserProfile(userId: string | undefined) {
  return useQuery(['user-profile', userId], () => userId ? fetchUserProfile(userId) : null)
}

export function useOrgLogo(orgId: string | undefined) {
  return useQuery(['org-logo', orgId], () => orgId ? fetchOrgLogo(orgId) : null)
}
```

Then use in components:
```typescript
// AppLayout.tsx
const { data: userProfile } = useUserProfile(user?.id)
const { data: org } = useOrgLogo(userProfile?.org_id)
```

---

### 3. **Utility Functions Scattered Across Pages (DRY Violation)**

**Locations**: `Home.tsx` has 10+ formatting/utility functions embedded

**Functions**: `formatDate`, `formatTimeAgo`, `formatDateTime`, `getActivityIcon`, `getOutcomeBadgeClass`, `formatOutcome`, `truncateNotes`, `canStartBlock`, `getGreeting`, `getGoalLabel`

**Issue**: These functions will be copied to other pages (SalesBlocks.tsx, Analytics.tsx, etc.)

**Solution - Create `lib/formatters.ts`**:
```typescript
// lib/formatters.ts
export const formatTimeAgo = (dateString: string): string => { ... }
export const formatDate = (): string => { ... }
export const formatDateTime = (dateString: string): string => { ... }
export const getActivityIcon = (type: string) => React.ReactNode { ... }
export const getOutcomeBadgeClass = (outcome: string): string => { ... }
export const formatOutcome = (outcome: string): string => { ... }
export const truncateNotes = (notes: string | null, maxLength?: number): string => { ... }

// lib/salesblock.ts
export const canStartBlock = (sb: SalesBlock): boolean => { ... }

// lib/goals.ts
export const getGoalLabel = (goal: Goal): string => { ... }

// lib/time.ts
export const getGreeting = (): string => { ... }
```

---

### 4. **Inconsistent Abstraction of Data Fetching**

**Issue**: Some data fetching is in hooks, some in components, no consistent pattern

**Examples**:
- `CreateSalesBlockModal.tsx`: Fetches lists, scripts, team members directly in component (lines 68-89)
- `useAuth` hook: Handles auth state (good pattern)
- `AppLayout.tsx`: Fetches user data in useEffect (mixed with component logic)

**Solution**: Create data fetching hooks for each resource:
```typescript
// hooks/useListsQuery.ts
export function useListsQuery(userId: string | undefined) {
  return useQuery(['lists', userId], () => userId ? fetchUserLists(userId) : null)
}

// hooks/useCallScriptsQuery.ts
export function useCallScriptsQuery(userId: string | undefined) {
  return useQuery(['scripts', userId], () => userId ? fetchScripts(userId) : null)
}

// Then in CreateSalesBlockModal.tsx
const { data: lists } = useListsQuery(user?.id)
const { data: scripts } = useCallScriptsQuery(user?.id)
```

---

### 5. **Type Definitions Not Centralized (KISS Violation)**

**Locations**: Types defined inline in components

**Examples**:
- `Home.tsx` (lines 18-48): `SalesBlock`, `Activity`, `Goal`, `GoalProgress` interfaces
- `CreateSalesBlockModal.tsx` (lines 14-28): `List`, `TeamMember`, `CallScript` interfaces
- Multiple pages repeat these definitions

**Issue**: Type duplication, hard to maintain, violates DRY

**Solution - Create `types/index.ts`**:
```typescript
// types/index.ts
export interface SalesBlock {
  id: string
  title: string
  scheduled_start: string
  scheduled_end: string
  duration_minutes: number
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
  list_id: string
  list?: { name: string }
  contact_count?: number
}

export interface Activity {
  id: string
  type: 'call' | 'email' | 'social' | 'meeting' | 'note'
  outcome: string
  notes: string | null
  created_at: string
  contact?: {
    first_name: string
    last_name: string
  }
}

export interface Goal {
  id: string
  metric: string
  target_value: number
  period: 'daily' | 'weekly' | 'monthly'
  custom_metric_name: string | null
}

export interface List {
  id: string
  name: string
}

export interface TeamMember {
  id: string
  display_name: string
  email: string
}

export interface Contact { ... }
export interface Organization { ... }
// ... all other types
```

Then import and use consistently:
```typescript
import { SalesBlock, Activity, Goal } from '../types'
```

---

### 6. **File Organization: Missing `types/` Directory**

**Current Structure**:
```
frontend/src/
├── components/
├── pages/
├── hooks/
├── lib/
└── main.tsx
```

**Problem**: No centralized type definitions; implicit types scattered

**Required**: Add types directory with centralized definitions
```
frontend/src/
├── components/
├── pages/
├── hooks/
├── lib/
├── types/              ← NEW
│   ├── index.ts        (all types exported)
│   ├── domain.ts       (Contact, Deal, SalesBlock, etc.)
│   └── api.ts          (API response shapes)
├── main.tsx
└── App.tsx
```

---

## Medium Priority Issues (Should Fix)

### 7. **Component Props Not Strictly Typed**

**File**: `AppLayout.tsx` (line 48-50)

```typescript
interface AppLayoutProps {
  children: ReactNode
}
```

**Better**:
```typescript
interface AppLayoutProps {
  children: React.ReactNode
  // Explicitly typed children with use case
}
```

---

### 8. **Magic Strings and Numbers (KISS Violation)**

**Locations**: Multiple files use hardcoded values

**Examples in `Home.tsx`**:
- Line 266: Default target `50` for calls
- Line 272: Default target `3` for meetings
- Line 505: `contact_count` format strings
- Line 523: Time format hardcoded in multiple places

**Solution - Create constants**:
```typescript
// lib/constants.ts
export const SALES_BLOCK_DEFAULTS = {
  DEFAULT_CALL_TARGET: 50,
  DEFAULT_MEETING_TARGET: 3,
  ACTIVITY_FEED_LIMIT: 10,
  UPCOMING_DAYS: 7,
}

export const DATE_FORMATS = {
  TIME_12H: { hour: 'numeric', minute: '2-digit', hour12: true },
  DATE_FULL: { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' },
  DATE_SHORT: { month: 'short', day: 'numeric' },
  // ... more formats
}
```

---

### 9. **Unused Parameters and Code (YAGNI)**

**File**: `AppLayout.tsx` (line 56)

```typescript
const [displayName, setDisplayName] = useState<string>('')
```

Then on line 187-188:
```typescript
{displayName.charAt(0).toUpperCase()}
```

Only used once and loaded from the same fetch. Could be simplified or unified with userProfile.

---

### 10. **Missing Error Handling Abstraction**

**Issue**: Error handling inconsistent across data fetching

**Examples**:
- `Home.tsx` (line 75): Basic try-catch with console.error only
- `CreateSalesBlockModal.tsx` (line 76): console.error without user feedback
- No error states in UI

**Solution - Create error handling utility**:
```typescript
// lib/errors.ts
export function handleError(error: Error, context: string, callback?: () => void) {
  console.error(`Error in ${context}:`, error)
  // Could toast, log to service, etc.
  callback?.()
}

// lib/queryErrors.ts
export function useErrorHandler() {
  return (error: Error, context: string) => {
    handleError(error, context)
  }
}
```

---

### 11. **Component Composition Not Optimized**

**File**: `Home.tsx` (lines 494-545)

```typescript
{todaysSalesblocks.map((sb) => (
  <div key={sb.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
    {/* 30 lines of JSX */}
  </div>
))}
```

**Issue**: Card component not extracted, repeated in multiple sections

**Solution**:
```typescript
// components/salesblock-card.tsx
interface SalesBlockCardProps {
  salesBlock: SalesBlock
  showContactCount?: boolean
  onStart?: (id: string) => void
}

export function SalesBlockCard({ salesBlock, showContactCount, onStart }: SalesBlockCardProps) {
  // 30 lines extracted here
}

// Then in Home.tsx
<div className="space-y-3">
  {todaysSalesblocks.map((sb) => (
    <SalesBlockCard key={sb.id} salesBlock={sb} onStart={handleStartBlock} />
  ))}
</div>
```

---

### 12. **Hardcoded Navigation Routes**

**Locations**: Multiple components have hardcoded routes

**Examples**:
- `Home.tsx` (line 444): `/salesblocks/${salesblockId}/session`
- `AppLayout.tsx` (line 34-45): All routes hardcoded in `navItems` array

**Solution - Create routes constants**:
```typescript
// lib/routes.ts
export const ROUTES = {
  HOME: '/',
  SALESBLOCKS: '/salesblocks',
  SALESBLOCK_SESSION: (id: string) => `/salesblocks/${id}/session`,
  LISTS: '/lists',
  LIST_DETAIL: (id: string) => `/lists/${id}`,
  CONTACTS: '/contacts',
  CONTACT_DETAIL: (id: string) => `/contacts/${id}`,
  EMAIL: '/email',
  SOCIAL: '/social',
  PIPELINE: '/pipeline',
  GOALS: '/goals',
  ANALYTICS: '/analytics',
  TEAM: '/team',
  SETTINGS: '/settings',
  SCRIPTS: '/scripts',
  TEMPLATES: '/templates',
  SIGNIN: '/signin',
  SIGNUP: '/signup',
  FORGOT_PASSWORD: '/forgot-password',
  PRICING: '/pricing',
} as const
```

Then use throughout:
```typescript
navigate(ROUTES.SALESBLOCK_SESSION(salesblockId))
```

---

## Lower Priority Issues (Nice to Have)

### 13. **Improve TypeScript Strictness**

**Issue**: Some implicit `any` types or loose typing

**Solution**:
- Add `noImplicitAny: true` to `tsconfig.json` if not already set
- Use explicit return types on functions
- Avoid `any` (use `unknown` if needed)

---

### 14. **Extract Reusable Form Patterns**

**Issue**: Form handling repeated across modals

**Solution**: Create form builder utilities or higher-order components for consistent validation and state management

---

### 15. **Modal Component Abstraction**

**Issue**: Many modals follow similar pattern (backdrop, close button, form)

**Solution**: Create base `Modal` component wrapper to reduce repetition

---

## File Organization Summary

### Current Issues
- ❌ No `types/` directory
- ❌ No `lib/queries/` for data fetching
- ❌ No `lib/formatters.ts` for utilities
- ❌ No `lib/routes.ts` or `lib/constants.ts`
- ❌ Components too large (mixing concerns)

### Recommended Structure
```
frontend/src/
├── components/
│   ├── common/           (shared UI: buttons, modals, cards)
│   ├── salesblocks/      (feature: SalesBlock components)
│   ├── contacts/         (feature: Contact components)
│   ├── analytics/        (feature: Analytics components)
│   └── app-layout.tsx
├── pages/
│   ├── home.tsx
│   ├── salesblocks.tsx
│   ├── lists.tsx
│   └── ... (route pages)
├── hooks/
│   ├── useAuth.ts
│   ├── useTheme.ts
│   ├── useDashboardData.ts
│   ├── useListsQuery.ts
│   └── ... (data/state hooks)
├── lib/
│   ├── supabase.ts       (client instance)
│   ├── queries/
│   │   ├── userQueries.ts
│   │   ├── listQueries.ts
│   │   ├── activityQueries.ts
│   │   └── ...
│   ├── formatters.ts     (all time/date/string formatters)
│   ├── constants.ts      (magic strings/numbers)
│   ├── routes.ts         (route paths)
│   ├── calendar.ts
│   ├── salesforce.ts
│   └── ...
├── types/
│   ├── index.ts          (export all types)
│   ├── domain.ts         (Contact, Deal, SalesBlock, etc.)
│   ├── api.ts            (API shapes)
│   └── enums.ts          (ActivityType, UserRole, etc.)
├── styles/
│   └── globals.css
├── App.tsx
└── main.tsx
```

---

## Implementation Priority

### Phase 1 (Critical - Do First)
1. Create `types/` directory with centralized type definitions
2. Create `lib/queries/` directory with extracted data fetching
3. Create `lib/formatters.ts` with utility functions
4. Create `lib/routes.ts` with route constants
5. Create `lib/constants.ts` with magic values
6. Extract hooks: `useDashboardData`, `useListsQuery`, etc.

### Phase 2 (Medium - Do Second)
1. Break down large components (Home.tsx → smaller pieces)
2. Create reusable card components (SalesBlockCard, ActivityCard, etc.)
3. Standardize error handling across data fetching
4. Add explicit return types to all functions

### Phase 3 (Nice to Have)
1. Extract form patterns into utilities
2. Add modal wrapper component
3. Improve TypeScript strictness
4. Add comprehensive comments to complex logic

---

## Quick Wins (Easy to Implement)

- [ ] Move all types to `types/index.ts`
- [ ] Create `lib/constants.ts` with magic numbers
- [ ] Create `lib/routes.ts` with route paths
- [ ] Create `lib/formatters.ts` with utility functions
- [ ] Extract `useDashboardData` hook from Home.tsx
- [ ] Extract `useListsQuery` hook
- [ ] Add `types/` to tsconfig path mapping for clean imports

---

## Code Examples for Reference

### Before (Mixed Concerns)
```typescript
// pages/Home.tsx - 696 lines, does everything
export default function Home() {
  const [userDisplayName, setUserDisplayName] = useState('')
  // ... 20 more state variables

  const loadDashboardData = async () => {
    // Fetches user, salesblocks, activities, goals
    // Formats dates, calculates progress
    // Sets 10 different state variables
  }

  const formatTimeAgo = (dateString: string) => { /* 15 lines */ }
  const formatDate = () => { /* 10 lines */ }
  const formatDateTime = (dateString: string) => { /* 10 lines */ }
  // ... 10 more utility functions

  return (
    <div>
      {/* 500+ lines of JSX */}
    </div>
  )
}
```

### After (Separated Concerns)
```typescript
// pages/Home.tsx - 50 lines, orchestrates only
import { useDashboardData } from '../hooks/useDashboardData'
import { DashboardGreeting } from '../components/dashboard-greeting'
import { TodaysSalesBlocks } from '../components/todays-salesblocks'
import { ActivityFeed } from '../components/activity-feed'
import { GoalProgress } from '../components/goal-progress'

export default function Home() {
  const { userDisplayName, salesblocks, activities, goals, loading } = useDashboardData()

  if (loading) return <LoadingState />

  return (
    <div className="p-8">
      <DashboardGreeting name={userDisplayName} />
      <div className="grid grid-cols-3 gap-6">
        <TodaysSalesBlocks blocks={salesblocks} />
        <ActivityFeed activities={activities} />
        <GoalProgress goals={goals} />
      </div>
    </div>
  )
}

// hooks/useDashboardData.ts - 100 lines, only data logic
export function useDashboardData() {
  const { user } = useAuth()
  const { data: userProfile } = useUserProfile(user?.id)
  const { data: todaysSalesBlocks } = useTodaysSalesBlocks(user?.id)
  const { data: recentActivities } = useRecentActivities(user?.id)
  const { data: goals, progress } = useGoalProgress(user?.id)

  return {
    userDisplayName: userProfile?.display_name || '',
    salesblocks: todaysSalesBlocks || [],
    activities: recentActivities || [],
    goals: progress || [],
    loading: // computed from individual queries
  }
}

// lib/formatters.ts - 80 lines, utility functions only
export const formatTimeAgo = (dateString: string): string => { /* ... */ }
export const formatDate = (): string => { /* ... */ }
export const getActivityIcon = (type: string) => React.ReactNode { /* ... */ }
// ... all utilities
```

---

## Conclusion

The codebase has solid fundamentals but needs refactoring to align with the standing code quality principles. The main issues are:

1. **Large, mixed-concern components** (violates KISS + SOLID)
2. **Repeated utility functions** (DRY violation)
3. **Scattered type definitions** (organization issue)
4. **No centralized constants/routes** (maintainability issue)
5. **Inconsistent data fetching patterns** (abstraction issue)

**Recommended approach**: Implement Phase 1 quick wins first, then gradually refactor large components. This provides immediate improvements while maintaining developer velocity.
