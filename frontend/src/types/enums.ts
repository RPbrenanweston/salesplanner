/**
 * Enum types and constants
 */

export enum UserRole {
  SDR = 'sdr',
  AE = 'ae',
  MANAGER = 'manager',
}

export enum SalesBlockStatus {
  SCHEDULED = 'scheduled',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum ActivityType {
  CALL = 'call',
  EMAIL = 'email',
  SOCIAL = 'social',
  MEETING = 'meeting',
  NOTE = 'note',
}

export enum ActivityOutcome {
  NO_ANSWER = 'no_answer',
  VOICEMAIL = 'voicemail',
  CONNECT = 'connect',
  CONVERSATION = 'conversation',
  MEETING_BOOKED = 'meeting_booked',
  NOT_INTERESTED = 'not_interested',
  FOLLOW_UP = 'follow_up',
  OTHER = 'other',
}

export enum GoalMetric {
  CALLS = 'calls',
  EMAILS = 'emails',
  SOCIAL_TOUCHES = 'social_touches',
  MEETINGS_BOOKED = 'meetings_booked',
  PIPELINE_VALUE = 'pipeline_value',
  CUSTOM = 'custom',
}

export enum GoalPeriod {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
}

export enum ContactSource {
  CSV = 'csv',
  SALESFORCE = 'salesforce',
  MANUAL = 'manual',
}

export enum FormulaType {
  COUNT = 'count',
  RATIO = 'ratio',
  SUM = 'sum',
}

export enum Theme {
  LIGHT = 'light',
  DARK = 'dark',
  SYSTEM = 'system',
}

// Outcome labels for display
export const OUTCOME_LABELS: Record<ActivityOutcome, string> = {
  [ActivityOutcome.NO_ANSWER]: 'No Answer',
  [ActivityOutcome.VOICEMAIL]: 'Voicemail',
  [ActivityOutcome.CONNECT]: 'Connect',
  [ActivityOutcome.CONVERSATION]: 'Conversation',
  [ActivityOutcome.MEETING_BOOKED]: 'Meeting Booked',
  [ActivityOutcome.NOT_INTERESTED]: 'Not Interested',
  [ActivityOutcome.FOLLOW_UP]: 'Follow Up',
  [ActivityOutcome.OTHER]: 'Other',
}

// Goal metric labels
export const GOAL_METRIC_LABELS: Record<GoalMetric, string> = {
  [GoalMetric.CALLS]: 'Calls Made',
  [GoalMetric.EMAILS]: 'Emails Sent',
  [GoalMetric.SOCIAL_TOUCHES]: 'Social Touches',
  [GoalMetric.MEETINGS_BOOKED]: 'Meetings Booked',
  [GoalMetric.PIPELINE_VALUE]: 'Pipeline Value',
  [GoalMetric.CUSTOM]: 'Custom',
}
