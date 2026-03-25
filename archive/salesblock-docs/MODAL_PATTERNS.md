# Modal Component Guide

This guide documents the reusable Modal component that provides consistent modal UI across the application.

## Overview

The Modal component is a wrapper that handles all the common modal UI structure, allowing you to focus on the content:
- Backdrop with click-to-close
- Header with title, icon, and close button
- Scrollable content area
- Optional footer for actions
- Keyboard shortcuts (Escape to close)
- Accessibility features
- Dark mode support

Before, each modal had ~100+ lines of repeated JSX. Now, it's a simple wrapper.

---

## Components

### `Modal`

Main modal wrapper component.

```typescript
interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  icon?: React.ReactNode
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg'
  closeOnBackdropClick?: boolean
  closeLabel?: string
  className?: string
  form?: string
  showCloseButton?: boolean
}
```

### `ModalActions`

Container for footer action buttons. Provides flex layout with proper spacing.

```typescript
<ModalActions>
  <button>Cancel</button>
  <button>Save</button>
</ModalActions>
```

### `ModalFormActions`

Pre-built footer with Cancel/Submit buttons for form modals. Handles loading state and validation.

```typescript
<ModalFormActions
  onCancel={handleClose}
  submitLabel="Create Contact"
  isSubmitting={isLoading}
  isValid={!hasErrors}
/>
```

---

## Usage Examples

### Basic Modal

```typescript
export function MyModal({ isOpen, onClose }: ModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="My Modal"
      icon={<Plus className="w-5 h-5" />}
    >
      <p>Modal content goes here</p>
    </Modal>
  )
}
```

### Modal with Form

```typescript
import { Modal, ModalFormActions } from '../components/Modal'
import { useForm } from '../lib/form-utils'

export function AddContactModal({ isOpen, onClose }: ModalProps) {
  const form = useForm({
    initialValues: { firstName: '', lastName: '' },
    validate: (values) => ({ /* ... */ }),
    onSubmit: async (values) => { /* ... */ },
    onSuccess: () => {
      form.reset()
      onClose()
    },
  })

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Contact"
      icon={<Plus className="w-5 h-5" />}
      footer={
        <ModalFormActions
          onCancel={onClose}
          submitLabel="Add Contact"
          isSubmitting={form.isSubmitting}
          isValid={form.isValid}
        />
      }
    >
      <form onSubmit={form.handleSubmit} className="space-y-4">
        <div>
          <input
            value={form.values.firstName}
            onChange={(e) => form.setFieldValue('firstName', e.target.value)}
            placeholder="First Name"
            className="w-full border rounded px-3 py-2"
          />
          {form.errors.firstName && (
            <span className="text-red-500 text-sm">{form.errors.firstName}</span>
          )}
        </div>

        <div>
          <input
            value={form.values.lastName}
            onChange={(e) => form.setFieldValue('lastName', e.target.value)}
            placeholder="Last Name"
            className="w-full border rounded px-3 py-2"
          />
          {form.errors.lastName && (
            <span className="text-red-500 text-sm">{form.errors.lastName}</span>
          )}
        </div>
      </form>
    </Modal>
  )
}
```

### Confirmation Modal

```typescript
export function ConfirmDialog({ isOpen, onClose, onConfirm }: ConfirmProps) {
  const [isLoading, setIsLoading] = useState(false)

  const handleConfirm = async () => {
    setIsLoading(true)
    try {
      await onConfirm()
      onClose()
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Confirm Action"
      icon={<AlertCircle className="w-5 h-5 text-yellow-500" />}
      size="sm"
      footer={
        <ModalActions>
          <button onClick={onClose} className="px-4 py-2 bg-gray-200 rounded">
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isLoading}
            className="px-4 py-2 bg-red-600 text-white rounded"
          >
            {isLoading ? 'Deleting...' : 'Delete'}
          </button>
        </ModalActions>
      }
    >
      <p>Are you sure you want to delete this item?</p>
      <p className="text-gray-600 text-sm mt-2">This action cannot be undone.</p>
    </Modal>
  )
}
```

### Large Form Modal

```typescript
export function EditProfileModal({ isOpen, onClose }: ModalProps) {
  const form = useForm({
    initialValues: { /* ... */ },
    // ... config
  })

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Profile"
      size="lg"  // Larger modal
      footer={
        <ModalFormActions
          onCancel={onClose}
          submitLabel="Save Changes"
          isSubmitting={form.isSubmitting}
        />
      }
    >
      <form onSubmit={form.handleSubmit} className="space-y-6">
        {/* Multiple form sections */}
      </form>
    </Modal>
  )
}
```

### Custom Footer

```typescript
<Modal
  isOpen={isOpen}
  onClose={onClose}
  title="Payment"
  footer={
    <div className="flex justify-between items-center">
      <span className="text-gray-600">Total: $99.99</span>
      <ModalActions>
        <button>Cancel</button>
        <button className="bg-green-600">Pay Now</button>
      </ModalActions>
    </div>
  }
>
  {/* Modal content */}
</Modal>
```

---

## API Reference

### Modal Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `isOpen` | boolean | - | Whether modal is visible |
| `onClose` | () => void | - | Called when user closes modal |
| `title` | string | - | Header title text |
| `icon` | ReactNode | undefined | Optional icon in header |
| `children` | ReactNode | - | Modal content |
| `footer` | ReactNode | undefined | Optional footer area |
| `size` | 'sm' \| 'md' \| 'lg' | 'md' | Modal width |
| `closeOnBackdropClick` | boolean | true | Allow backdrop click to close |
| `closeLabel` | string | 'Close' | Aria-label for close button |
| `className` | string | undefined | Custom container class |
| `form` | string | undefined | Form ID (for external submit) |
| `showCloseButton` | boolean | true | Show X close button |

### ModalActions Props

| Prop | Type | Description |
|------|------|-------------|
| `children` | ReactNode | Action buttons |

### ModalFormActions Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `onCancel` | () => void | - | Cancel button handler |
| `submitLabel` | string | 'Save' | Submit button text |
| `cancelLabel` | string | 'Cancel' | Cancel button text |
| `isSubmitting` | boolean | false | Show loading state |
| `isValid` | boolean | true | Disable submit if invalid |

---

## Features

### Keyboard Shortcuts

- **Escape**: Close modal (can be disabled with `closeOnBackdropClick={false}`)

### Backdrop Interaction

- Click on backdrop closes modal (can be disabled)
- Only closes when clicking exactly on backdrop, not on modal content

### Accessibility

- `role="dialog"` on modal
- `aria-modal="true"`
- `aria-labelledby="modal-title"` links title
- Escape key support
- Focus management
- Close button with proper aria-label

### Dark Mode

All components support light and dark modes:
- Text colors adjust
- Backgrounds adjust
- Borders adjust
- Hover states adjust

### Scrolling

- Content area scrolls if longer than viewport
- Header and footer stay fixed
- Body scroll disabled when modal open (restored on close)

---

## Best Practices

### 1. Always Provide Title

```typescript
// ✅ Good
<Modal title="Add Contact" />

// ❌ Bad - confusing without title
<Modal title="" />
```

### 2. Use Appropriate Size

```typescript
// ✅ Good - simple confirmation
<Modal size="sm" title="Delete?" />

// ✅ Good - form with multiple fields
<Modal size="lg" title="Edit Settings" />

// ❌ Bad - large modal for simple content
<Modal size="lg" title="Delete?" />
```

### 3. Use Icons for Visual Clarity

```typescript
// ✅ Good - icon shows intent
<Modal
  icon={<Trash2 className="w-5 h-5 text-red-500" />}
  title="Delete Item"
/>

// ✅ Good - plus icon for creation
<Modal
  icon={<Plus className="w-5 h-5" />}
  title="Add Contact"
/>
```

### 4. Disable Backdrop Click for Forms

```typescript
// ✅ Good - prevent accidental close
<Modal
  closeOnBackdropClick={false}
  title="Edit Profile"
>
  <form>...</form>
</Modal>

// ⚠️ Caution - easy to lose data
<Modal
  closeOnBackdropClick={true}
  title="Edit Profile"
>
  <form>...</form>
</Modal>
```

### 5. Provide Footer for Actions

```typescript
// ✅ Good - clear action buttons
<Modal
  footer={<ModalFormActions onCancel={onClose} />}
>
  {/* content */}
</Modal>

// ⚠️ Less obvious how to submit/cancel
<Modal>
  {/* content */}
</Modal>
```

### 6. Use ModalFormActions for Forms

```typescript
// ✅ Good - consistent form styling
<Modal
  footer={
    <ModalFormActions
      onCancel={onClose}
      isSubmitting={form.isSubmitting}
      isValid={form.isValid}
    />
  }
>
  <form onSubmit={form.handleSubmit}>...</form>
</Modal>

// Less ideal - custom button styling
<Modal
  footer={
    <button>Save</button>
  }
>
  <form>...</form>
</Modal>
```

---

## Migration Guide

### Before: Repeated Modal Structure

```typescript
export function AddContactModal({ isOpen, onClose }: ModalProps) {
  return isOpen ? (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <Plus className="w-5 h-5 text-blue-600" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Add Contact
            </h2>
          </div>
          <button onClick={onClose} className="text-gray-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <form>...</form>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 dark:border-gray-700 p-6">
          <div className="flex justify-end gap-3">
            <button onClick={onClose}>Cancel</button>
            <button type="submit">Save</button>
          </div>
        </div>
      </div>
    </div>
  ) : null
}
```

### After: Using Modal Component

```typescript
import { Modal, ModalFormActions } from '../components/Modal'
import { useForm } from '../lib/form-utils'

export function AddContactModal({ isOpen, onClose }: ModalProps) {
  const form = useForm({ /* config */ })

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Contact"
      icon={<Plus className="w-5 h-5" />}
      footer={
        <ModalFormActions
          onCancel={onClose}
          isSubmitting={form.isSubmitting}
        />
      }
    >
      <form onSubmit={form.handleSubmit}>
        {/* Just the form, no wrapper JSX */}
      </form>
    </Modal>
  )
}
```

**Reduction**: 60 lines → 20 lines (67% less code)

---

## Common Patterns

### Form Modal

Standard pattern for modals that contain forms:

1. Use `Modal` component
2. Provide form as children
3. Use `ModalFormActions` for footer
4. Integrate with `useForm` hook

```typescript
<Modal
  isOpen={isOpen}
  onClose={onClose}
  title="Modal Title"
  footer={<ModalFormActions onCancel={onClose} />}
>
  <form onSubmit={handleSubmit}>
    {/* form fields */}
  </form>
</Modal>
```

### Confirmation Modal

Pattern for confirmation/delete dialogs:

1. Use smaller size (`sm`)
2. Use warning/alert icon
3. Custom footer with colored buttons
4. Disable backdrop click

```typescript
<Modal
  isOpen={isOpen}
  onClose={onClose}
  title="Confirm Delete"
  icon={<AlertCircle className="text-red-500" />}
  size="sm"
  closeOnBackdropClick={false}
  footer={
    <ModalActions>
      <button onClick={onClose}>Cancel</button>
      <button className="bg-red-600" onClick={handleDelete}>
        Delete
      </button>
    </ModalActions>
  }
>
  <p>This action cannot be undone.</p>
</Modal>
```

### Multi-Step Modal

Pattern for modals with steps/tabs:

```typescript
const [step, setStep] = useState(1)

<Modal
  isOpen={isOpen}
  onClose={onClose}
  title={`Step ${step} of 3`}
  footer={
    <ModalActions>
      <button onClick={() => setStep(step - 1)} disabled={step === 1}>
        Back
      </button>
      <button onClick={() => setStep(step + 1)} disabled={step === 3}>
        Next
      </button>
    </ModalActions>
  }
>
  {step === 1 && <Step1 />}
  {step === 2 && <Step2 />}
  {step === 3 && <Step3 />}
</Modal>
```

---

## Troubleshooting

### Modal Not Closing

**Problem**: Escape key or backdrop click doesn't close modal

**Solution**: Check that `onClose` is properly updating parent state

```typescript
// ✅ Correct
const [isOpen, setIsOpen] = useState(false)
<Modal isOpen={isOpen} onClose={() => setIsOpen(false)} />

// ❌ Wrong - onClose doesn't update state
<Modal isOpen={true} onClose={() => {}} />
```

### Content Not Scrolling

**Problem**: Long content doesn't scroll inside modal

**Solution**: Modal automatically scrolls content - check z-index issues

```typescript
// The modal's content div is flex with overflow-y-auto
// If content doesn't scroll, may be CSS conflict
```

### Keyboard Shortcut Not Working

**Problem**: Escape key doesn't close modal

**Solution**: Check `closeOnBackdropClick` and that modal `isOpen` is true

```typescript
// ✅ Default behavior
<Modal isOpen={isOpen} onClose={handleClose} />

// Explicitly enable
<Modal isOpen={isOpen} onClose={handleClose} closeOnBackdropClick={true} />
```

---

## Related Files

- `components/Modal.tsx` - Modal component implementation
- `MODAL_PATTERNS.md` - This guide
- `FORM_PATTERNS.md` - Form handling guide
- Example usage: `components/AddContactModal.tsx`, `components/CreateSalesBlockModal.tsx`

