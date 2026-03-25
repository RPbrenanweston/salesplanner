/** @id salesblock.pages.app.app */
// @crumb frontend-app-orchestrator
// DOM | route_declaration | query_client_initialization | protected_route_enforcement | app_layout_composition
// why: Root component — orchestrates complete React Router routing architecture, lazy-loaded page splits, and QueryClient initialization for the full SalesBlock.io app
// in:React Router v6,TanStack QueryClient,ProtectedRoute,AppLayout,PageLoader,26 lazy-loaded page modules out:Fully routed SPA,public routes,protected routes behind AppLayout,OAuth callback routes
// hazard: 24 routes hardcoded — no dynamic route registry; adding a new page requires both a lazy import AND a new Route entry here
// hazard: React Query cache not persisted — QueryClient resets on full page reload; no localStorage or sessionStorage persistence configured
// edge:frontend/src/components/ProtectedRoute.tsx -> RELATES
// edge:frontend/src/components/AppLayout.tsx -> RELATES
// edge:frontend/src/components/PageLoader.tsx -> RELATES
// edge:frontend/src/pages/ -> RELATES
// edge:app#1 -> STEP_IN
// prompt: Add routes for /arena (Arena.tsx) and /content-library (ContentLibrary.tsx) when those pages are ready to surface; consider a route registry pattern to avoid dual-entry (import + Route) for each new page
import { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useSearchParams } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import PageLoader from './components/PageLoader'
import ProtectedRoute from './components/ProtectedRoute'
import AppLayout from './components/AppLayout'
import { Toaster } from './components/ui/toaster'

// Lazy load all page components for code splitting
const Home = lazy(() => import('./pages/Home'))
const SignIn = lazy(() => import('./pages/SignIn'))
const SignUp = lazy(() => import('./pages/SignUp'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'))
const SalesBlocks = lazy(() => import('./pages/SalesBlocks'))
const Lists = lazy(() => import('./pages/Lists'))
const ListDetailPage = lazy(() => import('./pages/ListDetailPage'))
const ContactsPage = lazy(() => import('./pages/ContactsPage'))
const ContactDetailPage = lazy(() => import('./pages/ContactDetailPage'))
const Email = lazy(() => import('./pages/Email'))
const Social = lazy(() => import('./pages/Social'))
const Pipeline = lazy(() => import('./pages/Pipeline'))
const Goals = lazy(() => import('./pages/Goals'))
const Analytics = lazy(() => import('./pages/Analytics'))
const Team = lazy(() => import('./pages/Team'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const SalesBlockSessionPage = lazy(() => import('./pages/SalesBlockSessionPage'))
const Scripts = lazy(() => import('./pages/Scripts'))
const EmailTemplates = lazy(() => import('./pages/EmailTemplates'))
const GmailOAuthCallback = lazy(() => import('./pages/GmailOAuthCallback'))
const OutlookOAuthCallback = lazy(() => import('./pages/OutlookOAuthCallback'))
const GoogleCalendarOAuthCallback = lazy(() => import('./pages/GoogleCalendarOAuthCallback'))
const OutlookCalendarOAuthCallback = lazy(() => import('./pages/OutlookCalendarOAuthCallback'))
const SalesforceOAuthCallback = lazy(() => import('./pages/SalesforceOAuthCallback'))
const AttioOAuthCallback = lazy(() => import('./pages/AttioOAuthCallback'))
const PricingPage = lazy(() => import('./pages/PricingPage'))
const MarketingPage = lazy(() => import('./pages/MarketingPage'))
const Diagnostics = lazy(() => import('./pages/Diagnostics'))
const AccountsPage = lazy(() => import('./pages/AccountsPage'))
const AccountDetailPage = lazy(() => import('./pages/AccountDetailPage'))
const Arena = lazy(() => import('./pages/Arena'))
const ContentLibrary = lazy(() => import('./pages/ContentLibrary'))

// Productivity (Super Productivity integration)
const DayPlannerPage = lazy(() => import('./pages/DayPlannerPage'))
const MorningBriefingPage = lazy(() => import('./pages/MorningBriefingPage'))
const DailyDebriefPage = lazy(() => import('./pages/DailyDebriefPage'))

const queryClient = new QueryClient()

/** Gate: only renders children when ?debug=true is present, otherwise redirects to /dashboard */
function DebugGate({ children }: { children: React.ReactNode }) {
  const [searchParams] = useSearchParams()
  if (searchParams.get('debug') !== 'true') {
    return <Navigate to="/dashboard" replace />
  }
  return <>{children}</>
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Marketing - public home */}
            <Route path="/" element={<MarketingPage />} />

            {/* Auth routes - public */}
            <Route path="/signin" element={<SignIn />} />
            <Route path="/signup" element={<SignUp />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/pricing" element={<PricingPage />} />

            {/* Diagnostics - protected, gated behind ?debug=true, no layout (standalone debug page) */}
            <Route
              path="/diagnostics"
              element={
                <ProtectedRoute>
                  <DebugGate>
                    <Diagnostics />
                  </DebugGate>
                </ProtectedRoute>
              }
            />

            {/* OAuth callbacks - public */}
            <Route path="/oauth/gmail/callback" element={<GmailOAuthCallback />} />
            <Route path="/oauth/outlook/callback" element={<OutlookOAuthCallback />} />
            <Route path="/oauth/google-calendar/callback" element={<GoogleCalendarOAuthCallback />} />
            <Route path="/oauth/outlook-calendar/callback" element={<OutlookCalendarOAuthCallback />} />
            <Route path="/oauth/salesforce/callback" element={<SalesforceOAuthCallback />} />
            <Route path="/oauth/attio/callback" element={<AttioOAuthCallback />} />

            {/* Protected routes with AppLayout */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <Home />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/salesblocks"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <SalesBlocks />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/salesblocks/:salesblockId/session"
              element={
                <ProtectedRoute>
                  <SalesBlockSessionPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/lists"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <Lists />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/lists/:listId"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <ListDetailPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/contacts"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <ContactsPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/contacts/:contactId"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <ContactDetailPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/email"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <Email />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/social"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <Social />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/pipeline"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <Pipeline />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/goals"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <Goals />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/analytics"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <Analytics />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/team"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <Team />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <SettingsPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/scripts"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <Scripts />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/templates"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <EmailTemplates />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/arena"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <Arena />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/content-library"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <ContentLibrary />
                  </AppLayout>
                </ProtectedRoute>
              }
            />

            {/* Accounts */}
            <Route
              path="/accounts"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <AccountsPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/accounts/:accountId"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <AccountDetailPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />

            {/* Productivity (Super Productivity integration) */}
            <Route
              path="/planner"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <DayPlannerPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/briefing"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <MorningBriefingPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/debrief"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <DailyDebriefPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
          </Routes>
        </Suspense>
        <Toaster />
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App
