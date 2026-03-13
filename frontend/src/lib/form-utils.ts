/** @id salesblock.lib.core.form-utils */
/**
 * Reusable form hooks and utilities for consistent form handling across modals
 *
 * Provides:
 * - useForm hook: Form state management, validation, submission
 * - useFormField hook: Individual field management
 * - Form validation utilities
 */

import { useState, useCallback } from 'react'

/**
 * Form field error map
 */
export interface FormErrors {
  [fieldName: string]: string | undefined
}

/**
 * Form validator function signature
 */
export type FormValidator<T> = (values: T) => FormErrors | Promise<FormErrors>

/**
 * Form submit handler signature
 */
export type FormSubmitHandler<T> = (values: T) => Promise<void> | void

/**
 * Configuration for useForm hook
 */
export interface UseFormConfig<T> {
  initialValues: T
  onSubmit: FormSubmitHandler<T>
  validate?: FormValidator<T>
  onSuccess?: () => void
}

/**
 * Return type of useForm hook
 */
export interface UseFormResult<T> {
  values: T
  errors: FormErrors
  isSubmitting: boolean
  isValid: boolean

  // Field management
  setFieldValue: <K extends keyof T>(field: K, value: T[K]) => void
  setFieldError: (field: keyof T, error: string | undefined) => void
  resetField: (field: keyof T) => void

  // Form management
  handleSubmit: (e: React.FormEvent) => Promise<void>
  reset: () => void
}

/**
 * React hook for managing form state with validation
 *
 * Simplifies form handling by providing:
 * - Automatic validation
 * - Error tracking
 * - Submit handling with loading state
 * - Field value management
 * - Reset functionality
 *
 * @example
 * ```typescript
 * const { values, errors, handleSubmit, setFieldValue } = useForm({
 *   initialValues: { email: '', password: '' },
 *   validate: (values) => {
 *     const errors: FormErrors = {}
 *     if (!values.email) errors.email = 'Email required'
 *     if (!values.password) errors.password = 'Password required'
 *     return errors
 *   },
 *   onSubmit: async (values) => {
 *     await api.submit(values)
 *   },
 *   onSuccess: () => alert('Success!')
 * })
 * ```
 */
export function useForm<T extends Record<string, any>>({
  initialValues,
  onSubmit,
  validate,
  onSuccess,
}: UseFormConfig<T>): UseFormResult<T> {
  const [values, setValues] = useState<T>(initialValues)
  const [errors, setErrors] = useState<FormErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  /**
   * Set a single field value
   */
  const setFieldValue = useCallback(
    <K extends keyof T>(field: K, value: T[K]) => {
      setValues((prev) => ({
        ...prev,
        [field]: value,
      }))

      // Clear error when user starts editing
      if (errors[field as string]) {
        setErrors((prev) => ({
          ...prev,
          [field as string]: undefined,
        }))
      }
    },
    [errors]
  )

  /**
   * Set error for a specific field
   */
  const setFieldError = useCallback((field: keyof T, error: string | undefined) => {
    setErrors((prev) => ({
      ...prev,
      [field as string]: error,
    }))
  }, [])

  /**
   * Reset a single field to initial value
   */
  const resetField = useCallback((field: keyof T) => {
    setValues((prev) => ({
      ...prev,
      [field]: initialValues[field],
    }))
    setErrors((prev) => ({
      ...prev,
      [field as string]: undefined,
    }))
  }, [initialValues])

  /**
   * Reset entire form to initial state
   */
  const reset = useCallback(() => {
    setValues(initialValues)
    setErrors({})
  }, [initialValues])


  /**
   * Validate form values
   */
  const validateForm = useCallback(async (): Promise<FormErrors> => {
    if (!validate) return {}

    try {
      const validationErrors = await validate(values)
      return validationErrors
    } catch (error) {
      console.error('Form validation error:', error)
      return {}
    }
  }, [validate, values])

  /**
   * Handle form submission
   */
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()

      // Validate
      const validationErrors = await validateForm()
      setErrors(validationErrors)

      // Exit if validation failed
      if (Object.keys(validationErrors).length > 0) {
        return
      }

      // Submit
      setIsSubmitting(true)
      try {
        await onSubmit(values)
        onSuccess?.()
        reset()
      } catch (error) {
        console.error('Form submission error:', error)
        setErrors({
          _submit: error instanceof Error ? error.message : 'Form submission failed',
        })
      } finally {
        setIsSubmitting(false)
      }
    },
    [values, validateForm, onSubmit, onSuccess, reset]
  )

  /**
   * Check if form is valid
   */
  const isValid = Object.keys(errors).length === 0 && Object.keys(values).length > 0

  return {
    values,
    errors,
    isSubmitting,
    isValid,
    setFieldValue,
    setFieldError,
    resetField,
    handleSubmit,
    reset,
  }
}

/**
 * Utility function for common email validation
 */
export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * Utility function for URL validation
 */
export const validateUrl = (url: string): boolean => {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

/**
 * Utility function to create a field error object
 */
export const createFieldError = (field: string, message: string): FormErrors => ({
  [field]: message,
})

/**
 * Utility to merge error objects
 */
export const mergeErrors = (...errorObjects: FormErrors[]): FormErrors => {
  return Object.assign({}, ...errorObjects)
}

/**
 * Custom hook for array-type form fields (like custom fields, list items, etc.)
 *
 * Provides add, remove, and update operations for array fields
 */
export function useArrayField<T>(initialValue: T[] = []) {
  const [items, setItems] = useState<T[]>(initialValue)

  const addItem = useCallback((item: T) => {
    setItems((prev) => [...prev, item])
  }, [])

  const removeItem = useCallback((index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const updateItem = useCallback((index: number, item: T) => {
    setItems((prev) => {
      const next = [...prev]
      next[index] = item
      return next
    })
  }, [])

  const updateItemField = useCallback(<K extends keyof T>(index: number, field: K, value: T[K]) => {
    setItems((prev) => {
      const next = [...prev]
      next[index] = {
        ...next[index],
        [field]: value,
      }
      return next
    })
  }, [])

  const reset = useCallback(() => {
    setItems(initialValue)
  }, [initialValue])

  return {
    items,
    setItems,
    addItem,
    removeItem,
    updateItem,
    updateItemField,
    reset,
  }
}
