/**
 * ImportAttioModal — fetch People from Attio via CrmAdapter,
 * preview field mapping, deduplicate by email, and import selected contacts.
 * Follows the ImportSalesforceModal pattern.
 */
import { useState } from 'react'
import { X, Database, AlertCircle, CheckCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { AttioAdapter } from '../lib/crm/adapters/attio'
import type { CrmContact } from '../lib/crm/types'

interface ImportAttioModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function ImportAttioModal({
  isOpen,
  onClose,
  onSuccess,
}: ImportAttioModalProps) {
  const [previewContacts, setPreviewContacts] = useState<CrmContact[]>([])
  const [allContacts, setAllContacts] = useState<CrmContact[]>([])
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [importedCount, setImportedCount] = useState(0)
  const [skippedCount, setSkippedCount] = useState(0)
  const [errorCount, setErrorCount] = useState(0)
  const [error, setError] = useState('')
  const [showPreview, setShowPreview] = useState(false)
  const [showSummary, setShowSummary] = useState(false)

  const loadPreview = async () => {
    try {
      setIsLoadingPreview(true)
      setError('')

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      const { data: userData } = await supabase
        .from('users')
        .select('org_id')
        .eq('id', user.id)
        .single()
      if (!userData) throw new Error('User org not found')

      const contacts = await AttioAdapter.importContacts({
        orgId: userData.org_id,
        userId: user.id,
        dedupeByEmail: true,
      })

      setAllContacts(contacts)
      setPreviewContacts(contacts.slice(0, 5))
      setShowPreview(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load preview')
    } finally {
      setIsLoadingPreview(false)
    }
  }

  const startImport = async () => {
    try {
      setIsImporting(true)
      setError('')
      setImportedCount(0)
      setSkippedCount(0)
      setErrorCount(0)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      const { data: userData } = await supabase
        .from('users')
        .select('org_id')
        .eq('id', user.id)
        .single()
      if (!userData) throw new Error('User org not found')

      for (const contact of allContacts) {
        try {
          // Duplicate check by email
          if (contact.email) {
            const { data: existing } = await supabase
              .from('contacts')
              .select('id')
              .eq('org_id', userData.org_id)
              .eq('email', contact.email)
              .maybeSingle()

            if (existing) {
              setSkippedCount((prev) => prev + 1)
              continue
            }
          }

          const insertData: Record<string, unknown> = {
            first_name: contact.firstName || null,
            last_name: contact.lastName || null,
            email: contact.email || null,
            phone: contact.phone || null,
            company: contact.company || null,
            title: contact.title || null,
            source: 'attio',
            attio_record_id: contact.externalId,
            org_id: userData.org_id,
            created_by: user.id,
          }

          const { error: insertError } = await supabase
            .from('contacts')
            .insert(insertData)

          if (insertError) {
            console.error('Insert error:', insertError)
            setErrorCount((prev) => prev + 1)
          } else {
            setImportedCount((prev) => prev + 1)
          }
        } catch (err) {
          console.error('Record error:', err)
          setErrorCount((prev) => prev + 1)
        }
      }

      setShowSummary(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setIsImporting(false)
    }
  }

  const resetAndClose = () => {
    setPreviewContacts([])
    setAllContacts([])
    setShowPreview(false)
    setShowSummary(false)
    setImportedCount(0)
    setSkippedCount(0)
    setErrorCount(0)
    setError('')
    onClose()
  }

  const completeImport = () => {
    resetAndClose()
    onSuccess()
  }

  if (!isOpen) return null

  // Summary screen
  if (showSummary) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4">
          <div className="p-6">
            <div className="flex items-center justify-center mb-4">
              <CheckCircle className="h-12 w-12 text-green-600" />
            </div>
            <h3 className="text-xl font-semibold text-center mb-4 dark:text-white">
              Import Complete
            </h3>
            <div className="space-y-2 text-sm dark:text-gray-300">
              <div className="flex justify-between">
                <span>Imported:</span>
                <span className="font-semibold text-green-600">{importedCount}</span>
              </div>
              <div className="flex justify-between">
                <span>Skipped (duplicates):</span>
                <span className="font-semibold text-yellow-600">{skippedCount}</span>
              </div>
              <div className="flex justify-between">
                <span>Errors:</span>
                <span className="font-semibold text-red-600">{errorCount}</span>
              </div>
            </div>
            <button
              onClick={completeImport}
              className="w-full mt-6 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Database className="h-6 w-6 text-purple-600" />
              <h2 className="text-2xl font-bold dark:text-white">Import from Attio</h2>
            </div>
            <button
              onClick={resetAndClose}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <span className="text-sm text-red-800 dark:text-red-200">{error}</span>
            </div>
          )}

          {/* Field Mapping Info */}
          <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <h4 className="text-sm font-semibold mb-2 dark:text-white">Field Mapping:</h4>
            <div className="text-xs space-y-1 dark:text-gray-300">
              <div>Attio Name &rarr; First Name + Last Name</div>
              <div>Attio Email &rarr; Email</div>
              <div>Attio Phone &rarr; Phone</div>
              <div>Attio Job Title &rarr; Title</div>
              <div className="mt-2 text-yellow-700 dark:text-yellow-400">
                Duplicates (by email) will be skipped
              </div>
            </div>
          </div>

          {/* Preview Button */}
          {!showPreview && (
            <button
              onClick={loadPreview}
              disabled={isLoadingPreview}
              className="w-full bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed mb-4"
            >
              {isLoadingPreview ? 'Loading from Attio...' : 'Fetch Attio Contacts'}
            </button>
          )}

          {/* Preview Section */}
          {showPreview && (
            <>
              <div className="mb-4 p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
                <p className="text-sm font-medium dark:text-purple-200">
                  Found {allContacts.length} contact{allContacts.length !== 1 ? 's' : ''} in Attio
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  Showing first {Math.min(5, allContacts.length)} records
                </p>
              </div>

              {/* Preview Table */}
              <div className="mb-4 border dark:border-gray-700 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-3 py-2 text-left dark:text-gray-200">Name</th>
                      <th className="px-3 py-2 text-left dark:text-gray-200">Email</th>
                      <th className="px-3 py-2 text-left dark:text-gray-200">Title</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y dark:divide-gray-700">
                    {previewContacts.map((contact) => (
                      <tr key={contact.externalId} className="dark:text-gray-300">
                        <td className="px-3 py-2">
                          {contact.firstName} {contact.lastName}
                        </td>
                        <td className="px-3 py-2">{contact.email || '\u2014'}</td>
                        <td className="px-3 py-2">{contact.title || '\u2014'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Import Progress */}
              {isImporting && (
                <div className="mb-4 p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
                  <div className="flex justify-between text-sm mb-2 dark:text-purple-200">
                    <span>Importing...</span>
                    <span>
                      {importedCount + skippedCount + errorCount} / {allContacts.length}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-purple-600 h-2 rounded-full transition-all"
                      style={{
                        width: `${allContacts.length > 0 ? ((importedCount + skippedCount + errorCount) / allContacts.length) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  <div className="flex gap-4 text-xs mt-2 dark:text-gray-300">
                    <span className="text-green-600">Imported: {importedCount}</span>
                    <span className="text-yellow-600">Skipped: {skippedCount}</span>
                    <span className="text-red-600">Errors: {errorCount}</span>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={resetAndClose}
                  disabled={isImporting}
                  className="flex-1 px-4 py-2 border dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  onClick={startImport}
                  disabled={isImporting || allContacts.length === 0}
                  className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isImporting ? 'Importing...' : `Import ${allContacts.length} Contacts`}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
