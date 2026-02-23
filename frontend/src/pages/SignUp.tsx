import { useState, useEffect } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

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
        navigate('/')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign up')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="text-center text-3xl font-bold text-gray-900 dark:text-white">
            {isInvitation ? `Join ${invitationData?.org_name || 'the team'}` : 'Create your SalesBlock account'}
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
            {isInvitation ? (
              `You've been invited to join as ${invitationData?.role?.toUpperCase()}`
            ) : (
              <>
                Already have an account?{' '}
                <Link to="/signin" className="font-medium text-blue-600 hover:text-blue-500">
                  Sign in
                </Link>
              </>
            )}
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSignUp}>
          {error && (
            <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-4">
              <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
            </div>
          )}
          <div className="rounded-md shadow-sm space-y-4">
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
                disabled={isInvitation}
                className="appearance-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 disabled:bg-gray-100 dark:disabled:bg-gray-700 disabled:cursor-not-allowed sm:text-sm"
                placeholder="Email address"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
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
                className="appearance-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 sm:text-sm"
                placeholder="Password (min. 6 characters)"
              />
            </div>
            <div>
              <label htmlFor="displayName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Display name
              </label>
              <input
                id="displayName"
                name="displayName"
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="appearance-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 sm:text-sm"
                placeholder="Your name"
              />
            </div>
            {!isInvitation && (
              <div>
                <label htmlFor="organizationName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Organization name
                </label>
                <input
                  id="organizationName"
                  name="organizationName"
                  type="text"
                  required
                  value={organizationName}
                  onChange={(e) => setOrganizationName(e.target.value)}
                  className="appearance-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 sm:text-sm"
                  placeholder="Your company name"
                />
              </div>
            )}
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (isInvitation ? 'Joining team...' : 'Creating account...') : (isInvitation ? 'Accept invitation' : 'Create account')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
