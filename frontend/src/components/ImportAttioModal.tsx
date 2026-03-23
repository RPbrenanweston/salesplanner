// Attio CRM import modal — multi-step flow for importing people/companies from Attio
// Step 1: Choose source (People / Companies) and optionally select an Attio List
// Step 2: Preview records with checkboxes for selective import
// Step 3: Import selected records with progress tracking

import { useState, useEffect, useCallback } from 'react';
import { X, AlertCircle, CheckCircle, Users, Building2, List, ChevronLeft } from 'lucide-react';
import {
  fetchAttioPeople,
  fetchAttioCompanies,
  fetchAttioLists,
  fetchAttioListEntriesAsPeople,
  fetchAttioListEntriesAsCompanies,
  type AttioPerson,
  type AttioCompany,
  type AttioList,
} from '../lib/attio';
import { supabase } from '../lib/supabase';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ImportAttioModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  userId: string;
  orgId: string;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type RecordType = 'people' | 'companies';
type ModalStep = 'source' | 'preview' | 'summary';

interface ImportCounts {
  imported: number;
  skipped: number;
  errors: number;
  total: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ImportAttioModal({
  isOpen,
  onClose,
  onSuccess,
  userId,
  orgId,
}: ImportAttioModalProps) {
  // Step management
  const [step, setStep] = useState<ModalStep>('source');
  const [recordType, setRecordType] = useState<RecordType>('people');

  // Attio lists
  const [attioLists, setAttioLists] = useState<AttioList[]>([]);
  const [isLoadingLists, setIsLoadingLists] = useState(false);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);

  // Records for preview
  const [people, setPeople] = useState<AttioPerson[]>([]);
  const [companies, setCompanies] = useState<AttioCompany[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Loading / importing states
  const [isLoadingRecords, setIsLoadingRecords] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importCounts, setImportCounts] = useState<ImportCounts>({
    imported: 0,
    skipped: 0,
    errors: 0,
    total: 0,
  });

  // Errors
  const [error, setError] = useState('');

  // ---------------------------------------------------------------------------
  // Load Attio lists on mount
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!isOpen) return;
    loadAttioLists();
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadAttioLists = async () => {
    setIsLoadingLists(true);
    setError('');
    try {
      const lists = await fetchAttioLists(userId, orgId);
      setAttioLists(lists);
    } catch (err) {
      console.error('Failed to load Attio lists:', err);
      // Non-fatal — lists section will just be empty
    } finally {
      setIsLoadingLists(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Load records (all or from list)
  // ---------------------------------------------------------------------------

  const loadRecords = useCallback(
    async (type: RecordType, listId: string | null, listParentObject?: string) => {
      setIsLoadingRecords(true);
      setError('');
      setPeople([]);
      setCompanies([]);
      setSelectedIds(new Set());

      try {
        if (listId) {
          // Detect list type from parent_object — route to correct import
          const isCompanyList = listParentObject === 'companies';
          if (isCompanyList) {
            const entries = await fetchAttioListEntriesAsCompanies(userId, orgId, listId);
            setCompanies(entries);
            setSelectedIds(new Set(entries.map((c) => c.externalId)));
            setRecordType('companies');
          } else {
            const entries = await fetchAttioListEntriesAsPeople(userId, orgId, listId);
            setPeople(entries);
            setSelectedIds(new Set(entries.map((p) => p.externalId)));
            setRecordType('people');
          }
        } else if (type === 'people') {
          const fetched = await fetchAttioPeople(userId, orgId);
          setPeople(fetched);
          setSelectedIds(new Set(fetched.map((p) => p.externalId)));
        } else {
          const fetched = await fetchAttioCompanies(userId, orgId);
          setCompanies(fetched);
          setSelectedIds(new Set(fetched.map((c) => c.externalId)));
        }

        setStep('preview');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load records from Attio');
      } finally {
        setIsLoadingRecords(false);
      }
    },
    [userId, orgId]
  );

  // ---------------------------------------------------------------------------
  // Selection helpers
  // ---------------------------------------------------------------------------

  const allSelected = (() => {
    const records = recordType === 'people' ? people : companies;
    return records.length > 0 && selectedIds.size === records.length;
  })();

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      const ids =
        recordType === 'people'
          ? people.map((p) => p.externalId)
          : companies.map((c) => c.externalId);
      setSelectedIds(new Set(ids));
    }
  };

  const toggleRecord = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // ---------------------------------------------------------------------------
  // Import
  // ---------------------------------------------------------------------------

  const startImport = async () => {
    setIsImporting(true);
    setError('');

    const counts: ImportCounts = { imported: 0, skipped: 0, errors: 0, total: selectedIds.size };
    setImportCounts({ ...counts });

    try {
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

      if (recordType === 'people') {
        const selectedPeople = people.filter((p) => selectedIds.has(p.externalId));

        for (const person of selectedPeople) {
          try {
            // Duplicate check by email
            if (person.email) {
              const { data: existing } = await supabase
                .from('contacts')
                .select('id')
                .eq('org_id', userData.org_id)
                .eq('email', person.email)
                .maybeSingle();

              if (existing) {
                counts.skipped += 1;
                setImportCounts({ ...counts });
                continue;
              }
            }

            const { error: insertError } = await supabase.from('contacts').insert({
              first_name: person.firstName || 'Unknown',
              last_name: person.lastName || 'Unknown',
              email: person.email || null,
              phone: null,
              company: person.company || null,
              title: person.title || null,
              source: 'manual', // 'attio' not in enum — use 'manual' as fallback
              org_id: userData.org_id,
              created_by: user.id,
              custom_fields: { attio_id: person.externalId },
            });

            if (insertError) {
              console.error('Insert error:', insertError);
              counts.errors += 1;
            } else {
              counts.imported += 1;
            }
          } catch (err) {
            console.error('Record import error:', err);
            counts.errors += 1;
          }
          setImportCounts({ ...counts });
        }
      } else {
        // Companies — inserted into the accounts table (where AccountsPage reads)
        const selectedCompanies = companies.filter((c) => selectedIds.has(c.externalId));

        for (const company of selectedCompanies) {
          try {
            // Duplicate check by name + org in accounts table
            if (company.name) {
              const { data: existing } = await supabase
                .from('accounts')
                .select('id')
                .eq('org_id', userData.org_id)
                .eq('name', company.name)
                .maybeSingle();

              if (existing) {
                counts.skipped += 1;
                setImportCounts({ ...counts });
                continue;
              }
            }

            const { error: insertError } = await supabase.from('accounts').insert({
              name: company.name || 'Unknown',
              domain: company.domain || null,
              industry: company.industry || null,
              org_id: userData.org_id,
              created_by: user.id,
            });

            if (insertError) {
              // Handle unique constraint violation
              if (insertError.code === '23505') {
                counts.skipped += 1;
              } else {
                console.error('Insert error:', insertError);
                counts.errors += 1;
              }
            } else {
              counts.imported += 1;
            }
          } catch (err) {
            console.error('Record import error:', err);
            counts.errors += 1;
          }
          setImportCounts({ ...counts });
        }
      }

      setStep('summary');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setIsImporting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Reset / close
  // ---------------------------------------------------------------------------

  const resetAndClose = () => {
    setStep('source');
    setRecordType('people');
    setSelectedListId(null);
    setPeople([]);
    setCompanies([]);
    setSelectedIds(new Set());
    setImportCounts({ imported: 0, skipped: 0, errors: 0, total: 0 });
    setError('');
    setIsImporting(false);
    setIsLoadingRecords(false);
    onClose();
  };

  const completeImport = () => {
    resetAndClose();
    onSuccess();
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (!isOpen) return null;

  const records = recordType === 'people' ? people : companies;

  // -- Summary step --
  if (step === 'summary') {
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
                <span className="font-semibold text-green-600">{importCounts.imported}</span>
              </div>
              <div className="flex justify-between">
                <span>Skipped (duplicates):</span>
                <span className="font-semibold text-yellow-600">{importCounts.skipped}</span>
              </div>
              <div className="flex justify-between">
                <span>Errors:</span>
                <span className="font-semibold text-red-600">{importCounts.errors}</span>
              </div>
            </div>
            <button
              onClick={completeImport}
              className="w-full mt-6 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  // -- Preview step --
  if (step === 'preview') {
    const progressPercent =
      importCounts.total > 0
        ? ((importCounts.imported + importCounts.skipped + importCounts.errors) /
            importCounts.total) *
          100
        : 0;

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-3xl w-full mx-4 max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="p-6 border-b dark:border-gray-700 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setStep('source')}
                  disabled={isImporting}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-50"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center">
                  {recordType === 'people' ? (
                    <Users className="h-4 w-4 text-white" />
                  ) : (
                    <Building2 className="h-4 w-4 text-white" />
                  )}
                </div>
                <div>
                  <h2 className="text-lg font-bold dark:text-white">
                    {recordType === 'people' ? 'People' : 'Companies'} from Attio
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {selectedIds.size} of {records.length} selected
                  </p>
                </div>
              </div>
              <button
                onClick={resetAndClose}
                disabled={isImporting}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="mx-6 mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-2 flex-shrink-0">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <span className="text-sm text-red-800 dark:text-red-200">{error}</span>
            </div>
          )}

          {/* Table */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left w-10">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      disabled={isImporting}
                      className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                    />
                  </th>
                  {recordType === 'people' ? (
                    <>
                      <th className="px-3 py-2 text-left dark:text-gray-200">Name</th>
                      <th className="px-3 py-2 text-left dark:text-gray-200">Email</th>
                      <th className="px-3 py-2 text-left dark:text-gray-200">Title</th>
                    </>
                  ) : (
                    <>
                      <th className="px-3 py-2 text-left dark:text-gray-200">Company</th>
                      <th className="px-3 py-2 text-left dark:text-gray-200">Domain</th>
                      <th className="px-3 py-2 text-left dark:text-gray-200">Industry</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-gray-700">
                {recordType === 'people'
                  ? people.map((person) => (
                      <tr
                        key={person.externalId}
                        className="dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                      >
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(person.externalId)}
                            onChange={() => toggleRecord(person.externalId)}
                            disabled={isImporting}
                            className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                          />
                        </td>
                        <td className="px-3 py-2 font-medium">
                          {person.firstName} {person.lastName}
                        </td>
                        <td className="px-3 py-2 text-gray-500 dark:text-gray-400">
                          {person.email || '\u2014'}
                        </td>
                        <td className="px-3 py-2 text-gray-500 dark:text-gray-400">
                          {person.title || '\u2014'}
                        </td>
                      </tr>
                    ))
                  : companies.map((company) => (
                      <tr
                        key={company.externalId}
                        className="dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                      >
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(company.externalId)}
                            onChange={() => toggleRecord(company.externalId)}
                            disabled={isImporting}
                            className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                          />
                        </td>
                        <td className="px-3 py-2 font-medium">{company.name || '\u2014'}</td>
                        <td className="px-3 py-2 text-gray-500 dark:text-gray-400">
                          {company.domain || '\u2014'}
                        </td>
                        <td className="px-3 py-2 text-gray-500 dark:text-gray-400">
                          {company.industry || '\u2014'}
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>

            {records.length === 0 && !isLoadingRecords && (
              <div className="py-12 text-center text-gray-400 dark:text-gray-500">
                No records found
              </div>
            )}
          </div>

          {/* Import progress */}
          {isImporting && (
            <div className="px-6 py-3 border-t dark:border-gray-700 flex-shrink-0">
              <div className="flex justify-between text-sm mb-2 dark:text-purple-200">
                <span>Importing...</span>
                <span>
                  {importCounts.imported + importCounts.skipped + importCounts.errors} /{' '}
                  {importCounts.total}
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-purple-600 h-2 rounded-full transition-all"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="flex gap-4 text-xs mt-2 dark:text-gray-300">
                <span className="text-green-600">Imported: {importCounts.imported}</span>
                <span className="text-yellow-600">Skipped: {importCounts.skipped}</span>
                <span className="text-red-600">Errors: {importCounts.errors}</span>
              </div>
            </div>
          )}

          {/* Footer actions */}
          <div className="p-6 border-t dark:border-gray-700 flex gap-3 flex-shrink-0">
            <button
              onClick={resetAndClose}
              disabled={isImporting}
              className="flex-1 px-4 py-2 border dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={startImport}
              disabled={isImporting || selectedIds.size === 0}
              className="flex-1 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
            >
              {isImporting
                ? 'Importing...'
                : `Import ${selectedIds.size} ${recordType === 'people' ? 'People' : 'Companies'}`}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // -- Source step (default) --
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center">
                <svg className="h-4 w-4 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                </svg>
              </div>
              <h2 className="text-xl font-bold dark:text-white">Import from Attio</h2>
            </div>
            <button
              onClick={resetAndClose}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <span className="text-sm text-red-800 dark:text-red-200">{error}</span>
            </div>
          )}

          {/* Record type tabs */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-3 dark:text-gray-200">
              What would you like to import?
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setRecordType('people')}
                disabled={isLoadingRecords}
                className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                  recordType === 'people'
                    ? 'border-purple-600 bg-purple-50 dark:bg-purple-900/20'
                    : 'border-gray-200 dark:border-gray-600 hover:border-purple-300 dark:hover:border-purple-700'
                } disabled:opacity-50`}
              >
                <Users
                  className={`h-6 w-6 ${
                    recordType === 'people' ? 'text-purple-600' : 'text-gray-400 dark:text-gray-500'
                  }`}
                />
                <span
                  className={`text-sm font-semibold ${
                    recordType === 'people'
                      ? 'text-purple-600'
                      : 'text-gray-700 dark:text-gray-300'
                  }`}
                >
                  People
                </span>
              </button>
              <button
                onClick={() => setRecordType('companies')}
                disabled={isLoadingRecords}
                className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                  recordType === 'companies'
                    ? 'border-purple-600 bg-purple-50 dark:bg-purple-900/20'
                    : 'border-gray-200 dark:border-gray-600 hover:border-purple-300 dark:hover:border-purple-700'
                } disabled:opacity-50`}
              >
                <Building2
                  className={`h-6 w-6 ${
                    recordType === 'companies'
                      ? 'text-purple-600'
                      : 'text-gray-400 dark:text-gray-500'
                  }`}
                />
                <span
                  className={`text-sm font-semibold ${
                    recordType === 'companies'
                      ? 'text-purple-600'
                      : 'text-gray-700 dark:text-gray-300'
                  }`}
                >
                  Companies
                </span>
              </button>
            </div>
          </div>

          {/* All Records button */}
          <button
            onClick={() => {
              setSelectedListId(null);
              loadRecords(recordType, null);
            }}
            disabled={isLoadingRecords}
            className="w-full mb-4 bg-purple-600 text-white px-4 py-3 rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold transition-colors"
          >
            {isLoadingRecords && !selectedListId
              ? 'Loading...'
              : `Load All ${recordType === 'people' ? 'People' : 'Companies'}`}
          </button>

          {/* Attio Lists section */}
          <div className="border-t dark:border-gray-700 pt-4">
            <div className="flex items-center gap-2 mb-3">
              <List className="h-4 w-4 text-purple-600" />
              <span className="text-sm font-medium dark:text-gray-200">
                Or import from an Attio List
              </span>
            </div>

            {isLoadingLists ? (
              <div className="flex items-center justify-center py-6 text-gray-400 dark:text-gray-500">
                <div className="w-5 h-5 border-2 border-purple-600 border-t-transparent rounded-full animate-spin mr-2" />
                <span className="text-sm">Loading lists...</span>
              </div>
            ) : attioLists.length === 0 ? (
              <div className="py-6 text-center text-sm text-gray-400 dark:text-gray-500">
                No Attio lists found
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {attioLists.map((list) => (
                  <button
                    key={list.id}
                    onClick={() => {
                      setSelectedListId(list.id);
                      loadRecords(list.parentObject === 'companies' ? 'companies' : 'people', list.id, list.parentObject);
                    }}
                    disabled={isLoadingRecords}
                    className="w-full text-left px-4 py-3 rounded-lg border dark:border-gray-600 hover:border-purple-400 dark:hover:border-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {list.parentObject === 'companies' ? (
                          <Building2 className="h-3.5 w-3.5 text-purple-500 flex-shrink-0" />
                        ) : (
                          <Users className="h-3.5 w-3.5 text-purple-500 flex-shrink-0" />
                        )}
                        <span className="text-sm font-medium dark:text-white">{list.name}</span>
                      </div>
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        {isLoadingRecords && selectedListId === list.id
                          ? 'Loading...'
                          : list.parentObject === 'companies' ? 'Companies' : 'People'}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
