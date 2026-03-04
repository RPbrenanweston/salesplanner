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
