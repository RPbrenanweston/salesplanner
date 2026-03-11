// @crumb frontend-page-sign-in
// UI/AUTH | render_email_password_form | sign_in_with_password | navigate_on_success | display_error
// why: Email + password sign-in — authenticate existing user and redirect to app root on success
// in:supabase.auth.signInWithPassword,useNavigate,user-entered email+password out:authenticated session via Supabase,redirect to / err:invalid credentials(error inline),network failure(error inline)
// hazard: No rate limiting on sign-in form — relies entirely on Supabase Auth rate limiting; brute force possible if misconfigured
// hazard: Redirect on success goes unconditionally to / — deep link destination lost; no returnTo param handling
// edge:frontend/src/lib/supabase.ts -> CALLS
// edge:frontend/src/App.tsx -> RELATES
// edge:frontend/src/pages/SignUp.tsx -> RELATES
// edge:frontend/src/pages/ForgotPassword.tsx -> RELATES
// edge:sign-in#1 -> STEP_IN
// prompt: Add returnTo param to preserve destination URL. Add Google SSO as alternative. Add lockout feedback for rate limit errors.
import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ROUTES } from '../lib/routes'

export default function SignIn() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) throw signInError
      if (data.user) {
        navigate(ROUTES.HOME)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign in')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-void-950 via-void-900 to-void-950 flex items-center justify-center px-4">
      <div className="max-w-md w-full space-y-8">
        <div>
          {/* Logo/Branding */}
          <div className="flex justify-center mb-6">
            <div className="text-3xl font-black font-display text-indigo-electric">
              SalesBlock.io
            </div>
          </div>
          <h2 className="text-center text-2xl font-bold font-display text-white">
            Sign in to your account
          </h2>
          <p className="mt-2 text-center text-sm text-white/60">
            Or{' '}
            <Link to="/signup" className="font-medium text-indigo-electric hover:text-indigo-electric/80 transition-colors ease-snappy">
              create a new account
            </Link>
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSignIn}>
          {error && (
            <div className="rounded-lg bg-red-alert/10 border border-red-alert/30 p-4">
              <p className="text-sm text-red-alert">{error}</p>
            </div>
          )}
          <div className="glass-card p-6 space-y-4">
            <div>
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
              <label htmlFor="password" className="block text-sm font-medium text-white/80 mb-1">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="appearance-none block w-full px-3 py-2 bg-white/5 border border-white/10 placeholder-white/30 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-electric focus:border-indigo-electric text-sm transition-colors ease-snappy"
                placeholder="••••••••"
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="text-sm">
              <Link to="/forgot-password" className="font-medium text-white/60 hover:text-indigo-electric transition-colors ease-snappy">
                Forgot your password?
              </Link>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-indigo-electric text-white font-semibold rounded-lg hover:bg-indigo-electric/80 focus:outline-none focus:ring-2 focus:ring-indigo-electric/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all ease-snappy"
            >
              {loading && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
