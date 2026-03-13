// @crumb frontend-component-activity-feed-section
// UI/Dashboard/Activity | activity_list_rendering | outcome_badge_display | time_formatting | truncated_notes_display
// why: Activity feed section — display recent contact activities on dashboard with outcome badges, icons, and truncated notes
// in:Activity[](id,type,outcome,notes,created_at),useDashboardData hook out:Formatted activity list with icons/badges/time,truncated notes UI err:Empty activities list (show empty state),malformed activity data
// hazard: Notes truncation has no expand-to-full functionality — users cannot read truncated activity details from dashboard
// hazard: Time formatting uses relative time (timeAgo) which becomes stale — 1-hour-old activity still shows "1 hour ago" after 2 hours unless refetch
// edge:frontend/src/hooks/useDashboardData.ts -> READS
// edge:frontend/src/lib/formatters.ts -> CALLS
// edge:frontend/src/lib/time.ts -> CALLS
// prompt: Add expand/modal link for full note text. Implement realtime time updates with 60s refresh interval or use absolute timestamp as fallback.

/**
 * Section showing recent activities with icons and outcomes
 */
import { FileText } from 'lucide-react'
import { Activity } from '../hooks/useDashboardData'
import { getActivityIcon, getOutcomeBadgeClass, formatOutcome, truncateNotes } from '../lib/formatters'
import { formatTimeAgo } from '../lib/time'

interface ActivityFeedSectionProps {
  activities: Activity[]
}

export function ActivityFeedSection({ activities }: ActivityFeedSectionProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
        <FileText className="w-5 h-5 text-purple-600" />
        Recent Activity
      </h2>

      {activities.length === 0 ? (
        <p className="text-gray-500 dark:text-gray-400 text-center py-4">
          No recent activities
        </p>
      ) : (
        <div className="space-y-3">
          {activities.map((activity) => (
            <div
              key={activity.id}
              className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg"
            >
              <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                {getActivityIcon(activity.type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-gray-900 dark:text-white text-sm">
                    {activity.contact?.first_name} {activity.contact?.last_name}
                  </span>
                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getOutcomeBadgeClass(activity.outcome)}`}>
                    {formatOutcome(activity.outcome)}
                  </span>
                </div>
                {activity.notes && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                    {truncateNotes(activity.notes)}
                  </p>
                )}
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                  {activity.created_at && formatTimeAgo(activity.created_at)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
