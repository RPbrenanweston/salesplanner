# Centralized Type Definitions

## Overview

This directory contains all TypeScript type definitions for the application, serving as the single source of truth for domain models, enums, and type aliases.

## Structure

```
types/
├── domain.ts      # Core business entity types (User, Contact, SalesBlock, etc.)
├── enums.ts       # Enum types and labeled constants
└── index.ts       # Central export point
```

## Usage

### Recommended: Import from types/

```typescript
// ✅ Recommended
import { User, SalesBlock, Activity, Goal } from '@/types'

function processUser(user: User) {
  // user is fully typed
}
```

### Not Recommended: Defining types in components

```typescript
// ❌ Avoid
interface User {
  id: string
  display_name: string
}

// Why? This creates duplication and divergence from single source of truth
```

## Defined Types

### Domain Types (domain.ts)

**User Management:**
- `Organization` - Company organization record
- `User` - User account with auth and preferences
- `TeamMember` - Team member reference (subset of User)

**Contact Management:**
- `Contact` - Lead/prospect record
- `ContactList` - Curated list of contacts
- `Contact` supports custom fields for flexibility

**Sales Activities:**
- `SalesBlock` - Timed outreach session
- `Activity` - Single outreach action (call, email, etc.)
- `Deal` - Sales opportunity
- `PipelineStage` - Deal stage configuration

**Content Management:**
- `CallScript` - Sales script for calls
- `EmailTemplate` - Email template with variables
- `CustomKPI` - User-defined metric

**Goals & Metrics:**
- `Goal` - Sales target (daily/weekly/monthly)
- `GoalProgress` - Calculated progress against goal

### Enum Types (enums.ts)

**Role-based:**
```typescript
enum UserRole {
  SDR = 'sdr',           // Sales Development Rep
  AE = 'ae',             // Account Executive
  MANAGER = 'manager'    // Team/Org Manager
}
```

**Business States:**
```typescript
enum SalesBlockStatus { /* scheduled, in_progress, completed, cancelled */ }
enum ActivityType { /* call, email, social, meeting, note */ }
enum ActivityOutcome { /* no_answer, connect, meeting_booked, etc. */ }
enum ContactSource { /* csv, salesforce, manual */ }
```

**Labeled Constants:**
```typescript
// Example: Use these for dropdowns, badges, displays
const OUTCOME_LABELS: Record<ActivityOutcome, string> = {
  [ActivityOutcome.NO_ANSWER]: 'No Answer',
  [ActivityOutcome.CONNECT]: 'Connect',
  // ...
}
```

## Benefits of Centralization

### Before (Types Scattered)
```typescript
// Home.tsx
interface SalesBlock { ... }
interface Activity { ... }
interface Goal { ... }

// CreateSalesBlockModal.tsx
interface List { ... }
interface CallScript { ... }
interface TeamMember { ... }

// Problem: Duplication, divergence, hard to maintain
```

### After (Centralized Types)
```typescript
// All imports from single location
import { SalesBlock, Activity, Goal, ContactList, CallScript, TeamMember } from '@/types'

// Single source of truth
// Type consistency across codebase
// Easy to find and update definitions
```

## Migration Guide

### Step 1: Move Type to domain.ts or enums.ts

If you find a type definition in a component:

```typescript
// Before: In Home.tsx
interface SalesBlock {
  id: string
  title: string
  // ...
}
```

Move it to `types/domain.ts`:

```typescript
// After: In types/domain.ts
export interface SalesBlock {
  // ...
}
```

### Step 2: Export from types/index.ts (Already Done)

```typescript
// types/index.ts
export * from './domain'
export * from './enums'
```

### Step 3: Update Imports

```typescript
// Before
interface SalesBlock { ... }
const block: SalesBlock = ...

// After
import { SalesBlock } from '@/types'
const block: SalesBlock = ...
```

## When to Add New Types

1. **New entity from database**: Add to `domain.ts`
   - User, Contact, Deal, Goal, etc.

2. **Enumeration or fixed values**: Add to `enums.ts`
   - Status, Role, Outcome types
   - Add labeled constants if displayed to users

3. **Internal/UI-only type**: Keep in component/hook
   - Form state, temporary calculations
   - Only if not used across multiple files

## Type Organization Principles

### 1. One File Per Domain Area
- User-related types → together
- Activity-related types → together
- Content (Script, Template) → together

### 2. Export as Public, Order Logically
```typescript
// Logical order: depend on
export interface Organization { ... }
export interface User { ... }  // depends on Organization
export interface TeamMember { ... }  // depends on User
```

### 3. Document Complex Types
```typescript
/**
 * SalesBlock represents a timed outreach session
 *
 * - status: current session state (scheduled → in_progress → completed)
 * - list_id: contacts to work through
 * - duration_minutes: maximum session time
 */
export interface SalesBlock {
  // ...
}
```

## Consistency Checks

To ensure type consistency across the codebase:

1. **No inline type definitions** (except UI-local state)
2. **All imports from @/types**
3. **Use enums for fixed values**
4. **Document complex relationships**

## Integration with Queries & Hooks

Types are used throughout the data layer:

```typescript
// lib/queries/userQueries.ts
import type { User, TeamMember } from '../../types'

export function fetchUserProfile(userId: string): Promise<User | null> { ... }

// hooks/useUserQuery.ts
import { useQuery } from '@tanstack/react-query'
import type { User } from '../types'

export function useUserProfile(userId?: string) {
  return useQuery<User | null>({ ... })
}

// components/MyComponent.tsx
import { useUserProfile } from '@/hooks'
import type { User } from '@/types'

function MyComponent() {
  const { data: user } = useUserProfile(userId)
  // user is fully typed as User | null
}
```

## Future Enhancements

1. **Schema Validation**: Use libraries like `zod` or `io-ts` to validate data from Supabase
2. **Type Narrowing**: Use discriminated unions for complex types
3. **Generic Types**: Create reusable patterns for common structures

---

**Key Rule**: If you're defining a type in a component, ask: "Is this type used anywhere else?" If yes, move it here.
