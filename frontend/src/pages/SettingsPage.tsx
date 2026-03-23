// @crumb frontend-page-settings
// UI/PAGES | load_org_data | render_six_tab_ui | logo_upload | org_settings_save | salesforce_auto_push | pipeline_stages_crud | oauth_buttons
// why: Multi-tab settings hub — manage profile, organisation, team, integrations, pipeline stages, and billing
// in:supabase(orgs+pipeline_stages+users+storage),useAuth,GmailOAuthButton+OutlookOAuthButton+GoogleCalendarOAuthButton+OutlookCalendarOAuthButton+SalesforceOAuthButton out:6-tab settings UI with profile edit,org management,team roster,OAuth buttons,pipeline stage editor,billing display err:logo upload failure(uploadError state),org save failure(silent),pipeline stage save failure(silent),Storage URL construction may fail silently
// hazard: All 5 OAuth integrations render inside a single tab — if any OAuth button throws on mount it crashes the entire integrations tab
// hazard: Logo upload uses Supabase Storage with a hardcoded bucket name — path convention changes cause silent stale/broken logo_url
// edge:frontend/src/lib/supabase.ts -> CALLS
// edge:frontend/src/hooks/useAuth.ts -> READS
// edge:frontend/src/components/GmailOAuthButton.tsx -> RELATES
// edge:frontend/src/components/OutlookOAuthButton.tsx -> RELATES
// edge:frontend/src/components/GoogleCalendarOAuthButton.tsx -> RELATES
// edge:frontend/src/components/OutlookCalendarOAuthButton.tsx -> RELATES
// edge:frontend/src/components/SalesforceOAuthButton.tsx -> RELATES
// edge:frontend/src/App.tsx -> RELATES
// edge:settings#1 -> STEP_IN
// prompt: Wrap each OAuth button in its own ErrorBoundary. Add success/error toasts for all save actions. Validate org logo URL before displaying. Extract each tab into a sub-component.
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import GmailOAuthButton from '../components/GmailOAuthButton'
import MicrosoftOAuthButton from '../components/MicrosoftOAuthButton'
import GoogleCalendarOAuthButton from '../components/GoogleCalendarOAuthButton'
import SalesforceOAuthButton from '../components/SalesforceOAuthButton'
import OAuthErrorBoundary from '../components/OAuthErrorBoundary'
import { toast } from '../hooks/use-toast'

type Tab = 'profile' | 'organization' | 'team' | 'integrations' | 'pipeline' | 'billing'

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('profile')
  const { user } = useAuth()

  const [orgName, setOrgName] = useState('')
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [orgId, setOrgId] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadSuccess, setUploadSuccess] = useState(false)

  // Salesforce auto-push toggle state
  const [sfAutoPush, setSfAutoPush] = useState(false)
  const [sfAutoPushLoading, setSfAutoPushLoading] = useState(false)
  const [sfConnected, setSfConnected] = useState(false)

  // Attio auto-push toggle state
  const [attioAutoPush, setAttioAutoPush] = useState(false)
  const [attioAutoPushLoading, setAttioAutoPushLoading] = useState(false)
  const [attioConnected, setAttioConnected] = useState(false)

  // Pipeline stages state
  const [pipelineStages, setPipelineStages] = useState<{
    id: string
    name: string
    position: number
    probability: number
    color: string
  }[]>([])
  const [loadingStages, setLoadingStages] = useState(false)
  const [savingStages, setSavingStages] = useState(false)

  // Billing state
  const [billingData, setBillingData] = useState<{
    currentPlan: string | null
    nextBillingDate: string | null
    stripeCustomerId: string | null
  }>({
    currentPlan: null,
    nextBillingDate: null,
    stripeCustomerId: null,
  })
  const [loadingBilling, setLoadingBilling] = useState(false)

  // Team & Invitations state
  const [userRole, setUserRole] = useState<string | null>(null)
  const [teamMembers, setTeamMembers] = useState<{
    id: string
    email: string
    display_name: string
    role: string
    team_id: string | null
  }[]>([])
  const [teamInvitations, setTeamInvitations] = useState<{
    id: string
    email: string
    role: string
    status: string
    invited_by: string
    created_at: string
    expires_at: string
  }[]>([])
  const [loadingTeam, setLoadingTeam] = useState(false)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'sdr' | 'ae' | 'manager'>('sdr')
  const [inviteTeamId, setInviteTeamId] = useState<string | null>(null)
  const [availableTeams, setAvailableTeams] = useState<{ id: string; name: string }[]>([])
  const [sendingInvite, setSendingInvite] = useState(false)
  const [resendingInviteId, setResendingInviteId] = useState<string | null>(null)

  // Profile state
  const [displayName, setDisplayName] = useState('')
  const [profileEmail, setProfileEmail] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileSaved, setProfileSaved] = useState(false)
  const [passwordNew, setPasswordNew] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSuccess, setPasswordSuccess] = useState(false)
  const [darkMode, setDarkMode] = useState(() => document.documentElement.classList.contains('dark'))

  // Hierarchy management state
  const [divisions, setDivisions] = useState<{
    id: string
    name: string
    org_id: string
  }[]>([])
  const [teams, setTeams] = useState<{
    id: string
    name: string
    division_id: string | null
    org_id: string
  }[]>([])
  const [loadingHierarchy, setLoadingHierarchy] = useState(false)
  const [editingDivisionId, setEditingDivisionId] = useState<string | null>(null)
  const [editingDivisionName, setEditingDivisionName] = useState('')
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null)
  const [editingTeamName, setEditingTeamName] = useState('')
  const [newDivisionName, setNewDivisionName] = useState('')
  const [newTeamName, setNewTeamName] = useState('')
  const [newTeamDivisionId, setNewTeamDivisionId] = useState<string | null>(null)

  // Activity types management state
  const [activityTypes, setActivityTypes] = useState<{
    id: string
    label: string
    value: string
    icon: string | null
  }[]>([])
  const [loadingActivityTypes, setLoadingActivityTypes] = useState(false)
  const [newActivityLabel, setNewActivityLabel] = useState('')
  const [newActivityValue, setNewActivityValue] = useState('')
  const [savingActivityType, setSavingActivityType] = useState(false)

  // Load organization data + profile data
  useEffect(() => {
    const loadOrgData = async () => {
      if (!user) return

      // Load profile data
      setProfileEmail(user.email || '')
      const { data: profileData } = await supabase
        .from('users')
        .select('org_id, role, display_name')
        .eq('id', user.id)
        .single()

      if (profileData) {
        setDisplayName(profileData.display_name || '')
        setUserRole(profileData.role)
      }

      if (!profileData?.org_id) return

      setOrgId(profileData.org_id)

      const { data: orgData } = await supabase
        .from('organizations')
        .select('name, logo_url, sf_auto_push_activities, attio_auto_push_activities')
        .eq('id', profileData.org_id)
        .single()

      if (orgData) {
        setOrgName(orgData.name || '')
        setLogoUrl(orgData.logo_url)
        setSfAutoPush(orgData.sf_auto_push_activities || false)
        setAttioAutoPush(orgData.attio_auto_push_activities || false)
      }

      // Check Salesforce connection status
      const connected = await isSalesforceConnected()
      setSfConnected(connected)

      // Check Attio connection status
      if (user && profileData.org_id) {
        const { data: attioConn } = await supabase
          .from('oauth_connections')
          .select('id')
          .eq('user_id', user.id)
          .eq('provider', 'attio')
          .maybeSingle()
        setAttioConnected(!!attioConn)
      }
    }

    loadOrgData()
  }, [user])

  // Load pipeline stages for Pipeline tab
  useEffect(() => {
    const loadPipelineStages = async () => {
      if (!user || activeTab !== 'pipeline') return

      setLoadingStages(true)
      try {
        const { data: userData } = await supabase
          .from('users')
          .select('org_id')
          .eq('id', user.id)
          .single()

        if (!userData?.org_id) return

        const { data: stages } = await supabase
          .from('pipeline_stages')
          .select('id, name, position, probability, color')
          .eq('org_id', userData.org_id)
          .order('position')

        if (stages) {
          setPipelineStages(stages)
        }
      } catch (error) {
        console.error('Error loading pipeline stages:', error)
      } finally {
        setLoadingStages(false)
      }
    }

    loadPipelineStages()
  }, [user, activeTab])

  // Load team data for Team tab
  useEffect(() => {
    const loadTeamData = async () => {
      if (!user || activeTab !== 'team' || userRole !== 'manager') return

      setLoadingTeam(true)
      try {
        const { data: userData } = await supabase
          .from('users')
          .select('org_id, team_id')
          .eq('id', user.id)
          .single()

        if (!userData?.org_id) return

        // Load team members
        const { data: members } = await supabase
          .from('users')
          .select('id, email, display_name, role, team_id')
          .eq('org_id', userData.org_id)
          .order('display_name')

        if (members) {
          setTeamMembers(members)
        }

        // Load pending invitations
        const { data: invites } = await supabase
          .from('team_invitations')
          .select('id, email, role, status, invited_by, created_at, expires_at')
          .eq('org_id', userData.org_id)
          .eq('status', 'pending')
          .order('created_at', { ascending: false })

        if (invites) {
          setTeamInvitations(invites)
        }

        // Load available teams
        const { data: teams } = await supabase
          .from('teams')
          .select('id, name')
          .eq('org_id', userData.org_id)
          .order('name')

        if (teams) {
          setAvailableTeams(teams)
        }
      } catch (error) {
        console.error('Error loading team data:', error)
      } finally {
        setLoadingTeam(false)
      }
    }

    loadTeamData()
  }, [user, activeTab, userRole])

  // Load hierarchy data for Organization tab
  useEffect(() => {
    const loadHierarchyData = async () => {
      if (!user || activeTab !== 'organization') return

      setLoadingHierarchy(true)
      try {
        const { data: userData } = await supabase
          .from('users')
          .select('org_id')
          .eq('id', user.id)
          .single()

        if (!userData?.org_id) return

        // Load divisions
        const { data: divisionsData } = await supabase
          .from('divisions')
          .select('id, name, org_id')
          .eq('org_id', userData.org_id)
          .order('name')

        if (divisionsData) {
          setDivisions(divisionsData)
        }

        // Load teams
        const { data: teamsData } = await supabase
          .from('teams')
          .select('id, name, division_id, org_id')
          .eq('org_id', userData.org_id)
          .order('name')

        if (teamsData) {
          setTeams(teamsData)
        }

        // Load team members for user reassignment
        const { data: members } = await supabase
          .from('users')
          .select('id, email, display_name, role, team_id')
          .eq('org_id', userData.org_id)
          .order('display_name')

        if (members) {
          setTeamMembers(members)
        }

        // Load activity types
        setLoadingActivityTypes(true)
        const { data: activityTypesData } = await supabase
          .from('activity_types')
          .select('id, label, value, icon')
          .eq('org_id', userData.org_id)
          .order('label')

        if (activityTypesData) {
          setActivityTypes(activityTypesData)
        }
        setLoadingActivityTypes(false)
      } catch (error) {
        console.error('Error loading hierarchy data:', error)
        setLoadingActivityTypes(false)
      } finally {
        setLoadingHierarchy(false)
      }
    }

    loadHierarchyData()
  }, [user, activeTab])

  // Load billing data for Billing tab
  useEffect(() => {
    const loadBillingData = async () => {
      if (!user || activeTab !== 'billing') return

      setLoadingBilling(true)
      try {
        const { data: userData } = await supabase
          .from('users')
          .select('org_id, role, subscription_status')
          .eq('id', user.id)
          .single()

        if (!userData?.org_id) return

        const { data: orgData } = await supabase
          .from('organizations')
          .select('stripe_customer_id')
          .eq('id', userData.org_id)
          .single()

        if (orgData?.stripe_customer_id) {
          // Fetch subscription data from Stripe via Edge Function
          const response = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-billing-info`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
                'Content-Type': 'application/json',
              },
            }
          )

          if (response.ok) {
            const billing = await response.json()
            setBillingData({
              currentPlan: `${userData.role.toUpperCase()} - ${userData.subscription_status}`,
              nextBillingDate: billing.nextBillingDate,
              stripeCustomerId: orgData.stripe_customer_id,
            })
          }
        } else {
          setBillingData({
            currentPlan: 'Free Trial',
            nextBillingDate: null,
            stripeCustomerId: null,
          })
        }
      } catch (error) {
        console.error('Error loading billing data:', error)
      } finally {
        setLoadingBilling(false)
      }
    }

    loadBillingData()
  }, [user, activeTab])

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !orgId) return

    // Reset states
    setUploadError(null)
    setUploadSuccess(false)

    // Validate file type
    const validTypes = ['image/png', 'image/jpeg', 'image/svg+xml']
    if (!validTypes.includes(file.type)) {
      setUploadError('Invalid file type. Please upload PNG, JPG, or SVG.')
      return
    }

    // Validate file size (2MB max)
    const maxSize = 2 * 1024 * 1024
    if (file.size > maxSize) {
      setUploadError('File too large. Maximum size is 2MB.')
      return
    }

    setUploading(true)

    try {
      // Generate unique filename
      const fileExt = file.name.split('.').pop()
      const fileName = `${orgId}/logo-${Date.now()}.${fileExt}`

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('logos')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true
        })

      if (uploadError) throw uploadError

      // Get public URL
      const { data } = supabase.storage
        .from('logos')
        .getPublicUrl(fileName)

      // Update organizations table
      const { error: updateError } = await supabase
        .from('organizations')
        .update({ logo_url: data.publicUrl })
        .eq('id', orgId)

      if (updateError) throw updateError

      setLogoUrl(data.publicUrl)
      setUploadSuccess(true)

      // Clear success message after 3 seconds
      setTimeout(() => setUploadSuccess(false), 3000)
    } catch (error) {
      console.error('Logo upload error:', error)
      setUploadError('Upload failed. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  const handleRemoveLogo = async () => {
    if (!orgId || !logoUrl) return

    setUploading(true)
    setUploadError(null)

    try {
      // Extract file path from URL
      const urlParts = logoUrl.split('/logos/')
      if (urlParts.length === 2) {
        const filePath = urlParts[1]

        // Delete from storage
        await supabase.storage
          .from('logos')
          .remove([filePath])
      }

      // Update organizations table
      const { error: updateError } = await supabase
        .from('organizations')
        .update({ logo_url: null })
        .eq('id', orgId)

      if (updateError) throw updateError

      setLogoUrl(null)
      setUploadSuccess(true)
      setTimeout(() => setUploadSuccess(false), 3000)
    } catch (error) {
      console.error('Logo removal error:', error)
      setUploadError('Failed to remove logo. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  const handleSfAutoPushToggle = async () => {
    if (!orgId) return

    setSfAutoPushLoading(true)
    try {
      const newValue = !sfAutoPush

      const { error } = await supabase
        .from('organizations')
        .update({ sf_auto_push_activities: newValue })
        .eq('id', orgId)

      if (error) throw error

      setSfAutoPush(newValue)
    } catch (error) {
      console.error('Failed to update SF auto-push setting:', error)
      toast({ variant: 'destructive', title: 'Failed to update auto-push setting', description: 'Please try again.' })
    } finally {
      setSfAutoPushLoading(false)
    }
  }

  const handleAttioAutoPushToggle = async () => {
    if (!orgId) return

    setAttioAutoPushLoading(true)
    try {
      const newValue = !attioAutoPush

      const { error } = await supabase
        .from('organizations')
        .update({ attio_auto_push_activities: newValue })
        .eq('id', orgId)

      if (error) throw error

      setAttioAutoPush(newValue)
    } catch (error) {
      console.error('Failed to update Attio auto-push setting:', error)
      alert('Failed to update auto-push setting. Please try again.')
    } finally {
      setAttioAutoPushLoading(false)
    }
  }

  const handleSyncNow = async () => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-activities-to-salesforce`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      )

      if (!response.ok) throw new Error('Sync failed')

      const result = await response.json()
      toast({ title: `Sync completed: ${result.synced} synced, ${result.failed} failed` })
    } catch (error) {
      console.error('Manual sync error:', error)
      toast({ variant: 'destructive', title: 'Manual sync failed', description: 'Please try again.' })
    }
  }

  const handleProbabilityChange = (stageId: string, newProbability: number) => {
    setPipelineStages(stages =>
      stages.map(stage =>
        stage.id === stageId
          ? { ...stage, probability: newProbability }
          : stage
      )
    )
  }

  const handleSaveProbabilities = async () => {
    setSavingStages(true)
    try {
      // Update each stage's probability
      const updates = pipelineStages.map(stage =>
        supabase
          .from('pipeline_stages')
          .update({ probability: stage.probability })
          .eq('id', stage.id)
      )

      await Promise.all(updates)

      toast({ title: 'Stage probabilities updated successfully' })
    } catch (error) {
      console.error('Error saving probabilities:', error)
      toast({ variant: 'destructive', title: 'Failed to save probabilities', description: 'Please try again.' })
    } finally {
      setSavingStages(false)
    }
  }

  const handleOpenCustomerPortal = async () => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-portal-session`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      )

      if (!response.ok) throw new Error('Failed to create portal session')

      const { url } = await response.json()
      window.location.href = url
    } catch (error) {
      console.error('Error opening customer portal:', error)
      toast({ variant: 'destructive', title: 'Failed to open billing portal', description: 'Please try again.' })
    }
  }

  const handleCancelSubscription = async () => {
    if (!confirm('Are you sure you want to cancel your subscription? Access will continue until the end of the current billing period.')) {
      return
    }

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cancel-subscription`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      )

      if (!response.ok) throw new Error('Failed to cancel subscription')

      toast({ title: 'Subscription cancelled. You will retain access until the end of your billing period.' })
      // Reload billing data
      setActiveTab('billing')
    } catch (error) {
      console.error('Error cancelling subscription:', error)
      toast({ variant: 'destructive', title: 'Failed to cancel subscription', description: 'Please try again.' })
    }
  }

  const handleSendInvite = async () => {
    if (!inviteEmail || !orgId) {
      toast({ variant: 'destructive', title: 'Please enter an email address' })
      return
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(inviteEmail)) {
      toast({ variant: 'destructive', title: 'Please enter a valid email address' })
      return
    }

    setSendingInvite(true)
    try {
      // Create invitation record
      const { data: invitation, error: inviteError } = await supabase
        .from('team_invitations')
        .insert({
          org_id: orgId,
          team_id: inviteTeamId,
          email: inviteEmail,
          role: inviteRole,
          invited_by: user!.id,
        })
        .select()
        .single()

      if (inviteError) throw inviteError

      // Send magic link via Supabase Edge Function
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-team-invitation`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            invitation_id: invitation.id,
            email: inviteEmail,
            org_id: orgId,
            team_id: inviteTeamId,
            role: inviteRole,
          }),
        }
      )

      if (!response.ok) {
        throw new Error('Failed to send invitation email')
      }

      toast({ title: `Invitation sent to ${inviteEmail}` })

      // Reset form
      setInviteEmail('')
      setInviteRole('sdr')
      setInviteTeamId(null)
      setShowInviteModal(false)

      // Reload team data
      setActiveTab('team')
    } catch (error: any) {
      console.error('Error sending invitation:', error)
      if (error.message?.includes('duplicate')) {
        toast({ variant: 'destructive', title: 'An invitation has already been sent to this email address' })
      } else {
        toast({ variant: 'destructive', title: 'Failed to send invitation', description: 'Please try again.' })
      }
    } finally {
      setSendingInvite(false)
    }
  }

  const handleCancelInvite = async (inviteId: string) => {
    if (!confirm('Are you sure you want to cancel this invitation?')) {
      return
    }

    try {
      const { error } = await supabase
        .from('team_invitations')
        .delete()
        .eq('id', inviteId)

      if (error) throw error

      // Reload invitations
      setTeamInvitations(invites => invites.filter(i => i.id !== inviteId))
      toast({ title: 'Invitation cancelled' })
    } catch (error) {
      console.error('Error cancelling invitation:', error)
      toast({ variant: 'destructive', title: 'Failed to cancel invitation', description: 'Please try again.' })
    }
  }

  const handleResendInvite = async (invite: { id: string; email: string; role: string }) => {
    if (!orgId || !user) return
    setResendingInviteId(invite.id)
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-team-invitation`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: invite.email,
            org_id: orgId,
            role: invite.role,
            resend: true,
          }),
        }
      )

      if (!response.ok) throw new Error('Failed to resend invitation')

      toast({ title: `Invitation resent to ${invite.email}` })

      // Reload team data to get fresh invitation with new expires_at
      const { data: invites } = await supabase
        .from('team_invitations')
        .select('id, email, role, status, invited_by, created_at, expires_at')
        .eq('org_id', orgId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })

      if (invites) setTeamInvitations(invites)
    } catch (error) {
      console.error('Error resending invitation:', error)
      toast({ variant: 'destructive', title: 'Failed to resend invitation', description: 'Please try again.' })
    } finally {
      setResendingInviteId(null)
    }
  }

  // Hierarchy management handlers
  const handleCreateDivision = async () => {
    if (!newDivisionName.trim() || !orgId) return

    try {
      const { data, error } = await supabase
        .from('divisions')
        .insert({ org_id: orgId, name: newDivisionName.trim() })
        .select()
        .single()

      if (error) throw error

      setDivisions([...divisions, data])
      setNewDivisionName('')
      toast({ title: 'Division created successfully' })
    } catch (error) {
      console.error('Error creating division:', error)
      toast({ variant: 'destructive', title: 'Failed to create division', description: 'Please try again.' })
    }
  }

  const handleRenameDivision = async (divisionId: string, newName: string) => {
    if (!newName.trim()) return

    try {
      const { error } = await supabase
        .from('divisions')
        .update({ name: newName.trim() })
        .eq('id', divisionId)

      if (error) throw error

      setDivisions(divisions.map(d => d.id === divisionId ? { ...d, name: newName.trim() } : d))
      setEditingDivisionId(null)
      setEditingDivisionName('')
    } catch (error) {
      console.error('Error renaming division:', error)
      toast({ variant: 'destructive', title: 'Failed to rename division', description: 'Please try again.' })
    }
  }

  const handleDeleteDivision = async (divisionId: string) => {
    if (!confirm('Delete this division? Teams in this division will be unassigned but not deleted.')) {
      return
    }

    try {
      const { error } = await supabase
        .from('divisions')
        .delete()
        .eq('id', divisionId)

      if (error) throw error

      setDivisions(divisions.filter(d => d.id !== divisionId))
      // Update teams that were in this division (division_id will be set to null by ON DELETE SET NULL)
      setTeams(teams.map(t => t.division_id === divisionId ? { ...t, division_id: null } : t))
      toast({ title: 'Division deleted' })
    } catch (error) {
      console.error('Error deleting division:', error)
      toast({ variant: 'destructive', title: 'Failed to delete division', description: 'Please try again.' })
    }
  }

  const handleCreateTeam = async () => {
    if (!newTeamName.trim() || !orgId) return

    try {
      const { data, error } = await supabase
        .from('teams')
        .insert({
          org_id: orgId,
          name: newTeamName.trim(),
          division_id: newTeamDivisionId,
        })
        .select()
        .single()

      if (error) throw error

      setTeams([...teams, data])
      setNewTeamName('')
      setNewTeamDivisionId(null)
      toast({ title: 'Team created successfully' })
    } catch (error) {
      console.error('Error creating team:', error)
      toast({ variant: 'destructive', title: 'Failed to create team', description: 'Please try again.' })
    }
  }

  const handleRenameTeam = async (teamId: string, newName: string) => {
    if (!newName.trim()) return

    try {
      const { error } = await supabase
        .from('teams')
        .update({ name: newName.trim() })
        .eq('id', teamId)

      if (error) throw error

      setTeams(teams.map(t => t.id === teamId ? { ...t, name: newName.trim() } : t))
      setEditingTeamId(null)
      setEditingTeamName('')
    } catch (error) {
      console.error('Error renaming team:', error)
      toast({ variant: 'destructive', title: 'Failed to rename team', description: 'Please try again.' })
    }
  }

  const handleDeleteTeam = async (teamId: string) => {
    if (!confirm('Delete this team? Users in this team will be unassigned but not deleted.')) {
      return
    }

    try {
      const { error } = await supabase
        .from('teams')
        .delete()
        .eq('id', teamId)

      if (error) throw error

      setTeams(teams.filter(t => t.id !== teamId))
      // Update users that were in this team
      setTeamMembers(teamMembers.map(m => m.team_id === teamId ? { ...m, team_id: null } : m))
      toast({ title: 'Team deleted' })
    } catch (error) {
      console.error('Error deleting team:', error)
      toast({ variant: 'destructive', title: 'Failed to delete team', description: 'Please try again.' })
    }
  }

  const handleAssignTeamToDivision = async (teamId: string, divisionId: string | null) => {
    try {
      const { error } = await supabase
        .from('teams')
        .update({ division_id: divisionId })
        .eq('id', teamId)

      if (error) throw error

      setTeams(teams.map(t => t.id === teamId ? { ...t, division_id: divisionId } : t))
    } catch (error) {
      console.error('Error assigning team to division:', error)
      toast({ variant: 'destructive', title: 'Failed to assign team', description: 'Please try again.' })
    }
  }

  const handleReassignUser = async (userId: string, newTeamId: string | null) => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ team_id: newTeamId })
        .eq('id', userId)

      if (error) throw error

      setTeamMembers(teamMembers.map(m => m.id === userId ? { ...m, team_id: newTeamId } : m))
    } catch (error) {
      console.error('Error reassigning user:', error)
      toast({ variant: 'destructive', title: 'Failed to reassign user', description: 'Please try again.' })
    }
  }

  // Activity types management handlers
  const handleAddActivityType = async () => {
    if (!newActivityLabel.trim() || !newActivityValue.trim() || !orgId) return

    setSavingActivityType(true)
    try {
      const { data, error } = await supabase
        .from('activity_types')
        .insert({
          org_id: orgId,
          label: newActivityLabel.trim(),
          value: newActivityValue.trim().toLowerCase().replace(/\s+/g, '_'),
          icon: null,
        })
        .select('id, label, value, icon')
        .single()

      if (error) throw error

      setActivityTypes([...activityTypes, data])
      setNewActivityLabel('')
      setNewActivityValue('')
      toast({ title: 'Activity type added' })
    } catch (error) {
      console.error('Error adding activity type:', error)
      toast({ variant: 'destructive', title: 'Failed to add activity type', description: 'Please try again.' })
    } finally {
      setSavingActivityType(false)
    }
  }

  const handleDeleteActivityType = async (typeId: string) => {
    if (!confirm('Delete this activity type?')) return

    try {
      const { error } = await supabase
        .from('activity_types')
        .delete()
        .eq('id', typeId)

      if (error) throw error

      setActivityTypes(activityTypes.filter((t) => t.id !== typeId))
      toast({ title: 'Activity type removed' })
    } catch (error) {
      console.error('Error deleting activity type:', error)
      toast({ variant: 'destructive', title: 'Failed to remove activity type', description: 'Please try again.' })
    }
  }

  return (
    <div className="min-h-full bg-gray-50 dark:bg-void-950 p-6 space-y-6">
      <div>
        <p className="vv-section-title mb-1">Account</p>
        <h1 className="font-display text-3xl font-bold text-gray-900 dark:text-white">
          Settings
        </h1>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-white/10 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('profile')}
            className={`${
              activeTab === 'profile'
                ? 'border-indigo-electric text-indigo-electric'
                : 'border-transparent text-gray-600 dark:text-white/50 hover:text-gray-900 dark:hover:text-white hover:border-white/20'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
          >
            Profile
          </button>
          <button
            onClick={() => setActiveTab('organization')}
            className={`${
              activeTab === 'organization'
                ? 'border-indigo-electric text-indigo-electric'
                : 'border-transparent text-gray-600 dark:text-white/50 hover:text-gray-900 dark:hover:text-white hover:border-white/20'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
          >
            Organization
          </button>
          {userRole === 'manager' && (
            <button
              onClick={() => setActiveTab('team')}
              className={`${
                activeTab === 'team'
                  ? 'border-indigo-electric text-indigo-electric'
                  : 'border-transparent text-gray-600 dark:text-white/50 hover:text-gray-900 dark:hover:text-white hover:border-white/20'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
            >
              Team
            </button>
          )}
          <button
            onClick={() => setActiveTab('integrations')}
            className={`${
              activeTab === 'integrations'
                ? 'border-indigo-electric text-indigo-electric'
                : 'border-transparent text-gray-600 dark:text-white/50 hover:text-gray-900 dark:hover:text-white hover:border-white/20'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
          >
            Integrations
          </button>
          <button
            onClick={() => setActiveTab('pipeline')}
            className={`${
              activeTab === 'pipeline'
                ? 'border-indigo-electric text-indigo-electric'
                : 'border-transparent text-gray-600 dark:text-white/50 hover:text-gray-900 dark:hover:text-white hover:border-white/20'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
          >
            Pipeline
          </button>
          <button
            onClick={() => setActiveTab('billing')}
            className={`${
              activeTab === 'billing'
                ? 'border-indigo-electric text-indigo-electric'
                : 'border-transparent text-gray-600 dark:text-white/50 hover:text-gray-900 dark:hover:text-white hover:border-white/20'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
          >
            Billing
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'profile' && (
        <div className="max-w-2xl space-y-8">
          <h2 className="font-display text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Profile Settings
          </h2>

          {/* Display Name */}
          <div className="glass-card p-6">
            <label className="vv-section-title block mb-2">Display Name</label>
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={displayName}
                onChange={(e) => {
                  setDisplayName(e.target.value)
                  setProfileSaved(false)
                }}
                placeholder="Enter your display name"
                className="flex-1 px-4 py-2 border border-gray-200 dark:border-white/10 rounded-lg bg-white dark:bg-white/5 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/40 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-electric/50 focus:border-indigo-electric transition-all"
              />
              <button
                onClick={async () => {
                  if (!user) return
                  setSavingProfile(true)
                  setProfileSaved(false)
                  try {
                    const { error } = await supabase
                      .from('users')
                      .update({ display_name: displayName })
                      .eq('id', user.id)
                    if (error) throw error
                    setProfileSaved(true)
                    setTimeout(() => setProfileSaved(false), 3000)
                  } catch (err) {
                    console.error('Failed to save display name:', err)
                    toast({ variant: 'destructive', title: 'Failed to save display name', description: 'Please try again.' })
                  } finally {
                    setSavingProfile(false)
                  }
                }}
                disabled={savingProfile}
                className="px-4 py-2 bg-indigo-electric hover:bg-indigo-electric/80 text-white rounded-lg text-sm font-semibold transition-all duration-200 ease-snappy disabled:opacity-50"
              >
                {savingProfile ? 'Saving...' : profileSaved ? 'Saved!' : 'Save'}
              </button>
            </div>
          </div>

          {/* Email (read-only) */}
          <div className="glass-card p-6">
            <label className="vv-section-title block mb-2">Email Address</label>
            <input
              type="email"
              value={profileEmail}
              disabled
              className="w-full px-4 py-2 border border-gray-200 dark:border-white/10 rounded-lg bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-white/50 cursor-not-allowed text-sm"
            />
            <p className="text-xs text-gray-500 dark:text-white/40 mt-2">
              Email address cannot be changed here. Contact support if you need to update it.
            </p>
          </div>

          {/* Change Password */}
          <div className="glass-card p-6">
            <label className="vv-section-title block mb-4">Change Password</label>
            <div className="space-y-3">
              <input
                type="password"
                value={passwordNew}
                onChange={(e) => {
                  setPasswordNew(e.target.value)
                  setPasswordError(null)
                  setPasswordSuccess(false)
                }}
                placeholder="New password"
                className="w-full px-4 py-2 border border-gray-200 dark:border-white/10 rounded-lg bg-white dark:bg-white/5 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/40 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-electric/50 focus:border-indigo-electric transition-all"
              />
              <input
                type="password"
                value={passwordConfirm}
                onChange={(e) => {
                  setPasswordConfirm(e.target.value)
                  setPasswordError(null)
                  setPasswordSuccess(false)
                }}
                placeholder="Confirm new password"
                className="w-full px-4 py-2 border border-gray-200 dark:border-white/10 rounded-lg bg-white dark:bg-white/5 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/40 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-electric/50 focus:border-indigo-electric transition-all"
              />
              {passwordError && (
                <p className="text-sm text-red-alert">{passwordError}</p>
              )}
              {passwordSuccess && (
                <p className="text-sm text-emerald-signal">Password updated successfully.</p>
              )}
              <button
                onClick={async () => {
                  setPasswordError(null)
                  setPasswordSuccess(false)
                  if (passwordNew.length < 6) {
                    setPasswordError('Password must be at least 6 characters.')
                    return
                  }
                  if (passwordNew !== passwordConfirm) {
                    setPasswordError('Passwords do not match.')
                    return
                  }
                  setChangingPassword(true)
                  try {
                    const { error } = await supabase.auth.updateUser({
                      password: passwordNew,
                    })
                    if (error) throw error
                    setPasswordSuccess(true)
                    setPasswordNew('')
                    setPasswordConfirm('')
                    setTimeout(() => setPasswordSuccess(false), 5000)
                  } catch (err: any) {
                    setPasswordError(err.message || 'Failed to update password.')
                  } finally {
                    setChangingPassword(false)
                  }
                }}
                disabled={changingPassword || !passwordNew}
                className="px-4 py-2 bg-indigo-electric hover:bg-indigo-electric/80 text-white rounded-lg text-sm font-semibold transition-all duration-200 ease-snappy disabled:opacity-50"
              >
                {changingPassword ? 'Updating...' : 'Update Password'}
              </button>
            </div>
          </div>

          {/* Theme Preference */}
          <div className="glass-card p-6">
            <label className="vv-section-title block mb-2">Theme Preference</label>
            <p className="text-sm text-gray-600 dark:text-white/50 mb-4">
              Choose your preferred color scheme.
            </p>
            <div className="flex items-center gap-4">
              <button
                onClick={() => {
                  document.documentElement.classList.remove('dark')
                  localStorage.setItem('theme', 'light')
                  setDarkMode(false)
                }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ease-snappy border ${
                  !darkMode
                    ? 'bg-indigo-electric text-white border-indigo-electric'
                    : 'bg-white dark:bg-white/5 text-gray-700 dark:text-white/60 border-gray-200 dark:border-white/10 hover:border-indigo-electric/50'
                }`}
              >
                Light
              </button>
              <button
                onClick={() => {
                  document.documentElement.classList.add('dark')
                  localStorage.setItem('theme', 'dark')
                  setDarkMode(true)
                }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ease-snappy border ${
                  darkMode
                    ? 'bg-indigo-electric text-white border-indigo-electric'
                    : 'bg-white dark:bg-white/5 text-gray-700 dark:text-white/60 border-gray-200 dark:border-white/10 hover:border-indigo-electric/50'
                }`}
              >
                Dark
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'organization' && (
        <div className="max-w-4xl">
          <h2 className="font-display text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Organization Settings
          </h2>

          {/* Organization Name */}
          <div className="mb-8">
            <label className="vv-section-title block mb-2">
              Organization Name
            </label>
            <input
              type="text"
              value={orgName}
              disabled
              className="w-full px-4 py-2 border border-gray-200 dark:border-white/10 rounded-lg bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-white/50 cursor-not-allowed"
            />
          </div>

          {/* Logo Upload */}
          <div className="mb-8">
            <label className="vv-section-title block mb-2">
              Organization Logo
            </label>
            <p className="text-sm text-gray-600 dark:text-white/50 mb-4">
              Upload your company logo (PNG, JPG, or SVG, max 2MB). This will appear in the sidebar and sign-in page.
            </p>

            {/* Current Logo Preview */}
            {logoUrl && (
              <div className="mb-4 glass-card p-4">
                <p className="text-sm font-medium text-gray-700 dark:text-white/70 mb-2">
                  Current Logo
                </p>
                <div className="flex items-center space-x-4">
                  <img
                    src={logoUrl}
                    alt="Organization logo"
                    className="h-16 w-auto object-contain"
                  />
                  <button
                    onClick={handleRemoveLogo}
                    disabled={uploading}
                    className="px-3 py-1 text-sm text-red-alert hover:text-red-alert/70 disabled:opacity-50 transition-colors duration-150"
                  >
                    Remove
                  </button>
                </div>
              </div>
            )}

            {/* Upload Button */}
            <div className="flex items-center space-x-4">
              <label className="flex items-center justify-center px-4 py-2 border border-gray-200 dark:border-white/10 rounded-lg text-sm font-medium text-gray-700 dark:text-white/70 bg-white dark:bg-white/5 hover:bg-gray-50 dark:hover:bg-white/10 cursor-pointer transition-all duration-150 ease-snappy">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml"
                  onChange={handleLogoUpload}
                  disabled={uploading}
                  className="sr-only"
                />
                {uploading ? 'Uploading...' : logoUrl ? 'Change Logo' : 'Upload Logo'}
              </label>

              {uploadError && (
                <span className="text-sm text-red-600 dark:text-red-400">
                  {uploadError}
                </span>
              )}

              {uploadSuccess && (
                <span className="text-sm text-green-600 dark:text-green-400">
                  ✓ Logo updated successfully
                </span>
              )}
            </div>
          </div>

          {/* Hierarchy Management */}
          <div>
            <h3 className="font-display text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Organizational Hierarchy
            </h3>
            <p className="text-sm text-gray-600 dark:text-white/50 mb-4">
              Configure divisions and teams to organize your sales organization. Users can be assigned to teams.
            </p>

            {loadingHierarchy ? (
              <div className="flex items-center gap-3 text-gray-400 dark:text-white/40 py-8">
          <div className="w-5 h-5 border-2 border-indigo-electric border-t-transparent rounded-full animate-spin" />
          <span className="font-mono text-sm tracking-widest uppercase">Loading Hierarchy...</span>
        </div>
            ) : (
              <div className="space-y-6">
                {/* Divisions Section */}
                <div className="glass-card p-4">
                  <h4 className="text-md font-medium text-gray-900 dark:text-white mb-3">
                    Divisions ({divisions.length})
                  </h4>

                  {divisions.map((division) => (
                    <div key={division.id} className="mb-3 p-3 border border-white/10 rounded-lg">
                      {editingDivisionId === division.id ? (
                        <div className="flex items-center space-x-2">
                          <input
                            type="text"
                            value={editingDivisionName}
                            onChange={(e) => setEditingDivisionName(e.target.value)}
                            className="flex-1 px-3 py-1 text-sm border border-gray-200 dark:border-white/10 rounded-md bg-white dark:bg-white/5 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-electric focus:outline-none"
                            autoFocus
                          />
                          <button
                            onClick={() => handleRenameDivision(division.id, editingDivisionName)}
                            className="px-3 py-1 text-sm bg-indigo-electric text-white rounded-md hover:bg-indigo-electric/80"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => {
                              setEditingDivisionId(null)
                              setEditingDivisionName('')
                            }}
                            className="px-3 py-1 text-sm bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-700 dark:text-white/70 rounded-md hover:bg-gray-50 dark:hover:bg-white/10 transition-colors duration-150"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {division.name}
                          </span>
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => {
                                setEditingDivisionId(division.id)
                                setEditingDivisionName(division.name)
                              }}
                              className="px-2 py-1 text-xs text-indigo-electric hover:text-indigo-electric/70 transition-colors duration-150"
                            >
                              Rename
                            </button>
                            <button
                              onClick={() => handleDeleteDivision(division.id)}
                              className="px-2 py-1 text-xs text-red-alert hover:text-red-alert/70 transition-colors duration-150"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Teams in this division */}
                      <div className="mt-2 ml-4 space-y-1">
                        {teams.filter(t => t.division_id === division.id).map(team => (
                          <div key={team.id} className="text-xs text-gray-600 dark:text-white/50">
                            • {team.name}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}

                  {/* Create Division Form */}
                  <div className="mt-4 flex items-center space-x-2">
                    <input
                      type="text"
                      value={newDivisionName}
                      onChange={(e) => setNewDivisionName(e.target.value)}
                      placeholder="New division name"
                      className="flex-1 px-3 py-2 text-sm border border-gray-200 dark:border-white/10 rounded-md bg-white dark:bg-white/5 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-electric focus:outline-none"
                    />
                    <button
                      onClick={handleCreateDivision}
                      disabled={!newDivisionName.trim()}
                      className="px-4 py-2 text-sm bg-indigo-electric text-white rounded-md hover:bg-indigo-electric/80 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Add Division
                    </button>
                  </div>
                </div>

                {/* Teams Section */}
                <div className="glass-card p-4">
                  <h4 className="text-md font-medium text-gray-900 dark:text-white mb-3">
                    Teams ({teams.length})
                  </h4>

                  {teams.map((team) => (
                    <div key={team.id} className="mb-3 p-3 border border-white/10 rounded-lg">
                      {editingTeamId === team.id ? (
                        <div className="flex items-center space-x-2">
                          <input
                            type="text"
                            value={editingTeamName}
                            onChange={(e) => setEditingTeamName(e.target.value)}
                            className="flex-1 px-3 py-1 text-sm border border-gray-200 dark:border-white/10 rounded-md bg-white dark:bg-white/5 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-electric focus:outline-none"
                            autoFocus
                          />
                          <button
                            onClick={() => handleRenameTeam(team.id, editingTeamName)}
                            className="px-3 py-1 text-sm bg-indigo-electric text-white rounded-md hover:bg-indigo-electric/80"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => {
                              setEditingTeamId(null)
                              setEditingTeamName('')
                            }}
                            className="px-3 py-1 text-sm bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-700 dark:text-white/70 rounded-md hover:bg-gray-50 dark:hover:bg-white/10 transition-colors duration-150"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {team.name}
                          </span>
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => {
                                setEditingTeamId(team.id)
                                setEditingTeamName(team.name)
                              }}
                              className="px-2 py-1 text-xs text-indigo-electric hover:text-indigo-electric/70 transition-colors duration-150"
                            >
                              Rename
                            </button>
                            <button
                              onClick={() => handleDeleteTeam(team.id)}
                              className="px-2 py-1 text-xs text-red-alert hover:text-red-alert/70 transition-colors duration-150"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Division Assignment */}
                      <div className="flex items-center space-x-2">
                        <label className="text-xs text-gray-600 dark:text-white/50">
                          Division:
                        </label>
                        <select
                          value={team.division_id || ''}
                          onChange={(e) => handleAssignTeamToDivision(team.id, e.target.value || null)}
                          className="px-2 py-1 text-xs border border-gray-200 dark:border-white/10 rounded-md bg-white dark:bg-white/5 text-gray-900 dark:text-white"
                        >
                          <option value="">No division</option>
                          {divisions.map(div => (
                            <option key={div.id} value={div.id}>
                              {div.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))}

                  {/* Create Team Form */}
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={newTeamName}
                        onChange={(e) => setNewTeamName(e.target.value)}
                        placeholder="New team name"
                        className="flex-1 px-3 py-2 text-sm border border-gray-200 dark:border-white/10 rounded-md bg-white dark:bg-white/5 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-electric focus:outline-none"
                      />
                      <select
                        value={newTeamDivisionId || ''}
                        onChange={(e) => setNewTeamDivisionId(e.target.value || null)}
                        className="px-3 py-2 text-sm border border-gray-200 dark:border-white/10 rounded-md bg-white dark:bg-white/5 text-gray-900 dark:text-white"
                      >
                        <option value="">No division</option>
                        {divisions.map(div => (
                          <option key={div.id} value={div.id}>
                            {div.name}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={handleCreateTeam}
                        disabled={!newTeamName.trim()}
                        className="px-4 py-2 text-sm bg-indigo-electric text-white rounded-md hover:bg-indigo-electric/80 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Add Team
                      </button>
                    </div>
                  </div>
                </div>

                {/* User Reassignment Section */}
                <div className="glass-card p-4">
                  <h4 className="text-md font-medium text-gray-900 dark:text-white mb-3">
                    User Team Assignments ({teamMembers.length})
                  </h4>

                  <div className="space-y-2">
                    {teamMembers.map((member) => (
                      <div key={member.id} className="flex items-center justify-between p-2 border border-gray-200 dark:border-white/10 rounded-md">
                        <div>
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {member.display_name}
                          </span>
                          <span className="ml-2 text-xs text-gray-500 dark:text-white/50">
                            ({member.role.toUpperCase()})
                          </span>
                        </div>
                        <select
                          value={member.team_id || ''}
                          onChange={(e) => handleReassignUser(member.id, e.target.value || null)}
                          className="px-3 py-1 text-sm border border-gray-200 dark:border-white/10 rounded-md bg-white dark:bg-white/5 text-gray-900 dark:text-white"
                        >
                          <option value="">No team</option>
                          {teams.map(team => (
                            <option key={team.id} value={team.id}>
                              {team.name}
                              {team.division_id && divisions.find(d => d.id === team.division_id)
                                ? ` (${divisions.find(d => d.id === team.division_id)!.name})`
                                : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Activity Types Management Section */}
                {userRole === 'manager' && (
                  <div className="glass-card p-4">
                    <h4 className="text-md font-medium text-gray-900 dark:text-white mb-1">
                      Activity Types
                    </h4>
                    <p className="text-sm text-gray-500 dark:text-white/50 mb-3">
                      Configure the activity types available when logging activities.
                    </p>

                    {loadingActivityTypes ? (
                      <div className="flex items-center gap-2 text-gray-400 dark:text-white/40 py-2">
                        <div className="w-4 h-4 border-2 border-indigo-electric border-t-transparent rounded-full animate-spin" />
                        <span className="text-sm">Loading...</span>
                      </div>
                    ) : (
                      <div className="space-y-2 mb-4">
                        {activityTypes.length === 0 ? (
                          <p className="text-sm text-gray-500 dark:text-white/40 italic">No custom types configured. Using defaults.</p>
                        ) : (
                          activityTypes.map((type) => (
                            <div key={type.id} className="flex items-center justify-between p-2 border border-gray-200 dark:border-white/10 rounded-md">
                              <div>
                                <span className="text-sm font-medium text-gray-900 dark:text-white">{type.label}</span>
                                <span className="ml-2 text-xs text-gray-500 dark:text-white/50 font-mono">{type.value}</span>
                              </div>
                              <button
                                onClick={() => handleDeleteActivityType(type.id)}
                                className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 text-xs"
                              >
                                Remove
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    )}

                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newActivityLabel}
                        onChange={(e) => setNewActivityLabel(e.target.value)}
                        placeholder="Label (e.g. LinkedIn)"
                        className="flex-1 px-3 py-1.5 text-sm border border-gray-200 dark:border-white/10 rounded-md bg-white dark:bg-white/5 text-gray-900 dark:text-white placeholder-gray-400"
                      />
                      <input
                        type="text"
                        value={newActivityValue}
                        onChange={(e) => setNewActivityValue(e.target.value)}
                        placeholder="Value (e.g. linkedin)"
                        className="flex-1 px-3 py-1.5 text-sm border border-gray-200 dark:border-white/10 rounded-md bg-white dark:bg-white/5 text-gray-900 dark:text-white placeholder-gray-400"
                      />
                      <button
                        onClick={handleAddActivityType}
                        disabled={savingActivityType || !newActivityLabel.trim() || !newActivityValue.trim()}
                        className="px-3 py-1.5 text-sm bg-indigo-electric text-white rounded-md hover:bg-indigo-electric/80 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'team' && userRole === 'manager' && (
        <div className="max-w-4xl">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-display text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Team Management
              </h2>
              <p className="text-gray-600 dark:text-white/50">
                Invite team members and manage access to your organization.
              </p>
            </div>
            <button
              onClick={() => setShowInviteModal(true)}
              className="px-4 py-2 bg-indigo-electric text-white rounded-lg hover:bg-indigo-electric/80 transition-colors font-medium"
            >
              Invite Member
            </button>
          </div>

          {loadingTeam ? (
            <div className="flex items-center gap-3 text-gray-400 dark:text-white/40 py-8">
          <div className="w-5 h-5 border-2 border-indigo-electric border-t-transparent rounded-full animate-spin" />
          <span className="font-mono text-sm tracking-widest uppercase">Loading Team...</span>
        </div>
          ) : (
            <>
              {/* Pending Invitations */}
              {teamInvitations.length > 0 && (
                <div className="mb-8">
                  <h3 className="font-display text-lg font-medium text-gray-900 dark:text-white mb-4">
                    Pending Invitations ({teamInvitations.length})
                  </h3>
                  <div className="glass-card overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                      <thead className="bg-gray-50 dark:bg-white/5">
                        <tr>
                          <th className="px-6 py-3 text-left vv-section-title">
                            Email
                          </th>
                          <th className="px-6 py-3 text-left vv-section-title">
                            Role
                          </th>
                          <th className="px-6 py-3 text-left vv-section-title">
                            Expires
                          </th>
                          <th className="px-6 py-3 text-left vv-section-title">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-white/10">
                        {teamInvitations.map((invite) => (
                          <tr key={invite.id}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                              {invite.email}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-white/50">
                              <span className="px-2 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded">
                                {invite.role.toUpperCase()}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-white/50">
                              {new Date(invite.expires_at).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                              <div className="flex items-center gap-3">
                                <button
                                  onClick={() => handleResendInvite(invite)}
                                  disabled={resendingInviteId === invite.id}
                                  className="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 disabled:opacity-50"
                                >
                                  {resendingInviteId === invite.id ? 'Sending...' : 'Resend'}
                                </button>
                                <button
                                  onClick={() => handleCancelInvite(invite.id)}
                                  className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                                >
                                  Cancel
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Team Members */}
              <div>
                <h3 className="font-display text-lg font-medium text-gray-900 dark:text-white mb-4">
                  Team Members ({teamMembers.length})
                </h3>
                <div className="glass-card overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-white/5">
                      <tr>
                        <th className="px-6 py-3 text-left vv-section-title">
                          Name
                        </th>
                        <th className="px-6 py-3 text-left vv-section-title">
                          Email
                        </th>
                        <th className="px-6 py-3 text-left vv-section-title">
                          Role
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-white/10">
                      {teamMembers.map((member) => (
                        <tr key={member.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                            {member.display_name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-white/50">
                            {member.email}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-white/50">
                            <span className="px-2 py-1 text-xs font-medium bg-gray-100 dark:bg-white/10 text-gray-800 dark:text-white/70 rounded">
                              {member.role.toUpperCase()}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* Invite Modal */}
          {showInviteModal && (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
              <div className="glass-card max-w-md w-full mx-4 p-6">
                <h3 className="font-display text-xl font-semibold text-gray-900 dark:text-white mb-4">
                  Invite Team Member
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="vv-section-title block mb-2">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="colleague@company.com"
                      className="w-full px-4 py-2 border border-gray-200 dark:border-white/10 rounded-lg bg-white dark:bg-white/5 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-electric focus:outline-none transition-colors duration-150"
                    />
                  </div>

                  <div>
                    <label className="vv-section-title block mb-2">
                      Role
                    </label>
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value as 'sdr' | 'ae' | 'manager')}
                      className="w-full px-4 py-2 border border-gray-200 dark:border-white/10 rounded-lg bg-white dark:bg-white/5 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-electric focus:outline-none transition-colors duration-150"
                    >
                      <option value="sdr">SDR - Sales Development Rep</option>
                      <option value="ae">AE - Account Executive</option>
                      <option value="manager">Manager</option>
                    </select>
                  </div>

                  {availableTeams.length > 0 && (
                    <div>
                      <label className="vv-section-title block mb-2">
                        Team (Optional)
                      </label>
                      <select
                        value={inviteTeamId || ''}
                        onChange={(e) => setInviteTeamId(e.target.value || null)}
                        className="w-full px-4 py-2 border border-gray-200 dark:border-white/10 rounded-lg bg-white dark:bg-white/5 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-electric focus:outline-none transition-colors duration-150"
                      >
                        <option value="">No team assignment</option>
                        {availableTeams.map((team) => (
                          <option key={team.id} value={team.id}>
                            {team.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div className="mt-6 flex items-center justify-end space-x-3">
                  <button
                    onClick={() => {
                      setShowInviteModal(false)
                      setInviteEmail('')
                      setInviteRole('sdr')
                      setInviteTeamId(null)
                    }}
                    disabled={sendingInvite}
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-white/70 hover:text-gray-900 dark:hover:text-white transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSendInvite}
                    disabled={sendingInvite || !inviteEmail}
                    className="px-4 py-2 bg-indigo-electric text-white rounded-lg hover:bg-indigo-electric/80 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {sendingInvite ? 'Sending...' : 'Send Invitation'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'integrations' && (
        <div className="max-w-2xl">
          <h2 className="font-display text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Integrations
          </h2>
          <p className="text-gray-600 dark:text-white/50 mb-6">
            Connect your email, calendar, and CRM to sync data and send messages directly from SalesBlock.
          </p>

          {/* Email Providers */}
          <div className="mb-8">
            <h3 className="font-display text-lg font-medium text-gray-900 dark:text-white mb-4">
              Email
            </h3>
            <div className="space-y-4">
              <OAuthErrorBoundary label="Gmail">
                <GmailOAuthButton />
              </OAuthErrorBoundary>
              <OAuthErrorBoundary label="Outlook">
                <MicrosoftOAuthButton integrationType="mail" />
              </OAuthErrorBoundary>
            </div>
          </div>

          {/* Calendar Providers */}
          <div className="mb-8">
            <h3 className="font-display text-lg font-medium text-gray-900 dark:text-white mb-4">
              Calendar
            </h3>
            <div className="space-y-4">
              <OAuthErrorBoundary label="Google Calendar">
                <GoogleCalendarOAuthButton />
              </OAuthErrorBoundary>
              <OAuthErrorBoundary label="Outlook Calendar">
                <MicrosoftOAuthButton integrationType="calendar" />
              </OAuthErrorBoundary>
            </div>
          </div>

          {/* CRM — rendered from adapter registry */}
          <div>
            <h3 className="font-display text-lg font-medium text-gray-900 dark:text-white mb-4">
              CRM
            </h3>
            {getAvailableAdapters().length === 0 && (
              <p className="text-sm text-gray-500 dark:text-white/40">No CRM integrations available.</p>
            )}
            <div className="space-y-4">
              <OAuthErrorBoundary label="Salesforce">
                <SalesforceOAuthButton />
              </OAuthErrorBoundary>

              {/* Salesforce Activity Sync Settings */}
              <div className="glass-card p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                      Auto-push Activities to Salesforce
                    </h4>
                    <p className="text-xs text-gray-600 dark:text-white/50 mt-1">
                      Automatically create Salesforce Tasks when you log activities in SalesBlock
                    </p>
                  </div>
                  <button
                    onClick={handleSfAutoPushToggle}
                    disabled={sfAutoPushLoading || !sfConnected}
                    title={!sfConnected ? 'Salesforce not connected — connect above to enable' : undefined}
                    className={`${
                      sfAutoPush && sfConnected ? 'bg-indigo-electric' : 'dark:bg-white/10 bg-gray-300'
                    } relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50`}
                  >
                    <span
                      className={`${
                        sfAutoPush && sfConnected ? 'translate-x-6' : 'translate-x-1'
                      } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
                    />
                  </button>
                </div>

                {!sfConnected && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                    Salesforce not connected &mdash; connect above to sync activities
                  </p>
                )}

                <div className="mt-4 flex items-center space-x-2">
                  <button
                    onClick={handleSyncNow}
                    disabled={!sfConnected}
                    className="px-3 py-1 text-sm font-medium text-white bg-indigo-electric hover:bg-indigo-electric/80 rounded-md transition-all duration-150 ease-snappy disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Sync Now
                  </button>
                  <span className="text-xs text-gray-500 dark:text-white/50">
                    Manually sync pending activities
                  </span>
                </div>
              </div>

              {/* Attio Activity Sync Settings */}
              <div className="glass-card p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                      Auto-push Activities to Attio
                    </h4>
                    <p className="text-xs text-gray-600 dark:text-white/50 mt-1">
                      Automatically create Attio Notes when you log activities in SalesBlock
                    </p>
                  </div>
                  <button
                    onClick={handleAttioAutoPushToggle}
                    disabled={attioAutoPushLoading || !attioConnected}
                    title={!attioConnected ? 'Attio not connected — connect above to enable' : undefined}
                    className={`${
                      attioAutoPush && attioConnected ? 'bg-indigo-electric' : 'dark:bg-white/10 bg-gray-300'
                    } relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50`}
                  >
                    <span
                      className={`${
                        attioAutoPush && attioConnected ? 'translate-x-6' : 'translate-x-1'
                      } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
                    />
                  </button>
                </div>

                {!attioConnected && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                    Attio not connected &mdash; connect above to sync activities
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'pipeline' && (
        <div className="max-w-2xl">
          <h2 className="font-display text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Pipeline Stages
          </h2>
          <p className="text-gray-600 dark:text-white/50 mb-6">
            Configure probability percentages for each pipeline stage. These values are used to calculate weighted revenue forecasts.
          </p>

          {loadingStages ? (
            <div className="flex items-center gap-3 text-gray-400 dark:text-white/40 py-8">
          <div className="w-5 h-5 border-2 border-indigo-electric border-t-transparent rounded-full animate-spin" />
          <span className="font-mono text-sm tracking-widest uppercase">Loading Stages...</span>
        </div>
          ) : (
            <>
              <div className="space-y-4 mb-6">
                {pipelineStages.map((stage) => (
                  <div
                    key={stage.id}
                    className="glass-card p-4"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: stage.color }}
                        />
                        <h3 className="font-medium text-gray-900 dark:text-white">
                          {stage.name}
                        </h3>
                      </div>
                      <div className="text-sm text-gray-600 dark:text-white/50">
                        {stage.probability}% probability
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="5"
                        value={stage.probability}
                        onChange={(e) => handleProbabilityChange(stage.id, parseInt(e.target.value))}
                        className="flex-1 h-2 bg-gray-200 dark:bg-white/10 rounded-lg appearance-none cursor-pointer accent-indigo-electric"
                      />
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={stage.probability}
                        onChange={(e) => handleProbabilityChange(stage.id, parseInt(e.target.value) || 0)}
                        className="w-20 px-3 py-1 text-sm border border-gray-200 dark:border-white/10 rounded-md bg-white dark:bg-white/5 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-electric focus:outline-none"
                      />
                      <span className="text-sm text-gray-500 dark:text-white/50">%</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-4">
                <button
                  onClick={handleSaveProbabilities}
                  disabled={savingStages}
                  className="px-4 py-2 bg-indigo-electric text-white rounded-lg hover:bg-indigo-electric/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {savingStages ? 'Saving...' : 'Save Changes'}
                </button>
                <p className="text-sm text-gray-500 dark:text-white/50">
                  Changes will apply to forecast calculations immediately
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === 'billing' && (
        <div className="max-w-2xl">
          <h2 className="font-display text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Billing & Subscription
          </h2>
          <p className="text-gray-600 dark:text-white/50 mb-6">
            Manage your subscription, payment method, and billing information.
          </p>

          {loadingBilling ? (
            <div className="flex items-center gap-3 text-gray-400 dark:text-white/40 py-8">
          <div className="w-5 h-5 border-2 border-indigo-electric border-t-transparent rounded-full animate-spin" />
          <span className="font-mono text-sm tracking-widest uppercase">Loading Billing...</span>
        </div>
          ) : (
            <div className="space-y-6">
              {/* Current Plan */}
              <div className="glass-card p-6">
                <h3 className="font-display text-lg font-medium text-gray-900 dark:text-white mb-4">
                  Current Plan
                </h3>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                      {billingData.currentPlan || 'Free Trial'}
                    </p>
                    {billingData.nextBillingDate && (
                      <p className="text-sm text-gray-600 dark:text-white/50 mt-1">
                        Next billing date: {new Date(billingData.nextBillingDate).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Payment Method & Portal */}
              {billingData.stripeCustomerId && (
                <div className="glass-card p-6">
                  <h3 className="font-display text-lg font-medium text-gray-900 dark:text-white mb-4">
                    Payment Method
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-white/50 mb-4">
                    Update your payment method, view invoices, and manage billing details in the Stripe Customer Portal.
                  </p>
                  <button
                    onClick={handleOpenCustomerPortal}
                    className="px-4 py-2 bg-indigo-electric text-white rounded-lg hover:bg-indigo-electric/80 transition-colors"
                  >
                    Manage Payment Method
                  </button>
                </div>
              )}

              {/* Cancel Subscription */}
              {billingData.stripeCustomerId && billingData.currentPlan !== 'Free Trial' && (
                <div className="border border-red-alert/30 rounded-lg p-6 bg-red-50 dark:bg-red-alert/10">
                  <h3 className="font-display text-lg font-medium text-red-700 dark:text-red-alert mb-2">
                    Cancel Subscription
                  </h3>
                  <p className="text-sm text-red-700 dark:text-red-300 mb-4">
                    Cancelling your subscription will downgrade your account to read-only access at the end of your current billing period.
                  </p>
                  <button
                    onClick={handleCancelSubscription}
                    className="px-4 py-2 bg-red-alert text-white rounded-lg hover:bg-red-alert/80 transition-all duration-150 ease-snappy"
                  >
                    Cancel Subscription
                  </button>
                </div>
              )}

              {/* Team Billing Note */}
              <div className="glass-card p-6">
                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                  Team Plans
                </h3>
                <p className="text-sm text-gray-600 dark:text-white/50">
                  Team plans are billed per seat based on role (SDR: $3.50/wk, AE: $4.50/wk, Manager: $5.50/wk). Minimum 2 users required for team plans.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
