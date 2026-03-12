/**
 * @crumb toggle-card-control
 * @intent Client-side toggle switch control for boolean admin settings with label and description
 * @responsibilities Render accessible switch component with enabled/disabled state, handle onChange callback, apply visual styling based on state
 * @contracts Props: { label: string, description?: string, enabled: boolean, onChange: (enabled: boolean) => void, disabled?: boolean } | Returns: React.ReactNode
 * @hazards onChange callback not debounced—rapid clicks trigger multiple state changes; disabled state only affects visual styling, form submission validation required
 * @area admin-ui/form-controls
 * @refs AdminLayout (container), StaffPermissions (access control integration point), cn utility
 * @prompt Maintain aria-checked sync with enabled prop. Verify transition classes (translate-x-5/x-0.5) work on all browsers. Consider debouncing onChange in parent.
 */

"use client"

import { cn } from "./utils"

interface ToggleCardProps {
  label: string
  description?: string
  enabled: boolean
  onChange: (enabled: boolean) => void
  disabled?: boolean
}

export function ToggleCard({
  label,
  description,
  enabled,
  onChange,
  disabled = false,
}: ToggleCardProps) {
  return (
    <div className="bg-white/65 backdrop-blur-md rounded-[12px] border border-black/[0.08] px-5 py-4 flex items-center gap-4">
      <div className="flex-1 min-w-0">
        <div className="font-medium text-slate-800 text-sm">{label}</div>
        {description && (
          <div className="mt-0.5 font-mono text-[11px] text-slate-400 leading-snug">
            {description}
          </div>
        )}
      </div>

      {/* Toggle switch */}
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        onClick={() => !disabled && onChange(!enabled)}
        disabled={disabled}
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-[#10b77f]/30",
          enabled ? "bg-[#10b77f]" : "bg-slate-200",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        <span
          className={cn(
            "pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transition-transform",
            enabled ? "translate-x-5" : "translate-x-0.5"
          )}
        />
      </button>
    </div>
  )
}
