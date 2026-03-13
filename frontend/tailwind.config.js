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
      },
      colors: {
        void: {
          950: '#020617',
          900: '#0F172A',
          800: '#131f24',
        },
        'indigo-electric': '#6366F1',
        'cyan-neon': '#0db9f2',
        'purple-neon': '#8b5cf6',
        'red-alert': '#f43f5e',
        'emerald-signal': '#10b981',
        muted: {
          DEFAULT: '#e2e8f0',   // slate-200
          foreground: '#64748b', // slate-500
        },
        card: {
          DEFAULT: '#ffffff',
          foreground: '#0f172a',
        },
      },
      transitionTimingFunction: {
        snappy: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      boxShadow: {
        'neon-indigo': '0 0 20px rgba(99, 102, 241, 0.4)',
        'neon-cyan': '0 0 20px rgba(13, 185, 242, 0.4)',
        'neon-purple': '0 0 20px rgba(139, 92, 246, 0.4)',
      },
    },
  },
  plugins: [],
}
