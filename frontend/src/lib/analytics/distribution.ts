/**
 * Generic distribution computation.
 *
 * Groups items by an arbitrary key extractor, returns counts and percentages.
 * Ported from JobTrackr, adapted for SalesBlock.
 * Generalized to work with any SalesBlock entity (contacts by status, deals by stage, activities by type).
 */

export interface DistributionEntry {
  key: string
  label: string
  count: number
  percentage: number
}

/**
 * Compute a distribution of items grouped by a derived key.
 *
 * @param items - Array of items to group
 * @param groupBy - Function that extracts the grouping key from each item
 * @param labelMap - Optional mapping from key to human-readable label.
 *                   Falls back to capitalizing the key.
 * @returns Array of distribution entries with counts and percentages.
 *          Only keys with count >= 1 are included. Empty input returns [].
 */
export function computeDistribution<T>(
  items: T[],
  groupBy: (item: T) => string,
  labelMap?: Record<string, string>,
): DistributionEntry[] {
  if (items.length === 0) return []

  const counts = new Map<string, number>()

  for (const item of items) {
    const key = groupBy(item)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  const total = items.length

  return Array.from(counts.entries()).map(([key, count]) => ({
    key,
    label: labelMap?.[key] ?? key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '),
    count,
    percentage: total > 0 ? Math.round((count / total) * 100) : 0,
  }))
}
