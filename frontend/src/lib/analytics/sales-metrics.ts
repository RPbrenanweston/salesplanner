/**
 * SalesBlock-specific aggregate metrics.
 *
 * Computes sales performance metrics from contacts, deals, and activities.
 * Ported from JobTrackr, adapted for SalesBlock.
 * Reworked for the sales domain (contacts, deals, activities) instead of job applications.
 */

// Minimal shapes needed for analytics computation — keeps this module
// decoupled from the full domain types so it stays pure and testable.

export interface AnalyticsContact {
  status?: string
  created_at: string
  updated_at?: string
}

export interface AnalyticsDeal {
  stage_id: string
  value: number
  close_date?: string | null
  created_at: string
}

export interface AnalyticsActivity {
  type: string
  outcome: string
  created_at: string
}

export interface SalesMetrics {
  totalContacts: number
  activeContacts: number
  conversionRate: number
  avgDealCycleDays: number
  totalPipelineValue: number
  wonDealsValue: number
  activitiesThisWeek: number
  avgActivitiesPerDay: number
}

/**
 * Compute aggregate sales metrics across contacts, deals, and activities.
 *
 * @param contacts - Array of contacts (need created_at, updated_at)
 * @param deals - Array of deals (need stage_id, value, close_date, created_at)
 * @param activities - Array of activities (need type, outcome, created_at)
 * @param options - Optional overrides for "now" and won-stage identification
 * @returns SalesMetrics with totals, rates, and averages
 */
export function computeSalesMetrics(
  contacts: AnalyticsContact[],
  deals: AnalyticsDeal[],
  activities: AnalyticsActivity[],
  options: {
    now?: Date
    isWonStage?: (stageId: string) => boolean
  } = {},
): SalesMetrics {
  const now = options.now ?? new Date()
  const isWonStage = options.isWonStage ?? (() => false)

  const totalContacts = contacts.length

  // Active contacts: updated or created within the last 30 days
  const thirtyDaysAgo = new Date(now)
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const thirtyDaysMs = thirtyDaysAgo.getTime()

  const activeContacts = contacts.filter((c) => {
    const ts = c.updated_at ?? c.created_at
    return new Date(ts).getTime() >= thirtyDaysMs
  }).length

  // Conversion rate: contacts that have at least one associated deal / total contacts
  // Since we don't have contact_id on deals here, we approximate:
  // conversion = deals.length / contacts.length (deals created per contact)
  const conversionRate =
    totalContacts > 0 ? Math.round((deals.length / totalContacts) * 100) : 0

  // Average deal cycle: days from deal creation to close_date for closed deals
  const closedDeals = deals.filter((d) => d.close_date)
  const avgDealCycleDays =
    closedDeals.length > 0
      ? Math.round(
          closedDeals.reduce((sum, d) => {
            const created = new Date(d.created_at).getTime()
            const closed = new Date(d.close_date!).getTime()
            return sum + (closed - created) / (1000 * 60 * 60 * 24)
          }, 0) / closedDeals.length,
        )
      : 0

  // Pipeline value: sum of deal values where the deal is NOT in a won stage and has no close_date
  const totalPipelineValue = deals
    .filter((d) => !d.close_date && !isWonStage(d.stage_id))
    .reduce((sum, d) => sum + d.value, 0)

  // Won deals value: sum of deal values where stage is "won"
  const wonDealsValue = deals
    .filter((d) => isWonStage(d.stage_id))
    .reduce((sum, d) => sum + d.value, 0)

  // Activities this week (Monday through Sunday containing "now")
  const dayOfWeek = now.getDay()
  const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  const weekStart = new Date(now)
  weekStart.setDate(weekStart.getDate() - mondayOffset)
  weekStart.setHours(0, 0, 0, 0)
  const weekStartMs = weekStart.getTime()

  const activitiesThisWeek = activities.filter(
    (a) => new Date(a.created_at).getTime() >= weekStartMs,
  ).length

  // Average activities per day across the full activity date range
  let avgActivitiesPerDay = 0
  if (activities.length > 0) {
    const sorted = activities
      .map((a) => new Date(a.created_at).getTime())
      .sort((a, b) => a - b)
    const firstDay = sorted[0]
    const lastDay = sorted[sorted.length - 1]
    const daySpan = Math.max(1, Math.ceil((lastDay - firstDay) / (1000 * 60 * 60 * 24)) + 1)
    avgActivitiesPerDay = Math.round((activities.length / daySpan) * 10) / 10
  }

  return {
    totalContacts,
    activeContacts,
    conversionRate,
    avgDealCycleDays,
    totalPipelineValue,
    wonDealsValue,
    activitiesThisWeek,
    avgActivitiesPerDay,
  }
}
