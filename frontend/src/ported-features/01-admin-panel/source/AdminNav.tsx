/**
 * @crumb admin-navigation-menu
 * @intent Client-side navigation menu with permission-based filtering and active link detection
 * @responsibilities Filter NavItem array by StaffPermissions, detect currentPath active state, render Material Symbols icon + label for each visible item
 * @contracts Props: { items: NavItem[], currentPath: string, permissions?: Partial<StaffPermissions> } | Returns: React.ReactNode
 * @hazards Active detection: startsWith logic treats "/admin/settings" as active for "/admin" (false positive)—requires exact href or leading '/' context; permission check uses optional chaining, silently hides items if permissions falsy
 * @area admin-ui/navigation
 * @refs AdminLayout (parent container), types (NavItem, StaffPermissions), Material Symbols Outlined icon system
 * @prompt Fix active detection: add "exactly /admin" exception OR use exact match for root. Document permission handling edge cases (null, undefined, false). Material Symbols icons load via CDN—verify connectivity before deployment.
 */

"use client"

import { cn } from "./utils"
import type { NavItem, StaffPermissions } from "./types"

interface AdminNavProps {
  items: NavItem[]
  currentPath: string
  permissions?: Partial<StaffPermissions>
}

export function AdminNav({ items, currentPath, permissions }: AdminNavProps) {
  const visible = items.filter(
    (item) => !item.requiredPermission || permissions?.[item.requiredPermission]
  )
  return (
    <nav className="flex flex-col gap-1">
      {visible.map((item) => {
        const isActive =
          currentPath === item.href ||
          (item.href !== "/admin" && currentPath.startsWith(item.href))
        return (
          <a
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-[8px] transition-colors text-sm font-mono",
              isActive
                ? "bg-[#10b77f]/10 text-[#10b77f] font-medium"
                : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            )}
          >
            <span className="material-symbols-outlined text-[18px]">
              {item.icon}
            </span>
            <span className="tracking-wide">{item.label}</span>
          </a>
        )
      })}
    </nav>
  )
}
