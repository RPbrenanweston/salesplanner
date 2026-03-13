/** @id salesblock.lib.core.error-logger */

/**
 * Centralized error logging with Sentry-ready hooks.
 *
 * All errors flow through here. To add Sentry/LogRocket:
 *   1. Install the SDK
 *   2. Call Sentry.captureException(err) in the TODO block below
 */

export function logError(error: unknown, context: string): void {
  const message = error instanceof Error ? error.message : String(error)
  const stack = error instanceof Error ? error.stack : undefined

  console.error(`[${context}]`, message, stack ?? '')

  // TODO: Integrate Sentry/LogRocket when configured
  // if (typeof window !== 'undefined' && window.__SENTRY__) {
  //   Sentry.captureException(error instanceof Error ? error : new Error(message), {
  //     tags: { context },
  //   })
  // }
}

export function logWarning(message: string, context: string, data?: unknown): void {
  console.warn(`[${context}]`, message, data ?? '')
}
