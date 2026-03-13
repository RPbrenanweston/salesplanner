// @crumb frontend-component-todays-salesblocks-section
// UI/Dashboard/Sessions | block_scheduling | start_control | block_duration_estimation
// why: Today's salesblocks section — display scheduled blocks for current day with start/continue actions and real-time status management
// in:salesblocks:SalesBlock[](id,title,scheduled_start,duration_minutes,status,contact_count),onStartBlock callback,onScheduleBlock callback out:List of blocks with conditional buttons (Start/Continue/Waiting) and display timing err:Empty salesblocks array (show schedule prompt),undefined list.name
// hazard: Start button relies on canStartBlock() utility — if that function's window (e.g., 5min before scheduled_start) changes, UX breaks silently. No loading state when starting a block.
// hazard: Time display uses toLocaleTimeString() — user's browser timezone may differ from server, showing incorrect local times for blocks scheduled in different zones
// edge:frontend/src/hooks/useDashboardData.ts -> READS
// edge:frontend/src/lib/salesblock.ts -> CALLS
// prompt: Add start_loading state and disable button during request. Pass ISO server timestamp or timezone offset to toLocaleTimeString() to sync with server. Test with users in different timezones.

/**
 * Section showing today's salesblocks with start button
 */
import { Clock, Plus, Play } from 'lucide-react'
import { SalesBlock } from '../hooks/useDashboardData'
import { canStartBlock } from '../lib/salesblock'

interface TodaysSalesBlocksSectionProps {
  salesblocks: SalesBlock[]
  onStartBlock: (id: string) => void
  onScheduleBlock: () => void
}

export function TodaysSalesBlocksSection({
  salesblocks,
  onStartBlock,
  onScheduleBlock,
}: TodaysSalesBlocksSectionProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
        <Clock className="w-5 h-5 text-blue-600" />
        Today's SalesBlocks
      </h2>

      {salesblocks.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            No salesblocks scheduled for today
          </p>
          <button
            onClick={onScheduleBlock}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Schedule a SalesBlock
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {salesblocks.map((sb) => (
            <div
              key={sb.id}
              className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg"
            >
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white">
                  {sb.title}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {sb.list?.name || 'Unknown list'} - {sb.contact_count} contacts - {sb.duration_minutes} min
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {new Date(sb.scheduled_start).toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true,
                  })}
                </p>
              </div>
              {canStartBlock(sb) && (
                <button
                  onClick={() => onStartBlock(sb.id)}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <Play className="w-4 h-4" />
                  Start Block
                </button>
              )}
              {!canStartBlock(sb) && sb.status === 'scheduled' && (
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  Starts at {new Date(sb.scheduled_start).toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true,
                  })}
                </span>
              )}
              {sb.status === 'in_progress' && (
                <button
                  onClick={() => onStartBlock(sb.id)}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <Play className="w-4 h-4" />
                  Continue
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
