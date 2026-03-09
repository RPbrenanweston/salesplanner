/**
 * @crumb
 * @id frontend-entry-main
 * @area UI/Entry
 * @intent Application entry point — mount React root, wrap App in StrictMode, inject global CSS
 * @responsibilities Create React DOM root at #root element, render App component wrapped in StrictMode, import global index.css styles
 * @contracts main.tsx → void; mounts ReactDOM.createRoot on document.getElementById('root'); renders <React.StrictMode><App /></React.StrictMode>
 * @in index.html #root div, App.tsx root component, index.css global styles
 * @out React application mounted to DOM
 * @err Missing #root element in index.html (ReactDOM.createRoot throws, app never mounts — blank page with console error); App.tsx import failure (module resolution error at build time)
 * @hazard React.StrictMode causes effects and renders to run twice in development — any side effect that is not idempotent (e.g. analytics events, Supabase channel subscriptions) will fire twice in dev but once in production, masking double-subscription bugs
 * @hazard No error boundary at the root level — any uncaught render error in App or its children will cause a blank white screen with no user-visible error message; add a root ErrorBoundary to display a fallback UI
 * @shared-edges frontend/src/App.tsx→RENDERS as root component; frontend/src/index.css→IMPORTS global styles; index.html→PROVIDES #root mount point
 * @trail entry#1 | Vite loads index.html → imports main.tsx → ReactDOM.createRoot → App renders → Router initialises → user sees landing page
 * @prompt Add root ErrorBoundary component to catch and display uncaught render errors. Add Sentry or similar error tracking initialization here for production error monitoring.
 */
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
