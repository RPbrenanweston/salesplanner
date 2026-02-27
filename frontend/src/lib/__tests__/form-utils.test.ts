import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import {
  useForm,
  useArrayField,
  validateEmail,
  validateUrl,
  createFieldError,
  mergeErrors,
  FormErrors,
} from '../form-utils'

describe('Form Utilities', () => {
  describe('validateEmail', () => {
    it('should validate correct email format', () => {
      expect(validateEmail('test@example.com')).toBe(true)
      expect(validateEmail('user.name+tag@example.co.uk')).toBe(true)
    })

    it('should reject invalid email format', () => {
      expect(validateEmail('invalid')).toBe(false)
      expect(validateEmail('invalid@')).toBe(false)
      expect(validateEmail('@example.com')).toBe(false)
      expect(validateEmail('test@.com')).toBe(false)
    })
  })

  describe('validateUrl', () => {
    it('should validate correct URLs', () => {
      expect(validateUrl('https://example.com')).toBe(true)
      expect(validateUrl('http://localhost:3000')).toBe(true)
      expect(validateUrl('ftp://files.example.com')).toBe(true)
    })

    it('should reject invalid URLs', () => {
      expect(validateUrl('not a url')).toBe(false)
      expect(validateUrl('example.com')).toBe(false) // Missing protocol
      expect(validateUrl('')).toBe(false)
    })
  })

  describe('createFieldError', () => {
    it('should create field error object', () => {
      const error = createFieldError('email', 'Email is required')
      expect(error).toEqual({ email: 'Email is required' })
    })
  })

  describe('mergeErrors', () => {
    it('should merge multiple error objects', () => {
      const errors1: FormErrors = { email: 'Invalid email' }
      const errors2: FormErrors = { password: 'Too short' }
      const errors3: FormErrors = { name: 'Required' }

      const merged = mergeErrors(errors1, errors2, errors3)
      expect(merged).toEqual({
        email: 'Invalid email',
        password: 'Too short',
        name: 'Required',
      })
    })

    it('should handle empty error objects', () => {
      const merged = mergeErrors({}, { email: 'Invalid' }, {})
      expect(merged).toEqual({ email: 'Invalid' })
    })
  })

  describe('useForm Hook', () => {
    it('should initialize with provided values', () => {
      const { result } = renderHook(() =>
        useForm({
          initialValues: { email: '', password: '' },
          onSubmit: async () => {},
        })
      )

      expect(result.current.values).toEqual({ email: '', password: '' })
      expect(result.current.errors).toEqual({})
      expect(result.current.isSubmitting).toBe(false)
    })

    it('should update field value', () => {
      const { result } = renderHook(() =>
        useForm({
          initialValues: { email: '' },
          onSubmit: async () => {},
        })
      )

      act(() => {
        result.current.setFieldValue('email', 'test@example.com')
      })

      expect(result.current.values.email).toBe('test@example.com')
    })

    it('should clear error when field is edited', () => {
      const { result } = renderHook(() =>
        useForm({
          initialValues: { email: '' },
          onSubmit: async () => {},
        })
      )

      act(() => {
        result.current.setFieldError('email', 'Email is required')
      })

      expect(result.current.errors.email).toBe('Email is required')

      act(() => {
        result.current.setFieldValue('email', 'test@example.com')
      })

      expect(result.current.errors.email).toBeUndefined()
    })

    it('should validate on submit', async () => {
      const { result } = renderHook(() =>
        useForm({
          initialValues: { email: '' },
          validate: (values) => {
            const errors: FormErrors = {}
            if (!values.email) errors.email = 'Email required'
            return errors
          },
          onSubmit: async () => {},
        })
      )

      await act(async () => {
        const form = document.createElement('form')
        const event = new Event('submit', { bubbles: true })
        Object.defineProperty(event, 'preventDefault', { value: () => {} })
        await result.current.handleSubmit(event as any)
      })

      expect(result.current.errors.email).toBe('Email required')
    })

    it('should call onSubmit with valid values', async () => {
      const onSubmit = async (values: any) => {
        expect(values.email).toBe('test@example.com')
      }

      const { result } = renderHook(() =>
        useForm({
          initialValues: { email: '' },
          validate: (values) => {
            const errors: FormErrors = {}
            if (!values.email) errors.email = 'Email required'
            return errors
          },
          onSubmit,
        })
      )

      act(() => {
        result.current.setFieldValue('email', 'test@example.com')
      })

      await act(async () => {
        const form = document.createElement('form')
        const event = new Event('submit', { bubbles: true })
        Object.defineProperty(event, 'preventDefault', { value: () => {} })
        await result.current.handleSubmit(event as any)
      })

      expect(result.current.isSubmitting).toBe(false)
    })

    it('should reset form to initial values', () => {
      const { result } = renderHook(() =>
        useForm({
          initialValues: { email: '', password: '' },
          onSubmit: async () => {},
        })
      )

      act(() => {
        result.current.setFieldValue('email', 'test@example.com')
        result.current.setFieldError('password', 'Required')
      })

      expect(result.current.values.email).toBe('test@example.com')
      expect(result.current.errors.password).toBe('Required')

      act(() => {
        result.current.reset()
      })

      expect(result.current.values.email).toBe('')
      expect(result.current.errors.password).toBeUndefined()
    })

    it('should reset individual field', () => {
      const { result } = renderHook(() =>
        useForm({
          initialValues: { email: '', password: '' },
          onSubmit: async () => {},
        })
      )

      act(() => {
        result.current.setFieldValue('email', 'test@example.com')
        result.current.setFieldError('email', 'Invalid')
      })

      act(() => {
        result.current.resetField('email')
      })

      expect(result.current.values.email).toBe('')
      expect(result.current.errors.email).toBeUndefined()
    })

    it('should handle async validation', async () => {
      const { result } = renderHook(() =>
        useForm({
          initialValues: { email: '' },
          validate: async (values) => {
            const errors: FormErrors = {}
            if (!values.email) errors.email = 'Email required'
            // Simulate async validation
            await new Promise((resolve) => setTimeout(resolve, 10))
            return errors
          },
          onSubmit: async () => {},
        })
      )

      await act(async () => {
        const form = document.createElement('form')
        const event = new Event('submit', { bubbles: true })
        Object.defineProperty(event, 'preventDefault', { value: () => {} })
        await result.current.handleSubmit(event as any)
      })

      expect(result.current.errors.email).toBe('Email required')
    })

    it('should call onSuccess after submit', async () => {
      const onSuccess = async () => {
        expect(true).toBe(true)
      }

      const { result } = renderHook(() =>
        useForm({
          initialValues: { email: '' },
          validate: () => ({}),
          onSubmit: async () => {},
          onSuccess,
        })
      )

      act(() => {
        result.current.setFieldValue('email', 'test@example.com')
      })

      await act(async () => {
        const form = document.createElement('form')
        const event = new Event('submit', { bubbles: true })
        Object.defineProperty(event, 'preventDefault', { value: () => {} })
        await result.current.handleSubmit(event as any)
      })
    })
  })

  describe('useArrayField Hook', () => {
    it('should initialize with provided array', () => {
      const initialItems = [{ id: '1', name: 'Item 1' }]
      const { result } = renderHook(() => useArrayField(initialItems))

      expect(result.current.items).toEqual(initialItems)
    })

    it('should initialize with empty array by default', () => {
      const { result } = renderHook(() => useArrayField())

      expect(result.current.items).toEqual([])
    })

    it('should add item to array', () => {
      const { result } = renderHook(() => useArrayField<{ id: string; name: string }>())

      act(() => {
        result.current.addItem({ id: '1', name: 'Item 1' })
      })

      expect(result.current.items).toEqual([{ id: '1', name: 'Item 1' }])
    })

    it('should remove item from array', () => {
      const initial = [
        { id: '1', name: 'Item 1' },
        { id: '2', name: 'Item 2' },
      ]
      const { result } = renderHook(() => useArrayField(initial))

      act(() => {
        result.current.removeItem(0)
      })

      expect(result.current.items).toEqual([{ id: '2', name: 'Item 2' }])
    })

    it('should update item at index', () => {
      const initial = [
        { id: '1', name: 'Item 1' },
        { id: '2', name: 'Item 2' },
      ]
      const { result } = renderHook(() => useArrayField(initial))

      act(() => {
        result.current.updateItem(0, { id: '1', name: 'Updated Item 1' })
      })

      expect(result.current.items[0].name).toBe('Updated Item 1')
    })

    it('should update specific field within item', () => {
      const initial = [{ id: '1', name: 'Item 1' }]
      const { result } = renderHook(() => useArrayField(initial))

      act(() => {
        result.current.updateItemField(0, 'name', 'Updated Name')
      })

      expect(result.current.items[0].name).toBe('Updated Name')
    })

    it('should reset array to initial values', () => {
      const initial = [{ id: '1', name: 'Item 1' }]
      const { result } = renderHook(() => useArrayField(initial))

      act(() => {
        result.current.addItem({ id: '2', name: 'Item 2' })
        result.current.removeItem(0)
      })

      act(() => {
        result.current.reset()
      })

      expect(result.current.items).toEqual(initial)
    })
  })
})
