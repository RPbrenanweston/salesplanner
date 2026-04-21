export function logApiError(fn: string, error: unknown, ctx?: Record<string, unknown>) {
  console.error(`[${fn}]`, error, ctx)
}
