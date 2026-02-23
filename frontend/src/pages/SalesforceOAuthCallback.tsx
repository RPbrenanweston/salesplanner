import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

export default function SalesforceOAuthCallback() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    const handleCallback = async () => {
      // Extract OAuth code and state from URL
      const code = searchParams.get('code')
      const state = searchParams.get('state')
      const error = searchParams.get('error')
      const errorDescription = searchParams.get('error_description')

      // Handle OAuth errors
      if (error) {
        console.error('Salesforce OAuth error:', error, errorDescription)
        setErrorMessage(errorDescription || error)
        setStatus('error')
        setTimeout(() => {
          if (window.opener) {
            window.close()
          } else {
            navigate('/settings')
          }
        }, 3000)
        return
      }

      if (!code || !state) {
        setErrorMessage('Missing authorization code or state')
        setStatus('error')
        setTimeout(() => {
          if (window.opener) {
            window.close()
          } else {
            navigate('/settings')
          }
        }, 3000)
        return
      }

      try {
        // Parse user context from state
        const { user_id } = JSON.parse(state)

        // TODO (US-031): Exchange code for access token and refresh token via backend
        // This should be done in a Supabase Edge Function to keep client_secret secure
        // For now, we'll just store the code (insecure - needs backend implementation)

        console.log('Salesforce OAuth code received:', code)
        console.log('User ID from state:', user_id)

        // Placeholder: Mark as successful
        // In real implementation, Edge Function would:
        // 1. Exchange code for tokens via Salesforce token endpoint
        // 2. Store access_token, refresh_token, instance_url in oauth_connections table
        // 3. Return success/error to frontend

        setStatus('success')

        // Close popup or redirect after short delay
        setTimeout(() => {
          if (window.opener) {
            // This is a popup - close it
            window.close()
          } else {
            // This is not a popup - redirect to settings
            navigate('/settings')
          }
        }, 1500)
      } catch (err) {
        console.error('Failed to process Salesforce OAuth callback:', err)
        setErrorMessage('Failed to process OAuth response')
        setStatus('error')
        setTimeout(() => {
          if (window.opener) {
            window.close()
          } else {
            navigate('/settings')
          }
        }, 3000)
      }
    }

    handleCallback()
  }, [searchParams, navigate])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
        {status === 'processing' && (
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Connecting Salesforce...
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              Please wait while we complete the connection.
            </p>
          </div>
        )}

        {status === 'success' && (
          <div className="text-center">
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Salesforce Connected!
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              This window will close automatically.
            </p>
          </div>
        )}

        {status === 'error' && (
          <div className="text-center">
            <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Connection Failed
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {errorMessage || 'An error occurred while connecting to Salesforce.'}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-500">
              This window will close automatically.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
