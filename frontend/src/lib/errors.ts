/**
 * Centralized error handling and logging utilities
 *
 * Provides consistent error handling across the application with:
 * - Structured error logging
 * - Error classification (network, permission, validation, server)
 * - User-friendly error messages
 * - Error recovery suggestions
 * - Type-safe error handling
 *
 * Usage:
 *   try {
 *     const data = await fetchData()
 *   } catch (error) {
 *     logApiError('fetchData', error)
 *     throw createUserError('Failed to load data', 'Please try again.')
 *   }
 */

export enum ErrorType {
  NETWORK = 'NETWORK',
  AUTHENTICATION = 'AUTHENTICATION',
  AUTHORIZATION = 'AUTHORIZATION',
  VALIDATION = 'VALIDATION',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  SERVER = 'SERVER',
  UNKNOWN = 'UNKNOWN',
}

export interface ApplicationError {
  type: ErrorType
  message: string
  userMessage: string
  statusCode?: number
  originalError?: unknown
  context?: Record<string, unknown>
  timestamp: Date
  retryable: boolean
}

/**
 * Classify error by type
 */
export function classifyError(error: unknown): ErrorType {
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return ErrorType.NETWORK
  }

  const message = String(error)

  // Supabase PostgreSQL error codes
  if (message.includes('401') || message.includes('PGRST301')) {
    return ErrorType.AUTHENTICATION
  }
  if (message.includes('403') || message.includes('PGRST303')) {
    return ErrorType.AUTHORIZATION
  }
  if (message.includes('400') || message.includes('PGRST')) {
    return ErrorType.VALIDATION
  }
  if (message.includes('404')) {
    return ErrorType.NOT_FOUND
  }
  if (message.includes('409')) {
    return ErrorType.CONFLICT
  }
  if (message.includes('5')) {
    return ErrorType.SERVER
  }

  return ErrorType.UNKNOWN
}

/**
 * Check if error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  const type = classifyError(error)
  return [
    ErrorType.NETWORK,
    ErrorType.SERVER,
  ].includes(type)
}

/**
 * Get user-friendly error message based on error type
 */
export function getUserErrorMessage(type: ErrorType): string {
  switch (type) {
    case ErrorType.NETWORK:
      return 'Network error. Please check your connection and try again.'
    case ErrorType.AUTHENTICATION:
      return 'Authentication failed. Please sign in again.'
    case ErrorType.AUTHORIZATION:
      return 'You do not have permission to perform this action.'
    case ErrorType.VALIDATION:
      return 'Invalid input. Please check your data and try again.'
    case ErrorType.NOT_FOUND:
      return 'The requested resource was not found.'
    case ErrorType.CONFLICT:
      return 'This resource already exists. Please use a different name.'
    case ErrorType.SERVER:
      return 'Server error. Please try again later.'
    case ErrorType.UNKNOWN:
      return 'An unexpected error occurred. Please try again.'
  }
}

/**
 * Create a structured application error
 */
export function createApplicationError(
  message: string,
  userMessage?: string,
  context?: Record<string, unknown>
): ApplicationError {
  const type = classifyError(new Error(message))

  return {
    type,
    message,
    userMessage: userMessage || getUserErrorMessage(type),
    context,
    timestamp: new Date(),
    retryable: isRetryableError(new Error(message)),
  }
}

/**
 * Create a user-facing error message
 */
export function createUserError(
  message: string,
  suggestion?: string
): Error {
  const full = suggestion ? `${message} ${suggestion}` : message
  return new Error(full)
}

/**
 * Log API error with structure and context
 *
 * Best for:
 * - Data fetching errors in query functions
 * - API call failures
 * - Supabase errors
 */
export function logApiError(
  operation: string,
  error: unknown,
  context?: Record<string, unknown>
): void {
  const appError = createApplicationError(
    `${operation} failed`,
    undefined,
    context
  )

  console.error(
    `[${appError.type}] ${operation}:`,
    {
      message: appError.message,
      userMessage: appError.userMessage,
      context: appError.context,
      originalError: error,
      retryable: appError.retryable,
      timestamp: appError.timestamp.toISOString(),
    }
  )
}

/**
 * Log component error with stack trace
 *
 * Best for:
 * - Render errors
 * - Component lifecycle errors
 * - State management errors
 */
export function logComponentError(
  component: string,
  error: unknown,
  context?: Record<string, unknown>
): void {
  console.error(
    `[COMPONENT] ${component}:`,
    {
      error,
      context,
      timestamp: new Date().toISOString(),
      stack: error instanceof Error ? error.stack : undefined,
    }
  )
}

/**
 * Log warning message
 *
 * Best for:
 * - Unexpected but recoverable conditions
 * - Deprecation warnings
 * - Performance warnings
 */
export function logWarning(
  category: string,
  message: string,
  context?: Record<string, unknown>
): void {
  console.warn(
    `[${category}] ${message}`,
    context || {}
  )
}

/**
 * Log info message
 *
 * Best for:
 * - User actions (create, update, delete)
 * - Feature usage
 * - Important state changes
 */
export function logInfo(
  category: string,
  message: string,
  context?: Record<string, unknown>
): void {
  console.log(
    `[${category}] ${message}`,
    context || {}
  )
}

/**
 * Assert condition and throw error if false
 *
 * Usage:
 *   assertError(user !== null, 'User not found')
 */
export function assertError(
  condition: boolean,
  message: string
): asserts condition {
  if (!condition) {
    throw createUserError(message)
  }
}
