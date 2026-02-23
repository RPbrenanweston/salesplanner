import { useState } from 'react';
import { X, Upload, AlertCircle, CheckCircle } from 'lucide-react';
import Papa from 'papaparse';
import { supabase } from '../lib/supabase';

interface ImportCSVModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
}

type ImportStep = 'upload' | 'mapping' | 'preview' | 'importing' | 'complete';

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
  const [selectedListId, setSelectedListId] = useState<string>('');
  const [lists, setLists] = useState<any[]>([]);
  const [importProgress, setImportProgress] = useState({ imported: 0, skipped: 0, errors: 0 });
  const [error, setError] = useState<string>('');

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

    // Parse CSV
    Papa.parse(selectedFile, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.data.length === 0) {
          setError('CSV file is empty');
          return;
        }

        if (results.data.length > 10000) {
          setError('Maximum 10,000 contacts allowed per import');
          return;
        }

        const headers = results.meta.fields || [];
        setCsvData(results.data);

        // Auto-detect column mappings
        const autoMappings = headers.map((header) => {
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
      },
      error: () => {
        setError('Failed to parse CSV file');
      },
    });
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
    setImportProgress({ imported: 0, skipped: 0, errors: 0 });

    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser) return;

    const { data: userRecord } = await supabase
      .from('users')
      .select('org_id')
      .eq('id', currentUser.id)
      .single();

    if (!userRecord) return;

    const orgId = userRecord.org_id;
    const mappingMap = Object.fromEntries(
      columnMappings.filter(m => m.dbField !== 'ignore').map(m => [m.csvColumn, m.dbField])
    );

    let imported = 0;
    let skipped = 0;
    let errors = 0;

    for (const row of csvData) {
      const contact: ContactRow = {};

      // Map CSV columns to DB fields
      for (const [csvCol, dbField] of Object.entries(mappingMap)) {
        contact[dbField] = row[csvCol];
      }

      // Email is required
      if (!contact.email) {
        errors++;
        continue;
      }

      // Check for duplicate
      const { data: existing } = await supabase
        .from('contacts')
        .select('id')
        .eq('org_id', orgId)
        .eq('email', contact.email)
        .maybeSingle();

      if (existing) {
        if (duplicateStrategy === 'skip') {
          skipped++;
          continue;
        } else if (duplicateStrategy === 'update') {
          const { error: updateError } = await supabase
            .from('contacts')
            .update({ ...contact, updated_at: new Date().toISOString() })
            .eq('id', existing.id);

          if (updateError) {
            errors++;
          } else {
            imported++;
          }
          continue;
        }
      }

      // Insert new contact
      const { data: newContact, error: insertError } = await supabase
        .from('contacts')
        .insert({
          ...contact,
          org_id: orgId,
          source: 'csv',
          created_by: currentUser.id,
        })
        .select('id')
        .single();

      if (insertError) {
        errors++;
      } else {
        imported++;

        // Add to list if selected
        if (selectedListId && newContact) {
          await supabase.from('list_contacts').insert({
            list_id: selectedListId,
            contact_id: newContact.id,
            position: 0,
          });
        }
      }

      setImportProgress({ imported, skipped, errors });
    }

    setStep('complete');
  };

  const handleClose = () => {
    setStep('upload');
    setCsvData([]);
    setColumnMappings([]);
    setDuplicateStrategy('skip');
    setSelectedListId('');
    setImportProgress({ imported: 0, skipped: 0, errors: 0 });
    setError('');
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
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Add to List (Optional)
                  </label>
                  <select
                    value={selectedListId}
                    onChange={(e) => setSelectedListId(e.target.value)}
                    className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white"
                  >
                    <option value="">None</option>
                    {lists.map((list) => (
                      <option key={list.id} value={list.id}>
                        {list.name}
                      </option>
                    ))}
                  </select>
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
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Start Import
                </button>
              </div>
            </div>
          )}

          {/* Importing Step */}
          {step === 'importing' && (
            <div className="space-y-4 text-center py-8">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              <p className="text-sm text-gray-600 dark:text-gray-300">Importing contacts...</p>
              <div className="text-sm space-y-1">
                <p className="text-green-600 dark:text-green-400">✓ Imported: {importProgress.imported}</p>
                <p className="text-yellow-600 dark:text-yellow-400">⊘ Skipped: {importProgress.skipped}</p>
                <p className="text-red-600 dark:text-red-400">✗ Errors: {importProgress.errors}</p>
              </div>
            </div>
          )}

          {/* Complete Step */}
          {step === 'complete' && (
            <div className="space-y-4 text-center py-8">
              <CheckCircle className="w-16 h-16 mx-auto text-green-600 dark:text-green-400" />
              <h3 className="text-xl font-semibold dark:text-white">Import Complete!</h3>
              <div className="text-sm space-y-1 text-gray-600 dark:text-gray-300">
                <p className="text-green-600 dark:text-green-400">✓ Imported: {importProgress.imported}</p>
                <p className="text-yellow-600 dark:text-yellow-400">⊘ Skipped: {importProgress.skipped}</p>
                <p className="text-red-600 dark:text-red-400">✗ Errors: {importProgress.errors}</p>
              </div>

              <button
                onClick={() => {
                  onImportComplete();
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
