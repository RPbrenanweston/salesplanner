/** @id salesblock.lib.core.error-logger */
export function logError(error: Error, context: string): void {
  console.error(`[${context}]`, error.message, error.stack)
  // TODO: Send to Sentry/LogRocket if configured
}
