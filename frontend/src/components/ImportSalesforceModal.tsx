// @crumb frontend-component-import-salesforce-modal
// UI/Contacts/Import | query_salesforce_records | selectable_record_list | field_mapping | bulk_insert
// why: Salesforce import modal — query Salesforce CRM records via connected integration and import selected contacts/leads into the contacts table
// in:lib/salesforce (querySalesforceRecords, getSalesforceUserId),supabase contacts table,useAuth out:Selected Salesforce records inserted as contacts,onImported called err:No Salesforce connection (error shown),Salesforce API error,Supabase bulk insert failure
// hazard: Hardcoded SFDC field mapping — local schema changes or custom SFDC fields cause incomplete imports
// hazard: Salesforce queries may time out or return large record sets exceeding displayed limit
// edge:frontend/src/lib/salesforce.ts -> CALLS
// edge:frontend/src/components/SalesforceOAuthButton.tsx -> RELATES
// edge:sf-import#1 -> STEP_IN
// prompt: Make field mapping configurable. Add record count cap with pagination. Pre-check Salesforce connection status before rendering form.
import { useState } from 'react';
import { X, Database, AlertCircle, CheckCircle } from 'lucide-react';
import {
  querySalesforceRecords,
  getSalesforceUserId,
  mapSalesforceToContact,
  type SalesforceRecord,
  type SalesforceQueryOptions,
} from '../lib/salesforce';
import { supabase } from '../lib/supabase';

interface ImportSalesforceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  accessToken: string;
  instanceUrl: string;
}

export default function ImportSalesforceModal({
  isOpen,
  onClose,
  onSuccess,
  accessToken,
  instanceUrl,
}: ImportSalesforceModalProps) {
  const [objectType, setObjectType] = useState<'Lead' | 'Contact' | 'Account'>('Lead');
  const [filterByOwner, setFilterByOwner] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [previewRecords, setPreviewRecords] = useState<SalesforceRecord[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [skippedCount, setSkippedCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [error, setError] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [showSummary, setShowSummary] = useState(false);

  const loadPreview = async () => {
    try {
      setIsLoadingPreview(true);
      setError('');

      const options: SalesforceQueryOptions = {
        objectType,
        startDate: startDate ? new Date(startDate).toISOString() : undefined,
        endDate: endDate ? new Date(endDate).toISOString() : undefined,
      };

      // Get current Salesforce user ID if filter by owner is enabled
      if (filterByOwner) {
        const userId = await getSalesforceUserId(accessToken, instanceUrl);
        options.ownerId = userId;
      }

      const { records, totalSize } = await querySalesforceRecords(accessToken, instanceUrl, options);

      setPreviewRecords(records.slice(0, 5)); // Show first 5
      setTotalCount(totalSize);
      setShowPreview(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load preview');
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const startImport = async () => {
    try {
      setIsImporting(true);
      setError('');
      setImportedCount(0);
      setSkippedCount(0);
      setErrorCount(0);

      // Get current user and org
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data: userData } = await supabase
        .from('users')
        .select('org_id')
        .eq('id', user.id)
        .single();
      if (!userData) throw new Error('User org not found');

      const options: SalesforceQueryOptions = {
        objectType,
        startDate: startDate ? new Date(startDate).toISOString() : undefined,
        endDate: endDate ? new Date(endDate).toISOString() : undefined,
      };

      if (filterByOwner) {
        const userId = await getSalesforceUserId(accessToken, instanceUrl);
        options.ownerId = userId;
      }

      const { records } = await querySalesforceRecords(accessToken, instanceUrl, options);

      // Import each record
      for (const record of records) {
        try {
          const contactData = mapSalesforceToContact(
            record,
            objectType,
            userData.org_id,
            user.id
          );

          // Check for duplicate by email
          if (contactData.email) {
            const { data: existing } = await supabase
              .from('contacts')
              .select('id')
              .eq('org_id', userData.org_id)
              .eq('email', contactData.email)
              .maybeSingle();

            if (existing) {
              setSkippedCount((prev) => prev + 1);
              continue;
            }
          }

          // Insert contact
          const { error: insertError } = await supabase.from('contacts').insert(contactData);

          if (insertError) {
            console.error('Insert error:', insertError);
            setErrorCount((prev) => prev + 1);
          } else {
            setImportedCount((prev) => prev + 1);
          }
        } catch (err) {
          console.error('Record error:', err);
          setErrorCount((prev) => prev + 1);
        }
      }

      setShowSummary(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setIsImporting(false);
    }
  };

  const resetAndClose = () => {
    setObjectType('Lead');
    setFilterByOwner(true);
    setStartDate('');
    setEndDate('');
    setPreviewRecords([]);
    setTotalCount(0);
    setShowPreview(false);
    setShowSummary(false);
    setImportedCount(0);
    setSkippedCount(0);
    setErrorCount(0);
    setError('');
    onClose();
  };

  const completeImport = () => {
    resetAndClose();
    onSuccess();
  };

  if (!isOpen) return null;

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
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Database className="h-6 w-6 text-blue-600" />
              <h2 className="text-2xl font-bold dark:text-white">Import from Salesforce</h2>
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

          {/* Object Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2 dark:text-gray-200">
              Salesforce Object
            </label>
            <div className="flex gap-4">
              {(['Lead', 'Contact', 'Account'] as const).map((obj) => (
                <label key={obj} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="objectType"
                    value={obj}
                    checked={objectType === obj}
                    onChange={(e) => setObjectType(e.target.value as typeof obj)}
                    className="text-blue-600"
                    disabled={isLoadingPreview || isImporting}
                  />
                  <span className="text-sm dark:text-gray-300">{obj}s</span>
                </label>
              ))}
            </div>
          </div>

          {/* Filters */}
          <div className="mb-6 space-y-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filterByOwner}
                onChange={(e) => setFilterByOwner(e.target.checked)}
                className="text-blue-600"
                disabled={isLoadingPreview || isImporting}
              />
              <span className="text-sm dark:text-gray-300">
                Filter by owner (my records only)
              </span>
            </label>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-200">
                  Start Date (optional)
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  disabled={isLoadingPreview || isImporting}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-200">
                  End Date (optional)
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  disabled={isLoadingPreview || isImporting}
                />
              </div>
            </div>
          </div>

          {/* Preview Button */}
          {!showPreview && (
            <button
              onClick={loadPreview}
              disabled={isLoadingPreview}
              className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed mb-4"
            >
              {isLoadingPreview ? 'Loading Preview...' : 'Preview Records'}
            </button>
          )}

          {/* Preview Section */}
          {showPreview && (
            <>
              <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-sm font-medium dark:text-blue-200">
                  Found {totalCount} matching {objectType.toLowerCase()}
                  {totalCount !== 1 ? 's' : ''}
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  Showing first {Math.min(5, totalCount)} records
                </p>
              </div>

              {/* Field Mapping Info */}
              <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <h4 className="text-sm font-semibold mb-2 dark:text-white">Field Mapping:</h4>
                <div className="text-xs space-y-1 dark:text-gray-300">
                  {objectType === 'Account' ? (
                    <>
                      <div>• Account Name → First Name + Company</div>
                      <div>• Phone → Phone</div>
                    </>
                  ) : (
                    <>
                      <div>• First Name + Last Name → Name</div>
                      <div>• Email → Email</div>
                      <div>• Phone → Phone</div>
                      {objectType === 'Lead' && <div>• Company → Company</div>}
                      <div>• Title → Title</div>
                    </>
                  )}
                  <div className="mt-2 text-yellow-700 dark:text-yellow-400">
                    • Duplicates (by email) will be skipped
                  </div>
                </div>
              </div>

              {/* Preview Table */}
              <div className="mb-4 border dark:border-gray-700 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      {objectType === 'Account' ? (
                        <>
                          <th className="px-3 py-2 text-left dark:text-gray-200">Name</th>
                          <th className="px-3 py-2 text-left dark:text-gray-200">Phone</th>
                        </>
                      ) : (
                        <>
                          <th className="px-3 py-2 text-left dark:text-gray-200">Name</th>
                          <th className="px-3 py-2 text-left dark:text-gray-200">Email</th>
                          {objectType === 'Lead' && (
                            <th className="px-3 py-2 text-left dark:text-gray-200">Company</th>
                          )}
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y dark:divide-gray-700">
                    {previewRecords.map((record) => (
                      <tr key={record.Id} className="dark:text-gray-300">
                        {objectType === 'Account' ? (
                          <>
                            <td className="px-3 py-2">{record.Name || '—'}</td>
                            <td className="px-3 py-2">{record.Phone || '—'}</td>
                          </>
                        ) : (
                          <>
                            <td className="px-3 py-2">
                              {record.FirstName} {record.LastName}
                            </td>
                            <td className="px-3 py-2">{record.Email || '—'}</td>
                            {objectType === 'Lead' && (
                              <td className="px-3 py-2">{record.Company || '—'}</td>
                            )}
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Import Progress */}
              {isImporting && (
                <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <div className="flex justify-between text-sm mb-2 dark:text-blue-200">
                    <span>Importing...</span>
                    <span>
                      {importedCount + skippedCount + errorCount} / {totalCount}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all"
                      style={{
                        width: `${((importedCount + skippedCount + errorCount) / totalCount) * 100}%`,
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
                  disabled={isImporting || totalCount === 0}
                  className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isImporting ? 'Importing...' : `Import ${totalCount} Records`}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
