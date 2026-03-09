/**
 * @crumb
 * @id frontend-page-sign-up
 * @area UI/Auth
 * @intent User registration — create new account or accept org invitation from email link; creates org on fresh signup
 * @responsibilities Parse invitation_id + email from URL params, load invitation data from Supabase, render signup form (email/password/displayName/orgName), call supabase.auth.signUp, create org + user record on success
 * @contracts SignUp() → JSX; reads team_invitations table; calls supabase.auth.signUp + inserts orgs + users; uses useSearchParams for invitation_id
 * @in supabase (team_invitations + orgs + users tables, auth.signUp), useSearchParams (invitation_id + email), user-entered form fields
 * @out New Supabase auth user + org record + users record; redirect to /; or inline error
 * @err Invitation load failure (silent — form still renders without invitation context); signUp failure (error displayed); org/user insert failure (silent — user is authenticated but app record missing)
 * @hazard If supabase.auth.signUp succeeds but the subsequent org or user insert fails, the user lands in an authenticated-but-broken state — no org_id, no users record, app will 404 or show empty state with no recovery path
 * @hazard Invitation data is fetched by invitation_id from URL with no CSRF token or expiry check on the frontend — the backend must enforce expiry; if it doesn't, old invitation links remain valid indefinitely
 * @shared-edges frontend/src/lib/supabase.ts→QUERIES team_invitations+orgs+users; frontend/src/App.tsx→ROUTES to /sign-up; frontend/src/pages/SignIn.tsx→LINKED; supabase/functions/send-team-invitation/index.ts→GENERATES invitation links
 * @trail sign-up#1 | SignUp mounts → parse URL params → load invitation (if present) → user fills form → handleSignUp → auth.signUp → insert org + user → navigate('/')
 * @prompt VV tokens applied — void-950 background, glass-card form, indigo-electric CTA, white/5 inputs with indigo-electric focus rings, red-alert error banner. Add post-signup org/user insert error handling with retry or rollback. Validate invitation_id expiry on the frontend before rendering form. Add email verification step for non-invitation signups.
 */
import { useState, useEffect } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ROUTES } from '../lib/routes'

export default function SignUp() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [organizationName, setOrganizationName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Invitation flow state
  const [invitationId, setInvitationId] = useState<string | null>(null)
  const [invitationData, setInvitationData] = useState<{
    org_id: string
    team_id: string | null
    role: string
    org_name: string
  } | null>(null)
  const [isInvitation, setIsInvitation] = useState(false)

  // Load invitation data from URL params
  useEffect(() => {
    const inviteId = searchParams.get('invitation_id')
    const inviteEmail = searchParams.get('email')

    if (inviteId && inviteEmail) {
      setInvitationId(inviteId)
      setEmail(inviteEmail)
      setIsInvitation(true)

      // Fetch invitation details
      const loadInvitation = async () => {
        try {
          const { data: invite } = await supabase
            .from('team_invitations')
            .select('org_id, team_id, role, organizations(name)')
            .eq('id', inviteId)
            .eq('status', 'pending')
            .single()

          if (invite) {
            setInvitationData({
              org_id: invite.org_id,
              team_id: invite.team_id,
              role: invite.role,
              org_name: (invite.organizations as any)?.name || 'SalesBlock.io'
            })
            setOrganizationName((invite.organizations as any)?.name || '')
          } else {
            setError('Invitation not found or has expired')
          }
        } catch (err) {
          console.error('Error loading invitation:', err)
          setError('Failed to load invitation details')
        }
      }

      loadInvitation()
    }
  }, [searchParams])

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      // Create auth user
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: displayName,
            organization_name: organizationName,
          },
        },
      })

      if (signUpError) throw signUpError

      if (authData.user) {
        if (isInvitation && invitationData) {
          // Invitation flow: join existing organization
          const { error: userError } = await supabase
            .from('users')
            .insert([
              {
                id: authData.user.id,
                org_id: invitationData.org_id,
                team_id: invitationData.team_id,
                role: invitationData.role,
                display_name: displayName,
                email: email,
                preferences: {},
              },
            ])

          if (userError) throw userError

          // Mark invitation as accepted
          if (invitationId) {
            await supabase
              .from('team_invitations')
              .update({ status: 'accepted' })
              .eq('id', invitationId)
          }
        } else {
          // New org flow: create organization and manager user
          const { data: orgData, error: orgError } = await supabase
            .from('organizations')
            .insert([
              {
                name: organizationName,
                settings: {},
              },
            ])
            .select()
            .single()

          if (orgError) throw orgError

          // Create user record with manager role
          const { error: userError } = await supabase
            .from('users')
            .insert([
              {
                id: authData.user.id,
                org_id: orgData.id,
                role: 'manager',
                display_name: displayName,
                email: email,
                preferences: {},
              },
            ])

          if (userError) throw userError
        }

        // Navigate to home after successful signup
        navigate(ROUTES.HOME)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign up')
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
            {isInvitation ? `Join ${invitationData?.org_name || 'the team'}` : 'Create your SalesBlock account'}
          </h2>
          <p className="mt-2 text-center text-sm text-white/60">
            {isInvitation ? (
              `You've been invited to join as ${invitationData?.role?.toUpperCase()}`
            ) : (
              <>
                Already have an account?{' '}
                <Link to="/signin" className="font-medium text-indigo-electric hover:text-indigo-electric/80 transition-colors ease-snappy">
                  Sign in
                </Link>
              </>
            )}
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSignUp}>
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
                disabled={isInvitation}
                className="appearance-none block w-full px-3 py-2 bg-white/5 border border-white/10 placeholder-white/30 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-electric focus:border-indigo-electric disabled:opacity-50 disabled:cursor-not-allowed text-sm transition-colors ease-snappy"
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
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="appearance-none block w-full px-3 py-2 bg-white/5 border border-white/10 placeholder-white/30 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-electric focus:border-indigo-electric text-sm transition-colors ease-snappy"
                placeholder="Min. 6 characters"
              />
            </div>
            <div>
              <label htmlFor="displayName" className="block text-sm font-medium text-white/80 mb-1">
                Display name
              </label>
              <input
                id="displayName"
                name="displayName"
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="appearance-none block w-full px-3 py-2 bg-white/5 border border-white/10 placeholder-white/30 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-electric focus:border-indigo-electric text-sm transition-colors ease-snappy"
                placeholder="Your name"
              />
            </div>
            {!isInvitation && (
              <div>
                <label htmlFor="organizationName" className="block text-sm font-medium text-white/80 mb-1">
                  Organization name
                </label>
                <input
                  id="organizationName"
                  name="organizationName"
                  type="text"
                  required
                  value={organizationName}
                  onChange={(e) => setOrganizationName(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 bg-white/5 border border-white/10 placeholder-white/30 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-electric focus:border-indigo-electric text-sm transition-colors ease-snappy"
                  placeholder="Your company name"
                />
              </div>
            )}
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-indigo-electric text-white font-semibold rounded-lg hover:bg-indigo-electric/80 focus:outline-none focus:ring-2 focus:ring-indigo-electric/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all ease-snappy"
            >
              {loading && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              {loading ? (isInvitation ? 'Joining team...' : 'Creating account...') : (isInvitation ? 'Accept invitation' : 'Create account')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
