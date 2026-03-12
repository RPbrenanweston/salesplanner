/**
 * @crumb admin-types-definitions
 * @intent Shared type definitions for admin package with zero @jobtrackr/* dependencies
 * @responsibilities Define StaffRole union, StaffPermissions interface (8 boolean flags), NavItem, AdminUser, and TableColumn<T> generic
 * @contracts Exports: 5 types | Usage: import type { StaffPermissions, NavItem } from "@jobtrackr/admin/types"
 * @hazards StaffPermissions flags are all boolean—no role inheritance or permission hierarchy; NavItem.icon expects Material Symbols name strings without validation
 * @area admin-ui/types
 * @refs All admin components (use StaffPermissions), AdminLayout (uses NavItem, AdminUser), DataTable (uses TableColumn generic)
 * @prompt Maintain 1:1 correspondence between StaffPermissions boolean flags and UI features in AdminLayout/AdminNav. Document icon naming convention (Material Symbols Outlined CSS class names).
 */

// Admin package shared types — zero @jobtrackr/* dependencies

export type StaffRole = "admin" | "moderator" | "analyst" | "support"

export interface StaffPermissions {
  canViewUsers: boolean
  canEditUsers: boolean
  canDeleteUsers: boolean
  canViewIntel: boolean
  canEditSettings: boolean
  canViewAIConfig: boolean
  canEditAIConfig: boolean
  canManageStaff: boolean
}

export interface NavItem {
  label: string
  href: string
  icon: string // Material Symbols name
  requiredPermission?: keyof StaffPermissions
}

export interface AdminUser {
  id: string
  name: string
  email: string
  role: StaffRole
}

export interface TableColumn<T> {
  key: keyof T | string
  label: string
  sortable?: boolean
  render?: (value: unknown, row: T) => React.ReactNode
}
