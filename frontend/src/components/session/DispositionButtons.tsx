// @crumb frontend-component-disposition-buttons
// UI/Session/Activity | disposition_selection | activity_outcome_mapping | keyboard_shortcuts | session_state_update
// why: Call disposition buttons — capture call outcome (no answer, voicemail, connected, etc) with keyboard shortcuts and save to session activity
// in:SessionType(call,email,social),ActivityOutcome enum,keyboard shortcut press events out:Disposition selected via onSelectDisposition callback,activity saved with outcome err:Invalid disposition for session type,keyboard shortcut conflict
// hazard: Keyboard shortcut (1-6) conflicts with browser/OS shortcuts on some systems — user expects shortcut to work but OS intercepts it
// hazard: Email dispositions use generic 'other' outcome for Sent/Opened — loses granularity in reporting and search filters
// edge:frontend/src/pages/SalesBlockSessionPage.tsx -> RELATES
// edge:frontend/src/types/enums.ts -> READS
// prompt: Add fallback disposition hints when keyboard shortcuts conflict. Consider dedicated email disposition enum (email_sent, email_opened, email_replied). Test shortcuts on Mac (Cmd+1) vs Windows (Ctrl+1).

import { useCallback, useEffect, useState } from 'react'
import type { SessionType } from '../../types/domain'
import type { ActivityOutcome } from '../../types/enums'

interface DispositionConfig {
  label: string
  outcome: ActivityOutcome
  shortcut?: string
  variant: 'default' | 'success' | 'warning' | 'danger'
}

const CALL_DISPOSITIONS: DispositionConfig[] = [
  { label: 'No Answer', outcome: 'no_answer' as ActivityOutcome, shortcut: '1', variant: 'default' },
  { label: 'Left VM', outcome: 'voicemail' as ActivityOutcome, shortcut: '2', variant: 'default' },
  { label: 'Connected', outcome: 'connect' as ActivityOutcome, shortcut: '3', variant: 'success' },
  { label: 'Not Interested', outcome: 'not_interested' as ActivityOutcome, shortcut: '4', variant: 'danger' },
  { label: 'Meeting Set', outcome: 'meeting_booked' as ActivityOutcome, shortcut: '5', variant: 'success' },
  { label: 'Call Back', outcome: 'follow_up' as ActivityOutcome, shortcut: '6', variant: 'warning' },
]

const EMAIL_DISPOSITIONS: DispositionConfig[] = [
  { label: 'Sent', outcome: 'other' as ActivityOutcome, variant: 'default' },
  { label: 'Opened', outcome: 'other' as ActivityOutcome, variant: 'default' },
  { label: 'Replied', outcome: 'connect' as ActivityOutcome, variant: 'success' },
  { label: 'Meeting Set', outcome: 'meeting_booked' as ActivityOutcome, variant: 'success' },
]

const SOCIAL_DISPOSITIONS: DispositionConfig[] = [
  { label: 'Viewed', outcome: 'other' as ActivityOutcome, variant: 'default' },
  { label: 'Connected', outcome: 'connect' as ActivityOutcome, variant: 'success' },
  { label: 'Message Sent', outcome: 'other' as ActivityOutcome, variant: 'default' },
  { label: 'Replied', outcome: 'connect' as ActivityOutcome, variant: 'success' },
  { label: 'Meeting Set', outcome: 'meeting_booked' as ActivityOutcome, variant: 'success' },
]

function getDispositions(sessionType: SessionType): DispositionConfig[] {
  switch (sessionType) {
    case 'call': return CALL_DISPOSITIONS
    case 'email': return EMAIL_DISPOSITIONS
    case 'social': return SOCIAL_DISPOSITIONS
  }
}

/** Check if this disposition triggers the connected flow panel */
function isConnectedDisposition(outcome: ActivityOutcome, sessionType: SessionType): boolean {
  if (sessionType === 'call' && outcome === ('connect' as ActivityOutcome)) return true
  if (sessionType === 'email' && outcome === ('connect' as ActivityOutcome)) return true
  if (sessionType === 'social' && outcome === ('connect' as ActivityOutcome)) return true
  return false
}

const VARIANT_STYLES: Record<DispositionConfig['variant'], string> = {
  default: 'border-white/10 hover:bg-white/10 text-slate-300',
  success: 'border-emerald-500/30 hover:bg-emerald-500/20 text-emerald-400',
  warning: 'border-amber-500/30 hover:bg-amber-500/20 text-amber-400',
  danger: 'border-rose-500/30 hover:bg-rose-500/20 text-rose-400',
}

interface DispositionButtonsProps {
  sessionType: SessionType
  onDisposition: (outcome: ActivityOutcome, label: string) => void
  onConnectedFlow: () => void
  disabled?: boolean
}

export function DispositionButtons({
  sessionType,
  onDisposition,
  onConnectedFlow,
  disabled = false,
}: DispositionButtonsProps) {
  const dispositions = getDispositions(sessionType)
  const [pressedKey, setPressedKey] = useState<string | null>(null)

  const handleClick = useCallback(
    (config: DispositionConfig) => {
      if (disabled) return
      if (isConnectedDisposition(config.outcome, sessionType)) {
        onConnectedFlow()
      } else {
        onDisposition(config.outcome, config.label)
      }
    },
    [disabled, sessionType, onDisposition, onConnectedFlow]
  )

  // Keyboard shortcuts (call dispositions only)
  useEffect(() => {
    if (sessionType !== 'call' || disabled) return

    function handleKeyDown(e: KeyboardEvent) {
      // Don't trigger if user is typing in an input/textarea
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) return

      const config = dispositions.find((d) => d.shortcut === e.key)
      if (config) {
        setPressedKey(e.key)
        handleClick(config)
        setTimeout(() => setPressedKey(null), 200)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [sessionType, disabled, dispositions, handleClick])

  return (
    <div className="flex flex-wrap gap-2">
      {dispositions.map((config) => (
        <button
          key={config.label}
          onClick={() => handleClick(config)}
          disabled={disabled}
          className={`
            flex items-center gap-2 px-4 py-2.5 rounded-lg border font-medium text-sm
            transition-all duration-150 ease-snappy
            disabled:opacity-40 disabled:cursor-not-allowed
            ${VARIANT_STYLES[config.variant]}
            ${pressedKey === config.shortcut ? 'scale-95 ring-2 ring-indigo-500' : ''}
          `}
        >
          {config.shortcut && (
            <kbd className="text-[10px] font-mono bg-white/10 px-1.5 py-0.5 rounded">
              {config.shortcut}
            </kbd>
          )}
          {config.label}
        </button>
      ))}
    </div>
  )
}

export { getDispositions, isConnectedDisposition }
export type { DispositionConfig }
