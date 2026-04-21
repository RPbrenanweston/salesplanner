'use client'

import { useEffect, useRef, useState } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { getSupabaseBrowser } from '@/lib/supabase/browser'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const initialised = useRef(false)

  useEffect(() => {
    const supabase = getSupabaseBrowser()

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      initialised.current = true
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!initialised.current) return
      setSession(session)
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signOut = async () => {
    await getSupabaseBrowser().auth.signOut()
  }

  return { user, session, loading, signOut }
}
