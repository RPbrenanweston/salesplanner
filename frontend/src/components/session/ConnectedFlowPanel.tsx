import { useState } from 'react'
import type { ProgressFlags } from '../../types/domain'

interface ConnectedFlowPanelProps {
  onSaveAndNext: (flags: ProgressFlags) => void
  onSaveAndStay: (flags: ProgressFlags) => void
  onCancel: () => void
}

const DEFAULT_FLAGS: ProgressFlags = {
  intro_given: false,
  conversation_held: false,
  asked_for_meeting: false,
  meeting_booked: false,
  objection_details: '',
}

export function ConnectedFlowPanel({
  onSaveAndNext,
  onSaveAndStay,
  onCancel,
}: ConnectedFlowPanelProps) {
  const [flags, setFlags] = useState<ProgressFlags>({ ...DEFAULT_FLAGS })

  function toggleFlag(key: keyof Omit<ProgressFlags, 'objection_details'>) {
    setFlags((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const checkboxes: { key: keyof Omit<ProgressFlags, 'objection_details'>; label: string }[] = [
    { key: 'intro_given', label: 'Intro Given' },
    { key: 'conversation_held', label: 'Conversation Held' },
    { key: 'asked_for_meeting', label: 'Asked for Meeting' },
    { key: 'meeting_booked', label: 'Meeting Booked' },
  ]

  return (
    <div className="mt-3 p-4 rounded-lg border border-emerald-500/20 bg-emerald-500/5 space-y-4 animate-in slide-in-from-top-2 duration-200">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-emerald-400">
          Connected — How did it go?
        </h4>
        <button
          onClick={onCancel}
          className="text-xs text-slate-500 hover:text-slate-300"
        >
          Cancel
        </button>
      </div>

      <div className="space-y-2">
        {checkboxes.map(({ key, label }) => (
          <label
            key={key}
            className="flex items-center gap-3 cursor-pointer group"
          >
            <input
              type="checkbox"
              checked={flags[key]}
              onChange={() => toggleFlag(key)}
              className="h-4 w-4 rounded border-white/20 bg-white/5 text-indigo-500 focus:ring-indigo-500/50"
            />
            <span
              className={`text-sm ${
                flags[key] ? 'text-white' : 'text-slate-400 group-hover:text-slate-300'
              }`}
            >
              {label}
            </span>
            {key === 'meeting_booked' && flags[key] && (
              <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-bold">
                OUTCOME UPGRADE
              </span>
            )}
          </label>
        ))}
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-400 mb-1">
          Objection Details
        </label>
        <textarea
          value={flags.objection_details}
          onChange={(e) =>
            setFlags((prev) => ({ ...prev, objection_details: e.target.value }))
          }
          placeholder="&quot;Send me an email&quot; — budget not ready until Q3..."
          rows={2}
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-300 placeholder:text-slate-600 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none"
        />
      </div>

      <div className="flex gap-2 pt-1">
        <button
          onClick={() => onSaveAndNext(flags)}
          className="flex-1 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors"
        >
          Save & Next →
        </button>
        <button
          onClick={() => onSaveAndStay(flags)}
          className="px-4 py-2 rounded-lg border border-white/10 hover:bg-white/5 text-slate-300 text-sm font-medium transition-colors"
        >
          Save & Stay
        </button>
      </div>
    </div>
  )
}
