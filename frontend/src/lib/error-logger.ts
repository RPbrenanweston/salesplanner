/** @id salesblock.lib.core.error-logger */

/**
 * Centralized error logging — routes to Sentry when initialized, console otherwise.
 *
 * Sentry init lives in main.tsx (gated on VITE_SENTRY_DSN).
 * getClient() returns undefined when Sentry is not initialized, so no-ops cleanly without a DSN.
 */

import * as Sentry from '@sentry/react'

export function logError(error: unknown, context: string): void {
  const message = error instanceof Error ? error.message : String(error)
  const stack = error instanceof Error ? error.stack : undefined

  console.error(`[${context}]`, message, stack ?? '')

  // Forward to Sentry when initialized — no-ops without VITE_SENTRY_DSN
  if (Sentry.getClient()) {
    Sentry.captureException(error instanceof Error ? error : new Error(message), {
      tags: { context },
    })
  }
}

export function logWarning(message: string, context: string, data?: unknown): void {
  console.warn(`[${context}]`, message, data ?? '')
}
