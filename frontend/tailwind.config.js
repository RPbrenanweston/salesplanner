/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        // Theme-driven fonts — swapped at runtime via CSS variables
        display: ['var(--font-display)', 'Space Grotesk', 'sans-serif'],
        body: ['var(--font-body)', 'Lato', 'sans-serif'],
        // Fixed fonts
        sans: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
        epic: ['Cinzel', 'serif'],
      },
      colors: {
        // ── Theme-driven colors (swap at runtime via CSS variables) ──
        // These replace the hardcoded void/neon/electric tokens.
        // Existing components using `dark:bg-void-950` etc. continue to
        // work because the void-* tokens below now reference CSS variables.
        void: {
          950: 'var(--color-bg)',
          900: 'var(--color-surface)',
          800: 'var(--color-surface-alt)',
          700: 'var(--color-surface-alt)',
        },
        'indigo-electric': 'var(--color-primary)',
        'cyan-neon': 'var(--color-accent)',
        'purple-neon': 'var(--color-accent2)',
        'red-alert': 'var(--color-danger)',
        'emerald-signal': 'var(--color-success)',

        // ── Semantic theme tokens (for new components) ──
        theme: {
          primary: 'var(--color-primary)',
          'primary-dim': 'var(--color-primary-dim)',
          bg: 'var(--color-bg)',
          surface: 'var(--color-surface)',
          'surface-alt': 'var(--color-surface-alt)',
          text: 'var(--color-text)',
          'text-muted': 'var(--color-text-muted)',
          accent: 'var(--color-accent)',
          accent2: 'var(--color-accent2)',
          border: 'var(--color-border)',
          danger: 'var(--color-danger)',
          success: 'var(--color-success)',
        },

        // ── Fixed tokens ──────────────────────────────────────────
        muted: {
          DEFAULT: '#e2e8f0',
          foreground: '#64748b',
        },
        card: {
          DEFAULT: '#ffffff',
          foreground: '#0f172a',
        },
        // Hero's Journey / Epic Quest design system (legacy)
        quest: {
          gold: '#D4AF37',
          'gold-dim': 'rgba(212, 175, 55, 0.15)',
          bg: '#0B0C10',
          surface: '#1A1625',
          text: '#F5F5F0',
          muted: '#8D8A95',
          accent: '#FF4500',
          border: '#332D41',
        },
      },
      transitionTimingFunction: {
        snappy: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      boxShadow: {
        'neon-indigo': '0 0 20px rgba(99, 102, 241, 0.4)',
        'neon-cyan': '0 0 20px rgba(13, 185, 242, 0.4)',
        'neon-purple': '0 0 20px rgba(139, 92, 246, 0.4)',
        // Epic Quest glows
        'quest-glow': '0 0 20px rgba(212, 175, 55, 0.15)',
        'quest-glow-strong': '0 0 30px rgba(212, 175, 55, 0.4)',
        'quest-glow-inner': 'inset 0 0 20px rgba(212, 175, 55, 0.08)',
      },
    },
  },
  plugins: [],
}
