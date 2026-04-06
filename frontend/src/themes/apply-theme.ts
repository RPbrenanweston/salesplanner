import type { ThemeConfig } from './types'

function injectGoogleFont(url: string) {
  const existingLink = document.querySelector<HTMLLinkElement>('link[data-theme-font]')
  if (existingLink) {
    existingLink.href = url
    return
  }
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = url
  link.setAttribute('data-theme-font', 'true')
  document.head.appendChild(link)
}

/**
 * Applies a ThemeConfig to the document by:
 * 1. Setting CSS custom properties on <html>
 * 2. Setting data-theme attribute for CSS selectors
 * 3. Injecting Google Fonts
 * 4. Updating the document title
 */
export function applyTheme(config: ThemeConfig) {
  const root = document.documentElement

  // ── Colors ──────────────────────────────────────────────────
  root.style.setProperty('--color-primary', config.colors.primary)
  root.style.setProperty('--color-primary-dim', config.colors.primaryDim)
  root.style.setProperty('--color-bg', config.colors.bg)
  root.style.setProperty('--color-surface', config.colors.surface)
  root.style.setProperty('--color-surface-alt', config.colors.surfaceAlt)
  root.style.setProperty('--color-text', config.colors.text)
  root.style.setProperty('--color-text-muted', config.colors.textMuted)
  root.style.setProperty('--color-accent', config.colors.accent)
  root.style.setProperty('--color-accent2', config.colors.accent2)
  root.style.setProperty('--color-border', config.colors.border)
  root.style.setProperty('--color-danger', config.colors.danger)
  root.style.setProperty('--color-success', config.colors.success)

  // ── Fonts ───────────────────────────────────────────────────
  root.style.setProperty('--font-display', `'${config.fonts.display}', sans-serif`)
  root.style.setProperty('--font-body', `'${config.fonts.body}', sans-serif`)

  // ── Theme identifier (for CSS [data-theme] selectors) ───────
  root.setAttribute('data-theme', config.id)

  // ── Metadata ────────────────────────────────────────────────
  document.title = config.appTitle
  injectGoogleFont(config.fonts.googleFontsUrl)
}
