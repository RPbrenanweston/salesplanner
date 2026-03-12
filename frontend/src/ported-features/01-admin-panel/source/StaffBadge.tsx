/**
 * @crumb staff-role-badge
 * @intent Visual role indicator badge with semantic color coding for staff member profiles
 * @responsibilities Render colored badge displaying StaffRole with role-specific background/text color, apply cn() utility for class composition
 * @contracts Props: { role: StaffRole, className?: string } | Returns: React.ReactNode | ROLE_STYLES: Record<StaffRole, string>
 * @hazards ROLE_STYLES is hardcoded Record mapping—no validation for unknown role values (will access undefined); badge renders role text directly without sanitization; className merging via cn() may lose custom styles if conflicts with ROLE_STYLES classes
 * @area admin-ui/badges
 * @refs types (StaffRole), cn utility, Tailwind color classes (purple/blue/amber/slate variants)
 * @prompt Consider validating role against StaffRole union before rendering. Extract ROLE_STYLES to types.ts for easier maintenance and reusability. Add aria-label for screen readers (e.g., "admin role").
 */

import { cn } from "./utils"
import type { StaffRole } from "./types"

interface StaffBadgeProps {
  role: StaffRole
  className?: string
}

const ROLE_STYLES: Record<StaffRole, string> = {
  admin: "bg-purple-50 text-purple-700 border-purple-200",
  moderator: "bg-blue-50 text-blue-700 border-blue-200",
  analyst: "bg-amber-50 text-amber-700 border-amber-200",
  support: "bg-slate-50 text-slate-600 border-slate-200",
}

export function StaffBadge({ role, className }: StaffBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-[4px] border font-mono text-[10px] uppercase tracking-widest",
        ROLE_STYLES[role],
        className
      )}
    >
      {role}
    </span>
  )
}
