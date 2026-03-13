/**
 * Analytics computation library.
 *
 * Pure TypeScript functions for computing sales analytics metrics.
 * No React, no Supabase, no side effects — just data in, data out.
 *
 * Ported from JobTrackr, adapted for SalesBlock.
 */

export { computeDistribution } from './distribution'
export type { DistributionEntry } from './distribution'

export { computeTimeline } from './timeline'
export type { TimelineEntry } from './timeline'

export { computeSalesMetrics } from './sales-metrics'
export type {
  AnalyticsContact,
  AnalyticsDeal,
  AnalyticsActivity,
  SalesMetrics,
} from './sales-metrics'
