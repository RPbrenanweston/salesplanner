/**
 * SalesBlock business logic utilities
 */

interface SalesBlock {
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
  scheduled_start: string
}

export const canStartBlock = (sb: SalesBlock): boolean => {
  if (sb.status !== 'scheduled') return false
  const now = new Date()
  const scheduledStart = new Date(sb.scheduled_start)
  // Can start if scheduled time is now or in the past
  return scheduledStart <= now
}
