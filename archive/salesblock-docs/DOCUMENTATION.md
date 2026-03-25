# Documentation Guide

This guide documents the SalesBlock.io frontend architecture, patterns, and complex logic.

## Table of Contents

1. [Project Structure](#project-structure)
2. [Data Flow & State Management](#data-flow--state-management)
3. [Complex Components](#complex-components)
4. [API Integration](#api-integration)
5. [Common Patterns](#common-patterns)
6. [Styling Approach](#styling-approach)

---

## Project Structure

```
frontend/src/
├── components/          # Reusable UI components (modals, cards, sections)
├── pages/              # Page-level containers (routes)
├── hooks/              # Custom React hooks (data fetching, state)
├── lib/
│   ├── queries/        # Pure data fetching functions
│   ├── calendar.ts     # Google/Outlook calendar API integration
│   ├── constants.ts    # Magic numbers, enums, labels
│   ├── errors.ts       # Centralized error handling
│   ├── formatters.ts   # String/date/time formatting utilities
│   ├── goals.ts        # Goal calculation logic
│   ├── routes.ts       # Route path constants
│   ├── salesblock.ts   # SalesBlock validation/status logic
│   ├── salesforce.ts   # Salesforce API integration
│   ├── supabase.ts     # Supabase client
│   └── time.ts         # Time/date utilities
├── types/              # TypeScript type definitions
├── styles/             # Global styles
└── App.tsx             # Main app entry point
```

### Design Principle
- **Feature-based organization**: Related types, queries, and components grouped by entity
- **Separation of concerns**: Data layer (queries), logic layer (hooks), UI layer (components)
- **Single responsibility**: Each file has one clear purpose

---

## Data Flow & State Management

### Data Fetching Flow

```
Component (pages/Home.tsx)
    ↓
    imports useDashboardData hook
    ↓
Hook (hooks/useDashboardData.ts)
    ↓
    uses multiple useQuery hooks (useUserProfile, useTodaysSalesBlocks, etc.)
    ↓
React Query (caching, deduplication, background refetch)
    ↓
Query Functions (lib/queries/)
    ↓
    error handling with logApiError()
    ↓
Supabase Client (lib/supabase.ts)
    ↓
Supabase Backend
```

### Key Points

1. **Hooks are the data layer**: All data fetching goes through custom hooks (hooks/use*.ts)
2. **React Query handles caching**: Automatic deduplication, stale-while-revalidate, background refetch
3. **Error handling is centralized**: All API errors use `logApiError()` from lib/errors.ts
4. **Types flow from types/**: All domain types imported from centralized types/ directory
5. **Constants are centralized**: Magic strings/numbers in lib/constants.ts

### Example: Fetching User Data

```typescript
// Component usage (pages/Home.tsx)
const { userDisplayName, salesblocks, activities } = useDashboardData()

// Hook (hooks/useDashboardData.ts)
export function useDashboardData() {
  const { user } = useAuth()
  const { data: userProfile } = useUserProfile(user?.id)
  const { data: salesblocks } = useTodaysSalesBlocks(user?.id)
  const { data: activities } = useRecentActivities(user?.id)

  return {
    userDisplayName: userProfile?.display_name || '',
    salesblocks: salesblocks || [],
    activities: activities || [],
  }
}

// React Query hook (hooks/useUserQuery.ts)
export function useUserProfile(userId?: string) {
  return useQuery({
    queryKey: ['user-profile', userId],
    queryFn: () => fetchUserProfile(userId!),
    enabled: !!userId,
  })
}

// Query function (lib/queries/userQueries.ts)
export async function fetchUserProfile(userId: string) {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('display_name, email, org_id')
      .eq('id', userId)
      .maybeSingle()

    if (error) {
      logApiError('fetchUserProfile', error, { userId })
      return null
    }

    return data
  } catch (error) {
    logApiError('fetchUserProfile', error, { userId })
    return null
  }
}
```

---

## Complex Components

### SettingsPage.tsx (1695 lines)

**Purpose**: Comprehensive settings management with multiple tabs

**Tabs/Features**:
1. **Profile Tab**: User display name, email, preferences
2. **Organization Tab**: Org hierarchy, divisions, teams, user assignment
3. **Billing Tab**: Subscription status, payment methods, billing info
4. **Integrations Tab**: OAuth connections (Gmail, Google Calendar, Outlook, Salesforce)

**Complex Logic**:
- **Hierarchy Management**: Create/rename/delete divisions and teams
- **User Assignment**: Reassign users between teams
- **OAuth Flow**: Handle multiple integration OAuth connections
- **Billing Integration**: Stripe customer portal, subscription management

**Data Structure**:
```typescript
interface HierarchyState {
  divisions: Division[]
  teams: Team[]
  teamMembers: TeamMember[]
}
```

### Analytics.tsx (886 lines)

**Purpose**: Comprehensive analytics dashboard with multiple views

**Views**:
1. **Dashboard**: Key metrics (calls, emails, meetings, reply rate)
2. **Activity Timeline**: Hour-by-hour activity breakdown
3. **Team Performance** (Manager only): Team member metrics comparison
4. **Custom KPIs**: User-defined custom metrics

**Complex Logic**:
- **Date Range Filtering**: Today, last 7/30/90 days, custom ranges
- **Metrics Calculation**: Aggregate call/email/social/meeting activities
- **Pipeline Analysis**: Deal value, conversion rates
- **Performance Comparison**: Team member metrics side-by-side

---

## API Integration

### Supabase Integration

**Location**: lib/supabase.ts

```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

**Usage Pattern**:
```typescript
const { data, error } = await supabase
  .from('table_name')
  .select('column1, column2')
  .eq('filter_column', value)
  .single()  // or omit for array results

if (error) {
  logApiError('operationName', error, { context })
  return null
}

return data
```

### Google Calendar / Outlook Integration

**Location**: lib/calendar.ts

**Key Functions**:
- `getCalendarConnection()`: Fetch user's connected calendar (Google or Outlook)
- `createCalendarEvent()`: Create event on user's calendar
- `updateCalendarEvent()`: Update existing event
- `deleteCalendarEvent()`: Delete event
- `getFreeBusySlots()`: Get user's free time slots

**OAuth Flow**:
1. User clicks OAuth button
2. Redirected to provider's auth page
3. Provider redirects back with auth code
4. Save oauth_connection record with access_token
5. Use access_token for subsequent API calls

### Salesforce Integration

**Location**: lib/salesforce.ts

**Key Functions**:
- `getSalesforceConnection()`: Get user's Salesforce connection
- `querySalesforceRecords()`: Query SOQL
- `mapSalesforceToContact()`: Convert Salesforce data to SalesBlock contact format
- `markActivityForSync()`: Mark activity for Salesforce sync webhook

**Auto-sync Feature**:
- When activity is logged, `markActivityForSync()` sets a flag
- Webhook listener picks up the flag and syncs to Salesforce
- Prevents duplicate syncs on every save

---

## Common Patterns

### Error Handling Pattern

**Consistent approach across all data fetching**:

```typescript
export async function fetchData(id: string) {
  try {
    const { data, error } = await supabase
      .from('table')
      .select('*')
      .eq('id', id)
      .single()

    // Supabase error
    if (error) {
      logApiError('fetchData', error, { id })
      return null
    }

    return data
  } catch (error) {
    // Network or other error
    logApiError('fetchData', error, { id })
    return null
  }
}
```

**Error Logging Structure**:
```typescript
logApiError(operation, error, context)
// Outputs:
// [ERROR_TYPE] operation: {
//   message, userMessage, context, retryable, timestamp
// }
```

### React Query Hook Pattern

**Consistent hook structure**:

```typescript
export function useMyData(id?: string) {
  return useQuery({
    queryKey: ['my-data', id],           // Unique cache key
    queryFn: () => fetchMyData(id!),     // Fetch function
    enabled: !!id,                        // Only fetch if id exists
    staleTime: 2 * 60 * 1000,            // 2 minutes
    gcTime: 10 * 60 * 1000,              // Garbage collect after 10 min
  })
}
```

**Hook Usage**:
```typescript
const { data, error, isLoading, refetch } = useMyData(id)

// data is automatically typed
// error is Error or null
// isLoading is boolean
// refetch() forces fresh data fetch
```

### Form State Pattern

**Modal/form state management**:

```typescript
// State for form fields
const [title, setTitle] = useState('')
const [description, setDescription] = useState('')
const [isSubmitting, setIsSubmitting] = useState(false)
const [error, setError] = useState<string | null>(null)

// Reset function
const resetAndClose = () => {
  setTitle('')
  setDescription('')
  setError(null)
  onClose()
}

// Submit handler
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault()

  try {
    setIsSubmitting(true)
    // Perform operation
    const result = await createRecord(title, description)

    // Success
    resetAndClose()
    onSuccess?.()
  } catch (err) {
    // Error handling
    setError(err instanceof Error ? err.message : 'Unknown error')
  } finally {
    setIsSubmitting(false)
  }
}
```

---

## Styling Approach

### Technology: Tailwind CSS

**Location**: src/index.css

**Three Layers**:
```css
@tailwind base;        /* Reset/normalize styles */
@tailwind components;  /* Component classes (.btn, .card) */
@tailwind utilities;   /* Utility classes (.m-4, .text-center) */
```

### Tailwind Pattern

**Inline utility classes** in components:

```typescript
// ✅ Recommended
<div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
  <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
    Title
  </h2>
</div>

// ❌ Avoid
<div className="my-custom-card">  // Not using Tailwind
  ...
</div>
```

### Dark Mode Support

**Pattern**:
```typescript
className="
  bg-white dark:bg-gray-800        // Dark mode background
  text-gray-900 dark:text-white    // Dark mode text
  border-gray-200 dark:border-gray-700
"
```

**How it works**:
- `dark:` prefix applies classes when `prefers-color-scheme: dark`
- Theme context (hooks/useTheme.ts) manages system/light/dark preference
- Tailwind automatically applies dark: classes based on user preference

### Responsive Design

**Mobile-first approach**:

```typescript
className="
  text-sm md:text-base lg:text-lg  // Responsive text size
  grid-cols-1 md:grid-cols-2 lg:grid-cols-3  // Responsive columns
  p-4 md:p-6 lg:p-8  // Responsive padding
"
```

---

## Best Practices

### 1. Data Fetching
- Always use React Query hooks, not direct Supabase queries in components
- Add context to error logging for debugging
- Use `enabled` flag to conditionally fetch data

### 2. Component Documentation
- Add JSDoc comments to complex components
- Document props interfaces
- Explain complex logic with inline comments

### 3. Type Safety
- Import all types from types/ directory
- Use proper TypeScript types (not `any`)
- Export types from query modules for reusability

### 4. Error Handling
- Use centralized `logApiError()` for API errors
- Provide user-friendly error messages
- Include context (ids, params) for debugging

### 5. Performance
- Use React Query for automatic caching
- Implement lazy loading for large lists
- Memoize expensive computations with useMemo

### 6. Code Organization
- Keep components small and focused
- Extract complex logic to utility functions
- Group related types, queries, hooks by feature

---

## Debugging Tips

### 1. React Query DevTools
```typescript
// In App.tsx
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'

<QueryClientProvider client={queryClient}>
  <App />
  <ReactQueryDevtools initialIsOpen={false} />
</QueryClientProvider>
```

### 2. Check Browser Console
- Errors logged with structured format: `[ERROR_TYPE] operation: {...}`
- Easy to search and filter
- Includes context for debugging

### 3. Verify OAuth Connections
- Check `oauth_connections` table in Supabase
- Verify `access_token` is present
- Check `provider` field matches expected provider

### 4. Query Cache Debugging
- React Query DevTools shows all cached queries
- Check query keys, status, data
- Manually refetch/invalidate from DevTools

---

## Contributing Guidelines

When adding new features:

1. **Create query functions** in lib/queries/ with error handling
2. **Create hooks** in hooks/ with React Query
3. **Create components** for UI logic
4. **Add types** to types/ directory
5. **Document complex logic** with comments
6. **Use constants** from lib/constants.ts
7. **Follow naming conventions** from NAMING_CONVENTIONS.md

