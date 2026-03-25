import React from 'react'
import ReactDOM from 'react-dom/client'
import * as Sentry from '@sentry/react'
import SalesPlannerApp from './SalesPlannerApp.tsx'
import ErrorBoundary from './components/ErrorBoundary.tsx'
import './index.css'

if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    integrations: import.meta.env.PROD
      ? [Sentry.replayIntegration({ maskAllText: true, blockAllMedia: false })]
      : [],
    tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
  })
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <SalesPlannerApp />
    </ErrorBoundary>
  </React.StrictMode>,
)
