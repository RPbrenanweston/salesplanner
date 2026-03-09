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
 * @prompt Add client-side email format validation. Ensure SITE_URL is set correctly in Supabase Auth settings to avoid localhost redirect links in production emails.
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="text-center text-3xl font-bold text-gray-900 dark:text-white">
            Reset your password
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
            Remember your password?{' '}
            <Link to="/signin" className="font-medium text-blue-600 hover:text-blue-500">
              Sign in
            </Link>
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleResetPassword}>
          {error && (
            <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-4">
              <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
            </div>
          )}
          {message && (
            <div className="rounded-md bg-green-50 dark:bg-green-900/20 p-4">
              <p className="text-sm text-green-800 dark:text-green-200">{message}</p>
            </div>
          )}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
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
              className="appearance-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 sm:text-sm"
              placeholder="Email address"
            />
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Sending...' : 'Send reset link'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
