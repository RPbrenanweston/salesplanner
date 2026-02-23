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
