/**
 * @crumb confirm-dialog-modal
 * @intent Modal confirmation dialog component for destructive or critical admin actions
 * @responsibilities Render fixed overlay with modal dialog, support destructive action styling, handle onConfirm/onCancel callbacks
 * @contracts Props: { open: boolean, title: string, description: string, confirmLabel?: string, cancelLabel?: string, destructive?: boolean, onConfirm: () => void, onCancel: () => void } | Returns: React.ReactNode | null
 * @hazards Backdrop click closes dialog (dismissal via click)—no prevention of accidental close; destructive flag only affects button color, no server-side enforcement of permissions; fixed positioning breaks in transformed parent containers
 * @area admin-ui/dialogs
 * @refs AdminLayout (uses in permission management), z-50 fixed overlay pattern, frosted HUD backdrop-blur
 * @prompt Verify onCancel handler doesn't lose unsaved state. Consider required confirmation checkbox for true destructive actions. Test fixed positioning in nested display:contents parents.
 */

"use client"

import { cn } from "./utils"

interface ConfirmDialogProps {
  open: boolean
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* Dialog */}
      <div className="relative z-10 bg-white rounded-[12px] border border-black/[0.08] shadow-xl p-6 w-full max-w-sm mx-4">
        <div className="font-display font-bold text-slate-800 text-base">
          {title}
        </div>
        <div className="mt-2 text-sm text-slate-500 font-mono leading-relaxed">
          {description}
        </div>

        <div className="mt-5 flex gap-3 justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-[6px] border border-slate-200 text-sm font-mono text-slate-600 hover:bg-slate-50 transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={cn(
              "px-4 py-2 rounded-[6px] text-sm font-mono text-white transition-colors",
              destructive
                ? "bg-red-500 hover:bg-red-600"
                : "bg-[#10b77f] hover:bg-[#0ea370]"
            )}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
