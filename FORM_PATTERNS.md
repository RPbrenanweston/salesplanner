# Form Patterns Guide

This guide documents reusable form patterns and utilities for building consistent, maintainable forms throughout SalesBlock.io.

## Overview

Forms are one of the most repeated patterns in the application. To reduce code duplication and ensure consistency, we've extracted common form handling logic into reusable utilities.

### Key Principles

- **DRY**: Don't repeat form state management code across modals/pages
- **Consistency**: All forms follow the same validation, error handling, and submission patterns
- **Type Safety**: Full TypeScript support with proper typing
- **Accessibility**: Built-in support for form accessibility patterns
- **Testability**: Easier to test form logic when it's separated from UI

---

## Core Utilities

### `useForm` Hook

The main hook for form state management. Handles:
- Form values and field changes
- Validation and error tracking
- Form submission
- Form reset
- Loading states

**Location**: `lib/form-utils.ts`

### `useArrayField` Hook

For managing array-type form fields (custom fields, list items, etc.)

**Location**: `lib/form-utils.ts`

### Validation Utilities

Pre-built validators for common patterns:
- `validateEmail()` - Email format validation
- `validateUrl()` - URL format validation
- `createFieldError()` - Create single field error
- `mergeErrors()` - Combine multiple error objects

**Location**: `lib/form-utils.ts`

---

## Usage Examples

### Basic Form with Validation

```typescript
import { useForm, validateEmail, FormErrors } from '../lib/form-utils'

interface LoginForm {
  email: string
  password: string
}

export function LoginModal({ isOpen, onClose }: LoginModalProps) {
  const { values, errors, isSubmitting, handleSubmit, setFieldValue } = useForm<LoginForm>({
    initialValues: {
      email: '',
      password: '',
    },
    validate: (values) => {
      const errors: FormErrors = {}

      if (!values.email) {
        errors.email = 'Email is required'
      } else if (!validateEmail(values.email)) {
        errors.email = 'Invalid email format'
      }

      if (!values.password) {
        errors.password = 'Password is required'
      } else if (values.password.length < 8) {
        errors.password = 'Password must be at least 8 characters'
      }

      return errors
    },
    onSubmit: async (values) => {
      await api.login(values.email, values.password)
    },
    onSuccess: () => {
      onClose()
    },
  })

  if (!isOpen) return null

  return (
    <div className="modal">
      <form onSubmit={handleSubmit}>
        <div>
          <input
            type="email"
            value={values.email}
            onChange={(e) => setFieldValue('email', e.target.value)}
            placeholder="Email"
            className={errors.email ? 'border-red-500' : ''}
          />
          {errors.email && <span className="text-red-500">{errors.email}</span>}
        </div>

        <div>
          <input
            type="password"
            value={values.password}
            onChange={(e) => setFieldValue('password', e.target.value)}
            placeholder="Password"
            className={errors.password ? 'border-red-500' : ''}
          />
          {errors.password && <span className="text-red-500">{errors.password}</span>}
        </div>

        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Logging in...' : 'Login'}
        </button>
      </form>
    </div>
  )
}
```

### Form with Array Fields

```typescript
import { useForm, useArrayField } from '../lib/form-utils'

interface CustomField {
  key: string
  value: string
}

interface ContactForm {
  firstName: string
  lastName: string
  email: string
}

export function AddContactModal({ isOpen, onClose }: AddContactModalProps) {
  const form = useForm<ContactForm>({
    initialValues: {
      firstName: '',
      lastName: '',
      email: '',
    },
    validate: (values) => {
      const errors: FormErrors = {}
      if (!values.firstName) errors.firstName = 'First name required'
      if (!values.email) errors.email = 'Email required'
      return errors
    },
    onSubmit: async (values) => {
      // Create contact with custom fields
      await api.createContact(values, customFields.items)
    },
  })

  const customFields = useArrayField<CustomField>([])

  return (
    <form onSubmit={form.handleSubmit}>
      {/* Standard fields */}
      <input
        value={form.values.firstName}
        onChange={(e) => form.setFieldValue('firstName', e.target.value)}
        placeholder="First Name"
      />
      {form.errors.firstName && <span>{form.errors.firstName}</span>}

      {/* Custom fields array */}
      {customFields.items.map((field, index) => (
        <div key={index} className="flex gap-2">
          <input
            value={field.key}
            onChange={(e) =>
              customFields.updateItemField(index, 'key', e.target.value)
            }
            placeholder="Field name"
          />
          <input
            value={field.value}
            onChange={(e) =>
              customFields.updateItemField(index, 'value', e.target.value)
            }
            placeholder="Field value"
          />
          <button
            type="button"
            onClick={() => customFields.removeItem(index)}
          >
            Remove
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={() => customFields.addItem({ key: '', value: '' })}
      >
        Add Custom Field
      </button>

      <button type="submit" disabled={form.isSubmitting}>
        Create Contact
      </button>
    </form>
  )
}
```

### Form with Custom Validation

```typescript
import { useForm } from '../lib/form-utils'

interface SalesBlockForm {
  title: string
  listId: string
  scheduledDate: string
}

export function CreateSalesBlockModal() {
  const form = useForm<SalesBlockForm>({
    initialValues: {
      title: '',
      listId: '',
      scheduledDate: '',
    },
    validate: async (values) => {
      const errors: FormErrors = {}

      if (!values.title) {
        errors.title = 'Title required'
      }

      if (!values.listId) {
        errors.listId = 'List required'
      }

      if (!values.scheduledDate) {
        errors.scheduledDate = 'Date required'
      } else {
        // Custom validation: check if date is in past
        const selectedDate = new Date(values.scheduledDate)
        if (selectedDate < new Date()) {
          errors.scheduledDate = 'Cannot schedule in the past'
        }
      }

      // Async validation example: check if list has contacts
      if (values.listId) {
        const hasContacts = await api.listHasContacts(values.listId)
        if (!hasContacts) {
          errors.listId = 'List has no contacts'
        }
      }

      return errors
    },
    onSubmit: async (values) => {
      await api.createSalesBlock(values)
    },
  })

  return (
    <form onSubmit={form.handleSubmit}>
      {/* Fields... */}
    </form>
  )
}
```

---

## API Reference

### `useForm<T>`

Main hook for form state management.

```typescript
interface UseFormConfig<T> {
  initialValues: T
  onSubmit: FormSubmitHandler<T>
  validate?: FormValidator<T>
  onSuccess?: () => void
}

interface UseFormResult<T> {
  values: T
  errors: FormErrors
  isSubmitting: boolean
  isValid: boolean

  // Methods
  setFieldValue: <K extends keyof T>(field: K, value: T[K]) => void
  setFieldError: (field: keyof T, error: string | undefined) => void
  resetField: (field: keyof T) => void
  handleSubmit: (e: React.FormEvent) => Promise<void>
  reset: () => void
  setFieldsTouched: (fields: (keyof T)[]) => void
}
```

**Parameters**:
- `initialValues` (Required): Initial form values
- `onSubmit` (Required): Async function called on valid form submission
- `validate` (Optional): Validation function returning error map
- `onSuccess` (Optional): Callback after successful submission

**Returns**:
- `values`: Current form values
- `errors`: Field error messages
- `isSubmitting`: Loading state during submission
- `isValid`: Whether form has no errors
- `setFieldValue()`: Update a field value
- `setFieldError()`: Set error for a field
- `resetField()`: Reset a single field
- `handleSubmit()`: Form submit handler
- `reset()`: Reset entire form
- `setFieldsTouched()`: Mark fields as touched

### `useArrayField<T>`

Hook for managing array-type form fields.

```typescript
interface UseArrayFieldResult<T> {
  items: T[]
  setItems: (items: T[]) => void
  addItem: (item: T) => void
  removeItem: (index: number) => void
  updateItem: (index: number, item: T) => void
  updateItemField: <K extends keyof T>(index: number, field: K, value: T[K]) => void
  reset: () => void
}
```

**Returns**:
- `items`: Array of items
- `addItem()`: Add item to array
- `removeItem()`: Remove item at index
- `updateItem()`: Replace item at index
- `updateItemField()`: Update specific field of item
- `reset()`: Reset to initial values

### Validation Utilities

```typescript
validateEmail(email: string): boolean
validateUrl(url: string): boolean
createFieldError(field: string, message: string): FormErrors
mergeErrors(...errors: FormErrors[]): FormErrors
```

---

## Best Practices

### 1. Separate Form Logic from UI

```typescript
// ✅ Good: Separate hook from JSX
const form = useForm({ /* ... */ })

return (
  <input
    value={form.values.field}
    onChange={(e) => form.setFieldValue('field', e.target.value)}
  />
)

// ❌ Bad: Mixing state management with JSX
const [field, setField] = useState('')
// ... more state ...
```

### 2. Use Strong Typing for Form Values

```typescript
// ✅ Good: Strongly typed form values
interface ContactForm {
  firstName: string
  lastName: string
  email: string
}

const form = useForm<ContactForm>({ /* ... */ })

// ❌ Bad: Using `any` type
const form = useForm<any>({ /* ... */ })
```

### 3. Comprehensive Validation

```typescript
// ✅ Good: Validate all fields
validate: (values) => {
  const errors: FormErrors = {}

  if (!values.email) errors.email = 'Required'
  if (values.email && !validateEmail(values.email)) {
    errors.email = 'Invalid format'
  }

  return errors
}

// ❌ Bad: Missing validation
validate: (values) => {
  if (!values.email) return { email: 'Required' }
  return {}
}
```

### 4. Clear Error Messages

```typescript
// ✅ Good: Specific, actionable messages
'Email must be between 5 and 255 characters'
'Password must contain at least one uppercase letter'

// ❌ Bad: Vague messages
'Invalid input'
'Error'
```

### 5. Loading State During Submission

```typescript
// ✅ Good: Show loading state
<button disabled={form.isSubmitting}>
  {form.isSubmitting ? 'Creating...' : 'Create'}
</button>

// ❌ Bad: No indication of loading
<button>Create</button>
```

### 6. Reset After Success

```typescript
// ✅ Good: Reset form after successful submission
onSuccess: () => {
  form.reset()
  onClose()
}

// ❌ Bad: Don't reset
onSuccess: () => {
  onClose()
}
```

---

## Migration Guide

### Before: Manual State Management

```typescript
// Old way - lots of boilerplate
const [email, setEmail] = useState('')
const [password, setPassword] = useState('')
const [emailError, setEmailError] = useState('')
const [passwordError, setPasswordError] = useState('')
const [isSubmitting, setIsSubmitting] = useState(false)

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault()
  const errors: FormErrors = {}

  if (!email) errors.email = 'Email required'
  if (!password) errors.password = 'Password required'

  if (Object.keys(errors).length > 0) {
    setEmailError(errors.email)
    setPasswordError(errors.password)
    return
  }

  setIsSubmitting(true)
  try {
    await api.submit(email, password)
  } finally {
    setIsSubmitting(false)
  }
}
```

### After: Using useForm Hook

```typescript
// New way - clean and concise
const form = useForm({
  initialValues: { email: '', password: '' },
  validate: (values) => ({
    email: values.email ? '' : 'Email required',
    password: values.password ? '' : 'Password required',
  }),
  onSubmit: (values) => api.submit(values.email, values.password),
})
```

---

## Common Patterns

### Modal Forms

Modal forms are very common. The pattern is:
1. Get form state from `useForm`
2. Use `onSuccess` to close modal
3. Use form's `reset()` in `onSuccess`

```typescript
export function MyModal({ isOpen, onClose }: ModalProps) {
  const form = useForm({
    // ... config ...
    onSuccess: () => {
      form.reset()
      onClose()
    },
  })

  if (!isOpen) return null

  return (
    <form onSubmit={form.handleSubmit}>
      {/* Form fields */}
    </form>
  )
}
```

### Inline Forms (Pages)

For inline forms on pages, reset is optional:

```typescript
export function SettingsPage() {
  const form = useForm({
    // ... config ...
    onSuccess: () => {
      // Maybe show success message
      toast.success('Settings saved!')
      // Don't reset - user can see what they changed
    },
  })

  return (
    <form onSubmit={form.handleSubmit}>
      {/* Form fields */}
    </form>
  )
}
```

---

## Troubleshooting

### Form Doesn't Reset After Submit

**Problem**: Form still shows values after successful submission

**Solution**: Call `form.reset()` in `onSuccess` callback

```typescript
onSuccess: () => {
  form.reset()  // ← Add this
  onClose()
}
```

### Errors Not Showing

**Problem**: Error messages don't appear even though validation fails

**Solution**: Check that:
1. Validation returns error object with field names as keys
2. Field name in error object matches form value key
3. Error is being displayed in JSX

```typescript
// ✅ Correct error key matches form value key
validate: (values) => ({
  email: values.email ? '' : 'Email required',  // key 'email' matches
})

// Display error
{form.errors.email && <span>{form.errors.email}</span>}
```

### Async Validation Not Working

**Problem**: Async validation in `validate` function doesn't seem to run

**Solution**: Make sure to `await` the validation function

```typescript
// ✅ Correct: async validate function
validate: async (values) => {
  const errors: FormErrors = {}

  if (values.email) {
    const exists = await api.checkEmailExists(values.email)
    if (exists) {
      errors.email = 'Email already exists'
    }
  }

  return errors
}
```

---

## Related Files

- `lib/form-utils.ts` - Form utilities implementation
- `FORM_PATTERNS.md` - This guide
- Example usage in: `components/AddContactModal.tsx`, `components/CreateSalesBlockModal.tsx`

