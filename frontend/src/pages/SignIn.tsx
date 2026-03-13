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
// prompt: returnTo param, Google SSO, lockout feedback — implemented FEAT-001
import { useState } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ROUTES } from '../lib/routes'
import { isRateLimited } from '../lib/rate-limiter'
import { validateEmail } from '../lib/form-utils'

function getValidReturnTo(raw: string | null): string | null {
  if (!raw) return null
  if (!raw.startsWith('/')) return null
  if (raw.startsWith('//')) return null
  return raw
}

export default function SignIn() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const returnTo = getValidReturnTo(searchParams.get('returnTo'))
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState('')

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true)
    setError('')
    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin + (returnTo || '/'),
        },
      })
      if (oauthError) throw oauthError
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign in with Google')
      setGoogleLoading(false)
    }
  }

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateEmail(email)) {
      setError('Please enter a valid email address.')
      return
    }
    if (!password || password.length < 1) {
      setError('Password is required.')
      return
    }

    if (isRateLimited(`sign-in:${email.toLowerCase()}`, { windowMs: 60_000, maxRequests: 5 })) {
      setError('Too many attempts. Please wait a minute and try again.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) throw signInError
      if (data.user) {
        navigate(returnTo || ROUTES.HOME)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to sign in'
      if (/429|rate|too many/i.test(message)) {
        setError('Too many sign-in attempts. Please wait before trying again.')
      } else {
        setError(message)
      }
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
        <div className="mt-8 space-y-6">
          {error && (
            <div className="rounded-lg bg-red-alert/10 border border-red-alert/30 p-4">
              <p className="text-sm text-red-alert">{error}</p>
            </div>
          )}

          {/* Google SSO */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={googleLoading}
            className="w-full flex items-center justify-center gap-3 py-2.5 px-4 bg-white/5 border border-white/10 text-white font-semibold rounded-lg hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-indigo-electric/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all ease-snappy"
          >
            {googleLoading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 001 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
            )}
            {googleLoading ? 'Connecting...' : 'Continue with Google'}
          </button>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-3 bg-void-950 text-white/40">or</span>
            </div>
          </div>

        <form className="space-y-6" onSubmit={handleSignIn}>
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
    </div>
  )
}
