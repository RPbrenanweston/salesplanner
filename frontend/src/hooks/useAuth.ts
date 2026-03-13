// @crumb frontend-auth-state-manager
// SEC | session_state_retrieval | auth_state_subscription | user_context_provision | sign_out | loading_state_management
// why: React hook managing authentication state lifecycle and session subscription for persistent user context across app
// in:Supabase auth client (singleton),auth state change events out:User/session objects,loading flag,signOut callback err:getSession throws on network failure;onAuthStateChange may miss rapid auth transitions
// hazard: useAuth doesn't refresh expired tokens — depends on Supabase client auto-refresh (can fail silently if offline); loading flag race where loading=false but user still null
// hazard: useEffect cleanup unsubscribe may not fire reliably on rapid unmount — could leave lingering subscription listeners eating memory
// edge:frontend/src/lib/supabase.ts -> CALLS
// edge:frontend/src/components/ProtectedRoute.tsx -> CALLS
// edge:frontend/src/components/AppLayout.tsx -> READS
// edge:auth-flow#1 -> STEP_IN
// prompt: Consider adding auth token refresh wrapper to handle expired tokens proactively. Add telemetry for loading delays >1s. Verify cleanup unsubscribe fires on component unmount under rapid mount/unmount scenarios (React.StrictMode double-mount). Test offline scenarios.

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
