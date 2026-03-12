/**
 * @crumb admin-package-barrel
 * @intent Central export point for @jobtrackr/admin UI package with zero @jobtrackr/* dependencies
 * @responsibilities Export cn utility, type definitions (StaffRole, StaffPermissions, NavItem, AdminUser, TableColumn), and 8 UI components
 * @contracts Exports: cn(), 5 types, 8 components | Returns: Named exports only, no default export
 * @hazards Package zero-dependency by design—copying to other repos loses tree-shaking benefits; version mismatches on clsx/tailwind-merge risk breaking cn() utility
 * @area admin-ui/exports
 * @refs All 8 admin components (ToggleCard, PermissionGate, StatCard, ConfirmDialog, StaffBadge, AdminLayout, AdminNav, DataTable), types.ts, utils.ts
 * @prompt Keep imports named-only (no default export) for clarity. Document portability constraints if publishing to npm. Update re-export shims in @jobtrackr if types change.
 */

// @jobtrackr/admin — Portable admin UI package
// Zero @jobtrackr/* dependencies — safe to copy to any repo.

export { cn } from "./utils"

export type { StaffRole, StaffPermissions, NavItem, AdminUser, TableColumn } from "./types"

export { AdminLayout } from "./AdminLayout"
export { AdminNav } from "./AdminNav"
export { DataTable } from "./DataTable"
export { ToggleCard } from "./ToggleCard"
export { PermissionGate } from "./PermissionGate"
export { StatCard } from "./StatCard"
export { ConfirmDialog } from "./ConfirmDialog"
export { StaffBadge } from "./StaffBadge"
