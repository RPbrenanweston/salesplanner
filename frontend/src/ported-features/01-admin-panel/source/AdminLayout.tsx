/**
 * @crumb admin-layout-container
 * @intent Main two-column layout container (sidebar + content) for admin portal with navigation and user context
 * @responsibilities Render sidebar with brand, navigation menu (AdminNav), user footer; render flex-1 main content area; apply Frosted HUD design system
 * @contracts Props: { children: React.ReactNode, navItems: NavItem[], currentPath: string, user: AdminUser, permissions?: Partial<StaffPermissions> } | Returns: React.ReactNode
 * @hazards Sidebar width fixed at w-60 (240px)—no responsive collapse on mobile; AdminNav receives permission filter logic, sidebar itself has no permission checks
 * @area admin-ui/layout
 * @refs AdminNav (permission-filtered navigation), types (NavItem, AdminUser, StaffPermissions), Frosted HUD design tokens (#F3F4F6 bg, #10b77f accent)
 * @prompt Add responsive sidebar collapse for <md breakpoint. User avatar initials assume ASCII—test non-ASCII names. Verify min-h-screen covers all mobile viewports.
 */

import type { NavItem, AdminUser, StaffPermissions } from "./types"
import { AdminNav } from "./AdminNav"

interface AdminLayoutProps {
  children: React.ReactNode
  navItems: NavItem[]
  currentPath: string
  user: AdminUser
  permissions?: Partial<StaffPermissions>
  onSignOut?: () => void
}

export function AdminLayout({
  children,
  navItems,
  currentPath,
  user,
  permissions,
  onSignOut,
}: AdminLayoutProps) {
  return (
    <div className="min-h-screen bg-[#F3F4F6] bg-grid-pattern flex">
      {/* Sidebar */}
      <aside className="w-60 shrink-0 bg-white/65 backdrop-blur-md border-r border-black/[0.08] flex flex-col">
        {/* Logo / Brand */}
        <div className="px-5 py-5 border-b border-black/[0.06]">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-widest text-slate-400">
              [ADMIN]
            </span>
          </div>
          <div className="mt-1 font-display text-slate-800 font-bold text-sm leading-tight">
            JobTrackr
          </div>
        </div>

        {/* Nav */}
        <div className="flex-1 px-3 py-4">
          <AdminNav items={navItems} currentPath={currentPath} permissions={permissions} />
        </div>

        {/* User footer */}
        <div className="px-4 py-4 border-t border-black/[0.06]">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-[#10b77f]/20 flex items-center justify-center shrink-0">
              <span className="font-mono text-[10px] text-[#10b77f] font-bold">
                {user.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-mono text-[10px] uppercase tracking-widest text-slate-400 truncate">
                [{user.role}]
              </div>
              <div className="text-xs text-slate-600 truncate">{user.name}</div>
            </div>
            {onSignOut && (
              <button
                onClick={onSignOut}
                title="Sign out"
                className="shrink-0 text-slate-400 hover:text-slate-700 transition-colors"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                  logout
                </span>
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0 overflow-auto">
        <div className="p-6">{children}</div>
      </main>
    </div>
  )
}
