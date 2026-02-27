/**
 * UI formatting utilities for activities, outcomes, and text
 */
import React from 'react'
import {
  Phone,
  Mail,
  Share2,
  Calendar,
  FileText,
  Clock
} from 'lucide-react'

/**
 * Get Lucide icon component for activity type
 * @param type - Activity type ('call', 'email', 'social', 'meeting', 'note')
 * @returns React component rendering appropriate Lucide icon
 */
export const getActivityIcon = (type: string): React.ReactNode => {
  switch (type) {
    case 'call':
      return <Phone className="w-4 h-4" />
    case 'email':
      return <Mail className="w-4 h-4" />
    case 'social':
      return <Share2 className="w-4 h-4" />
    case 'meeting':
      return <Calendar className="w-4 h-4" />
    case 'note':
      return <FileText className="w-4 h-4" />
    default:
      return <Clock className="w-4 h-4" />
  }
}

/**
 * Get Tailwind CSS classes for activity outcome badge styling
 *
 * Success outcomes (green): connect, conversation, meeting_booked
 * Neutral outcomes (yellow): no_answer, voicemail, follow_up
 * Negative outcomes (red): not_interested
 * Unknown outcomes (gray): fallback
 *
 * @param outcome - Activity outcome string
 * @returns Tailwind class string with light/dark mode support
 */
export const getOutcomeBadgeClass = (outcome: string): string => {
  const successOutcomes = ['connect', 'conversation', 'meeting_booked']
  const neutralOutcomes = ['no_answer', 'voicemail', 'follow_up']
  const negativeOutcomes = ['not_interested']

  if (successOutcomes.includes(outcome)) {
    return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
  }
  if (negativeOutcomes.includes(outcome)) {
    return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
  }
  if (neutralOutcomes.includes(outcome)) {
    return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
  }
  return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
}

/**
 * Convert outcome string from snake_case to Title Case for display
 * Example: 'meeting_booked' -> 'Meeting Booked'
 *
 * @param outcome - Outcome string in snake_case format
 * @returns Formatted string in Title Case
 */
export const formatOutcome = (outcome: string): string => {
  return outcome
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

/**
 * Truncate notes string to maximum length with ellipsis
 * Useful for activity lists to avoid long text overflow
 *
 * @param notes - Notes string or null
 * @param maxLength - Maximum length before truncation (default: 60)
 * @returns Truncated string with '...' suffix if needed, empty string if null
 */
export const truncateNotes = (notes: string | null, maxLength: number = 60): string => {
  if (!notes) return ''
  if (notes.length <= maxLength) return notes
  return notes.substring(0, maxLength) + '...'
}
