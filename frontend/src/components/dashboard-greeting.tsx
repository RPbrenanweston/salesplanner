// @crumb frontend-component-dashboard-greeting
// UI/Dashboard/Header | time_based_greeting | date_display | user_personalization
// why: Dashboard greeting header — display personalized time-of-day greeting and current date for user
// in:userDisplayName string,current time(getGreeting),current date(formatDate) out:Greeting text "Good Morning/Afternoon/Evening" + user name + formatted date err:Empty/missing user name,invalid time output
// hazard: Time-of-day greeting is computed once on mount — if user keeps dashboard open for 12+ hours, greeting becomes incorrect (morning stays morning)
// hazard: formatDate uses browser locale without timezone awareness — may show wrong date for users in different timezones than server
// edge:frontend/src/lib/time.ts -> CALLS
// prompt: Refresh greeting on 60s interval or use server-provided timestamp. Use ISO 8601 with timezone offset or server time for date accuracy.

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
