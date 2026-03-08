/**
 * @crumb
 * @id frontend-protected-route-enforcer
 * @area SEC
 * @intent Route wrapper component enforcing authentication requirements and preventing unauthenticated access to protected routes
 * @responsibilities Session validation at route entry, auth state change subscription, redirect to signin on auth failure, loading state display during auth check
 * @contracts ProtectedRoute({children: ReactNode}) → JSX; renders {children} if authenticated, Navigate({to: '/signin'}) if unauthenticated, "Loading..." if auth check in progress
 * @in Session state via useAuth hook, child components (protected pages)
 * @out Protected JSX or redirect to signin
 * @err getSession network failure (offline), onAuthStateChange event misses auth transition (concurrent auth operations), redirect race during logout
 * @hazard Redirect to /signin happens synchronously on first auth check—if user is legitimately logging out concurrently, redirect race can cause redirect loop (user bounces /signin → /protected → /signin); Loading state "Loading..." is bare text—no visual feedback of progress, poor UX on slow networks (>2s)
 * @hazard useEffect dependency array missing loading—if loading state changes and component is unmounted, useEffect may fire after unmount causing memory leak
 * @shared-edges frontend/src/hooks/useAuth.ts→CALLS for session validation; frontend/src/components/AppLayout.tsx→WRAPPED in protected route definitions; frontend/src/App.tsx→NESTS ProtectedRoute around 10+ authenticated routes; protected pages (Settings, Contacts, Lists, etc.)→RENDERED as children
 * @trail route-protection#1 | Route mounts → ProtectedRoute calls useAuth → getSession in progress → render "Loading..." → getSession returns → if authenticated, render AppLayout + children; if unauthenticated, Navigate to /signin → user signs in on /signin → redirected to requested page
 * @prompt Add loading skeleton UI matching AppLayout dimensions to prevent layout shift. Consider debouncing rapid auth transitions (sign out → sign in within 100ms) to prevent redirect flicker. Add telemetry for auth check latency. Test redirect race condition when user signs out while ProtectedRoute mounting.
 */

import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

interface ProtectedRouteProps {
  children: React.ReactNode
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const [loading, setLoading] = useState(true)
  const [authenticated, setAuthenticated] = useState(false)

  useEffect(() => {
    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthenticated(!!session)
      setLoading(false)
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthenticated(!!session)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-gray-600 dark:text-gray-400">Loading...</div>
      </div>
    )
  }

  if (!authenticated) {
    return <Navigate to="/signin" replace />
  }

  return <>{children}</>
}
