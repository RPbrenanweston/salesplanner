import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './hooks/**/*.{js,ts,jsx,tsx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
    './types/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        display: ['var(--font-display)', 'Space Grotesk', 'sans-serif'],
        body: ['var(--font-body)', 'Lato', 'sans-serif'],
        sans: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
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
      },
      transitionTimingFunction: {
        snappy: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      boxShadow: {
        'neon-indigo': '0 0 20px rgba(99, 102, 241, 0.4)',
        'neon-cyan': '0 0 20px rgba(13, 185, 242, 0.4)',
      },
    },
  },
  plugins: [],
}

export default config
