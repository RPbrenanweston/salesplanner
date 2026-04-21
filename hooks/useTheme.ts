'use client'

import { useEffect, useState } from 'react'
import { getSupabaseBrowser } from '@/lib/supabase/browser'

export type Theme = 'light' | 'dark' | 'system'

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>('dark')
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('dark')

  const getSystemPreference = (): 'light' | 'dark' =>
    window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'

  const applyTheme = (resolved: 'light' | 'dark') => {
    document.documentElement.classList.remove('light', 'dark')
    document.documentElement.classList.add(resolved)
    setResolvedTheme(resolved)
  }

  const resolveTheme = (t: Theme): 'light' | 'dark' =>
    t === 'system' ? getSystemPreference() : t

  useEffect(() => {
    const saved = (localStorage.getItem('theme') as Theme | null) ?? 'dark'
    setThemeState(saved)
    applyTheme(resolveTheme(saved))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const setTheme = async (newTheme: Theme) => {
    setThemeState(newTheme)
    applyTheme(resolveTheme(newTheme))
    localStorage.setItem('theme', newTheme)

    try {
      const supabase = getSupabaseBrowser()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data } = await supabase.from('users').select('preferences').eq('id', user.id).maybeSingle()
        await supabase.from('users').update({ preferences: { ...data?.preferences, theme: newTheme } }).eq('id', user.id)
      }
    } catch {
      // non-fatal
    }
  }

  return { theme, resolvedTheme, setTheme }
}
