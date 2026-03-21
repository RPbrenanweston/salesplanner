/**
 * CreateCompetitionModal - Multi-step wizard for creating Arena competitions
 *
 * Steps: 1) Details  2) Select KPIs  3) Invite Participants  4) Review & Create
 */
import { useState, useCallback, useEffect } from 'react'
import {
  Trophy,
  Phone,
  Mail,
  TrendingUp,
  Share2,
  Calendar,
  BarChart3,
  Check,
  Plus,
  ChevronLeft,
  ChevronRight,
  Users,
  X,
} from 'lucide-react'
import { Modal } from './Modal'
import {
  type CompetitionPeriod,
  computeDateRange,
  periodLabel,
  type CompetitionKPI,
} from '../hooks/useArena'
import { useCustomKPIs } from '../hooks/useCustomKPIs'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CreateCompetitionModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (
    name: string,
    period: CompetitionPeriod,
    startDate?: string,
    endDate?: string,
    description?: string,
    kpiConfig?: CompetitionKPI[],
    participantIds?: string[],
  ) => Promise<void>
}

interface TeamMember {
  id: string
  display_name: string
  role: string
}

type WizardStep = 1 | 2 | 3 | 4

// ---------------------------------------------------------------------------
// Icon resolver
// ---------------------------------------------------------------------------

const ICON_MAP: Record<string, React.ReactNode> = {
  Phone: <Phone className="w-4 h-4" />,
  Mail: <Mail className="w-4 h-4" />,
  TrendingUp: <TrendingUp className="w-4 h-4" />,
  Share2: <Share2 className="w-4 h-4" />,
  Calendar: <Calendar className="w-4 h-4" />,
  BarChart3: <BarChart3 className="w-4 h-4" />,
}

function resolveIcon(iconName: string): React.ReactNode {
  return ICON_MAP[iconName] || <BarChart3 className="w-4 h-4" />
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PERIODS: CompetitionPeriod[] = ['day', 'week', 'month', 'quarter', 'half', 'year']

function formatDateForInput(isoString: string): string {
  return isoString.slice(0, 10)
}

// ---------------------------------------------------------------------------
// Step Indicator
// ---------------------------------------------------------------------------

function StepIndicator({ current, total }: { current: WizardStep; total: number }) {
  const steps = [
    { num: 1, label: 'Details' },
    { num: 2, label: 'KPIs' },
    { num: 3, label: 'Team' },
    { num: 4, label: 'Review' },
  ]

  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      {steps.slice(0, total).map((step, i) => {
        const isActive = step.num === current
        const isComplete = step.num < current

        return (
          <div key={step.num} className="flex items-center gap-2">
            {i > 0 && (
              <div
                className={`w-8 h-0.5 ${
                  isComplete ? 'bg-indigo-500' : 'bg-gray-300 dark:bg-gray-600'
                }`}
              />
            )}
            <div className="flex flex-col items-center gap-1">
              <div
                className={`
                  w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition
                  ${
                    isActive
                      ? 'bg-indigo-600 text-white'
                      : isComplete
                        ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                  }
                `}
              >
                {isComplete ? <Check className="w-4 h-4" /> : step.num}
              </div>
              <span
                className={`text-xs ${
                  isActive
                    ? 'text-indigo-600 dark:text-indigo-400 font-medium'
                    : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                {step.label}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// User Initials
// ---------------------------------------------------------------------------

function UserInitials({ name }: { name: string }) {
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <div className="w-9 h-9 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-xs font-bold">
      {initials}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function CreateCompetitionModal({ isOpen, onClose, onSubmit }: CreateCompetitionModalProps) {
  const { user } = useAuth()
  const { allKPIs, createKPI } = useCustomKPIs()

  // Wizard state
  const [step, setStep] = useState<WizardStep>(1)

  // Step 1: Details
  const [name, setName] = useState('')
  const [period, setPeriod] = useState<CompetitionPeriod>('month')
  const [description, setDescription] = useState('')
  const [useCustomDates, setUseCustomDates] = useState(false)
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')

  // Step 2: KPIs
  const [selectedKPIs, setSelectedKPIs] = useState<Map<string, number>>(new Map())
  const [showInlineKPIForm, setShowInlineKPIForm] = useState(false)
  const [newKPIName, setNewKPIName] = useState('')
  const [newKPIActivityType, setNewKPIActivityType] = useState('')
  const [newKPIPoints, setNewKPIPoints] = useState(1)

  // Step 3: Participants
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [selectedParticipants, setSelectedParticipants] = useState<Set<string>>(new Set())
  const [teamLoading, setTeamLoading] = useState(false)

  // Step 4
  const [submitting, setSubmitting] = useState(false)

  const computedRange = computeDateRange(period)

  // Reset form when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setStep(1)
      setName('')
      setPeriod('month')
      setDescription('')
      setUseCustomDates(false)
      setCustomStart('')
      setCustomEnd('')
      setSelectedKPIs(new Map())
      setShowInlineKPIForm(false)
      setNewKPIName('')
      setNewKPIActivityType('')
      setNewKPIPoints(1)
      setSelectedParticipants(new Set())
    } else if (user) {
      // Auto-select current user as participant
      setSelectedParticipants(new Set([user.id]))
    }
  }, [isOpen, user])

  // Fetch team members when reaching step 3
  useEffect(() => {
    if (step === 3 && user) {
      fetchTeamMembers()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, user])

  const fetchTeamMembers = useCallback(async () => {
    if (!user) return

    setTeamLoading(true)
    try {
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('org_id')
        .eq('id', user.id)
        .single()

      if (userError) throw userError

      const orgId = (userData as { org_id: string }).org_id

      const { data: members, error: membersError } = await supabase
        .from('users')
        .select('id, display_name, role')
        .eq('org_id', orgId)

      if (membersError) throw membersError

      if (members && Array.isArray(members)) {
        const mapped: TeamMember[] = members.map((m: Record<string, unknown>) => ({
          id: m.id as string,
          display_name: (m.display_name as string) || 'Unknown',
          role: (m.role as string) || 'Member',
        }))
        setTeamMembers(mapped)

        // Ensure current user is in selected set
        if (!selectedParticipants.has(user.id)) {
          setSelectedParticipants((prev) => new Set([...prev, user.id]))
        }
      }
    } catch {
      // Graceful degradation -- no team members found
      setTeamMembers([])
    } finally {
      setTeamLoading(false)
    }
  }, [user, selectedParticipants])

  // ---------------------------------------------------------------------------
  // KPI selection handlers
  // ---------------------------------------------------------------------------

  const toggleKPI = (kpiId: string, defaultPoints: number) => {
    setSelectedKPIs((prev) => {
      const next = new Map(prev)
      if (next.has(kpiId)) {
        next.delete(kpiId)
      } else {
        next.set(kpiId, defaultPoints)
      }
      return next
    })
  }

  const updateKPIWeight = (kpiId: string, weight: number) => {
    setSelectedKPIs((prev) => {
      const next = new Map(prev)
      next.set(kpiId, Math.max(1, weight))
      return next
    })
  }

  const handleAddCustomKPI = async () => {
    if (!newKPIName.trim() || !newKPIActivityType.trim()) return

    await createKPI({
      name: newKPIName.trim(),
      icon: 'BarChart3',
      activity_type: newKPIActivityType.trim(),
      formula_type: 'count',
      points_per_unit: newKPIPoints,
    })

    setNewKPIName('')
    setNewKPIActivityType('')
    setNewKPIPoints(1)
    setShowInlineKPIForm(false)
  }

  // ---------------------------------------------------------------------------
  // Participant handlers
  // ---------------------------------------------------------------------------

  const toggleParticipant = (userId: string) => {
    setSelectedParticipants((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) {
        // Don't allow removing self
        if (userId === user?.id) return prev
        next.delete(userId)
      } else {
        next.add(userId)
      }
      return next
    })
  }

  const selectAllParticipants = () => {
    setSelectedParticipants(new Set(teamMembers.map((m) => m.id)))
  }

  const clearParticipants = () => {
    // Always keep self
    setSelectedParticipants(new Set(user ? [user.id] : []))
  }

  // ---------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------

  const canProceed = (): boolean => {
    switch (step) {
      case 1:
        return name.trim().length > 0
      case 2:
        return selectedKPIs.size > 0
      case 3:
        return selectedParticipants.size > 0
      case 4:
        return true
      default:
        return false
    }
  }

  const handleNext = () => {
    if (step < 4 && canProceed()) {
      setStep((step + 1) as WizardStep)
    }
  }

  const handleBack = () => {
    if (step > 1) {
      setStep((step - 1) as WizardStep)
    }
  }

  const handleSubmit = async () => {
    if (!canProceed()) return

    setSubmitting(true)
    try {
      const startDate = useCustomDates && customStart ? new Date(customStart).toISOString() : undefined
      const endDate = useCustomDates && customEnd ? new Date(customEnd + 'T23:59:59.999Z').toISOString() : undefined

      // Build KPI config from selections
      const kpiConfig: CompetitionKPI[] = Array.from(selectedKPIs.entries()).map(([kpiId, points]) => {
        const kpi = allKPIs.find((k) => k.id === kpiId)
        return {
          kpi_id: kpiId,
          name: kpi?.name || kpiId,
          activity_type: kpi?.activity_type || kpiId,
          points_per_unit: points,
        }
      })

      const participantIds = Array.from(selectedParticipants)

      await onSubmit(
        name.trim(),
        period,
        startDate,
        endDate,
        description.trim() || undefined,
        kpiConfig,
        participantIds,
      )

      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Build selected KPIs summary for review
  // ---------------------------------------------------------------------------

  const getSelectedKPISummary = (): Array<{ name: string; points: number }> => {
    return Array.from(selectedKPIs.entries()).map(([kpiId, points]) => {
      const kpi = allKPIs.find((k) => k.id === kpiId)
      return { name: kpi?.name || kpiId, points }
    })
  }

  // ---------------------------------------------------------------------------
  // Render footer
  // ---------------------------------------------------------------------------

  const footer = (
    <div className="flex items-center justify-between">
      <div>
        {step > 1 && (
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>
        )}
      </div>
      <div>
        {step < 4 ? (
          <button
            type="button"
            onClick={handleNext}
            disabled={!canProceed()}
            className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Trophy className="w-4 h-4" />
            {submitting ? 'Creating...' : 'Create Competition'}
          </button>
        )}
      </div>
    </div>
  )

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Competition"
      icon={<Trophy className="w-5 h-5" />}
      size="lg"
      footer={footer}
    >
      <StepIndicator current={step} total={4} />

      {/* Step 1: Details */}
      {step === 1 && (
        <div className="space-y-5">
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
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-gray-900 dark:text-white placeholder-gray-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition"
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
                  onClick={() => {
                    setPeriod(p)
                    setUseCustomDates(false)
                  }}
                  className={`
                    px-3 py-2 rounded-lg text-sm font-medium transition
                    ${
                      period === p
                        ? 'bg-indigo-600 text-white shadow-sm'
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
                  className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
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
                  className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
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
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white outline-none focus:border-indigo-500 transition"
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
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white outline-none focus:border-indigo-500 transition"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Description */}
          <div>
            <label htmlFor="comp-desc" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              id="comp-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's this competition about?"
              rows={2}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-gray-900 dark:text-white placeholder-gray-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition resize-none"
            />
          </div>
        </div>
      )}

      {/* Step 2: Select KPIs */}
      {step === 2 && (
        <div className="space-y-5">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Choose which KPIs to track in this competition. Adjust the point weight for each.
          </p>

          {/* KPI Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {allKPIs.map((kpi) => {
              const isSelected = selectedKPIs.has(kpi.id)
              const currentWeight = selectedKPIs.get(kpi.id) ?? kpi.points_per_unit

              return (
                <div
                  key={kpi.id}
                  className={`
                    rounded-xl border-2 p-4 cursor-pointer transition
                    ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 dark:border-indigo-600'
                        : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600'
                    }
                  `}
                  onClick={() => toggleKPI(kpi.id, kpi.points_per_unit)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') toggleKPI(kpi.id, kpi.points_per_unit)
                  }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`p-2 rounded-lg ${
                          isSelected
                            ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                        }`}
                      >
                        {resolveIcon(kpi.icon)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{kpi.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {kpi.points_per_unit} pt{kpi.points_per_unit !== 1 ? 's' : ''}/unit
                        </p>
                      </div>
                    </div>
                    <div
                      className={`
                        w-5 h-5 rounded-md border-2 flex items-center justify-center transition
                        ${
                          isSelected
                            ? 'bg-indigo-600 border-indigo-600'
                            : 'border-gray-300 dark:border-gray-600'
                        }
                      `}
                    >
                      {isSelected && <Check className="w-3 h-3 text-white" />}
                    </div>
                  </div>

                  {/* Weight editor */}
                  {isSelected && (
                    <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                      <div className="flex items-center justify-between">
                        <label className="text-xs text-gray-500 dark:text-gray-400">Points per unit</label>
                        <input
                          type="number"
                          min={1}
                          max={100}
                          value={currentWeight}
                          onChange={(e) => {
                            e.stopPropagation()
                            updateKPIWeight(kpi.id, parseInt(e.target.value, 10) || 1)
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="w-16 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1 text-sm text-center text-gray-900 dark:text-white outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Inline KPI creation */}
          {!showInlineKPIForm ? (
            <button
              type="button"
              onClick={() => setShowInlineKPIForm(true)}
              className="inline-flex items-center gap-2 text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition"
            >
              <Plus className="w-4 h-4" />
              Create Custom KPI
            </button>
          ) : (
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-gray-900 dark:text-white">New Custom KPI</h4>
                <button
                  type="button"
                  onClick={() => setShowInlineKPIForm(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Name</label>
                <input
                  type="text"
                  value={newKPIName}
                  onChange={(e) => setNewKPIName(e.target.value)}
                  placeholder="e.g. Demos Completed"
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 outline-none focus:border-indigo-500 transition"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Activity Type (what it tracks)</label>
                <input
                  type="text"
                  value={newKPIActivityType}
                  onChange={(e) => setNewKPIActivityType(e.target.value)}
                  placeholder="e.g. demos_completed, interviews_booked"
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 outline-none focus:border-indigo-500 transition"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Points per unit</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={newKPIPoints}
                  onChange={(e) => setNewKPIPoints(parseInt(e.target.value, 10) || 1)}
                  className="w-24 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white outline-none focus:border-indigo-500 transition"
                />
              </div>

              <p className="text-xs text-gray-400 dark:text-gray-500 italic">
                Count-based by default. Advanced formulas coming soon.
              </p>

              <button
                type="button"
                onClick={handleAddCustomKPI}
                disabled={!newKPIName.trim() || !newKPIActivityType.trim()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="w-4 h-4" />
                Add KPI
              </button>
            </div>
          )}

          {selectedKPIs.size === 0 && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Select at least 1 KPI to continue.
            </p>
          )}
        </div>
      )}

      {/* Step 3: Invite Participants */}
      {step === 3 && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Select team members to include in the competition.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={selectAllParticipants}
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                Select All
              </button>
              <span className="text-xs text-gray-300 dark:text-gray-600">|</span>
              <button
                type="button"
                onClick={clearParticipants}
                className="text-xs text-gray-500 dark:text-gray-400 hover:underline"
              >
                Clear
              </button>
            </div>
          </div>

          {teamLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm">
                <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                Loading team members...
              </div>
            </div>
          ) : teamMembers.length === 0 ? (
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-8 text-center">
              <Users className="mx-auto h-8 w-8 text-gray-300 dark:text-gray-600 mb-3" />
              <p className="text-sm text-gray-500 dark:text-gray-400">
                You will compete solo. Invite team members from Settings.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {teamMembers.map((member) => {
                const isSelected = selectedParticipants.has(member.id)
                const isSelf = member.id === user?.id

                return (
                  <div
                    key={member.id}
                    className={`
                      flex items-center justify-between rounded-xl border p-3 cursor-pointer transition
                      ${
                        isSelected
                          ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 dark:border-indigo-600'
                          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600'
                      }
                    `}
                    onClick={() => toggleParticipant(member.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') toggleParticipant(member.id)
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <UserInitials name={member.display_name} />
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {member.display_name}
                          {isSelf && (
                            <span className="ml-2 text-xs text-indigo-600 dark:text-indigo-400">(You)</span>
                          )}
                        </p>
                        <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                          {member.role}
                        </span>
                      </div>
                    </div>
                    <div
                      className={`
                        w-5 h-5 rounded-md border-2 flex items-center justify-center transition
                        ${
                          isSelected
                            ? 'bg-indigo-600 border-indigo-600'
                            : 'border-gray-300 dark:border-gray-600'
                        }
                      `}
                    >
                      {isSelected && <Check className="w-3 h-3 text-white" />}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <p className="text-xs text-gray-500 dark:text-gray-400">
            {selectedParticipants.size} participant{selectedParticipants.size !== 1 ? 's' : ''} selected
          </p>
        </div>
      )}

      {/* Step 4: Review & Create */}
      {step === 4 && (
        <div className="space-y-5">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider">
            Review Competition
          </h3>

          {/* Name + Period */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 space-y-3">
            <div className="flex items-center gap-3">
              <Trophy className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">{name}</p>
                {description && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{description}</p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-gray-500 dark:text-gray-400">Period</p>
                <p className="font-medium text-gray-900 dark:text-white">{periodLabel(period)}</p>
              </div>
              <div>
                <p className="text-gray-500 dark:text-gray-400">Dates</p>
                <p className="font-medium text-gray-900 dark:text-white">
                  {useCustomDates
                    ? `${customStart} to ${customEnd}`
                    : `${formatDateForInput(computedRange.start)} to ${formatDateForInput(computedRange.end)}`}
                </p>
              </div>
            </div>
          </div>

          {/* KPIs */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
              KPIs ({selectedKPIs.size})
            </p>
            <div className="space-y-2">
              {getSelectedKPISummary().map((kpi) => (
                <div key={kpi.name} className="flex items-center justify-between text-sm">
                  <span className="text-gray-900 dark:text-white">{kpi.name}</span>
                  <span className="text-gray-500 dark:text-gray-400">
                    {kpi.points} pt{kpi.points !== 1 ? 's' : ''}/unit
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Participants */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
              Participants ({selectedParticipants.size})
            </p>
            <div className="flex flex-wrap gap-2">
              {teamMembers
                .filter((m) => selectedParticipants.has(m.id))
                .map((m) => (
                  <div
                    key={m.id}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-700 text-sm text-gray-900 dark:text-white"
                  >
                    <UserInitials name={m.display_name} />
                    <span>{m.display_name}</span>
                  </div>
                ))}
              {/* Show count if team is empty */}
              {teamMembers.filter((m) => selectedParticipants.has(m.id)).length === 0 && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {selectedParticipants.size} participant{selectedParticipants.size !== 1 ? 's' : ''}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </Modal>
  )
}
