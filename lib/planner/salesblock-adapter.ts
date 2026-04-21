/** @id salesblock.lib.salesblock-adapter */
/**
 * Adapter layer bridging the existing `salesblocks` table schema to the
 * frontend `ProductivityBlock` interface.
 *
 * The `salesblocks` table is the source of truth in Supabase. The
 * `ProductivityBlock` type is the frontend representation used by hooks
 * and components. This module handles all mapping in both directions.
 */

import type { BlockType, BlockStatus, ProductivityBlock } from '@/types/productivity'

// ---------------------------------------------------------------------------
// Legacy salesblock row shape (matches existing `salesblocks` table)
// ---------------------------------------------------------------------------

export interface LegacySalesblock {
  id: string
  org_id: string
  list_id: string
  user_id: string
  assigned_by?: string | null
  title: string
  scheduled_start: string
  scheduled_end: string
  actual_start?: string | null
  actual_end?: string | null
  duration_minutes: number
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
  calendar_event_id?: string | null
  notes?: string | null
  created_at?: string | null
  session_type?: string | null
}

// ---------------------------------------------------------------------------
// Status mapping
// ---------------------------------------------------------------------------

const STATUS_TO_BLOCK_STATUS: Record<string, BlockStatus> = {
  scheduled: 'planned',
  in_progress: 'active',
  completed: 'completed',
  cancelled: 'skipped',
}

const BLOCK_STATUS_TO_STATUS: Record<BlockStatus, string> = {
  planned: 'scheduled',
  active: 'in_progress',
  paused: 'in_progress',
  completed: 'completed',
  skipped: 'cancelled',
}

// ---------------------------------------------------------------------------
// Block type mapping
// ---------------------------------------------------------------------------

const SESSION_TYPE_TO_BLOCK_TYPE: Record<string, BlockType> = {
  call: 'call',
  email: 'email',
  social: 'linkedin',
  meeting: 'meeting',
  research: 'research',
  admin: 'admin',
}

const BLOCK_TYPE_TO_SESSION_TYPE: Record<BlockType, string> = {
  call: 'call',
  email: 'email',
  linkedin: 'social',
  meeting: 'meeting',
  research: 'research',
  admin: 'admin',
  break: 'call', // no direct equivalent; default to call
}

// ---------------------------------------------------------------------------
// Forward mapper: salesblock row -> ProductivityBlock
// ---------------------------------------------------------------------------

export function mapSalesblockToProductivityBlock(
  sb: LegacySalesblock,
  index = 0,
): ProductivityBlock {
  const scheduledDate = sb.scheduled_start
    ? sb.scheduled_start.substring(0, 10) // extract YYYY-MM-DD
    : null

  let durationActualMs = 0
  if (sb.actual_start && sb.actual_end) {
    durationActualMs =
      new Date(sb.actual_end).getTime() - new Date(sb.actual_start).getTime()
  }

  return {
    id: sb.id,
    user_id: sb.user_id,
    org_id: sb.org_id,
    block_type: SESSION_TYPE_TO_BLOCK_TYPE[sb.session_type ?? ''] ?? 'call',
    title: sb.title,
    description: sb.notes ?? null,
    contact_id: null,
    deal_id: null,
    duration_estimate_ms: sb.duration_minutes * 60_000,
    duration_actual_ms: durationActualMs,
    status: STATUS_TO_BLOCK_STATUS[sb.status] ?? 'planned',
    scheduled_date: scheduledDate,
    start_time: sb.actual_start ?? sb.scheduled_start ?? null,
    end_time: sb.actual_end ?? sb.scheduled_end ?? null,
    sort_order: index,
    completed_at: sb.status === 'completed' ? (sb.actual_end ?? sb.created_at ?? null) : null,
    created_at: sb.created_at ?? new Date().toISOString(),
    updated_at: sb.created_at ?? new Date().toISOString(),
  }
}

// ---------------------------------------------------------------------------
// Reverse mapper: ProductivityBlock partial -> salesblock INSERT/UPDATE fields
// ---------------------------------------------------------------------------

export function mapProductivityBlockToSalesblock(
  block: Partial<ProductivityBlock>,
  userId: string,
  orgId: string,
  listId: string,
): Record<string, unknown> {
  const durationMinutes = block.duration_estimate_ms
    ? Math.round(block.duration_estimate_ms / 60_000)
    : 30

  // Build scheduled_start from scheduled_date + start_time, or just date at midnight
  let scheduledStart: string | undefined
  let scheduledEnd: string | undefined

  if (block.start_time) {
    scheduledStart = block.start_time
    scheduledEnd =
      block.end_time ??
      new Date(
        new Date(block.start_time).getTime() + durationMinutes * 60_000,
      ).toISOString()
  } else if (block.scheduled_date) {
    scheduledStart = `${block.scheduled_date}T09:00:00.000Z`
    scheduledEnd = new Date(
      new Date(scheduledStart).getTime() + durationMinutes * 60_000,
    ).toISOString()
  } else {
    const now = new Date()
    scheduledStart = now.toISOString()
    scheduledEnd = new Date(now.getTime() + durationMinutes * 60_000).toISOString()
  }

  const row: Record<string, unknown> = {
    user_id: userId,
    org_id: orgId,
    list_id: listId,
    title: block.title ?? 'Untitled block',
    scheduled_start: scheduledStart,
    scheduled_end: scheduledEnd,
    duration_minutes: durationMinutes,
    status: BLOCK_STATUS_TO_STATUS[block.status ?? 'planned'] ?? 'scheduled',
    session_type: BLOCK_TYPE_TO_SESSION_TYPE[block.block_type ?? 'call'] ?? 'call',
    notes: block.description ?? null,
  }

  return row
}

// ---------------------------------------------------------------------------
// Partial update mapper: ProductivityBlock updates -> salesblock update fields
// ---------------------------------------------------------------------------

export function mapProductivityBlockUpdatesToSalesblock(
  updates: Partial<ProductivityBlock>,
): Record<string, unknown> {
  const row: Record<string, unknown> = {}

  if (updates.title !== undefined) row.title = updates.title
  if (updates.description !== undefined) row.notes = updates.description
  if (updates.status !== undefined) {
    row.status = BLOCK_STATUS_TO_STATUS[updates.status] ?? 'scheduled'
  }
  if (updates.block_type !== undefined) {
    row.session_type = BLOCK_TYPE_TO_SESSION_TYPE[updates.block_type] ?? 'call'
  }
  if (updates.duration_estimate_ms !== undefined) {
    row.duration_minutes = Math.round(updates.duration_estimate_ms / 60_000)
  }
  if (updates.start_time !== undefined) row.actual_start = updates.start_time
  if (updates.end_time !== undefined) row.actual_end = updates.end_time
  if (updates.completed_at !== undefined) row.actual_end = updates.completed_at

  return row
}
