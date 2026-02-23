import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import GmailOAuthButton from '../components/GmailOAuthButton'
import OutlookOAuthButton from '../components/OutlookOAuthButton'
import GoogleCalendarOAuthButton from '../components/GoogleCalendarOAuthButton'
import OutlookCalendarOAuthButton from '../components/OutlookCalendarOAuthButton'
import SalesforceOAuthButton from '../components/SalesforceOAuthButton'

type Tab = 'profile' | 'organization' | 'integrations'

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

  // Load organization data
  useEffect(() => {
    const loadOrgData = async () => {
      if (!user) return

      const { data: userData } = await supabase
        .from('users')
        .select('org_id')
        .eq('id', user.id)
        .single()

      if (!userData?.org_id) return

      setOrgId(userData.org_id)

      const { data: orgData } = await supabase
        .from('organizations')
        .select('name, logo_url, sf_auto_push_activities')
        .eq('id', userData.org_id)
        .single()

      if (orgData) {
        setOrgName(orgData.name || '')
        setLogoUrl(orgData.logo_url)
        setSfAutoPush(orgData.sf_auto_push_activities || false)
      }
    }

    loadOrgData()
  }, [user])

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
      alert('Failed to update auto-push setting. Please try again.')
    } finally {
      setSfAutoPushLoading(false)
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
      alert(`Sync completed: ${result.synced} synced, ${result.failed} failed`)
    } catch (error) {
      console.error('Manual sync error:', error)
      alert('Manual sync failed. Please try again.')
    }
  }

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
        Settings
      </h1>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('profile')}
            className={`${
              activeTab === 'profile'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
          >
            Profile
          </button>
          <button
            onClick={() => setActiveTab('organization')}
            className={`${
              activeTab === 'organization'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
          >
            Organization
          </button>
          <button
            onClick={() => setActiveTab('integrations')}
            className={`${
              activeTab === 'integrations'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
          >
            Integrations
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'profile' && (
        <div className="max-w-2xl">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Profile Settings
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Profile customization coming soon.
          </p>
        </div>
      )}

      {activeTab === 'organization' && (
        <div className="max-w-2xl">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Organization Settings
          </h2>

          {/* Organization Name */}
          <div className="mb-8">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Organization Name
            </label>
            <input
              type="text"
              value={orgName}
              disabled
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 cursor-not-allowed"
            />
          </div>

          {/* Logo Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Organization Logo
            </label>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Upload your company logo (PNG, JPG, or SVG, max 2MB). This will appear in the sidebar and sign-in page.
            </p>

            {/* Current Logo Preview */}
            {logoUrl && (
              <div className="mb-4 p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
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
                    className="px-3 py-1 text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>
              </div>
            )}

            {/* Upload Button */}
            <div className="flex items-center space-x-4">
              <label className="flex items-center justify-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors">
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
        </div>
      )}

      {activeTab === 'integrations' && (
        <div className="max-w-2xl">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Integrations
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Connect your email, calendar, and CRM to sync data and send messages directly from SalesBlock.
          </p>

          {/* Email Providers */}
          <div className="mb-8">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              Email
            </h3>
            <div className="space-y-4">
              <GmailOAuthButton />
              <OutlookOAuthButton />
            </div>
          </div>

          {/* Calendar Providers */}
          <div className="mb-8">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              Calendar
            </h3>
            <div className="space-y-4">
              <GoogleCalendarOAuthButton />
              <OutlookCalendarOAuthButton />
            </div>
          </div>

          {/* CRM */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              CRM
            </h3>
            <div className="space-y-4">
              <SalesforceOAuthButton />

              {/* Salesforce Activity Sync Settings */}
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-800">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                      Auto-push Activities to Salesforce
                    </h4>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                      Automatically create Salesforce Tasks when you log activities in SalesBlock
                    </p>
                  </div>
                  <button
                    onClick={handleSfAutoPushToggle}
                    disabled={sfAutoPushLoading}
                    className={`${
                      sfAutoPush ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
                    } relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50`}
                  >
                    <span
                      className={`${
                        sfAutoPush ? 'translate-x-6' : 'translate-x-1'
                      } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
                    />
                  </button>
                </div>

                <div className="mt-4 flex items-center space-x-2">
                  <button
                    onClick={handleSyncNow}
                    className="px-3 py-1 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors"
                  >
                    Sync Now
                  </button>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    Manually sync pending activities
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
