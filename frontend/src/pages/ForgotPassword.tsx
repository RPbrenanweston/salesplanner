/**
 * @crumb
 * @id frontend-page-forgot-password
 * @area UI/Auth
 * @intent Password reset initiation — send reset email via Supabase Auth with redirect to reset-password page
 * @responsibilities Render email form, call supabase.auth.resetPasswordForEmail with redirectTo, show success or error message
 * @contracts ForgotPassword() → JSX; calls supabase.auth.resetPasswordForEmail; redirectTo uses window.location.origin
 * @in supabase.auth.resetPasswordForEmail, user-entered email, window.location.origin for redirect URL
 * @out Reset email dispatched by Supabase; success message shown; user navigates to /reset-password via email link
 * @err Supabase error on resetPasswordForEmail (error displayed inline); invalid email format (no client-side validation — Supabase handles)
 * @hazard window.location.origin is used to construct the redirectTo URL — in development this points to localhost, meaning reset links sent from dev will expire if the user opens them in a different environment
 * @hazard No feedback differentiation between "email not found" and "email sent" — Supabase intentionally shows the same message for both to prevent user enumeration, but this means broken accounts get no recovery guidance
 * @shared-edges frontend/src/lib/supabase.ts→CALLS auth.resetPasswordForEmail; frontend/src/App.tsx→ROUTES to /forgot-password; frontend/src/pages/SignIn.tsx→LINKED
 * @trail forgot-password#1 | ForgotPassword renders → user enters email → handleResetPassword → resetPasswordForEmail → setMessage (success) | setError (failure) → user checks email → clicks link → /reset-password
 * @prompt VV tokens applied — void-950 background, glass-card form, indigo-electric CTA with spinner, white/5 input with indigo-electric focus ring, red-alert error banner, green-signal success banner. Remaining: add client-side email format validation. Ensure SITE_URL is set correctly in Supabase Auth settings to avoid localhost redirect links in production emails.
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })

      if (resetError) throw resetError

      setMessage('Check your email for the password reset link')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send reset email')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-void-950 via-void-900 to-void-950 flex items-center justify-center px-4">
      <div className="max-w-md w-full space-y-8">
        <div>
          <div className="flex justify-center mb-6">
            <div className="text-3xl font-black font-display text-indigo-electric">
              SalesBlock.io
            </div>
          </div>
          <h2 className="text-center text-3xl font-bold font-display text-white">
            Reset your password
          </h2>
          <p className="mt-2 text-center text-sm text-white/60">
            Remember your password?{' '}
            <Link to="/signin" className="font-medium text-indigo-electric hover:text-indigo-electric/80 transition-colors ease-snappy">
              Sign in
            </Link>
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleResetPassword}>
          {error && (
            <div className="rounded-lg bg-red-alert/10 border border-red-alert/30 p-4">
              <p className="text-sm text-red-alert">{error}</p>
            </div>
          )}
          {message && (
            <div className="rounded-lg bg-green-500/10 border border-green-500/30 p-4">
              <p className="text-sm text-green-400">{message}</p>
            </div>
          )}
          <div className="glass-card p-6">
            <label htmlFor="email" className="block text-sm font-medium text-white/80 mb-1">
              Email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="appearance-none block w-full px-3 py-2 bg-white/5 border border-white/10 placeholder-white/30 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-electric focus:border-indigo-electric text-sm transition-colors ease-snappy"
              placeholder="you@company.com"
            />
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-indigo-electric text-white font-semibold rounded-lg hover:bg-indigo-electric/80 focus:outline-none focus:ring-2 focus:ring-indigo-electric/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all ease-snappy"
            >
              {loading && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              {loading ? 'Sending...' : 'Send reset link'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
