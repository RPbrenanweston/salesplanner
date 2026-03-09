import { useState, ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  Home,
  Clock,
  List,
  Mail,
  Share2,
  TrendingUp,
  Target,
  BarChart2,
  Users,
  Settings,
  FileText,
  Trophy,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Sun,
  Moon
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useTheme } from '../hooks/useTheme'
import { useUserProfile, useOrganizationLogo } from '../hooks'
import { updateUserPreferences } from '../lib/queries/userQueries'
import { ROUTES } from '../lib/routes'
import TrialExpiryBanner from './TrialExpiryBanner'

interface NavItem {
  name: string
  path: string
  icon: typeof Home
}

const navItems: NavItem[] = [
  { name: 'Home', path: ROUTES.HOME, icon: Home },
  { name: 'SalesBlocks', path: ROUTES.SALESBLOCKS, icon: Clock },
  { name: 'Lists', path: ROUTES.LISTS, icon: List },
  { name: 'Scripts', path: ROUTES.SCRIPTS, icon: FileText },
  { name: 'Templates', path: ROUTES.TEMPLATES, icon: MailTemplate },
  { name: 'Email', path: ROUTES.EMAIL, icon: Mail },
  { name: 'Social', path: ROUTES.SOCIAL, icon: Share2 },
  { name: 'Pipeline', path: ROUTES.PIPELINE, icon: TrendingUp },
  { name: 'Goals', path: ROUTES.GOALS, icon: Target },
  { name: 'Analytics', path: ROUTES.ANALYTICS, icon: BarChart2 },
  { name: 'Team', path: ROUTES.TEAM, icon: Users },
  { name: 'Settings', path: ROUTES.SETTINGS, icon: Settings },
]

interface AppLayoutProps {
  children: ReactNode
}

export default function AppLayout({ children }: AppLayoutProps) {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const { theme, resolvedTheme, setTheme } = useTheme()
  const [collapsed, setCollapsed] = useState(false)

  // Fetch user profile using the new hook (handles caching)
  const { data: userProfile } = useUserProfile(user?.id)

  // Fetch org logo using the new hook (handles caching)
  const { data: orgLogoUrl } = useOrganizationLogo(userProfile?.org_id)

  // Set sidebar collapsed state from user preferences
  if (userProfile?.preferences?.sidebarCollapsed !== collapsed) {
    setCollapsed(userProfile?.preferences?.sidebarCollapsed ?? false)
  }

  const toggleSidebar = async () => {
    const newCollapsed = !collapsed
    setCollapsed(newCollapsed)

    if (user) {
      // Persist preference to Supabase
      await updateUserPreferences(user.id, {
        sidebarCollapsed: newCollapsed,
      })
    }
  }

  const handleSignOut = async () => {
    await signOut()
    navigate(ROUTES.SIGNIN)
  }

  const cycleTheme = () => {
    // Cycle through: system → light → dark → system
    if (theme === 'system') {
      setTheme('light')
    } else if (theme === 'light') {
      setTheme('dark')
    } else {
      setTheme('system')
    }
  }

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      {/* Sidebar */}
      <aside
        className={`${
          collapsed ? 'w-20' : 'w-64'
        } bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col transition-all duration-300`}
      >
        {/* Logo Section */}
        <div className="h-16 flex items-center justify-center border-b border-gray-200 dark:border-gray-700 px-4">
          {orgLogoUrl ? (
            <img
              src={orgLogoUrl}
              alt="Organization logo"
              className={`${collapsed ? 'w-8 h-8' : 'h-10'} object-contain`}
            />
          ) : (
            <div className={`${collapsed ? 'text-sm' : 'text-xl'} font-bold text-blue-600 dark:text-blue-400 transition-all`}>
              {collapsed ? 'SB' : 'SalesBlock.io'}
            </div>
          )}
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 py-4 space-y-1 px-2 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center ${
                  collapsed ? 'justify-center' : 'justify-start'
                } px-4 py-3 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`
              }
              title={collapsed ? item.name : undefined}
            >
              <item.icon className="w-5 h-5" />
              {!collapsed && <span className="ml-3 text-sm font-medium">{item.name}</span>}
            </NavLink>
          ))}
        </nav>

        {/* User Section at Bottom */}
        <div className="border-t border-gray-200 dark:border-gray-700 p-4">
          <div className={`flex items-center ${collapsed ? 'justify-center' : 'justify-between'} mb-3`}>
            {!collapsed && (
              <div className="flex items-center min-w-0">
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-medium flex-shrink-0">
                  {(userProfile?.display_name || user?.email || '').charAt(0).toUpperCase()}
                </div>
                <span className="ml-2 text-sm font-medium text-gray-900 dark:text-white truncate">
                  {userProfile?.display_name || user?.email || ''}
                </span>
              </div>
            )}
            {collapsed && (
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                {(userProfile?.display_name || user?.email || '').charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={cycleTheme}
              className={`flex items-center ${
                collapsed ? 'justify-center' : 'justify-start'
              } px-3 py-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors`}
              title={collapsed ? `Theme: ${theme}` : undefined}
            >
              {resolvedTheme === 'dark' ? (
                <Moon className="w-4 h-4" />
              ) : (
                <Sun className="w-4 h-4" />
              )}
              {!collapsed && <span className="ml-2 text-sm capitalize">{theme}</span>}
            </button>
            <button
              onClick={handleSignOut}
              className={`flex items-center ${
                collapsed ? 'justify-center' : 'justify-start'
              } px-3 py-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors`}
              title={collapsed ? 'Sign out' : undefined}
            >
              <LogOut className="w-4 h-4" />
              {!collapsed && <span className="ml-2 text-sm">Sign out</span>}
            </button>
            {!collapsed && (
              <button
                onClick={toggleSidebar}
                className="p-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}
          </div>
          {collapsed && (
            <button
              onClick={toggleSidebar}
              className="w-full mt-2 p-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-center"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-auto">
        <TrialExpiryBanner />
        {children}
      </main>
    </div>
  )
}
