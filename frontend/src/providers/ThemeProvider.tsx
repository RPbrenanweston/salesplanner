import { createContext, useContext, useEffect, type ReactNode } from 'react'
import { getTheme, type ThemeConfig } from '../themes'
import { applyTheme } from '../themes/apply-theme'

// __THEME__ is injected at build time by Vite define (see vite.config.ts)
declare const __THEME__: string

const activeTheme = getTheme(typeof __THEME__ !== 'undefined' ? __THEME__ : 'salesplanner')

const ThemeConfigContext = createContext<ThemeConfig>(activeTheme)

interface ThemeProviderProps {
  children: ReactNode
}

/**
 * Reads the build-time __THEME__ constant, resolves the ThemeConfig,
 * applies CSS variables + Google Fonts to <html>, and provides the
 * config via context to all child components.
 */
export function ThemeProvider({ children }: ThemeProviderProps) {
  useEffect(() => {
    applyTheme(activeTheme)
  }, [])

  return (
    <ThemeConfigContext.Provider value={activeTheme}>
      {children}
    </ThemeConfigContext.Provider>
  )
}

/** Access the active ThemeConfig anywhere in the component tree. */
export function useThemeConfig(): ThemeConfig {
  return useContext(ThemeConfigContext)
}
