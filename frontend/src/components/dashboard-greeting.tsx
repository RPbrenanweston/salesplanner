/**
 * Dashboard greeting section with time of day greeting and current date
 */
import { formatDate, getGreeting } from '../lib/time'

interface DashboardGreetingProps {
  userDisplayName: string
}

export function DashboardGreeting({ userDisplayName }: DashboardGreetingProps) {
  return (
    <div className="mb-8">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
        {getGreeting()}, {userDisplayName}
      </h1>
      <p className="text-gray-600 dark:text-gray-400">{formatDate()}</p>
    </div>
  )
}
