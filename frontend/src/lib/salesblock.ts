/**
 * SalesBlock business logic utilities
 *
 * Handles validation and state checks for SalesBlocks (outreach sessions).
 * A SalesBlock is a scheduled time period where a user works through a contact list.
 *
 * Lifecycle:
 * 1. SCHEDULED - Created, waiting for start time
 * 2. IN_PROGRESS - User has clicked "Start", actively working
 * 3. COMPLETED - User finished the session
 * 4. CANCELLED - User cancelled before completion
 */

interface SalesBlock {
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
  scheduled_start: string
}

/**
 * Check if a SalesBlock can be started by the user
 *
 * Rules:
 * - Status must be SCHEDULED (not in_progress, completed, or cancelled)
 * - Current time must be >= scheduled start time
 *
 * Use case: Determine if "Start" button should be enabled on dashboard
 *
 * @param sb - SalesBlock object with status and scheduled_start
 * @returns true if block can be started, false otherwise
 */
export const canStartBlock = (sb: SalesBlock): boolean => {
  if (sb.status !== 'scheduled') return false
  const now = new Date()
  const scheduledStart = new Date(sb.scheduled_start)
  // Can start if scheduled time is now or in the past
  return scheduledStart <= now
}
