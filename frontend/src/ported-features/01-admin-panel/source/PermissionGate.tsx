/**
 * @crumb permission-gate-wrapper
 * @intent Server or client permission-based conditional rendering wrapper for admin UI elements
 * @responsibilities Check StaffPermissions against required permission key, render children if allowed or fallback if denied
 * @contracts Props: { permissions: Partial<StaffPermissions>, require: keyof StaffPermissions, children: React.ReactNode, fallback?: React.ReactNode } | Returns: React.ReactNode
 * @hazards Fallback defaults to null (hidden)—no visual feedback for denied permissions; permission checks are synchronous, cannot validate against async data sources
 * @area admin-ui/access-control
 * @refs AdminLayout (uses PermissionGate wrapper), StaffPermissions (permission enum), AdminNav (permission filtering pattern)
 * @prompt Default fallback to empty fragment—ensure parent provides context for denied access. Compare with AdminNav permission filtering pattern.
 */

import type { StaffPermissions } from "./types"

interface PermissionGateProps {
  permissions: Partial<StaffPermissions>
  require: keyof StaffPermissions
  children: React.ReactNode
  fallback?: React.ReactNode
}

export function PermissionGate({
  permissions,
  require,
  children,
  fallback = null,
}: PermissionGateProps) {
  if (!permissions[require]) {
    return <>{fallback}</>
  }
  return <>{children}</>
}
