// @crumb frontend-page-sign-up
// UI/AUTH | parse_invitation_params | load_invitation_data | render_signup_form | auth_sign_up | create_org_user
// why: User registration — create new account or accept org invitation from email link; creates org on fresh signup
// in:supabase(team_invitations+orgs+users,auth.signUp),useSearchParams(invitation_id+email),user-entered form fields out:new auth user+org record+users record,redirect to / err:invitation load failure(silent),signUp failure(error displayed),org/user insert failure(silent broken state)
// hazard: If signUp succeeds but org/user insert fails, user lands in authenticated-but-broken state with no recovery path
// hazard: Invitation data fetched by invitation_id with no CSRF/expiry check on frontend — old invitation links may remain valid indefinitely
// edge:frontend/src/lib/supabase.ts -> CALLS
// edge:frontend/src/App.tsx -> RELATES
// edge:frontend/src/pages/SignIn.tsx -> RELATES
// edge:supabase/functions/send-team-invitation/index.ts -> RELATES
// edge:sign-up#1 -> STEP_IN
// prompt: Add post-signup org/user insert error handling with retry or rollback. Validate invitation_id expiry on frontend. Add email verification for non-invitation signups.
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
            .gt('expires_at', new Date().toISOString())
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

    // Track org created so we can delete it if the user-record step fails
    let createdOrgId: string | null = null

    try {
      // Step 1: Create auth user
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
          // Step 2a: Create user record in the invited org
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

          if (userError) {
            // Compensate: sign out the auth user we just created so they
            // are not left in an authenticated-but-profileless state
            await supabase.auth.signOut()
            throw new Error('Failed to set up your account. Please try again.')
          }

          // Step 2b: Mark invitation as accepted (best-effort — non-fatal)
          if (invitationId) {
            await supabase
              .from('team_invitations')
              .update({ status: 'accepted' })
              .eq('id', invitationId)
          }
        } else {
          // New org flow: create organization then manager user

          // Step 2: Create organization
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

          if (orgError) {
            // Compensate: sign out the orphaned auth user
            await supabase.auth.signOut()
            throw new Error('Failed to create your organization. Please try again.')
          }

          createdOrgId = orgData.id

          // Step 3: Create user record with manager role
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

          if (userError) {
            // Compensate: delete the org we just created, then sign out.
            // org deletion cascades to dependent rows via ON DELETE CASCADE.
            if (createdOrgId) {
              await supabase.from('organizations').delete().eq('id', createdOrgId)
            }
            await supabase.auth.signOut()
            throw new Error('Failed to set up your account. Please try again.')
          }
        }

        // All steps succeeded — navigate to home
        navigate(ROUTES.HOME)
      }
    } catch (err) {
      // Show a human-readable message; preserve specific messages we threw above
      const message =
        err instanceof Error && err.message !== 'Failed to sign up'
          ? err.message
          : 'Sign up failed. Please check your details and try again.'
      setError(message)
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
