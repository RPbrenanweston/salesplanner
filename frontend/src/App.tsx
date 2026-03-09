import { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import PageLoader from './components/PageLoader'
import ProtectedRoute from './components/ProtectedRoute'
import AppLayout from './components/AppLayout'

// Lazy load all page components for code splitting
const Home = lazy(() => import('./pages/Home'))
const SignIn = lazy(() => import('./pages/SignIn'))
const SignUp = lazy(() => import('./pages/SignUp'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'))
const SalesBlocks = lazy(() => import('./pages/SalesBlocks'))
const Lists = lazy(() => import('./pages/Lists'))
const ListDetailPage = lazy(() => import('./pages/ListDetailPage'))
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
const PricingPage = lazy(() => import('./pages/PricingPage'))

const queryClient = new QueryClient()

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Auth routes - public */}
            <Route path="/signin" element={<SignIn />} />
            <Route path="/signup" element={<SignUp />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/pricing" element={<PricingPage />} />

            {/* OAuth callbacks - public */}
            <Route path="/oauth/gmail/callback" element={<GmailOAuthCallback />} />
            <Route path="/oauth/outlook/callback" element={<OutlookOAuthCallback />} />
            <Route path="/oauth/google-calendar/callback" element={<GoogleCalendarOAuthCallback />} />
            <Route path="/oauth/outlook-calendar/callback" element={<OutlookCalendarOAuthCallback />} />
            <Route path="/oauth/salesforce/callback" element={<SalesforceOAuthCallback />} />

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
          </Routes>
        </Suspense>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App
