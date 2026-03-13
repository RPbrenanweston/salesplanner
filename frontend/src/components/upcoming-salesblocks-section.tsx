// @crumb frontend-component-upcoming-salesblocks-section
// UI/Dashboard/Planning | weekly_block_preview | schedule_visibility | list_item_summarization
// why: Upcoming salesblocks section — preview next week's scheduled blocks with duration and contact counts to help users plan calendar
// in:salesblocks:SalesBlock[](id,title,scheduled_start,duration_minutes,contact_count,list.name) out:Compact list of blocks with datetime and metadata; "No upcoming blocks" empty state err:Empty array,undefined list.name,null scheduled_start
// hazard: Label "Upcoming This Week" is hardcoded but filtering logic lives in parent component — no guarantee only this week shown. If parent changes filter, UX label becomes misleading.
// hazard: formatDateTime relies on browser locale — displays may vary (2026-03-13 vs 13/03/2026) confusing users comparing schedules. No truncation for very long block titles or list names.
// edge:frontend/src/hooks/useDashboardData.ts -> READS
// edge:frontend/src/lib/time.ts -> CALLS
// prompt: Move "Upcoming This Week" label and date range to parent (or accept as prop). Pass timezone info to formatDateTime. Add ellipsis/truncate utility for titles >30 chars.

/**
 * Section showing upcoming salesblocks for the week
 */
import { Calendar } from 'lucide-react'
import { SalesBlock } from '../hooks/useDashboardData'
import { formatDateTime } from '../lib/time'

interface UpcomingSalesBlocksSectionProps {
  salesblocks: SalesBlock[]
}

export function UpcomingSalesBlocksSection({ salesblocks }: UpcomingSalesBlocksSectionProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
        <Calendar className="w-5 h-5 text-orange-600" />
        Upcoming This Week
      </h2>

      {salesblocks.length === 0 ? (
        <p className="text-gray-500 dark:text-gray-400 text-center py-4">
          No upcoming salesblocks this week
        </p>
      ) : (
        <div className="space-y-3">
          {salesblocks.map((sb) => (
            <div
              key={sb.id}
              className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg"
            >
              <h3 className="font-medium text-gray-900 dark:text-white text-sm">
                {sb.title}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {sb.list?.name || 'Unknown list'}
              </p>
              <div className="flex items-center justify-between mt-2 text-xs text-gray-500 dark:text-gray-400">
                <span>{formatDateTime(sb.scheduled_start)}</span>
                <span>{sb.duration_minutes} min</span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {sb.contact_count} contacts
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
