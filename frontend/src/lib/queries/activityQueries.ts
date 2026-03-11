import { supabase } from '../supabase'
import type { Activity, ProgressFlags } from '../../types/domain'
import type { ActivityOutcome } from '../../types/enums'

/**
 * Log an activity (disposition) for a contact during a session.
 * If outcome is 'connect' and progressFlags provided, saves connected flow data.
 * If progressFlags.meeting_booked is true, upgrades outcome to 'meeting_booked'.
 */
export async function logActivity(params: {
  orgId: string
  contactId: string
  userId: string
  salesblockId: string
  type: Activity['type']
  outcome: ActivityOutcome
  notes?: string
  durationSeconds?: number
  progressFlags?: ProgressFlags | null
}): Promise<Activity> {
  // Auto-upgrade: if connected flow says meeting_booked, escalate outcome
  let finalOutcome: string = params.outcome
  if (params.progressFlags?.meeting_booked) {
    finalOutcome = 'meeting_booked'
  }

  const { data, error } = await supabase
    .from('activities')
    .insert({
      org_id: params.orgId,
      contact_id: params.contactId,
      user_id: params.userId,
      salesblock_id: params.salesblockId,
      type: params.type,
      outcome: finalOutcome,
      notes: params.notes || null,
      duration_seconds: params.durationSeconds || null,
      progress_flags: params.progressFlags || null,
    })
    .select()
    .single()

  if (error) throw error
  return data as Activity
}

/** Get session stats (dials, connects, meetings) for a salesblock */
export async function getSessionStats(salesblockId: string) {
  const { data, error } = await supabase
    .from('activities')
    .select('outcome, progress_flags')
    .eq('salesblock_id', salesblockId)

  if (error) throw error

  const activities = data || []
  const totalDials = activities.length
  const connects = activities.filter(
    (a) => a.outcome === 'connect' || a.outcome === 'meeting_booked'
  ).length
  const meetings = activities.filter(
    (a) => a.outcome === 'meeting_booked'
  ).length

  // Progress flag aggregates for 7-rate funnel
  const withFlags = activities.filter((a) => a.progress_flags)
  const intros = withFlags.filter((a) => a.progress_flags?.intro_given).length
  const conversations = withFlags.filter(
    (a) => a.progress_flags?.conversation_held
  ).length
  const asks = withFlags.filter(
    (a) => a.progress_flags?.asked_for_meeting
  ).length

  return {
    totalDials,
    connects,
    meetings,
    intros,
    conversations,
    asks,
  }
}

/** Get activity history for a contact (for History tab) */
export async function getContactHistory(
  contactId: string,
  limit = 20
): Promise<Activity[]> {
  const { data, error } = await supabase
    .from('activities')
    .select('*')
    .eq('contact_id', contactId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return (data || []) as Activity[]
}

/** Get cadence info for a contact (attempt count + last contact date) */
export async function getContactCadence(contactId: string) {
  const { data, error } = await supabase
    .from('activities')
    .select('created_at, type')
    .eq('contact_id', contactId)
    .eq('type', 'call')
    .order('created_at', { ascending: false })

  if (error) throw error

  const callActivities = data || []
  const attemptCount = callActivities.length
  const lastContactDate = callActivities[0]?.created_at || null
  const daysSinceLastContact = lastContactDate
    ? Math.floor(
        (Date.now() - new Date(lastContactDate).getTime()) / (1000 * 60 * 60 * 24)
      )
    : null

  return {
    attemptCount,
    maxAttempts: 7,
    lastContactDate,
    daysSinceLastContact,
    isLowPriority: attemptCount >= 7,
  }
}
