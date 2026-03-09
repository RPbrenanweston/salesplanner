/**
 * @crumb
 * @id frontend-hook-use-theme
 * @area UI/Theming
 * @intent useTheme hook — read and persist the current user's theme preference (light/dark/system), apply the theme class to the document root, sync to Supabase user_preferences
 * @responsibilities Load theme from Supabase user_preferences on mount, apply 'dark' class to document.documentElement, listen to system prefers-color-scheme if theme='system', expose setTheme to update preference in state and Supabase
 * @contracts useTheme() → { theme: Theme, setTheme: (t: Theme) => void }; reads/writes user_preferences table; applies/removes 'dark' class on document.documentElement
 * @in supabase user_preferences table (user_id, theme column), window.matchMedia for system theme detection
 * @out theme state (current resolved theme); setTheme (persists to Supabase + updates document class); 'dark' class on document.documentElement when dark mode active
 * @err Supabase read failure (falls back to 'system' default); Supabase write failure on setTheme (preference not persisted, local state still updates — silent divergence)
 * @hazard setTheme writes to Supabase asynchronously but updates local state synchronously — if the Supabase write fails, the UI shows the new theme while the stored preference remains the old value; on next login the user sees an unexpected theme
 * @hazard System theme change events (prefers-color-scheme media query listener) are not cleaned up on unmount — if the component using this hook mounts/unmounts repeatedly, stale listeners accumulate and fire redundant theme updates
 * @shared-edges supabase user_preferences table→READS and WRITES theme; document.documentElement→MUTATES 'dark' class; App.tsx or layout component→CONSUMES this hook; frontend/src/pages/SettingsPage.tsx→MAY RENDER theme selector using this hook
 * @trail theme#1 | App mounts → useTheme loads preference from Supabase → applies dark class if needed → user selects dark in settings → setTheme('dark') → Supabase write + document class update
 * @prompt Add matchMedia listener cleanup in useEffect return. Show error if Supabase write fails (preference not saved warning). Consider localStorage fallback for unauthenticated users.
 */
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export type Theme = 'light' | 'dark' | 'system';

export function useTheme() {
  const [theme, setTheme] = useState<Theme>('system');
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');

  // Get system preference
  const getSystemPreference = (): 'light' | 'dark' => {
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  };

  // Resolve theme based on current setting
  const resolveTheme = (currentTheme: Theme): 'light' | 'dark' => {
    if (currentTheme === 'system') {
      return getSystemPreference();
    }
    return currentTheme;
  };

  // Apply theme to document
  const applyTheme = (newResolvedTheme: 'light' | 'dark') => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(newResolvedTheme);
    setResolvedTheme(newResolvedTheme);
  };

  // Load theme from Supabase user preferences (or localStorage fallback)
  useEffect(() => {
    const loadTheme = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: userData } = await supabase
          .from('users')
          .select('preferences')
          .eq('id', user.id)
          .single();

        if (userData?.preferences?.theme) {
          const savedTheme = userData.preferences.theme as Theme;
          setTheme(savedTheme);
          applyTheme(resolveTheme(savedTheme));
          localStorage.setItem('theme', savedTheme); // Sync to localStorage
        } else {
          // No saved preference, check localStorage or use system
          const localTheme = localStorage.getItem('theme') as Theme | null;
          const themeToUse = localTheme || 'system';
          setTheme(themeToUse);
          applyTheme(resolveTheme(themeToUse));
        }
      } else {
        // Not logged in, use localStorage or system
        const localTheme = localStorage.getItem('theme') as Theme | null;
        const themeToUse = localTheme || 'system';
        setTheme(themeToUse);
        applyTheme(resolveTheme(themeToUse));
      }
    };

    loadTheme();
  }, []);

  // Listen to system preference changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (theme === 'system') {
        applyTheme(getSystemPreference());
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  // Change theme and save to both localStorage and Supabase
  const changeTheme = async (newTheme: Theme) => {
    setTheme(newTheme);
    const resolved = resolveTheme(newTheme);
    applyTheme(resolved);

    // Save to localStorage for flash prevention
    localStorage.setItem('theme', newTheme);

    // Save to Supabase
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: userData } = await supabase
        .from('users')
        .select('preferences')
        .eq('id', user.id)
        .single();

      await supabase
        .from('users')
        .update({
          preferences: {
            ...userData?.preferences,
            theme: newTheme
          }
        })
        .eq('id', user.id);
    }
  };

  return {
    theme,
    resolvedTheme,
    setTheme: changeTheme
  };
}
