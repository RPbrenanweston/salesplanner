// @crumb frontend-component-import-csv-modal
// UI/Import | csv_parsing | column_mapping | duplicate_strategy | batch_insert | list_assignment | error_detail_capture | contacts_or_accounts
// why: CSV import modal — upload a CSV file of contacts OR accounts, map columns, validate rows, bulk-insert into contacts/accounts table, and assign to a list
// in:CSV file (user upload),Web Worker parse result,supabase contacts+accounts+lists+list_contacts+account_list_items tables,importType prop out:Rows inserted/updated,list created/assigned,onImportComplete called,import summary displayed err:CSV parse error,missing required field (row skipped),per-row insert failure (detail captured),list creation failure (aborted),list assignment batch failure
// hazard: Per-row duplicate check issues individual SELECT+INSERT/UPDATE — N queries for N rows, large imports (5000+) will be slow
// hazard: list_contacts batch insert lacks ON CONFLICT — duplicate junction rows may be created
// edge:frontend/src/lib/supabase.ts -> CALLS
// edge:frontend/src/workers/parse-csv.worker.ts -> CALLS
// edge:csv-import#1 -> STEP_IN
// prompt: Add batch insert for contacts (chunk 500). Add ON CONFLICT to list_contacts insert. Consider streaming progress updates during import.
import { useState, useEffect, useRef } from 'react';
import { X, Upload, AlertCircle, CheckCircle, Users, Building2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ImportCSVModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
  importType?: 'contacts' | 'accounts';
  /** When true, the user cannot change the import type (e.g. from Accounts page) */
  lockImportType?: boolean;
}

type ImportStep = 'upload' | 'parsing' | 'mapping' | 'preview' | 'importing' | 'complete';

interface ColumnMapping {
  csvColumn: string;
  dbField: string;
}

interface MappedRow {
  [key: string]: any;
  _rowIndex: number;
}

const CONTACT_DB_FIELDS = [
  { value: 'first_name', label: 'First Name' },
  { value: 'last_name', label: 'Last Name' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'company', label: 'Company' },
  { value: 'title', label: 'Title' },
  { value: 'domain', label: 'Domain' },
  { value: 'linkedin_url', label: 'Prospect LinkedIn URL' },
  { value: 'company_linkedin_url', label: 'Company LinkedIn URL' },
  { value: 'twitter_handle', label: 'Prospect Twitter/X' },
  { value: 'company_twitter', label: 'Company Twitter/X' },
  { value: 'ignore', label: '(Ignore)' },
];

const ACCOUNT_DB_FIELDS = [
  { value: 'name', label: 'Account Name' },
  { value: 'domain', label: 'Domain' },
  { value: 'industry', label: 'Industry' },
  { value: 'employee_count_range', label: 'Employee Count Range' },
  { value: 'linkedin_url', label: 'LinkedIn URL' },
  { value: 'notes', label: 'Notes' },
  { value: 'ignore', label: '(Ignore)' },
];

export default function ImportCSVModal({ isOpen, onClose, onImportComplete, importType = 'contacts', lockImportType = false }: ImportCSVModalProps) {
  const [selectedType, setSelectedType] = useState<'contacts' | 'accounts'>(importType);

  // Sync selectedType when prop changes (e.g. switching tabs)
  useEffect(() => {
    setSelectedType(importType);
  }, [importType]);

  const isAccountImport = selectedType === 'accounts';
  const dbFields = isAccountImport ? ACCOUNT_DB_FIELDS : CONTACT_DB_FIELDS;
  const entityLabel = isAccountImport ? 'accounts' : 'contacts';

  const [step, setStep] = useState<ImportStep>('upload');
  const [csvData, setCsvData] = useState<any[]>([]);
  const [columnMappings, setColumnMappings] = useState<ColumnMapping[]>([]);
  const [duplicateStrategy, setDuplicateStrategy] = useState<'skip' | 'update' | 'create'>('skip');
  const [listMode, setListMode] = useState<'none' | 'existing' | 'new'>('new');
  const [selectedListId, setSelectedListId] = useState<string>('');
  const [newListName, setNewListName] = useState<string>(
    `CSV Import — ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
  );
  const [lists, setLists] = useState<any[]>([]);
  const [importProgress, setImportProgress] = useState({ imported: 0, updated: 0, skipped: 0, failed: 0, total: 0 });
  const [error, setError] = useState<string>('');
  const [errorDetails, setErrorDetails] = useState<Array<{ row: number; identifier: string; reason: string }>>([]);
  const [importedListName, setImportedListName] = useState<string>('');
  const workerRef = useRef<Worker | null>(null);

  // Initialize Web Worker on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      workerRef.current = new Worker(new URL('../workers/parse-csv.worker.ts', import.meta.url), { type: 'module' });
    }

    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
      }
    };
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith('.csv')) {
      setError('Please select a CSV file');
      return;
    }

    if (selectedFile.size > 10 * 1024 * 1024) {
      setError('File size must be under 10MB');
      return;
    }

    setError('');
    setStep('parsing');

    // Send file to Web Worker for parsing
    if (!workerRef.current) {
      setError('Failed to initialize CSV parser');
      setStep('upload');
      return;
    }

    // Set up worker message handler
    const messageHandler = (event: MessageEvent) => {
      const { success, data, meta, error: workerError } = event.data;

      if (!success) {
        setError(workerError || 'Failed to parse CSV file');
        setStep('upload');
        workerRef.current?.removeEventListener('message', messageHandler);
        return;
      }

      if (data.length === 0) {
        setError('CSV file is empty');
        setStep('upload');
        workerRef.current?.removeEventListener('message', messageHandler);
        return;
      }

      if (data.length > 10000) {
        setError(`Maximum 10,000 ${entityLabel} allowed per import`);
        setStep('upload');
        workerRef.current?.removeEventListener('message', messageHandler);
        return;
      }

      const headers = meta.fields || [];
      setCsvData(data);

      // Auto-detect column mappings (different patterns for contacts vs accounts)
      const autoMappings = headers.map((header: string) => {
        const normalized = header.toLowerCase().replace(/[^a-z]/g, '');
        let dbField = 'ignore';

        if (isAccountImport) {
          if (normalized.includes('name') || normalized.includes('company') || normalized.includes('organization') || normalized.includes('account')) dbField = 'name';
          else if (normalized.includes('domain') || normalized.includes('website') || normalized === 'url') dbField = 'domain';
          else if (normalized.includes('industry') || normalized.includes('sector')) dbField = 'industry';
          else if (normalized.includes('employee') || normalized.includes('size') || normalized.includes('headcount')) dbField = 'employee_count_range';
          else if (normalized.includes('linkedin')) dbField = 'linkedin_url';
          else if (normalized.includes('notes') || normalized.includes('description')) dbField = 'notes';
        } else {
          if (normalized.includes('firstname') || normalized === 'fname') dbField = 'first_name';
          else if (normalized.includes('lastname') || normalized === 'lname') dbField = 'last_name';
          else if (normalized.includes('email')) dbField = 'email';
          else if (normalized.includes('phone') || normalized.includes('mobile')) dbField = 'phone';
          else if (normalized.includes('company') || normalized.includes('organization')) dbField = 'company';
          else if (normalized.includes('title') || normalized.includes('position')) dbField = 'title';
          else if (normalized.includes('domain') || normalized.includes('website') || normalized === 'url') dbField = 'domain';
          else if (normalized.includes('companylinkedin') || normalized.includes('organizationlinkedin')) dbField = 'company_linkedin_url';
          else if (normalized.includes('linkedin')) dbField = 'linkedin_url';
          else if (normalized.includes('companytwitter') || normalized.includes('organizationtwitter')) dbField = 'company_twitter';
          else if (normalized.includes('twitter') || normalized.includes('xhandle')) dbField = 'twitter_handle';
        }

        return { csvColumn: header, dbField };
      });

      setColumnMappings(autoMappings);
      setStep('mapping');
      workerRef.current?.removeEventListener('message', messageHandler);
    };

    workerRef.current.addEventListener('message', messageHandler);
    workerRef.current.postMessage({ file: selectedFile });
  };

  const handleMappingChange = (csvColumn: string, dbField: string) => {
    setColumnMappings(prev =>
      prev.map(m => m.csvColumn === csvColumn ? { ...m, dbField } : m)
    );
  };

  const handleNextToPreview = async () => {
    // Load lists for optional assignment
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (currentUser) {
      const { data: userRecord } = await supabase
        .from('users')
        .select('org_id')
        .eq('id', currentUser.id)
        .single();

      if (userRecord) {
        let listsQuery = supabase
          .from('lists')
          .select('id, name')
          .eq('org_id', userRecord.org_id);
        if (isAccountImport) {
          listsQuery = listsQuery.eq('list_type', 'accounts');
        } else {
          listsQuery = listsQuery.or('list_type.eq.contacts,list_type.is.null');
        }
        const { data: listsData } = await listsQuery.order('name');
        setLists(listsData || []);
      }
    }

    setStep('preview');
  };

  const handleImport = async () => {
    setStep('importing');
    setImportProgress({ imported: 0, updated: 0, skipped: 0, failed: 0, total: 0 });
    setErrorDetails([]);
    setImportedListName('');
    setError('');

    try {
      const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser();
      if (authError || !currentUser) {
        setError('Authentication error. Please sign in again.');
        setStep('complete');
        return;
      }

      const { data: userRecord, error: userError } = await supabase
        .from('users')
        .select('org_id')
        .eq('id', currentUser.id)
        .single();

      if (userError || !userRecord) {
        setError('Could not find your organization. Please contact support.');
        setStep('complete');
        return;
      }

      if (!csvData || csvData.length === 0) {
        setError('No CSV data to import. Please go back and re-upload.');
        setStep('complete');
        return;
      }

      const orgId = userRecord.org_id;
      const mappingMap = Object.fromEntries(
        columnMappings.filter(m => m.dbField !== 'ignore').map(m => [m.csvColumn, m.dbField])
      );

      // Determine target list ID — ALWAYS ensure contacts land on a list (no orphans)
      let targetListId = '';
      const autoListName = `CSV Import — ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`;

      if (listMode === 'existing' && selectedListId) {
        targetListId = selectedListId;
        // Look up the list name for display
        const selectedList = lists.find(l => l.id === selectedListId);
        setImportedListName(selectedList?.name || 'Selected list');
      } else if (listMode === 'new' && newListName.trim()) {
        const listNameToCreate = newListName.trim();
        const { data: newList, error: listError } = await supabase
          .from('lists')
          .insert({
            name: listNameToCreate,
            org_id: orgId,
            owner_id: currentUser.id,
            is_shared: false,
            ...(isAccountImport ? { list_type: 'accounts' } : {}),
          })
          .select('id')
          .single();

        if (listError || !newList) {
          setError(`Failed to create list "${listNameToCreate}": ${listError?.message || 'Unknown error'}`);
          setStep('complete');
          return;
        }
        targetListId = newList.id;
        setImportedListName(listNameToCreate);
      } else {
        // Fallback: listMode === 'none' or missing data — auto-create a list to prevent orphaned contacts
        const { data: fallbackList, error: fallbackError } = await supabase
          .from('lists')
          .insert({
            name: autoListName,
            org_id: orgId,
            owner_id: currentUser.id,
            is_shared: false,
            ...(isAccountImport ? { list_type: 'accounts' } : {}),
          })
          .select('id')
          .single();

        if (fallbackError || !fallbackList) {
          setError(`Failed to create auto-list: ${fallbackError?.message || 'Unknown error'}`);
          setStep('complete');
          return;
        }
        targetListId = fallbackList.id;
        setImportedListName(autoListName);
      }

      const BATCH_SIZE = 500;
      let imported = 0;
      let updated = 0;
      let skipped = 0;
      let failed = 0;
      const rowErrors: Array<{ row: number; identifier: string; reason: string }> = [];
      const idsToAddToList: string[] = [];

      // The table and key field differ between contacts and accounts
      const tableName = isAccountImport ? 'accounts' : 'contacts';
      const requiredField = isAccountImport ? 'name' : 'email';
      const requiredFieldLabel = isAccountImport ? 'account name' : 'email address';

      // Build mapped rows (skip rows missing required field)
      const mappedRows: MappedRow[] = [];
      for (let i = 0; i < csvData.length; i++) {
        const row = csvData[i];
        const mapped: Record<string, any> = {};
        for (const [csvCol, dbField] of Object.entries(mappingMap)) {
          const val = row[csvCol];
          if (val !== undefined && val !== null && String(val).trim() !== '') {
            mapped[dbField] = String(val).trim();
          }
        }
        if (!mapped[requiredField]) {
          failed++;
          rowErrors.push({ row: i + 1, identifier: '(missing)', reason: `No ${requiredFieldLabel} found in row` });
          continue;
        }
        // Defaults for contact NOT NULL fields
        if (!isAccountImport) {
          if (!mapped.first_name) mapped.first_name = '';
          if (!mapped.last_name) mapped.last_name = '';
        }
        mappedRows.push({ ...mapped, _rowIndex: i });
      }

      const totalValid = mappedRows.length;
      setImportProgress({ imported, updated, skipped, failed, total: csvData.length });

      // Batch duplicate-check: by email (contacts) or name (accounts)
      const existingMap = new Map<string, string>(); // key → existing row id
      for (let i = 0; i < mappedRows.length; i += BATCH_SIZE) {
        const chunk = mappedRows.slice(i, i + BATCH_SIZE);
        const keys = chunk.map((r) => r[requiredField] as string);
        const { data: existing } = await supabase
          .from(tableName)
          .select(`id, ${requiredField}`)
          .eq('org_id', orgId)
          .in(requiredField, keys);
        for (const row of existing || []) {
          existingMap.set((row as any)[requiredField], row.id);
        }
      }

      // Separate rows into new vs existing
      const toInsert: MappedRow[] = [];
      const toUpdate: MappedRow[] = [];

      for (const row of mappedRows) {
        const existingId = existingMap.get(row[requiredField] as string);
        if (existingId) {
          if (duplicateStrategy === 'skip') {
            skipped++;
            idsToAddToList.push(existingId);
          } else if (duplicateStrategy === 'update') {
            toUpdate.push({ ...row, _existingId: existingId } as any);
            idsToAddToList.push(existingId);
          } else {
            toInsert.push(row);
          }
        } else {
          toInsert.push(row);
        }
      }

      setImportProgress({ imported, updated, skipped, failed, total: csvData.length });

      // Batch insert new rows
      for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
        const chunk = toInsert.slice(i, i + BATCH_SIZE);
        const rows = chunk.map(({ _rowIndex: _, ...rest }) => ({
          ...rest,
          org_id: orgId,
          created_by: currentUser.id,
          ...(isAccountImport ? {} : { source: 'csv' }),
        }));
        const { data: inserted, error: insertError } = await supabase
          .from(tableName)
          .insert(rows)
          .select('id');
        if (insertError) {
          console.error('Batch insert error:', insertError);
          failed += chunk.length;
          chunk.forEach((r) => rowErrors.push({ row: r._rowIndex + 1, identifier: r[requiredField] as string, reason: `Insert failed: ${insertError.message}` }));
        } else {
          imported += (inserted || []).length;
          for (const c of inserted || []) idsToAddToList.push(c.id);
        }
        setImportProgress({ imported, updated, skipped, failed, total: totalValid });
      }

      // Update existing rows one-by-one
      for (let i = 0; i < toUpdate.length; i++) {
        const row = toUpdate[i] as any;
        const { _rowIndex, _existingId, ...rowData } = row;
        const { error: updateError } = await supabase
          .from(tableName)
          .update({ ...rowData, updated_at: new Date().toISOString() })
          .eq('id', _existingId);
        if (updateError) {
          failed++;
          rowErrors.push({ row: _rowIndex + 1, identifier: rowData[requiredField] || '', reason: `Update failed: ${updateError.message}` });
        } else {
          updated++;
        }
        if (i % 50 === 0) setImportProgress({ imported, updated, skipped, failed, total: totalValid });
      }

      setImportProgress({ imported, updated, skipped, failed, total: totalValid });

      // Persist error details to state for display in completion step
      setErrorDetails(rowErrors);

      // Batch assign to list — different junction table for contacts vs accounts
      if (targetListId && idsToAddToList.length > 0) {
        const junctionTable = isAccountImport ? 'account_list_items' : 'list_contacts';
        const idColumn = isAccountImport ? 'account_id' : 'contact_id';
        const conflictColumns = isAccountImport ? 'list_id,account_id' : 'list_id,contact_id';
        let listAssignmentErrors = 0;

        for (let i = 0; i < idsToAddToList.length; i += BATCH_SIZE) {
          const batch = idsToAddToList.slice(i, i + BATCH_SIZE);
          const junctionRows = batch.map((rowId) => ({
            list_id: targetListId,
            [idColumn]: rowId,
            position: 0,
          }));

          const { error: batchError } = await supabase
            .from(junctionTable)
            .upsert(junctionRows, { onConflict: conflictColumns, ignoreDuplicates: true });
          if (batchError) {
            console.error(`Batch ${i / BATCH_SIZE + 1} list assignment error:`, batchError);
            listAssignmentErrors += batch.length;
          }
        }

        if (listAssignmentErrors > 0) {
          failed += listAssignmentErrors;
        }
      }

      setImportProgress({ imported, updated, skipped, failed, total: totalValid });
      setStep('complete');
    } catch (err) {
      console.error('Import failed:', err);
      setError('Import failed unexpectedly. Please try again.');
      setStep('complete');
    }
  };

  const handleClose = () => {
    setStep('upload');
    setCsvData([]);
    setColumnMappings([]);
    setDuplicateStrategy('skip');
    setListMode('new');
    setSelectedListId('');
    setNewListName(
      `CSV Import — ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
    );
    setImportProgress({ imported: 0, updated: 0, skipped: 0, failed: 0, total: 0 });
    setErrorDetails([]);
    setImportedListName('');
    setError('');
    setSelectedType(importType);
    // Remove worker event listeners on close
    if (workerRef.current) {
      workerRef.current.removeEventListener('message', () => {});
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b dark:border-gray-700">
          <h2 className="text-xl font-semibold dark:text-white">Import {isAccountImport ? 'Accounts' : 'Contacts'} from CSV</h2>
          <button onClick={handleClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-8rem)]">
          {/* Upload Step */}
          {step === 'upload' && (
            <div className="space-y-4">
              {/* Import type selector — shown unless locked */}
              {!lockImportType && (
                <div className="flex gap-3">
                  <button
                    onClick={() => setSelectedType('contacts')}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 text-sm font-semibold transition-all ${
                      selectedType === 'contacts'
                        ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                        : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-500'
                    }`}
                  >
                    <Users className="w-5 h-5" />
                    Contacts
                  </button>
                  <button
                    onClick={() => setSelectedType('accounts')}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 text-sm font-semibold transition-all ${
                      selectedType === 'accounts'
                        ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                        : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-500'
                    }`}
                  >
                    <Building2 className="w-5 h-5" />
                    Accounts
                  </button>
                </div>
              )}

              <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-12 text-center">
                <Upload className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                  Drag and drop your CSV file here, or click to browse
                </p>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="csv-file-input"
                />
                <label
                  htmlFor="csv-file-input"
                  className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700"
                >
                  Select CSV File
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Maximum 10,000 {entityLabel}, 10MB file size
                </p>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                  <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                </div>
              )}
            </div>
          )}

          {/* Parsing Step */}
          {step === 'parsing' && (
            <div className="space-y-4 text-center py-8">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              <p className="text-sm text-gray-600 dark:text-gray-300">Parsing CSV file...</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">This may take a moment for large files</p>
            </div>
          )}

          {/* Mapping Step */}
          {step === 'mapping' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Map your CSV columns to {isAccountImport ? 'account' : 'contact'} fields. Auto-detected mappings are pre-selected.
              </p>

              <div className="space-y-2">
                {columnMappings.map((mapping) => (
                  <div key={mapping.csvColumn} className="flex items-center gap-4">
                    <div className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                      <p className="text-sm font-medium dark:text-white">{mapping.csvColumn}</p>
                    </div>
                    <span className="text-gray-400">→</span>
                    <select
                      value={mapping.dbField}
                      onChange={(e) => handleMappingChange(mapping.csvColumn, e.target.value)}
                      className="flex-1 px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white"
                    >
                      {dbFields.map((field) => (
                        <option key={field.value} value={field.value}>
                          {field.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={() => setStep('upload')}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                >
                  Back
                </button>
                <button
                  onClick={handleNextToPreview}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Next: Preview
                </button>
              </div>
            </div>
          )}

          {/* Preview Step */}
          {step === 'preview' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Preview the first 5 rows. Total rows: <strong>{csvData.length}</strong>
              </p>

              <div className="overflow-x-auto border dark:border-gray-700 rounded-lg">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      {columnMappings.filter(m => m.dbField !== 'ignore').map((m) => (
                        <th key={m.csvColumn} className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                          {m.dbField.replace('_', ' ')}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {csvData.slice(0, 5).map((row, idx) => (
                      <tr key={idx}>
                        {columnMappings.filter(m => m.dbField !== 'ignore').map((m) => (
                          <td key={m.csvColumn} className="px-4 py-2 text-sm text-gray-900 dark:text-gray-200">
                            {row[m.csvColumn]}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="space-y-3 pt-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Duplicate {isAccountImport ? 'Name' : 'Email'} Strategy
                  </label>
                  <select
                    value={duplicateStrategy}
                    onChange={(e) => setDuplicateStrategy(e.target.value as any)}
                    className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white"
                  >
                    <option value="skip">Skip duplicates</option>
                    <option value="update">Update existing {entityLabel}</option>
                    <option value="create">Create duplicates</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Add to List
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-3 p-3 border dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      <input
                        type="radio"
                        name="listMode"
                        value="none"
                        checked={listMode === 'none'}
                        onChange={() => { setListMode('none'); setSelectedListId(''); setNewListName(''); }}
                        className="text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Don't add to a list</span>
                    </label>

                    <label className="flex items-center gap-3 p-3 border dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      <input
                        type="radio"
                        name="listMode"
                        value="existing"
                        checked={listMode === 'existing'}
                        onChange={() => { setListMode('existing'); setNewListName(''); }}
                        className="text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Add to existing list</span>
                    </label>

                    {listMode === 'existing' && (
                      <div className="ml-8">
                        <select
                          value={selectedListId}
                          onChange={(e) => setSelectedListId(e.target.value)}
                          className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white text-sm"
                        >
                          <option value="">Select a list...</option>
                          {lists.map((list) => (
                            <option key={list.id} value={list.id}>
                              {list.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <label className="flex items-center gap-3 p-3 border dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      <input
                        type="radio"
                        name="listMode"
                        value="new"
                        checked={listMode === 'new'}
                        onChange={() => { setListMode('new'); setSelectedListId(''); }}
                        className="text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Create a new list</span>
                    </label>

                    {listMode === 'new' && (
                      <div className="ml-8">
                        <input
                          type="text"
                          value={newListName}
                          onChange={(e) => setNewListName(e.target.value)}
                          placeholder="Enter list name..."
                          className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={() => setStep('mapping')}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                >
                  Back
                </button>
                <button
                  onClick={handleImport}
                  disabled={
                    (listMode === 'existing' && !selectedListId) ||
                    (listMode === 'new' && !newListName.trim())
                  }
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Start Import
                </button>
              </div>
            </div>
          )}

          {/* Importing Step */}
          {step === 'importing' && (
            <div className="space-y-4 py-8">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-3"></div>
                <p className="text-sm text-gray-600 dark:text-gray-300 font-medium">Importing {entityLabel}...</p>
                {importProgress.total > 0 && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {importProgress.imported + importProgress.updated + importProgress.skipped + importProgress.failed} of {importProgress.total} processed
                  </p>
                )}
              </div>
              {importProgress.total > 0 && (
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${Math.round(((importProgress.imported + importProgress.updated + importProgress.skipped + importProgress.failed) / importProgress.total) * 100)}%` }}
                  />
                </div>
              )}
              <div className="text-sm space-y-1 text-center">
                <p className="text-green-600 dark:text-green-400">✓ Inserted: {importProgress.imported}</p>
                <p className="text-blue-600 dark:text-blue-400">↻ Updated: {importProgress.updated}</p>
                <p className="text-yellow-600 dark:text-yellow-400">⊘ Skipped: {importProgress.skipped}</p>
                <p className="text-red-600 dark:text-red-400">✗ Failed: {importProgress.failed}</p>
              </div>
            </div>
          )}

          {/* Complete Step */}
          {step === 'complete' && (
            <div className="space-y-4 text-center py-8">
              {error ? (
                <AlertCircle className="w-16 h-16 mx-auto text-red-600 dark:text-red-400" />
              ) : (
                <CheckCircle className="w-16 h-16 mx-auto text-green-600 dark:text-green-400" />
              )}
              <h3 className="text-xl font-semibold dark:text-white">
                {error ? 'Import Failed' : 'Import Complete!'}
              </h3>

              {error && (
                <div className="flex items-center gap-2 p-3 mx-auto max-w-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
                  <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                </div>
              )}

              <div className="text-sm space-y-1 text-gray-600 dark:text-gray-300">
                <p className="text-green-600 dark:text-green-400">✓ Inserted: {importProgress.imported}</p>
                <p className="text-blue-600 dark:text-blue-400">↻ Updated: {importProgress.updated}</p>
                <p className="text-yellow-600 dark:text-yellow-400">⊘ Skipped (duplicates): {importProgress.skipped}</p>
                <p className="text-red-600 dark:text-red-400">✗ Failed: {importProgress.failed}</p>
              </div>

              {importedListName && (
                <p className="text-sm text-indigo-600 dark:text-indigo-400 font-medium">
                  📋 All {entityLabel} added to list: "{importedListName}"
                </p>
              )}

              {/* Error detail panel — scrollable list of per-row errors */}
              {errorDetails.length > 0 && (
                <div className="mx-auto max-w-lg text-left">
                  <p className="text-sm font-medium text-red-700 dark:text-red-300 mb-2">
                    Error Details ({errorDetails.length} rows failed):
                  </p>
                  <div className="max-h-48 overflow-y-auto border border-red-200 dark:border-red-800 rounded-lg bg-red-50 dark:bg-red-900/20">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-red-100 dark:bg-red-900/40">
                        <tr>
                          <th className="px-3 py-1.5 text-left text-red-700 dark:text-red-300 font-medium">Row</th>
                          <th className="px-3 py-1.5 text-left text-red-700 dark:text-red-300 font-medium">{isAccountImport ? 'Name' : 'Email'}</th>
                          <th className="px-3 py-1.5 text-left text-red-700 dark:text-red-300 font-medium">Reason</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-red-200 dark:divide-red-800">
                        {errorDetails.map((err, idx) => (
                          <tr key={idx}>
                            <td className="px-3 py-1.5 text-red-600 dark:text-red-400 tabular-nums">{err.row}</td>
                            <td className="px-3 py-1.5 text-red-600 dark:text-red-400 font-mono truncate max-w-[200px]">{err.identifier}</td>
                            <td className="px-3 py-1.5 text-red-600 dark:text-red-400">{err.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <button
                onClick={() => {
                  if (importProgress.imported > 0 || importProgress.updated > 0 || importProgress.skipped > 0) {
                    onImportComplete();
                  }
                  handleClose();
                }}
                className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
