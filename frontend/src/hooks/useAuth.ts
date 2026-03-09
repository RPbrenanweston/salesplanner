/**
 * @crumb
 * @id frontend-auth-state-manager
 * @area SEC
 * @intent React hook managing authentication state lifecycle and session subscription for persistent user context across app
 * @responsibilities Session state retrieval, auth state change subscription, user context provision, sign-out functionality, loading state management
 * @contracts useAuth() → {user: User | null, session: Session | null, loading: boolean, signOut: () → Promise<void>}
 * @in Supabase auth client (singleton), auth state change events from supabase.auth.onAuthStateChange
 * @out User/session objects (from Supabase Auth), loading flag, signOut callback
 * @err getSession throws on network failure (offline), onAuthStateChange listener may miss rapid auth transitions (concurrent signIn/signOut)
 * @hazard useAuth doesn't refresh expired tokens—depends on Supabase client auto-refresh (can fail silently if offline); loading flag set to false before async getSession completes—brief race where loading=false but user still null
 * @hazard useEffect cleanup unsubscribe may not fire reliably on component rapid unmount—could leave lingering subscription listeners eating memory
 * @shared-edges frontend/src/lib/supabase.ts→USES singleton client for auth operations; frontend/src/components/ProtectedRoute.tsx→CALLS for session check before route render; frontend/src/components/AppLayout.tsx→CONSUMES for user context display (name, avatar)
 * @trail auth-flow#1 | App mounts → useAuth hook calls getSession → subscribes to onAuthStateChange → ProtectedRoute reads session → renders protected content; user signs out → onAuthStateChange fires → loading=true briefly → user=null → ProtectedRoute redirects to signin
 * @prompt Consider adding auth token refresh wrapper to handle expired tokens proactively. Add telemetry for loading delays >1s. Verify cleanup unsubscribe fires on component unmount under rapid mount/unmount scenarios (React.StrictMode double-mount). Test offline scenarios.
 */

import { useEffect, useRef, useState } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  // Prevents onAuthStateChange from prematurely clearing loading=true
  // before the initial getSession resolves (race condition fix)
  const initialised = useRef(false)

  useEffect(() => {
    // Authoritative first load — getSession is the source of truth on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      initialised.current = true
      setLoading(false)
    })

    // Only handle subsequent auth changes (sign in, sign out, token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!initialised.current) return // skip if getSession hasn't resolved yet
      setSession(session)
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  return {
    user,
    session,
    loading,
    signOut,
  }
}
