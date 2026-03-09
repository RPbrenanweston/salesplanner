/**
 * Goal management utilities
 */

interface Goal {
  metric: string
  period: 'daily' | 'weekly' | 'monthly'
  custom_metric_name: string | null
}

export const getGoalLabel = (goal: Goal): string => {
  const metricLabels: Record<string, string> = {
    calls: 'Calls Made',
    emails: 'Emails Sent',
    social_touches: 'Social Touches',
    meetings_booked: 'Meetings Booked',
    pipeline_value: 'Pipeline Value',
    custom: goal.custom_metric_name || 'Custom',
  }
  const periodLabel = goal.period.charAt(0).toUpperCase() + goal.period.slice(1)
  return `${metricLabels[goal.metric] || goal.metric} (${periodLabel})`
}
