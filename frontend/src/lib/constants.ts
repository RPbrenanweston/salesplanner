/** @id salesblock.lib.core.constants */
/**
 * Centralized constants and magic strings/numbers
 *
 * This is the single source of truth for all application constants.
 * Use these instead of hardcoding values throughout the app.
 *
 * Usage:
 *   import { CONSTANTS } from '@/lib/constants'
 *   if (block.status === CONSTANTS.SALESBLOCK_STATUS.SCHEDULED) { ... }
 */

// ============================================================================
// Duration & Timing Constants
// ============================================================================

export const DURATION = {
  // Default duration for new SalesBlocks (in minutes)
  DEFAULT_SALESBLOCK_MINUTES: 30,

  // Trial period constants
  TRIAL_DAYS: 14,
  TRIAL_EXPIRY_WARNING_DAYS: 7, // Show banner when 7 days or less remaining

  // Refresh intervals (milliseconds)
  REFETCH_INTERVAL_SHORT: 5000, // 5 seconds
  REFETCH_INTERVAL_MEDIUM: 30000, // 30 seconds
  REFETCH_INTERVAL_LONG: 60000, // 1 minute
  REFETCH_INTERVAL_VERY_LONG: 300000, // 5 minutes

  // Toast/notification durations (milliseconds)
  TOAST_DURATION_SHORT: 2000,
  TOAST_DURATION_MEDIUM: 4000,
  TOAST_DURATION_LONG: 6000,

  // API timeouts (milliseconds)
  API_TIMEOUT_SHORT: 5000,
  API_TIMEOUT_MEDIUM: 30000,
  API_TIMEOUT_LONG: 60000,
} as const

// ============================================================================
// Sales Block Status Constants
// ============================================================================

export const SALESBLOCK_STATUS = {
  SCHEDULED: 'scheduled',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const

export type SalesBlockStatus = typeof SALESBLOCK_STATUS[keyof typeof SALESBLOCK_STATUS]

export const SALESBLOCK_STATUS_LABELS: Record<SalesBlockStatus, string> = {
  [SALESBLOCK_STATUS.SCHEDULED]: 'Scheduled',
  [SALESBLOCK_STATUS.IN_PROGRESS]: 'In Progress',
  [SALESBLOCK_STATUS.COMPLETED]: 'Completed',
  [SALESBLOCK_STATUS.CANCELLED]: 'Cancelled',
}

// ============================================================================
// Activity Type & Outcome Constants
// ============================================================================

export const ACTIVITY_TYPE = {
  CALL: 'call',
  EMAIL: 'email',
  SOCIAL: 'social',
  MEETING: 'meeting',
  NOTE: 'note',
} as const

export type ActivityType = typeof ACTIVITY_TYPE[keyof typeof ACTIVITY_TYPE]

export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  [ACTIVITY_TYPE.CALL]: 'Call',
  [ACTIVITY_TYPE.EMAIL]: 'Email',
  [ACTIVITY_TYPE.SOCIAL]: 'Social',
  [ACTIVITY_TYPE.MEETING]: 'Meeting',
  [ACTIVITY_TYPE.NOTE]: 'Note',
}

export const ACTIVITY_OUTCOME = {
  NO_ANSWER: 'no_answer',
  VOICEMAIL: 'voicemail',
  CONNECT: 'connect',
  CONVERSATION: 'conversation',
  MEETING_BOOKED: 'meeting_booked',
  NOT_INTERESTED: 'not_interested',
  FOLLOW_UP: 'follow_up',
  OTHER: 'other',
} as const

export type ActivityOutcome = typeof ACTIVITY_OUTCOME[keyof typeof ACTIVITY_OUTCOME]

export const ACTIVITY_OUTCOME_LABELS: Record<ActivityOutcome, string> = {
  [ACTIVITY_OUTCOME.NO_ANSWER]: 'No Answer',
  [ACTIVITY_OUTCOME.VOICEMAIL]: 'Voicemail',
  [ACTIVITY_OUTCOME.CONNECT]: 'Connect',
  [ACTIVITY_OUTCOME.CONVERSATION]: 'Conversation',
  [ACTIVITY_OUTCOME.MEETING_BOOKED]: 'Meeting Booked',
  [ACTIVITY_OUTCOME.NOT_INTERESTED]: 'Not Interested',
  [ACTIVITY_OUTCOME.FOLLOW_UP]: 'Follow Up',
  [ACTIVITY_OUTCOME.OTHER]: 'Other',
}

// ============================================================================
// User Role Constants
// ============================================================================

export const USER_ROLE = {
  SDR: 'sdr',
  AE: 'ae',
  MANAGER: 'manager',
} as const

export type UserRole = typeof USER_ROLE[keyof typeof USER_ROLE]

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  [USER_ROLE.SDR]: 'Sales Development Rep',
  [USER_ROLE.AE]: 'Account Executive',
  [USER_ROLE.MANAGER]: 'Manager',
}

// ============================================================================
// Subscription & Billing Constants
// ============================================================================

export const SUBSCRIPTION_STATUS = {
  TRIAL: 'trial',
  ACTIVE: 'active',
  PAST_DUE: 'past_due',
  CANCELLED: 'cancelled',
  EXPIRED: 'expired',
} as const

export type SubscriptionStatus = typeof SUBSCRIPTION_STATUS[keyof typeof SUBSCRIPTION_STATUS]

export const BILLING_PERIOD = {
  MONTHLY: 'monthly',
  YEARLY: 'yearly',
  WEEKLY: 'weekly',
} as const

export type BillingPeriod = typeof BILLING_PERIOD[keyof typeof BILLING_PERIOD]

// ============================================================================
// Contact Source Constants
// ============================================================================

export const CONTACT_SOURCE = {
  CSV: 'csv',
  SALESFORCE: 'salesforce',
  MANUAL: 'manual',
} as const

export type ContactSource = typeof CONTACT_SOURCE[keyof typeof CONTACT_SOURCE]

export const CONTACT_SOURCE_LABELS: Record<ContactSource, string> = {
  [CONTACT_SOURCE.CSV]: 'CSV Import',
  [CONTACT_SOURCE.SALESFORCE]: 'Salesforce',
  [CONTACT_SOURCE.MANUAL]: 'Manual Entry',
}

// ============================================================================
// Goal Metric Constants
// ============================================================================

export const GOAL_METRIC = {
  CALLS: 'calls',
  EMAILS: 'emails',
  SOCIAL_TOUCHES: 'social_touches',
  MEETINGS_BOOKED: 'meetings_booked',
  PIPELINE_VALUE: 'pipeline_value',
  CUSTOM: 'custom',
} as const

export type GoalMetric = typeof GOAL_METRIC[keyof typeof GOAL_METRIC]

export const GOAL_METRIC_LABELS: Record<GoalMetric, string> = {
  [GOAL_METRIC.CALLS]: 'Calls Made',
  [GOAL_METRIC.EMAILS]: 'Emails Sent',
  [GOAL_METRIC.SOCIAL_TOUCHES]: 'Social Touches',
  [GOAL_METRIC.MEETINGS_BOOKED]: 'Meetings Booked',
  [GOAL_METRIC.PIPELINE_VALUE]: 'Pipeline Value',
  [GOAL_METRIC.CUSTOM]: 'Custom',
}

export const GOAL_PERIOD = {
  DAILY: 'daily',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
} as const

export type GoalPeriod = typeof GOAL_PERIOD[keyof typeof GOAL_PERIOD]

export const GOAL_PERIOD_LABELS: Record<GoalPeriod, string> = {
  [GOAL_PERIOD.DAILY]: 'Daily',
  [GOAL_PERIOD.WEEKLY]: 'Weekly',
  [GOAL_PERIOD.MONTHLY]: 'Monthly',
}

// ============================================================================
// KPI & Formula Constants
// ============================================================================

export const FORMULA_TYPE = {
  COUNT: 'count',
  RATIO: 'ratio',
  SUM: 'sum',
} as const

export type FormulaType = typeof FORMULA_TYPE[keyof typeof FORMULA_TYPE]

export const FORMULA_TYPE_LABELS: Record<FormulaType, string> = {
  [FORMULA_TYPE.COUNT]: 'Count',
  [FORMULA_TYPE.RATIO]: 'Ratio',
  [FORMULA_TYPE.SUM]: 'Sum',
}

// ============================================================================
// Pagination & Data Limits
// ============================================================================

export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 20,
  LIST_PAGE_SIZE: 25,
  ACTIVITIES_PAGE_SIZE: 50,
  CONTACTS_PAGE_SIZE: 100,
  MAX_PAGE_SIZE: 500,
} as const

// ============================================================================
// Character Limits & Validation
// ============================================================================

export const LIMITS = {
  // Text field lengths
  NAME_MIN: 1,
  NAME_MAX: 100,
  EMAIL_MAX: 255,
  PHONE_MAX: 20,
  COMPANY_MAX: 255,
  TITLE_MAX: 100,
  URL_MAX: 500,

  // Large text
  DESCRIPTION_MAX: 500,
  NOTES_MAX: 2000,
  SCRIPT_CONTENT_MAX: 5000,
  EMAIL_SUBJECT_MAX: 200,
  EMAIL_BODY_MAX: 10000,

  // Numeric
  DEFAULT_DURATION_MIN: 5,
  DEFAULT_DURATION_MAX: 480, // 8 hours
  GOAL_TARGET_MIN: 1,
  GOAL_TARGET_MAX: 100000,
  PIPELINE_VALUE_MAX: 999999999,
} as const

// ============================================================================
// File Upload Constants
// ============================================================================

export const FILE_UPLOAD = {
  MAX_FILE_SIZE_MB: 10,
  MAX_FILE_SIZE_BYTES: 10 * 1024 * 1024,
  ALLOWED_FORMATS: ['.csv', '.xlsx', '.xls'],
  MAX_CONTACTS_PER_CSV: 10000,
} as const

// ============================================================================
// Analytics & Reporting Constants
// ============================================================================

export const ANALYTICS = {
  // Date range presets
  PRESET_TODAY: 'today',
  PRESET_YESTERDAY: 'yesterday',
  PRESET_LAST_7_DAYS: 'last_7_days',
  PRESET_LAST_30_DAYS: 'last_30_days',
  PRESET_LAST_90_DAYS: 'last_90_days',
  PRESET_THIS_MONTH: 'this_month',
  PRESET_LAST_MONTH: 'last_month',
  PRESET_THIS_YEAR: 'this_year',
  PRESET_LAST_YEAR: 'last_year',
} as const

// ============================================================================
// Theme Constants
// ============================================================================

export const THEME = {
  LIGHT: 'light',
  DARK: 'dark',
  SYSTEM: 'system',
} as const

export type Theme = typeof THEME[keyof typeof THEME]

// ============================================================================
// API & Integration Constants
// ============================================================================

export const INTEGRATIONS = {
  SALESFORCE: 'salesforce',
  OUTLOOK: 'outlook',
  GMAIL: 'gmail',
  GOOGLE_CALENDAR: 'google_calendar',
  OUTLOOK_CALENDAR: 'outlook_calendar',
} as const

// ============================================================================
// Error Messages (Localization ready)
// ============================================================================

export const ERROR_MESSAGES = {
  GENERIC: 'An unexpected error occurred. Please try again.',
  NETWORK: 'Network error. Please check your connection.',
  UNAUTHORIZED: 'You are not authorized to perform this action.',
  NOT_FOUND: 'The requested resource was not found.',
  VALIDATION_FAILED: 'Please check your input and try again.',
  FILE_TOO_LARGE: 'File size exceeds the maximum limit.',
  INVALID_FILE_FORMAT: 'Invalid file format.',
} as const

// ============================================================================
// Success Messages (Localization ready)
// ============================================================================

export const SUCCESS_MESSAGES = {
  SAVED: 'Changes saved successfully.',
  CREATED: 'Item created successfully.',
  DELETED: 'Item deleted successfully.',
  UPDATED: 'Item updated successfully.',
  IMPORTED: 'Data imported successfully.',
} as const
