/** @id salesblock.pages.app.main */
// @crumb frontend-entry-main
// UI/Entry | react_dom_root_creation | strict_mode_wrapping | global_css_injection | sentry_initialization
// why: Application entry point — mount React root, wrap App in StrictMode, inject global CSS, init Sentry error monitoring
// in:index.html #root div,App.tsx root component,index.css global styles,VITE_SENTRY_DSN out:React application mounted to DOM err:Missing #root element in index.html (ReactDOM.createRoot throws,blank page);App.tsx import failure (module resolution error at build time)
// hazard: React.StrictMode causes effects and renders to run twice in development — non-idempotent side effects fire twice in dev but once in production, masking double-subscription bugs
// edge:frontend/src/App.tsx -> RELATES
// edge:frontend/src/index.css -> RELATES
// edge:frontend/index.html -> RELATES
// edge:entry#1 -> STEP_IN
import React from 'react'
import ReactDOM from 'react-dom/client'
import * as Sentry from '@sentry/react'
import App from './App.tsx'
import ErrorBoundary from './components/ErrorBoundary.tsx'
import { ThemeProvider } from './providers/ThemeProvider.tsx'
import './index.css'

// Initialize Sentry when DSN is configured — no-ops silently without a DSN
if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    // Only enable session replay in production to avoid replaying dev noise
    integrations: import.meta.env.PROD
      ? [Sentry.replayIntegration({ maskAllText: true, blockAllMedia: false })]
      : [],
    // Capture 10% of traces in production; 100% in dev for visibility
    tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
  })
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </ErrorBoundary>
  </React.StrictMode>,
)
