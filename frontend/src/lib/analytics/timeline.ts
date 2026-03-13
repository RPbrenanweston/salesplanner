/**
 * Generic timeline computation.
 *
 * Groups items by date, returns chronologically sorted daily counts.
 * Ported from JobTrackr, adapted for SalesBlock.
 * Generalized to accept any date extractor.
 */

export interface TimelineEntry {
  date: string
  count: number
}

/**
 * Compute a timeline of item counts grouped by ISO date (YYYY-MM-DD).
 *
 * @param items - Array of items to group by date
 * @param getDate - Function that extracts an ISO date/datetime string from each item.
 *                  Only the YYYY-MM-DD portion is used.
 * @returns Chronologically sorted array of { date, count } entries.
 *          Empty input returns [].
 */
export function computeTimeline<T>(
  items: T[],
  getDate: (item: T) => string,
): TimelineEntry[] {
  if (items.length === 0) return []

  const counts = new Map<string, number>()

  for (const item of items) {
    const raw = getDate(item)
    const date = raw.split('T')[0] // Extract YYYY-MM-DD
    counts.set(date, (counts.get(date) ?? 0) + 1)
  }

  return Array.from(counts.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }))
}
