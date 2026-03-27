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
        display: ['Space Grotesk', 'sans-serif'],
        sans: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
        // Hero's Journey design system
        epic: ['Cinzel', 'serif'],
        body: ['Lato', 'sans-serif'],
      },
      colors: {
        void: {
          950: '#020617',
          900: '#0F172A',
          800: '#131f24',
          700: '#1e2d35',
        },
        'indigo-electric': '#6366F1',
        'cyan-neon': '#0db9f2',
        'purple-neon': '#8b5cf6',
        'red-alert': '#f43f5e',
        'emerald-signal': '#10b981',
        muted: {
          DEFAULT: '#e2e8f0',
          foreground: '#64748b',
        },
        card: {
          DEFAULT: '#ffffff',
          foreground: '#0f172a',
        },
        // Hero's Journey / Epic Quest design system
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
