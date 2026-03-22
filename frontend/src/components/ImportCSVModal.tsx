// @crumb frontend-component-import-csv-modal
// UI/Contacts/Import | csv_parsing | column_mapping | duplicate_strategy | batch_insert | list_assignment | error_detail_capture
// why: CSV import modal — upload a CSV file of contacts, map columns to contact fields, validate rows, bulk-insert into contacts table, and ALWAYS assign to a list
// in:CSV file (user upload),Web Worker parse result,supabase contacts+lists+list_contacts tables,useAuth out:Contact rows inserted/updated,list created/assigned,onImportComplete called,import summary displayed err:CSV parse error,missing email column (row skipped),per-row insert failure (detail captured),list creation failure (aborted),list assignment batch failure
// hazard: Per-row duplicate check issues individual SELECT+INSERT/UPDATE — N queries for N rows, large imports (5000+) will be slow
// hazard: list_contacts batch insert lacks ON CONFLICT — duplicate junction rows may be created
// edge:frontend/src/lib/supabase.ts -> CALLS
// edge:frontend/src/workers/parse-csv.worker.ts -> CALLS
// edge:csv-import#1 -> STEP_IN
// prompt: Add batch insert for contacts (chunk 500). Add ON CONFLICT to list_contacts insert. Consider streaming progress updates during import.
import { useState, useEffect, useRef } from 'react';
import { X, Upload, AlertCircle, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ImportCSVModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
}

type ImportStep = 'upload' | 'parsing' | 'mapping' | 'preview' | 'importing' | 'complete';

interface ColumnMapping {
  csvColumn: string;
  dbField: string;
}

interface ContactRow {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  company?: string;
  title?: string;
  [key: string]: any;
}

const DB_FIELDS = [
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

export default function ImportCSVModal({ isOpen, onClose, onImportComplete }: ImportCSVModalProps) {
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
  const [errorDetails, setErrorDetails] = useState<Array<{ row: number; email: string; reason: string }>>([]);
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
        setError('Maximum 10,000 contacts allowed per import');
        setStep('upload');
        workerRef.current?.removeEventListener('message', messageHandler);
        return;
      }

      const headers = meta.fields || [];
      setCsvData(data);

      // Auto-detect column mappings
      const autoMappings = headers.map((header: string) => {
        const normalized = header.toLowerCase().replace(/[^a-z]/g, '');
        let dbField = 'ignore';

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
        const { data: listsData } = await supabase
          .from('lists')
          .select('id, name')
          .eq('org_id', userRecord.org_id)
          .order('name');

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
      const rowErrors: Array<{ row: number; email: string; reason: string }> = [];
      const contactsToAddToList: string[] = [];

      // Build mapped contact rows (skip rows with no email)
      type MappedRow = ContactRow & { _rowIndex: number };
      const mappedRows: MappedRow[] = [];
      for (let i = 0; i < csvData.length; i++) {
        const row = csvData[i];
        const contact: ContactRow = {};
        for (const [csvCol, dbField] of Object.entries(mappingMap)) {
          const val = row[csvCol];
          if (val !== undefined && val !== null && String(val).trim() !== '') {
            contact[dbField] = String(val).trim();
          }
        }
        if (!contact.email) {
          failed++;
          rowErrors.push({ row: i + 1, email: '(missing)', reason: 'No email address found in row' });
          continue;
        }
        if (!contact.first_name) contact.first_name = '';
        if (!contact.last_name) contact.last_name = '';
        mappedRows.push({ ...contact, _rowIndex: i });
      }

      const totalValid = mappedRows.length;
      setImportProgress({ imported, updated, skipped, failed, total: csvData.length });

      // Batch duplicate-check in chunks to avoid large IN clauses
      const emailMap = new Map<string, string>(); // email → existing contact id
      for (let i = 0; i < mappedRows.length; i += BATCH_SIZE) {
        const chunk = mappedRows.slice(i, i + BATCH_SIZE);
        const emails = chunk.map((r) => r.email as string);
        const { data: existing } = await supabase
          .from('contacts')
          .select('id, email')
          .eq('org_id', orgId)
          .in('email', emails);
        for (const row of existing || []) {
          emailMap.set(row.email, row.id);
        }
      }

      // Separate rows into new vs existing
      const toInsert: MappedRow[] = [];
      const toUpdate: MappedRow[] = [];
      const toSkip: { id: string }[] = [];

      for (const row of mappedRows) {
        const existingId = emailMap.get(row.email as string);
        if (existingId) {
          if (duplicateStrategy === 'skip') {
            skipped++;
            toSkip.push({ id: existingId });
            contactsToAddToList.push(existingId);
          } else if (duplicateStrategy === 'update') {
            toUpdate.push({ ...row, _existingId: existingId } as any);
            contactsToAddToList.push(existingId);
          } else {
            // create — allow duplicate
            toInsert.push(row);
          }
        } else {
          toInsert.push(row);
        }
      }

      setImportProgress({ imported, updated, skipped, failed, total: csvData.length });

      // Batch insert new contacts in chunks of BATCH_SIZE
      for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
        const chunk = toInsert.slice(i, i + BATCH_SIZE);
        const rows = chunk.map(({ _rowIndex: _, ...rest }) => ({
          ...rest,
          org_id: orgId,
          source: 'csv',
          created_by: currentUser.id,
        }));
        const { data: inserted, error: insertError } = await supabase
          .from('contacts')
          .insert(rows)
          .select('id');
        if (insertError) {
          console.error('Batch insert error:', insertError);
          failed += chunk.length;
          chunk.forEach((r) => rowErrors.push({ row: r._rowIndex + 1, email: r.email as string, reason: `Insert failed: ${insertError.message}` }));
        } else {
          imported += (inserted || []).length;
          for (const c of inserted || []) contactsToAddToList.push(c.id);
        }
        setImportProgress({ imported, updated, skipped, failed, total: totalValid });
      }

      // Batch update existing contacts one-by-one (Supabase doesn't support batch UPDATE with different values)
      for (let i = 0; i < toUpdate.length; i++) {
        const row = toUpdate[i] as any;
        const { _rowIndex, _existingId, ...contactData } = row;
        const { error: updateError } = await supabase
          .from('contacts')
          .update({ ...contactData, updated_at: new Date().toISOString() })
          .eq('id', _existingId);
        if (updateError) {
          failed++;
          rowErrors.push({ row: _rowIndex + 1, email: contactData.email || '', reason: `Update failed: ${updateError.message}` });
        } else {
          updated++;
        }
        // Update progress every 50 updates
        if (i % 50 === 0) setImportProgress({ imported, updated, skipped, failed, total: totalValid });
      }

      setImportProgress({ imported, updated, skipped, failed, total: totalValid });

      // Persist error details to state for display in completion step
      setErrorDetails(rowErrors);

      // Batch insert all tracked contacts into list_contacts (targetListId is always set — no orphans)
      if (targetListId && contactsToAddToList.length > 0) {
        const BATCH_SIZE = 500;
        let listAssignmentErrors = 0;

        for (let i = 0; i < contactsToAddToList.length; i += BATCH_SIZE) {
          const batch = contactsToAddToList.slice(i, i + BATCH_SIZE);
          const listContactsToInsert = batch.map((contactId) => ({
            list_id: targetListId,
            contact_id: contactId,
            position: 0,
          }));

          const { error: batchError } = await supabase
            .from('list_contacts')
            .upsert(listContactsToInsert, { onConflict: 'list_id,contact_id', ignoreDuplicates: true });
          if (batchError) {
            console.error(`Batch ${i / BATCH_SIZE + 1} list assignment error:`, batchError);
            listAssignmentErrors += batch.length;
          }
        }

        // Update failed count if any list assignment batch failed
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
          <h2 className="text-xl font-semibold dark:text-white">Import Contacts from CSV</h2>
          <button onClick={handleClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-8rem)]">
          {/* Upload Step */}
          {step === 'upload' && (
            <div className="space-y-4">
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
                  Maximum 10,000 contacts, 10MB file size
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
                Map your CSV columns to contact fields. Auto-detected mappings are pre-selected.
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
                      {DB_FIELDS.map((field) => (
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
                    Duplicate Email Strategy
                  </label>
                  <select
                    value={duplicateStrategy}
                    onChange={(e) => setDuplicateStrategy(e.target.value as any)}
                    className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white"
                  >
                    <option value="skip">Skip duplicates</option>
                    <option value="update">Update existing contacts</option>
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
                <p className="text-sm text-gray-600 dark:text-gray-300 font-medium">Importing contacts...</p>
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
                  📋 All contacts added to list: "{importedListName}"
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
                          <th className="px-3 py-1.5 text-left text-red-700 dark:text-red-300 font-medium">Email</th>
                          <th className="px-3 py-1.5 text-left text-red-700 dark:text-red-300 font-medium">Reason</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-red-200 dark:divide-red-800">
                        {errorDetails.map((err, idx) => (
                          <tr key={idx}>
                            <td className="px-3 py-1.5 text-red-600 dark:text-red-400 tabular-nums">{err.row}</td>
                            <td className="px-3 py-1.5 text-red-600 dark:text-red-400 font-mono truncate max-w-[200px]">{err.email}</td>
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
