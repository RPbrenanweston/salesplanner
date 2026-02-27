# Data Fetching Pattern - Query Functions & Hooks

## Overview

This directory contains centralized data fetching functions that eliminate duplication across the application. Each data type (users, organizations, lists, scripts) has:

1. **Query Functions** (`*Queries.ts`): Pure async functions for data fetching
2. **React Query Hooks** (in `/hooks/use*Query.ts`): Hooks with caching and request deduplication

## Architecture

```
lib/queries/                    # Pure data fetching functions
  ├── userQueries.ts           # User profile, team info
  ├── organizationQueries.ts    # Org data, logo
  ├── listQueries.ts            # Contact lists
  ├── scriptQueries.ts          # Call scripts, email templates
  └── index.ts                  # Centralized exports

hooks/
  ├── useUserQuery.ts           # Cached user hooks
  ├── useOrganizationQuery.ts    # Cached org hooks
  ├── useListQuery.ts            # Cached list hooks
  ├── useScriptQuery.ts          # Cached script hooks
  └── index.ts                  # Centralized exports
```

## Usage Patterns

### Pattern 1: Use Hooks (Recommended)

Hooks provide automatic caching, deduplication, and background updates:

```typescript
// In a component
import { useUserProfile } from '@/hooks'

export function MyComponent() {
  const { data: user, isLoading, error } = useUserProfile(userId)

  if (isLoading) return <div>Loading...</div>
  if (error) return <div>Error: {error.message}</div>

  return <div>{user?.display_name}</div>
}
```

**Benefits:**
- Automatic caching (stale-while-revalidate)
- Request deduplication (multiple components requesting same data = 1 request)
- Background refetching
- Easy error/loading states
- Automatic query invalidation

### Pattern 2: Direct Query Functions

Use query functions directly for simple one-off operations:

```typescript
// In event handlers or non-React contexts
import { fetchUserProfile, updateUserPreferences } from '@/lib/queries'

async function handleUpdatePreference() {
  const success = await updateUserPreferences(userId, {
    sidebarCollapsed: true,
  })
}
```

**When to use:**
- Mutations/updates (creating, updating, deleting)
- One-off fetches in event handlers
- Non-React code

## Example: Refactoring AppLayout.tsx

### Before (Duplicated Fetching)

```typescript
// AppLayout.tsx - inline data fetching
useEffect(() => {
  async function loadUserData() {
    const { data: userData } = await supabase
      .from('users')
      .select('preferences, org_id, display_name')
      .eq('id', user.id)
      .single()

    const { data: orgData } = await supabase
      .from('organizations')
      .select('logo_url')
      .eq('id', userData.org_id)
      .single()

    setCollapsed(userData.preferences?.sidebarCollapsed)
    setDisplayName(userData.display_name)
    setOrgLogoUrl(orgData.logo_url)
  }
  loadUserData()
}, [user])
```

**Problems:**
- Duplicates logic found in other components
- No caching (re-fetches on every mount)
- Manual state management
- No error handling

### After (Using Hooks)

```typescript
// AppLayout.tsx - using hooks
const { data: userProfile } = useUserProfile(user?.id)
const { data: orgLogoUrl } = useOrganizationLogo(userProfile?.org_id)

// State is automatic from hooks, no useState needed
if (userProfile?.preferences?.sidebarCollapsed !== collapsed) {
  setCollapsed(userProfile.preferences.sidebarCollapsed ?? false)
}
```

**Benefits:**
- No duplicated logic
- Automatic caching (React Query)
- Cleaner component code
- Built-in error handling

## Stale Time Configuration

Each hook configures stale times appropriately:

| Data Type | Stale Time | Rationale |
|-----------|------------|-----------|
| User Profile | 5 minutes | Changes infrequently |
| Organization | 5 minutes | Rarely changes |
| Lists | 2 minutes | May change via drag-drop |
| List Contacts | 1 minute | Frequently updated |
| Org Logo | 10 minutes | Very rarely changes |
| Scripts/Templates | 5 minutes | Changes via settings |

## Query Key Naming Convention

```typescript
// User queries
['user-profile', userId]
['user-team-info', userId]
['team-members', teamId, excludeUserId]

// Organization queries
['organization', orgId]
['org-logo', orgId]

// List queries
['user-lists', userId]
['list', listId]
['list-contacts', listId]
['list-contact-count', listId]

// Script queries
['call-scripts', userId]
['call-script', scriptId]
['email-templates', userId]
['email-template', templateId]
```

## Adding New Queries

### Step 1: Create Query Functions

```typescript
// lib/queries/contactQueries.ts
export interface Contact { /* ... */ }

export async function fetchContact(contactId: string): Promise<Contact | null> {
  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .eq('id', contactId)
    .single()

  if (error) {
    console.error('Error fetching contact:', error)
    return null
  }
  return data
}
```

### Step 2: Create Hook

```typescript
// hooks/useContactQuery.ts
import { useQuery } from '@tanstack/react-query'
import { fetchContact, Contact } from '@/lib/queries'

export function useContact(contactId: string | undefined) {
  return useQuery<Contact | null>({
    queryKey: ['contact', contactId],
    queryFn: () => contactId ? fetchContact(contactId) : null,
    enabled: !!contactId,
    staleTime: 5 * 60 * 1000,
  })
}
```

### Step 3: Export from Index Files

```typescript
// lib/queries/index.ts
export * from './contactQueries'

// hooks/index.ts
export { useContact } from './useContactQuery'
```

### Step 4: Use in Components

```typescript
import { useContact } from '@/hooks'

function ContactDetail({ contactId }) {
  const { data: contact } = useContact(contactId)
  return <div>{contact?.first_name} {contact?.last_name}</div>
}
```

## Common Issues & Solutions

### Issue: Hook causing infinite loop

**Problem:**
```typescript
const { data } = useUserLists(userId) // userId is an object that changes

// Solution: Memoize or use ID from stable source
const { user } = useAuth()
const { data } = useUserLists(user?.id) // Use stable ID
```

### Issue: Cascading queries (dependent queries)

**Solution:**
```typescript
// Query 1: Get user profile
const { data: userProfile } = useUserProfile(userId)

// Query 2: Only when org_id is available (enabled option)
const { data: orgLogo } = useOrganizationLogo(userProfile?.org_id)
```

### Issue: Invalidate cache after mutation

**Solution:**
```typescript
import { useQueryClient } from '@tanstack/react-query'

function useUpdateUser() {
  const queryClient = useQueryClient()

  return async (userId: string, updates: UserProfile) => {
    await updateUser(userId, updates)
    // Invalidate and refetch
    queryClient.invalidateQueries({ queryKey: ['user-profile', userId] })
  }
}
```

## Migration Guide

To migrate existing components to use the new pattern:

1. **Identify** data fetching in your component (useEffect + useState)
2. **Find** equivalent hook in `/hooks`
3. **Replace** useEffect + useState with single hook call
4. **Remove** manual error/loading state management (hooks provide this)
5. **Test** that component still works

Example migration:
```typescript
// Before: 10+ lines
useEffect(() => {
  loadData()
}, [userId])

// After: 1 line
const { data } = useUserProfile(userId)
```

## Testing

Query functions are pure and easy to test:

```typescript
// __tests__/userQueries.test.ts
import { fetchUserProfile } from '@/lib/queries'

test('fetchUserProfile returns user data', async () => {
  const user = await fetchUserProfile('user-id')
  expect(user?.display_name).toBe('John Doe')
})
```

Hooks use React Testing Library:

```typescript
// __tests__/useUserQuery.test.tsx
import { renderHook, waitFor } from '@testing-library/react'
import { useUserProfile } from '@/hooks'

test('useUserProfile loads data', async () => {
  const { result } = renderHook(() => useUserProfile('user-id'))
  await waitFor(() => expect(result.current.isSuccess).toBe(true))
  expect(result.current.data?.display_name).toBe('John Doe')
})
```
