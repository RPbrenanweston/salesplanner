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

export const formatOutcome = (outcome: string): string => {
  return outcome
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

export const truncateNotes = (notes: string | null, maxLength: number = 60): string => {
  if (!notes) return ''
  if (notes.length <= maxLength) return notes
  return notes.substring(0, maxLength) + '...'
}
