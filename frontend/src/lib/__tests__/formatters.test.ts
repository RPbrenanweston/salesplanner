import { describe, it, expect } from 'vitest'
import {
  getActivityIcon,
  getOutcomeBadgeClass,
  formatOutcome,
  truncateNotes,
} from '../formatters'

describe('Formatter Utilities', () => {
  describe('getActivityIcon', () => {
    it('should return icon for each activity type', () => {
      const types = ['call', 'email', 'social', 'meeting', 'note']

      types.forEach((type) => {
        const icon = getActivityIcon(type)
        expect(icon).toBeDefined()
        // Icon should be a React element
        expect(typeof icon).toBe('object')
      })
    })

    it('should return default icon for unknown type', () => {
      const icon = getActivityIcon('unknown')
      expect(icon).toBeDefined()
    })
  })

  describe('getOutcomeBadgeClass', () => {
    it('should return green classes for success outcomes', () => {
      const outcomes = ['connect', 'conversation', 'meeting_booked']
      outcomes.forEach((outcome) => {
        const classes = getOutcomeBadgeClass(outcome)
        expect(classes).toContain('green')
      })
    })

    it('should return red classes for negative outcomes', () => {
      const classes = getOutcomeBadgeClass('not_interested')
      expect(classes).toContain('red')
    })

    it('should return yellow classes for neutral outcomes', () => {
      const outcomes = ['no_answer', 'voicemail', 'follow_up']
      outcomes.forEach((outcome) => {
        const classes = getOutcomeBadgeClass(outcome)
        expect(classes).toContain('yellow')
      })
    })

    it('should return gray classes for unknown outcomes', () => {
      const classes = getOutcomeBadgeClass('unknown')
      expect(classes).toContain('gray')
    })

    it('should include dark mode support', () => {
      const classes = getOutcomeBadgeClass('connect')
      expect(classes).toContain('dark:')
    })
  })

  describe('formatOutcome', () => {
    it('should convert snake_case to Title Case', () => {
      expect(formatOutcome('meeting_booked')).toBe('Meeting Booked')
      expect(formatOutcome('not_interested')).toBe('Not Interested')
      expect(formatOutcome('follow_up')).toBe('Follow Up')
    })

    it('should handle single word outcomes', () => {
      expect(formatOutcome('connect')).toBe('Connect')
      expect(formatOutcome('call')).toBe('Call')
    })

    it('should handle multiple underscores', () => {
      expect(formatOutcome('call_not_interested')).toBe('Call Not Interested')
    })
  })

  describe('truncateNotes', () => {
    it('should return empty string for null notes', () => {
      expect(truncateNotes(null)).toBe('')
    })

    it('should return full notes if within max length', () => {
      const notes = 'Short note'
      expect(truncateNotes(notes, 50)).toBe(notes)
    })

    it('should truncate notes exceeding max length', () => {
      const notes = 'This is a very long note that should be truncated'
      const truncated = truncateNotes(notes, 20)
      expect(truncated).toBe('This is a very long ...')
      expect(truncated.length).toBeLessThanOrEqual(23) // 20 chars + '...'
    })

    it('should use default max length of 60', () => {
      const notes = 'a'.repeat(70)
      const truncated = truncateNotes(notes)
      expect(truncated.length).toBeLessThanOrEqual(63) // 60 + '...'
    })

    it('should include ellipsis when truncated', () => {
      const notes = 'This is a very long note'
      const truncated = truncateNotes(notes, 10)
      expect(truncated).toMatch(/\.\.\.$/)
    })
  })
})
