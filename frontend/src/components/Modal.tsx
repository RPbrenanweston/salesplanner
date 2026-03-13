// @crumb frontend-component-modal-wrapper
// UI | modal_layout | backdrop_interaction | keyboard_accessibility | animation_state
// why: Reusable modal wrapper providing consistent modal structure, keyboard handlers, backdrop click logic, and scroll prevention across 15+ modal components
// in:isOpen:boolean,onClose callback,title:string,children:ReactNode,footer?:ReactNode,size:sm|md|lg out:Modal dialog with header/content/footer, backdrop, Escape key handling, scroll locked err:Modal renders when isOpen=false (returns null correctly),backdrop click not detected when modal nested deeply
// hazard: document.body.style.overflow set in useEffect — race condition if multiple modals mount simultaneously, last one to unmount restores scroll
// hazard: Escape key handler fires even when textarea/input focused if handler skips input check — user expects input to capture Escape for multi-step modals with escape-cancellable forms
// edge:frontend/src/components/CreateSalesBlockModal.tsx -> RELATES
// edge:frontend/src/components/LogActivityModal.tsx -> RELATES
// edge:frontend/src/components/BookMeetingModal.tsx -> RELATES
// edge:frontend/src/components/AddContactModal.tsx -> RELATES
// prompt: Use ref counter for body.overflow instead of simple set/unset — verify nested modals don't break scroll. Consider passing escapeClosesModal prop to allow forms to override default Escape behavior. Add z-index management for stacked modals.

/**
 * Reusable Modal component wrapper
 *
 * Provides consistent modal UI structure including:
 * - Backdrop with click-to-close
 * - Header with title, icon, and close button
 * - Scrollable content area
 * - Footer area for actions
 * - Consistent styling and animations
 * - Accessibility features
 *
 * Eliminates repetition across 15+ modal components
 */
import React, { ReactNode, useCallback, useEffect } from 'react'
import { X } from 'lucide-react'

interface ModalProps {
  /** Whether modal is open */
  isOpen: boolean

  /** Called when user attempts to close modal */
  onClose: () => void

  /** Modal title (displayed in header) */
  title: string

  /** Optional icon component for header */
  icon?: React.ReactNode

  /** Modal content - usually a form */
  children: ReactNode

  /** Optional footer actions (buttons, etc.) */
  footer?: ReactNode

  /** Size variant */
  size?: 'sm' | 'md' | 'lg'

  /** Whether backdrop click closes modal */
  closeOnBackdropClick?: boolean

  /** Close button label (for accessibility) */
  closeLabel?: string

  /** Custom className for modal container */
  className?: string

  /** Whether to show close button */
  showCloseButton?: boolean
}

/**
 * Reusable modal component with consistent styling and behavior
 *
 * @example
 * ```tsx
 * <Modal
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   title="Add Contact"
 *   icon={<Plus className="w-5 h-5" />}
 * >
 *   <form>
 *     <input type="text" placeholder="Name" />
 *     <button type="submit">Save</button>
 *   </form>
 * </Modal>
 * ```
 */
export function Modal({
  isOpen,
  onClose,
  title,
  icon,
  children,
  footer,
  size = 'md',
  closeOnBackdropClick = true,
  closeLabel = 'Close',
  className,
  showCloseButton = true,
}: ModalProps) {
  // Handle escape key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, onClose])

  // Handle backdrop click
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      // Only close if clicking exactly on backdrop, not on modal
      if (e.target === e.currentTarget && closeOnBackdropClick) {
        onClose()
      }
    },
    [closeOnBackdropClick, onClose]
  )

  if (!isOpen) return null

  // Size variants
  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-2xl',
  }

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={handleBackdropClick}
      role="presentation"
    >
      <div
        className={`
          bg-white dark:bg-gray-800
          rounded-lg shadow-xl
          w-full mx-4
          ${sizeClasses[size]}
          max-h-[90vh] flex flex-col
          ${className || ''}
        `}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            {icon && <div className="text-blue-600 dark:text-blue-400">{icon}</div>}
            <h2
              id="modal-title"
              className="text-xl font-bold text-gray-900 dark:text-white"
            >
              {title}
            </h2>
          </div>

          {showCloseButton && (
            <button
              onClick={onClose}
              aria-label={closeLabel}
              className="
                text-gray-500 hover:text-gray-700
                dark:text-gray-400 dark:hover:text-gray-200
                transition-colors
                p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded
              "
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="border-t border-gray-200 dark:border-gray-700 p-6 bg-gray-50 dark:bg-gray-900 rounded-b-lg">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Helper component for footer action buttons
 */
export function ModalActions({ children }: { children: ReactNode }) {
  return <div className="flex justify-end gap-3">{children}</div>
}

/**
 * Helper component for form-based modals
 *
 * Provides consistent styling for submit/cancel buttons
 */
export function ModalFormActions({
  onCancel,
  submitLabel = 'Save',
  cancelLabel = 'Cancel',
  isSubmitting = false,
  isValid = true,
}: {
  onCancel: () => void
  submitLabel?: string
  cancelLabel?: string
  isSubmitting?: boolean
  isValid?: boolean
}) {
  return (
    <ModalActions>
      <button
        type="button"
        onClick={onCancel}
        className="
          px-4 py-2 rounded
          bg-gray-200 dark:bg-gray-700
          text-gray-900 dark:text-white
          hover:bg-gray-300 dark:hover:bg-gray-600
          transition-colors
          disabled:opacity-50 disabled:cursor-not-allowed
        "
        disabled={isSubmitting}
      >
        {cancelLabel}
      </button>
      <button
        type="submit"
        className="
          px-4 py-2 rounded
          bg-blue-600 hover:bg-blue-700
          text-white
          transition-colors
          disabled:opacity-50 disabled:cursor-not-allowed
        "
        disabled={isSubmitting || !isValid}
      >
        {isSubmitting ? 'Saving...' : submitLabel}
      </button>
    </ModalActions>
  )
}
