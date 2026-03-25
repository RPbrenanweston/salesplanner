import { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import PageLoader from './components/PageLoader'
import ProtectedRoute from './components/ProtectedRoute'
import PlannerLayout from './components/PlannerLayout'
import { Toaster } from './components/ui/toaster'

// Lazy load pages
const SignIn = lazy(() => import('./pages/SignIn'))
const SignUp = lazy(() => import('./pages/SignUp'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'))
const SalesBlockSessionPage = lazy(() => import('./pages/SalesBlockSessionPage'))
const DayPlannerPage = lazy(() => import('./pages/DayPlannerPage'))
const MorningBriefingPage = lazy(() => import('./pages/MorningBriefingPage'))
const DailyDebriefPage = lazy(() => import('./pages/DailyDebriefPage'))
const ActivityFeedPage = lazy(() => import('./pages/ActivityFeedPage'))
const Goals = lazy(() => import('./pages/Goals'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const SalesPlannerLanding = lazy(() => import('./pages/SalesPlannerLanding'))

const queryClient = new QueryClient()

function SalesPlannerApp() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Public */}
            <Route path="/" element={<SalesPlannerLanding />} />
            <Route path="/signin" element={<SignIn />} />
            <Route path="/signup" element={<SignUp />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />

            {/* Focus Session — full screen, no layout */}
            <Route
              path="/salesblocks/:salesblockId/session"
              element={
                <ProtectedRoute>
                  <SalesBlockSessionPage />
                </ProtectedRoute>
              }
            />

            {/* Protected routes with PlannerLayout */}
            <Route
              path="/briefing"
              element={
                <ProtectedRoute>
                  <PlannerLayout>
                    <MorningBriefingPage />
                  </PlannerLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/planner"
              element={
                <ProtectedRoute>
                  <PlannerLayout>
                    <DayPlannerPage />
                  </PlannerLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/activity"
              element={
                <ProtectedRoute>
                  <PlannerLayout>
                    <ActivityFeedPage />
                  </PlannerLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/debrief"
              element={
                <ProtectedRoute>
                  <PlannerLayout>
                    <DailyDebriefPage />
                  </PlannerLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/goals"
              element={
                <ProtectedRoute>
                  <PlannerLayout>
                    <Goals />
                  </PlannerLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <PlannerLayout>
                    <SettingsPage />
                  </PlannerLayout>
                </ProtectedRoute>
              }
            />

            {/* Default: redirect to planner */}
            <Route path="/dashboard" element={<Navigate to="/planner" replace />} />
            <Route path="*" element={<Navigate to="/planner" replace />} />
          </Routes>
        </Suspense>
        <Toaster />
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default SalesPlannerApp
