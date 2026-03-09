# Naming Conventions Guide

This document establishes consistent naming patterns across the codebase.
All developers must follow these conventions to maintain code clarity and consistency.

## File Naming

### Components (.tsx)
**Pattern**: `PascalCase-with-descriptive-names.tsx`

```typescript
// ✅ Good
CreateSalesBlockModal.tsx
ActivityFeed.tsx
DealDetailModal.tsx
SalesBlockCard.tsx
ContactForm.tsx

// ❌ Bad
createSalesBlockModal.tsx       // not PascalCase
create_salesblock_modal.tsx     // snake_case
modal.tsx                       // too generic
CSM.tsx                         // abbreviations unclear
```

**Convention**:
- Use full words (not abbreviations)
- Include component type if helpful: Modal, Form, Section, Card, Button, etc.
- Feature-based naming: include feature name
- Generic suffixes: Modal, Form, Section, Card, Button, Header, Footer

### Hooks (.ts)
**Pattern**: `use[FeatureName].ts` (camelCase, starts with 'use')

```typescript
// ✅ Good
useUserProfile.ts
useGoalProgress.ts
useDashboardData.ts
useListContacts.ts
useTheme.ts

// ❌ Bad
UserProfileHook.ts             // not camelCase
user_profile.ts                // snake_case
getUser.ts                     // should start with 'use'
user-profile.ts                // kebab-case (use only in queries/)
```

**Convention**:
- MUST start with 'use' (React convention)
- camelCase after 'use'
- Descriptive feature name
- One hook per file (export one main hook)

### Query Functions (.ts in lib/queries/)
**Pattern**: `[entityName]Queries.ts` (camelCase plural)

```typescript
// ✅ Good
userQueries.ts
listQueries.ts
scriptQueries.ts
organizationQueries.ts
contactQueries.ts

// ❌ Bad
UserQueries.ts                 // should be camelCase
user_queries.ts                // snake_case
users.ts                       // too generic
userQuery.ts                   // should be plural
```

**Convention**:
- camelCase (not PascalCase)
- Plural (Queries)
- Entity-based naming
- Group related queries in one file

### Utilities (.ts in lib/)
**Pattern**: `[purpose].ts` (descriptive, specific)

```typescript
// ✅ Good
constants.ts
routes.ts
errors.ts
formatters.ts
validators.ts

// ❌ Bad
utils.ts                       // too generic
helpers.ts                     // too vague
tools.ts                       // unclear purpose
```

**Convention**:
- Describe purpose clearly
- Avoid generic 'utils', 'helpers', 'tools'
- Avoid abbreviations

---

## Function Naming

### Query Functions
**Pattern**: `fetch[EntityName]` (verb-noun)

```typescript
// ✅ Good
export async function fetchUserProfile(userId: string) { }
export async function fetchListContacts(listId: string) { }
export async function fetchCallScripts(userId: string) { }
export async function fetchTeamMembers(teamId: string) { }

// Create operations
export async function createSalesBlock(data: CreateSalesBlockInput) { }
export async function createContactList(data: CreateListInput) { }

// Update operations
export async function updateUserPreferences(userId: string, prefs: Preferences) { }
export async function updateSalesBlockStatus(blockId: string, status: SalesBlockStatus) { }

// Delete operations
export async function deleteContactList(listId: string) { }
export async function deleteSalesBlock(blockId: string) { }

// ❌ Bad
getUser()                      // should be 'fetch' for async
load_contacts()                // snake_case
retrieveScripts()              // overly formal
sync_profile()                 // unclear purpose
```

**Convention**:
- Use verb-noun pattern: `fetch`, `create`, `update`, `delete`
- `fetch` for read operations (async queries)
- `get` only for synchronous/computed values
- camelCase
- Avoid generic names like 'load', 'get', 'retrieve'

### React Hook Functions
**Pattern**: `use[FeatureName]` (React convention)

```typescript
// ✅ Good
export function useUserProfile(userId?: string) { }
export function useDashboardData() { }
export function useGoalProgress(userId: string) { }
export function useListContacts(listId: string) { }

// ❌ Bad
function getGoalProgress()     // should use 'use'
export function UserProfile()  // should start with lowercase 'use'
const useUserProfiles = () =>  // ambiguous (fetch hook? state hook?)
```

**Convention**:
- MUST start with 'use'
- camelCase
- Return object with `{ data, error, isLoading, ... }`
- One responsibility per hook

### UI Components
**Pattern**: `[ComponentName]` (descriptive, specific)

```typescript
// ✅ Good
function ActivityCard({ activity }: Props) { }
function SalesBlockCard({ block }: Props) { }
function CreateSalesBlockModal({ isOpen, onClose }: Props) { }
function DashboardGreeting({ userName }: Props) { }

// ❌ Bad
function Card({ data }: Props) { }    // too generic
function Modal({ props }: Props) { }  // unclear purpose
const ActivityC = () => { }           // abbreviations
```

**Convention**:
- PascalCase (React component convention)
- Descriptive name
- Include 'Modal', 'Form', 'Card', etc. suffix if appropriate
- Describe what it displays, not how it renders

### Utility Functions
**Pattern**: `[verb][Noun]` (camelCase, action-oriented)

```typescript
// ✅ Good
export function formatDate(date: Date): string { }
export function calculateGoalProgress(current: number, target: number): number { }
export function validateEmail(email: string): boolean { }
export function isManager(user: User): boolean { }
export function parseActivityType(type: string): ActivityType { }

// ❌ Bad
export function dateFormat(date: Date) { }      // verb-noun order
export function progressCalc() { }               // abbreviations
export function checkEmail() { }                 // generic verb
export function getIsManager() { }               // awkward construction
```

**Convention**:
- camelCase
- Start with verb (format, calculate, validate, is, parse)
- Clear noun following verb
- Avoid abbreviations
- Avoid 'get' for computed values (use verb instead: 'calculate', 'format', 'parse')

### Getter/Checker Functions
**Pattern**: `is[Adjective]` or `has[Property]`

```typescript
// ✅ Good
export function isManager(user: User): boolean { }
export function isCompleted(block: SalesBlock): boolean { }
export function hasTrialExpired(trial: Trial): boolean { }
export function isValidEmail(email: string): boolean { }

// ❌ Bad
export function checkManager(user: User) { }
export function validateSalesBlock() { }
export function canUserAccess() { }    // should be 'has' or 'is'
```

**Convention**:
- Prefix with `is`, `has`, `can`
- Return boolean
- Makes code more readable: `if (isManager) { }`

---

## Variable Naming

### Component Props
**Pattern**: Clear, descriptive, matches what they contain

```typescript
// ✅ Good
interface Props {
  userId: string
  isOpen: boolean
  onClose: () => void
  onSuccess?: (result: SalesBlock) => void
  salesblocks: SalesBlock[]
}

function Component({ userId, isOpen, onClose, onSuccess, salesblocks }: Props) { }

// ❌ Bad
interface Props {
  id: string           // ambiguous which ID?
  open: boolean        // should be 'isOpen'
  close: () => void    // should be 'onClose'
  cb?: () => void      // abbreviation
  data: unknown[]      // too generic
}
```

**Convention**:
- Avoid single letters except loop indices (i, j, k)
- Use prefixes for clarity:
  - `is*` for booleans (isOpen, isLoading, isValid)
  - `on*` for callbacks (onClose, onSuccess, onError)
  - `handle*` for event handlers (handleClick, handleSubmit)
- Full words, no abbreviations

### State Variables
**Pattern**: Clear description of what state represents

```typescript
// ✅ Good
const [isModalOpen, setIsModalOpen] = useState(false)
const [selectedListId, setSelectedListId] = useState('')
const [userGoals, setUserGoals] = useState<Goal[]>([])
const [emailDraft, setEmailDraft] = useState('')

// ❌ Bad
const [open, setOpen] = useState(false)       // ambiguous
const [list, setList] = useState([])          // too generic
const [data, setData] = useState({})          // what data?
const [modal, setModal] = useState(null)      // unclear
```

**Convention**:
- Describe the content, not the structure
- Use boolean prefixes: `is*`, `has*`, `should*`
- Plural for arrays: `salesblocks` not `salesblock[]`
- Include context: `selectedListId` not just `listId`

### Loop Variables
**Pattern**: Full name preferred, single letter acceptable

```typescript
// ✅ Good
for (const goal of userGoals) { }
activities.map((activity) => { })
salesblocks.forEach((block) => { })

// Acceptable for simple loops:
for (let i = 0; i < list.length; i++) { }

// ❌ Bad
for (const g of userGoals) { }               // abbreviation
activities.map((a) => { })                   // single letter
salesblocks.forEach((sb) => { })             // abbreviation
```

**Convention**:
- Full names preferred
- Single letters (i, j, k) acceptable for nested loops only
- Avoid abbreviations

---

## Type Naming

### Interfaces & Types
**Pattern**: `[EntityName]` (PascalCase)

```typescript
// ✅ Good
interface User { }
interface SalesBlock { }
interface CreateSalesBlockInput { }
interface SalesBlockCard_Props { }

// Type aliases for function signatures
type SuccessCallback = (result: SalesBlock) => void
type ErrorHandler = (error: Error) => void

// ❌ Bad
interface IUser { }                  // Hungarian notation (don't use)
interface user { }                   // should be PascalCase
type user_data = { }                 // should be PascalCase
interface CreateSalesblockInput { }  // 'SalesBlock' is capitalized entity
```

**Convention**:
- PascalCase
- Use full words (no abbreviations)
- Descriptive suffix for derived types:
  - `*Input` for form inputs
  - `*Output` for response types
  - `*Props` for React component props
- No Hungarian notation (IUser, etc.)

### Enum Values
**Pattern**: `UPPER_SNAKE_CASE` or PascalCase values

```typescript
// ✅ Good
enum UserRole {
  SDR = 'sdr',
  AE = 'ae',
  MANAGER = 'manager',
}

enum SalesBlockStatus {
  SCHEDULED = 'scheduled',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
}

// Also acceptable:
const USER_ROLE = {
  SDR: 'sdr',
  AE: 'ae',
  MANAGER: 'manager',
} as const

// ❌ Bad
enum Role {
  S = 'sdr',           // abbreviations
  a = 'ae',            // should be uppercase
  M = 'manager',       // unclear
}
```

**Convention**:
- Enum name: PascalCase
- Enum values: UPPER_SNAKE_CASE or camelCase (match database values)
- Use when you have a fixed set of values
- Prefer `as const` for smaller sets

### Constants
**Pattern**: `UPPER_SNAKE_CASE` for true constants

```typescript
// ✅ Good
const DEFAULT_PAGE_SIZE = 20
const TRIAL_EXPIRY_WARNING_DAYS = 7
const MAX_FILE_SIZE_MB = 10
const API_TIMEOUT_MS = 30000

// ❌ Bad
const defaultPageSize = 20       // should be UPPER_SNAKE_CASE for constants
const TrialDays = 7              // inconsistent
const max_file = 10              // mixed case
```

**Convention**:
- UPPER_SNAKE_CASE for constants
- Describe the value clearly
- Include unit if applicable: `*_MB`, `*_MS`, `*_SECONDS`
- Group related constants in objects (see lib/constants.ts)

---

## Route & Path Naming

### Route Constants
**Pattern**: `[LOCATION]` (UPPER_SNAKE_CASE for consistency)

```typescript
// ✅ Good
const ROUTES = {
  SIGNIN: '/signin',
  DASHBOARD: '/dashboard',
  SALESBLOCKS: '/salesblocks',
  LIST_DETAIL: (id) => `/lists/${id}`,
}

// Use: navigate(ROUTES.SIGNIN)

// ❌ Bad
const routes = {
  signin: '/signin',      // inconsistent case
  create_salesblock: '/create-block',  // inconsistent
  list_Detail: '/lists/:id',           // mixed case
}
```

**Convention**:
- UPPER_SNAKE_CASE
- Describe page or feature
- Path helpers as functions
- Located in lib/routes.ts

---

## Query Parameter Naming

**Pattern**: `camelCase` (matches JavaScript convention)

```typescript
// ✅ Good
?userId=123
?isArchived=true
?sortBy=createdAt
?pageSize=20

// ❌ Bad
?user_id=123        // should be camelCase
?IsArchived=true    // should be lowercase
?sort_by=createdAt  // snake_case
```

---

## Class & Object Property Naming

### Class Methods
**Pattern**: `[verb][Noun]` (camelCase)

```typescript
// ✅ Good
class UserService {
  async fetchUserProfile(userId: string) { }
  async updateUserPreferences(prefs: Preferences) { }
  validateEmail(email: string) { }
  isUserManager(user: User) { }
}

// ❌ Bad
class UserService {
  get_user() { }           // snake_case
  FetchProfile() { }       // PascalCase
  user_preferences() { }   // snake_case
}
```

**Convention**:
- camelCase
- Verb-noun pattern
- Public/private prefixes: not needed (use TypeScript `private` keyword)

### Object Properties
**Pattern**: camelCase, descriptive

```typescript
// ✅ Good
const user = {
  userId: '123',
  displayName: 'John Doe',
  emailAddress: 'john@example.com',
  isManager: true,
  createdAt: new Date(),
}

// ❌ Bad
const user = {
  user_id: '123',     // snake_case
  name: 'John',       // ambiguous
  email: 'john@example.com',
  manager: true,      // should be 'isManager'
}
```

**Convention**:
- camelCase
- Boolean properties: `is*`, `has*`, `should*` prefixes
- Date properties: `*At` suffix (createdAt, updatedAt)
- Full words (no abbreviations)

---

## Commonly Used Prefixes & Suffixes

### Prefixes
| Prefix | Usage | Example |
|--------|-------|---------|
| `use` | React hooks | `useUserProfile` |
| `is` | Boolean properties | `isManager`, `isOpen` |
| `has` | Boolean ownership | `hasPermission`, `hasValue` |
| `can` | Boolean ability | `canDelete`, `canEdit` |
| `on` | Event callbacks | `onClick`, `onSuccess` |
| `handle` | Event handlers | `handleSubmit`, `handleChange` |
| `fetch` | Async data fetching | `fetchUserData` |
| `create` | Object creation | `createSalesBlock` |
| `update` | Object modification | `updateUserProfile` |
| `delete` | Object deletion | `deleteSalesBlock` |

### Suffixes
| Suffix | Usage | Example |
|--------|-------|---------|
| `*Props` | React component props | `ModalProps` |
| `*State` | State object | `FormState` |
| `*Input` | Form inputs | `CreateListInput` |
| `*Output` | Function output | `FetchUserOutput` |
| `*Error` | Error types | `ValidationError` |
| `*Modal` | Modal components | `CreateSalesBlockModal` |
| `*Form` | Form components | `ContactForm` |
| `*Card` | Card components | `SalesBlockCard` |
| `*Button` | Button components | `SubmitButton` |
| `*At` | Timestamps | `createdAt`, `updatedAt` |
| `*Id` | ID references | `userId`, `listId` |

---

## Summary Checklist

When naming anything, ask yourself:

- [ ] **Is it clear?** Will another developer understand it without context?
- [ ] **Is it specific?** Does it avoid generic names (data, item, value)?
- [ ] **Is it consistent?** Does it follow the established pattern?
- [ ] **Is it complete?** Does it use full words without abbreviations?
- [ ] **Is it correct?** Does it accurately describe what it is?

**Golden Rule**: If you have to ask "What does this mean?" - the name is not good enough.

