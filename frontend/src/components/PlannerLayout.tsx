import { useState, useEffect, ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  CalendarDays,
  Sunrise,
  BookOpen,
  FileText,
  Target,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Sun,
  Moon,
  Rocket,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useTheme } from '../hooks/useTheme'
import { useUserProfile } from '../hooks'
import { updateUserPreferences } from '../lib/queries/userQueries'
import { PLANNER_BRAND } from '../lib/branding'

interface NavItem {
  name: string
  path: string
  icon: typeof CalendarDays
}

const navItems: NavItem[] = [
  { name: 'Briefing', path: '/briefing', icon: Sunrise },
  { name: 'Day Planner', path: '/planner', icon: CalendarDays },
  { name: 'Activity', path: '/activity', icon: FileText },
  { name: 'Debrief', path: '/debrief', icon: BookOpen },
  { name: 'Goals', path: '/goals', icon: Target },
  { name: 'Settings', path: '/settings', icon: Settings },
]

interface PlannerLayoutProps {
  children: ReactNode
}

export default function PlannerLayout({ children }: PlannerLayoutProps) {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const { theme, resolvedTheme, setTheme } = useTheme()
  const [collapsed, setCollapsed] = useState(false)

  const { data: userProfile } = useUserProfile(user?.id)

  useEffect(() => {
    if (userProfile?.preferences?.sidebarCollapsed !== undefined) {
      setCollapsed(userProfile.preferences.sidebarCollapsed)
    }
  }, [userProfile])

  const toggleSidebar = async () => {
    const newCollapsed = !collapsed
    setCollapsed(newCollapsed)

    if (user) {
      await updateUserPreferences(user.id, {
        sidebarCollapsed: newCollapsed,
      })
    }
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/signin')
  }

  const cycleTheme = () => {
    if (theme === 'system') {
      setTheme('light')
    } else if (theme === 'light') {
      setTheme('dark')
    } else {
      setTheme('system')
    }
  }

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-void-950">
      {/* Sidebar */}
      <aside
        className={`${
          collapsed ? 'w-20' : 'w-64'
        } bg-white dark:bg-void-900 border-r border-gray-200 dark:border-white/10 flex flex-col transition-all duration-300 ease-snappy`}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-center border-b border-gray-200 dark:border-white/10 px-4">
          <div className={`${collapsed ? 'text-sm' : 'text-xl'} font-display font-bold text-indigo-electric transition-all`}>
            {collapsed ? PLANNER_BRAND.shortName : PLANNER_BRAND.appName}
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 space-y-0.5 px-2 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center ${
                  collapsed ? 'justify-center' : 'justify-start'
                } px-3 py-2.5 rounded-lg transition-colors duration-150 ease-snappy ${
                  isActive
                    ? 'bg-indigo-electric/10 text-indigo-electric dark:bg-indigo-electric/10 dark:text-indigo-electric'
                    : 'text-gray-600 dark:text-white/50 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white'
                }`
              }
              title={collapsed ? item.name : undefined}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span className="ml-3 text-sm font-medium">{item.name}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Upgrade CTA */}
        {!collapsed && (
          <div className="px-3 mb-3">
            <a
              href={PLANNER_BRAND.upgradeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-indigo-electric/5 border border-indigo-electric/20 text-indigo-electric hover:bg-indigo-electric/10 transition-colors duration-150"
            >
              <Rocket className="w-4 h-4 flex-shrink-0" />
              <span className="text-xs font-medium">Upgrade to SalesBlock</span>
            </a>
          </div>
        )}

        {/* User Section */}
        <div className="border-t border-gray-200 dark:border-white/10 p-3">
          <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'} mb-2`}>
            <div className="w-8 h-8 bg-indigo-electric rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
              {(userProfile?.display_name || user?.email || '').charAt(0).toUpperCase()}
            </div>
            {!collapsed && (
              <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {userProfile?.display_name || user?.email || ''}
              </span>
            )}
          </div>
          <div className="flex items-center justify-between gap-1">
            <button
              onClick={cycleTheme}
              className={`flex items-center ${
                collapsed ? 'justify-center w-full' : 'justify-start'
              } px-3 py-2 rounded-lg text-gray-500 dark:text-white/40 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white transition-colors duration-150 ease-snappy`}
              title={collapsed ? `Theme: ${theme}` : undefined}
            >
              {resolvedTheme === 'dark' ? (
                <Moon className="w-4 h-4" />
              ) : (
                <Sun className="w-4 h-4" />
              )}
              {!collapsed && <span className="ml-2 text-xs capitalize">{theme}</span>}
            </button>
            <button
              onClick={handleSignOut}
              className={`flex items-center ${
                collapsed ? 'justify-center w-full' : 'justify-start'
              } px-3 py-2 rounded-lg text-gray-500 dark:text-white/40 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-red-600 dark:hover:text-red-alert transition-colors duration-150 ease-snappy`}
              title={collapsed ? 'Sign out' : undefined}
            >
              <LogOut className="w-4 h-4" />
              {!collapsed && <span className="ml-2 text-xs">Sign out</span>}
            </button>
            {!collapsed && (
              <button
                onClick={toggleSidebar}
                className="p-2 rounded-lg text-gray-500 dark:text-white/40 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white transition-colors duration-150 ease-snappy"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}
          </div>
          {collapsed && (
            <button
              onClick={toggleSidebar}
              className="w-full mt-1 p-2 rounded-lg text-gray-500 dark:text-white/40 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white flex items-center justify-center transition-colors duration-150 ease-snappy"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
