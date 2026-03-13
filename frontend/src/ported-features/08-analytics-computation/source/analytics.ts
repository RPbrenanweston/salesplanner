/**
 * @crumb analytics
 * @id salesblock.lib.analytics
 * @intent Pure computation functions for candidate job analytics — status distribution, application timeline, and funnel metrics
 * @responsibilities
 *   computeStatusDistribution(jobs): Groups jobs by status, returns counts with chart colors and labels
 *   computeApplicationTimeline(jobs): Groups jobs by applied month, returns chronologically sorted timeline
 *   computeMetrics(jobs): Calculates funnel rates (interview, offer, acceptance) from job status distribution
 *   Exports AnalyticsJob, StatusDistributionEntry, TimelineEntry, AnalyticsMetrics types
 * @contracts
 *   computeStatusDistribution(jobs: AnalyticsJob[]): StatusDistributionEntry[]
 *   computeApplicationTimeline(jobs: AnalyticsJob[]): TimelineEntry[]
 *   computeMetrics(jobs: AnalyticsJob[]): AnalyticsMetrics
 *   All functions are pure — no side effects, no async, no DB access
 * @hazards
 *   applied_date parsed with new Date() without timezone normalization — may shift months at day boundaries
 *   toLocaleDateString("en-US") depends on runtime locale support — edge runtimes may differ
 * @area Lib/Analytics
 * @refs @/types (JobStatus, STATUS_LABELS)
 * @prompt
 *   Add explicit timezone handling for date parsing to prevent month-boundary drift
 *   Export STATUS_CHART_COLORS for reuse by chart components
 */
import { JobStatus, STATUS_LABELS } from "@/types";

// ─── Types ────────────────────────────────────────────────────────────────────

/** Minimal job shape needed for analytics computations */
export interface AnalyticsJob {
  id: string;
  status: JobStatus;
  created_at: string;
  applied_date: string | null;
}

export interface StatusDistributionEntry {
  name: string;
  value: number;
  color: string;
}

export interface TimelineEntry {
  month: string;
  count: number;
}

export interface AnalyticsMetrics {
  totalJobs: number;
  interviewRate: number;
  offerRate: number;
  acceptanceRate: number;
}

// ─── Color Map ────────────────────────────────────────────────────────────────

const STATUS_CHART_COLORS: Record<JobStatus, string> = {
  wishlist: "#94a3b8",
  applied: "#3b82f6",
  phone_screen: "#eab308",
  interview: "#f97316",
  offer: "#22c55e",
  rejected: "#ef4444",
  accepted: "#10b981",
  withdrawn: "#64748b",
};

// ─── Statuses that indicate progression beyond initial application ────────────

const INTERVIEW_PLUS_STATUSES: Set<JobStatus> = new Set([
  "phone_screen",
  "interview",
  "offer",
  "accepted",
]);

const OFFER_STATUSES: Set<JobStatus> = new Set([
  "offer",
  "accepted",
]);

// ─── Pure Computation Functions ───────────────────────────────────────────────

/**
 * Compute the distribution of jobs across statuses.
 * Returns only statuses that have at least 1 job.
 */
export function computeStatusDistribution(
  jobs: AnalyticsJob[]
): StatusDistributionEntry[] {
  if (jobs.length === 0) return [];

  const counts = new Map<JobStatus, number>();

  for (const job of jobs) {
    counts.set(job.status, (counts.get(job.status) ?? 0) + 1);
  }

  const result: StatusDistributionEntry[] = [];

  counts.forEach((count, status) => {
    result.push({
      name: STATUS_LABELS[status],
      value: count,
      color: STATUS_CHART_COLORS[status],
    });
  });

  return result;
}

/**
 * Compute application timeline grouped by month.
 * Uses applied_date (falls back to created_at if null, but null applied_dates are excluded).
 * Months are sorted chronologically.
 */
export function computeApplicationTimeline(
  jobs: AnalyticsJob[]
): TimelineEntry[] {
  if (jobs.length === 0) return [];

  // Only include jobs that have an applied_date
  const applicableJobs = jobs.filter((j) => j.applied_date !== null);

  if (applicableJobs.length === 0) return [];

  const monthCounts = new Map<string, { count: number; sortKey: string }>();

  for (const job of applicableJobs) {
    const date = new Date(job.applied_date!);
    const monthLabel = date.toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
    });
    // Sort key: YYYY-MM for chronological ordering
    const sortKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

    const existing = monthCounts.get(monthLabel);
    if (existing) {
      existing.count += 1;
    } else {
      monthCounts.set(monthLabel, { count: 1, sortKey });
    }
  }

  // Sort by the sortKey (YYYY-MM)
  const entries = Array.from(monthCounts.entries()).sort(
    (a, b) => a[1].sortKey.localeCompare(b[1].sortKey)
  );

  return entries.map(([month, data]) => ({
    month,
    count: data.count,
  }));
}

/**
 * Compute high-level funnel metrics.
 *
 * - totalJobs: total count of all jobs
 * - interviewRate: % of applied jobs (non-wishlist) that reached phone_screen/interview/offer/accepted
 * - offerRate: % of applied jobs (non-wishlist) that reached offer/accepted
 * - acceptanceRate: % of offers (offer + accepted) that were accepted
 */
export function computeMetrics(jobs: AnalyticsJob[]): AnalyticsMetrics {
  const totalJobs = jobs.length;

  if (totalJobs === 0) {
    return { totalJobs: 0, interviewRate: 0, offerRate: 0, acceptanceRate: 0 };
  }

  // "Applied" means non-wishlist jobs (they entered the pipeline)
  const appliedJobs = jobs.filter((j) => j.status !== "wishlist");
  const appliedCount = appliedJobs.length;

  if (appliedCount === 0) {
    return { totalJobs, interviewRate: 0, offerRate: 0, acceptanceRate: 0 };
  }

  const interviewPlusCount = appliedJobs.filter((j) =>
    INTERVIEW_PLUS_STATUSES.has(j.status)
  ).length;

  const offerCount = appliedJobs.filter((j) =>
    OFFER_STATUSES.has(j.status)
  ).length;

  const acceptedCount = appliedJobs.filter(
    (j) => j.status === "accepted"
  ).length;

  const interviewRate = Math.round((interviewPlusCount / appliedCount) * 100);
  const offerRate = Math.round((offerCount / appliedCount) * 100);
  const acceptanceRate =
    offerCount > 0 ? Math.round((acceptedCount / offerCount) * 100) : 0;

  return { totalJobs, interviewRate, offerRate, acceptanceRate };
}
