// @crumb frontend-entry-main
// UI/Entry | react_dom_root_creation | strict_mode_wrapping | global_css_injection
// why: Application entry point — mount React root, wrap App in StrictMode, inject global CSS
// in:index.html #root div,App.tsx root component,index.css global styles out:React application mounted to DOM err:Missing #root element in index.html (ReactDOM.createRoot throws,blank page);App.tsx import failure (module resolution error at build time)
// hazard: React.StrictMode causes effects and renders to run twice in development — non-idempotent side effects fire twice in dev but once in production, masking double-subscription bugs
// hazard: No error boundary at the root level — uncaught render error causes blank white screen with no user-visible error message
// edge:frontend/src/App.tsx -> RELATES
// edge:frontend/src/index.css -> RELATES
// edge:frontend/index.html -> RELATES
// edge:entry#1 -> STEP_IN
// prompt: Add root ErrorBoundary component to catch and display uncaught render errors. Add Sentry or similar error tracking initialization here for production error monitoring.
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import ErrorBoundary from './components/ErrorBoundary.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)
