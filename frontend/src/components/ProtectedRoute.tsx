// @crumb frontend-protected-route-enforcer
// SEC | session_validation | auth_state_subscription | signin_redirect | loading_skeleton
// why: Route wrapper component enforcing authentication requirements and preventing unauthenticated access to protected routes
// in:Session state via useAuth hook,child components (protected pages) out:Protected JSX or redirect to signin err:getSession network failure,onAuthStateChange misses transition,redirect race during logout
// hazard: Synchronous redirect to /signin on first auth check — concurrent logout causes redirect loop
// hazard: useEffect dependency array missing loading — unmounted component may fire causing memory leak
// edge:frontend/src/hooks/useAuth.ts -> CALLS
// edge:frontend/src/components/AppLayout.tsx -> RELATES
// edge:frontend/src/App.tsx -> RELATES
// edge:route-protection#1 -> STEP_IN
// prompt: Consider debouncing rapid auth transitions to prevent redirect flicker. Add telemetry for auth check latency. Test redirect race condition.

import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

interface ProtectedRouteProps {
  children: React.ReactNode
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex h-screen bg-gray-50 dark:bg-gray-900 animate-pulse">
        {/* Sidebar skeleton */}
        <div className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
          {/* Logo */}
          <div className="h-16 flex items-center justify-center border-b border-gray-200 dark:border-gray-700">
            <div className="h-8 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
          </div>
          {/* Nav items */}
          <div className="flex-1 p-4 space-y-1">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-lg">
                <div className="w-5 h-5 bg-gray-200 dark:bg-gray-700 rounded" />
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded flex-1" />
              </div>
            ))}
          </div>
          {/* User section */}
          <div className="border-t border-gray-200 dark:border-gray-700 p-4 flex items-center gap-3">
            <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full" />
            <div className="flex-1 space-y-1">
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-24" />
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-32" />
            </div>
          </div>
        </div>
        {/* Main content skeleton */}
        <div className="flex-1 overflow-auto p-6 space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-48" />
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full" />
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
          <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-lg mt-4" />
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/signin" replace />
  }

  return <>{children}</>
}
