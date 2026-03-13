/** @id salesblock.lib.core.routes */
/**
 * Centralized route paths for the application
 *
 * This is the single source of truth for all route definitions.
 * Use these constants instead of hardcoding paths throughout the app.
 *
 * Usage:
 *   import { ROUTES } from '@/lib/routes'
 *   navigate(ROUTES.DASHBOARD)
 */

export const ROUTES = {
  // Authentication
  SIGNIN: '/signin',
  SIGNUP: '/signup',
  FORGOT_PASSWORD: '/forgot-password',
  RESET_PASSWORD: '/reset-password',

  // Marketing
  MARKETING: '/',

  // Main Navigation (app home)
  DASHBOARD: '/dashboard',
  HOME: '/dashboard',

  // Core Features
  SALESBLOCKS: '/salesblocks',
  LISTS: '/lists',
  CONTACTS: '/contacts',

  // Scripts & Templates
  SCRIPTS: '/scripts',
  TEMPLATES: '/templates',

  // Activity Tracking
  CALLS: '/calls',
  EMAIL: '/email',
  SOCIAL: '/social',

  // Sales Pipeline & Goals
  PIPELINE: '/pipeline',
  GOALS: '/goals',

  // Analytics & Reporting
  ANALYTICS: '/analytics',

  // Team & Administration
  TEAM: '/team',
  SETTINGS: '/settings',
  PROFILE: '/profile',

  // External OAuth Callbacks
  GMAIL_CALLBACK: '/oauth/gmail',
  GOOGLE_CALENDAR_CALLBACK: '/oauth/google-calendar',
  OUTLOOK_CALLBACK: '/oauth/outlook',
  OUTLOOK_CALENDAR_CALLBACK: '/oauth/outlook-calendar',
  SALESFORCE_CALLBACK: '/oauth/salesforce',

  // Pricing & Billing
  PRICING: '/pricing',
  BILLING: '/billing',

  // Details Pages (use with params)
  LIST_DETAIL: (listId: string) => `/lists/${listId}`,
  CONTACT_DETAIL: (contactId: string) => `/contacts/${contactId}`,
  SALESBLOCK_DETAIL: (blockId: string) => `/salesblocks/${blockId}`,
} as const

/**
 * Helper to navigate to list detail with return path
 */
export function getListDetailRoute(
  listId: string,
  returnPath?: string
): {
  pathname: string
  state?: { returnPath: string }
} {
  return {
    pathname: ROUTES.LIST_DETAIL(listId),
    ...(returnPath && { state: { returnPath } }),
  }
}

/**
 * Helper to navigate to contact detail with return path
 */
export function getContactDetailRoute(
  contactId: string,
  returnPath?: string
): {
  pathname: string
  state?: { returnPath: string }
} {
  return {
    pathname: ROUTES.CONTACT_DETAIL(contactId),
    ...(returnPath && { state: { returnPath } }),
  }
}

/**
 * Helper to navigate to salesblocks with pre-selected list
 */
export function getSalesBlocksRoute(preselectedListId?: string): {
  pathname: string
  state?: { preselectedListId: string }
} {
  return {
    pathname: ROUTES.SALESBLOCKS,
    ...(preselectedListId && { state: { preselectedListId } }),
  }
}

/**
 * Check if a path is protected (requires authentication)
 */
export function isProtectedRoute(path: string): boolean {
  const publicRoutes = [
    ROUTES.MARKETING,
    ROUTES.SIGNIN,
    ROUTES.SIGNUP,
    ROUTES.FORGOT_PASSWORD,
    ROUTES.RESET_PASSWORD,
    ROUTES.PRICING,
  ]
  return !publicRoutes.includes(path as typeof publicRoutes[number])
}
