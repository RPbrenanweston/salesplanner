/**
 * CreateCompetitionModal - Modal for creating new Arena competitions
 *
 * Allows users to name a competition, pick a time period, and optionally
 * override auto-computed start/end dates.
 */
import { useState, useCallback } from 'react'
import { Trophy } from 'lucide-react'
import { Modal, ModalFormActions } from './Modal'
import { type CompetitionPeriod, computeDateRange, periodLabel } from '../hooks/useArena'

interface CreateCompetitionModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (name: string, period: CompetitionPeriod, startDate?: string, endDate?: string) => Promise<void>
}

const PERIODS: CompetitionPeriod[] = ['day', 'week', 'month', 'quarter', 'half', 'year']

function formatDateForInput(isoString: string): string {
  return isoString.slice(0, 10)
}

export function CreateCompetitionModal({ isOpen, onClose, onSubmit }: CreateCompetitionModalProps) {
  const [name, setName] = useState('')
  const [period, setPeriod] = useState<CompetitionPeriod>('month')
  const [useCustomDates, setUseCustomDates] = useState(false)
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const computedRange = computeDateRange(period)

  const handlePeriodChange = useCallback((p: CompetitionPeriod) => {
    setPeriod(p)
    setUseCustomDates(false)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    setSubmitting(true)
    try {
      const startDate = useCustomDates && customStart ? new Date(customStart).toISOString() : undefined
      const endDate = useCustomDates && customEnd ? new Date(customEnd + 'T23:59:59.999Z').toISOString() : undefined
      await onSubmit(name.trim(), period, startDate, endDate)
      // Reset form
      setName('')
      setPeriod('month')
      setUseCustomDates(false)
      setCustomStart('')
      setCustomEnd('')
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Competition"
      icon={<Trophy className="w-5 h-5" />}
      footer={
        <ModalFormActions
          onCancel={onClose}
          submitLabel="Create Competition"
          isSubmitting={submitting}
          isValid={name.trim().length > 0}
        />
      }
    >
      <form id="create-competition-form" onSubmit={handleSubmit} className="space-y-6">
        {/* Competition Name */}
        <div>
          <label htmlFor="comp-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Competition Name
          </label>
          <input
            id="comp-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. March Sprint, Q1 Blitz"
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-gray-900 dark:text-white placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition"
            autoFocus
          />
        </div>

        {/* Period Selector */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Time Period
          </label>
          <div className="grid grid-cols-3 gap-2">
            {PERIODS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => handlePeriodChange(p)}
                className={`
                  px-3 py-2 rounded-lg text-sm font-medium transition
                  ${
                    period === p
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }
                `}
              >
                {periodLabel(p)}
              </button>
            ))}
          </div>
        </div>

        {/* Auto-Computed Dates Display */}
        {!useCustomDates && (
          <div className="rounded-lg bg-gray-50 dark:bg-gray-700/50 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Dates</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {formatDateForInput(computedRange.start)} to {formatDateForInput(computedRange.end)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setUseCustomDates(true)
                  setCustomStart(formatDateForInput(computedRange.start))
                  setCustomEnd(formatDateForInput(computedRange.end))
                }}
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                Customize
              </button>
            </div>
          </div>
        )}

        {/* Custom Date Inputs */}
        {useCustomDates && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Custom Dates</label>
              <button
                type="button"
                onClick={() => setUseCustomDates(false)}
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                Use default
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="comp-start" className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                  Start
                </label>
                <input
                  id="comp-start"
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white outline-none focus:border-blue-500 transition"
                />
              </div>
              <div>
                <label htmlFor="comp-end" className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                  End
                </label>
                <input
                  id="comp-end"
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white outline-none focus:border-blue-500 transition"
                />
              </div>
            </div>
          </div>
        )}
      </form>
    </Modal>
  )
}
