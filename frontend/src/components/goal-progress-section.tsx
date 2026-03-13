// @crumb frontend-component-goal-progress-section
// UI/Dashboard/Metrics | goal_tracking | progress_visualization | threshold_based_coloring
// why: Goal progress section — display user sales goals with color-coded progress bars based on achievement percentage thresholds
// in:goals:GoalProgress[](label,current,target) out:Progress bar list with color coding (blue→yellow→green) and percentage labels err:Empty goals array (show empty state),NaN target values (guard with Math.min)
// hazard: Color thresholds (50%=blue, 75%=yellow, 100%=green) are hardcoded — if goal types vary (email vs calls), fixed thresholds may misrepresent progress
// hazard: Goals rendered in arbitrary order without sorting — user cannot quickly find priority goals; no timestamp or goal deadline shown
// edge:frontend/src/hooks/useGoalProgress.ts -> READS
// prompt: Add sorting by progress % (ascending to show gaps first) or by creation order. Consider adding goal deadline/deadline-aware "time remaining" indicator. Document color threshold meanings.

/**
 * Section showing goal progress with progress bars
 */
import { Target } from 'lucide-react'
import { GoalProgress } from '../hooks/useGoalProgress'

interface GoalProgressSectionProps {
  goals: GoalProgress[]
}

export function GoalProgressSection({ goals }: GoalProgressSectionProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
        <Target className="w-5 h-5 text-green-600" />
        Goal Progress
      </h2>

      {goals.length === 0 ? (
        <p className="text-gray-500 dark:text-gray-400 text-center py-4">
          No goals set
        </p>
      ) : (
        <div className="space-y-4">
          {goals.map((goal, index) => {
            const percentage = goal.target > 0 ? Math.min((goal.current / goal.target) * 100, 100) : 0
            return (
              <div key={index}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {goal.label}
                  </span>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {goal.current} / {goal.target}
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full transition-all duration-300 ${
                      percentage >= 100
                        ? 'bg-green-600'
                        : percentage >= 75
                        ? 'bg-green-500'
                        : percentage >= 50
                        ? 'bg-yellow-500'
                        : 'bg-blue-600'
                    }`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-1 text-right">
                  {Math.round(percentage)}%
                </p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
