/**
 * @crumb
 * @id frontend-app-orchestrator
 * @area DOM
 * @intent Root component orchestrating complete routing architecture and app initialization with protected/public route separation
 * @responsibilities BrowserRouter setup, QueryClientProvider (React Query) initialization, route definition and protection, OAuth callback handling, layout injection
 * @contracts App() → Router JSX; exports BrowserRouter wrapper with 18 route definitions (public + protected); wraps authenticated routes in ProtectedRoute + AppLayout
 * @in Route component imports (18 pages), protected route list, AppLayout wrapper
 * @out Router tree with all routes, auth protection applied, QueryClient provider scope
 * @err Route component not found (lazy load failure), OAuth callback URL mismatch on concurrent flows, route name collision
 * @hazard 18 routes hardcoded in App.tsx—no dynamic route registry, adding routes requires App.tsx modification (scales poorly, creates bottleneck); OAuth callbacks (Gmail, Outlook, GoogleCalendar, OutlookCalendar, Salesforce) all point to /oauth-callback—if multiple OAuth flows in progress, state param collision can cause wrong callback handler execution (user logs in with Gmail, ends up with Outlook token)
 * @hazard React Query cache not persisted—QueryClient cache resets on full page reload, losing infinite query state and user-specific data cache (address/contact lists)
 * @shared-edges frontend/src/components/AppLayout.tsx→WRAPPED by ProtectedRoute in route definitions; frontend/src/components/ProtectedRoute.tsx→INSTANTIATED in 10+ protected route definitions (/salesblocks, /lists, /contacts, /email, /social, /pipeline, /goals, /analytics, /team, /settings, /content, /scripts, /templates, /arena); frontend/src/pages/*.tsx→RENDERED as route components (SignInPage, SignUpPage, ContactsPage, etc.); frontend/src/lib/oauth-callbacks.ts→IMPORTED for OAuth callback routes
 * @trail app-init#1 | App mounts BrowserRouter → mounts QueryClientProvider → defines 18 routes (5 public: /signin, /signup, /forgot-password, OAuth callbacks × 4; 13 protected: /, /salesblocks, /lists, /contacts, /email, /social, /pipeline, /goals, /analytics, /team, /settings, /content, /scripts, /templates, /arena) → ProtectedRoute enforces auth on protected routes → AppLayout renders sidebar + header + content
 * @prompt Refactor route definitions into separate routes.ts config file to reduce App.tsx size (currently 225 lines). Create dynamic OAuth callback registry to safely handle multiple concurrent OAuth flows (track state param → handler mapping). Implement React Query persistence using localStorage adapter for offline-first experience. Consider code-splitting page components with React.lazy() for faster initial load.
 */

import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Home from './pages/Home'
import SignIn from './pages/SignIn'
import SignUp from './pages/SignUp'
import ForgotPassword from './pages/ForgotPassword'
import SalesBlocks from './pages/SalesBlocks'
import Lists from './pages/Lists'
import ListDetailPage from './pages/ListDetailPage'
import ContactDetailPage from './pages/ContactDetailPage'
import Email from './pages/Email'
import Social from './pages/Social'
import Pipeline from './pages/Pipeline'
import Goals from './pages/Goals'
import Analytics from './pages/Analytics'
import Team from './pages/Team'
import SettingsPage from './pages/SettingsPage'
import SalesBlockSessionPage from './pages/SalesBlockSessionPage'
import Scripts from './pages/Scripts'
import EmailTemplates from './pages/EmailTemplates'
import ContentLibrary from './pages/ContentLibrary'
import Arena from './pages/Arena'
import GmailOAuthCallback from './pages/GmailOAuthCallback'
import OutlookOAuthCallback from './pages/OutlookOAuthCallback'
import GoogleCalendarOAuthCallback from './pages/GoogleCalendarOAuthCallback'
import OutlookCalendarOAuthCallback from './pages/OutlookCalendarOAuthCallback'
import SalesforceOAuthCallback from './pages/SalesforceOAuthCallback'
import PricingPage from './pages/PricingPage'
import ProtectedRoute from './components/ProtectedRoute'
import AppLayout from './components/AppLayout'

const queryClient = new QueryClient()

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/signin" element={<SignIn />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/oauth/gmail/callback" element={<GmailOAuthCallback />} />
          <Route path="/oauth/outlook/callback" element={<OutlookOAuthCallback />} />
          <Route path="/oauth/google-calendar/callback" element={<GoogleCalendarOAuthCallback />} />
          <Route path="/oauth/outlook-calendar/callback" element={<OutlookCalendarOAuthCallback />} />
          <Route path="/oauth/salesforce/callback" element={<SalesforceOAuthCallback />} />
          <Route path="/pricing" element={<PricingPage />} />

          {/* Protected routes with AppLayout */}
          <Route
            path="/"
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
            path="/content"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <ContentLibrary />
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
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App
