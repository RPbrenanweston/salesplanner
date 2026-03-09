/**
 * @crumb
 * @id frontend-component-list-builder-modal
 * @area UI/Lists
 * @intent List builder modal — create or edit a smart contact list with filter criteria (company, title, source, domain, social handles) that dynamically resolves matching contacts
 * @responsibilities Render filter builder UI (add/remove filter rows with field + operator + value), preview matching contact count, save list definition to lists table, call onSaved callback
 * @contracts ListBuilderModal({ list?, onClose, onSaved }) → JSX; calls supabase.from('contacts').select with dynamic filter; calls supabase.from('lists').upsert; optional list prop for edit mode
 * @in list (optional existing list for edit), supabase contacts + lists tables, useAuth (org_id), onClose callback, onSaved callback
 * @out List definition row upserted in lists table with filter criteria JSON; onSaved called with list record; modal closed
 * @err Supabase preview query failure (count shows error); Supabase upsert failure (caught, error shown); invalid filter combination (empty result — no guard)
 * @hazard Filter criteria are stored as JSON in the lists table and re-evaluated dynamically — if the contacts table schema changes (field renamed or removed), existing list filter criteria will silently return 0 results or throw a Supabase query error
 * @hazard Contact preview count query executes on every filter change with no debounce — rapid filter edits will fire multiple concurrent Supabase queries and the UI may show a stale count if responses arrive out of order
 * @shared-edges supabase contacts table→READS for preview; supabase lists table→UPSERTS list definition; frontend/src/pages/Lists.tsx→RENDERS modal; ListDetailPage→READS list and executes filters
 * @trail list-builder#1 | User clicks "New List" → ListBuilderModal renders → user adds filter rows → preview count updates → handleSave → supabase upsert → onSaved(list) → modal closes → list appears in Lists page
 * @prompt Debounce preview queries. Add schema-versioning to filter criteria JSON so migrations can update stored filters. Add filter validation before save.
 */
import { useState, useEffect, useRef } from 'react';
import { X, Plus, Trash2, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';

type FilterField = 'company' | 'title' | 'source' | 'created_at' | 'custom_field' | 'domain' | 'linkedin_url' | 'company_linkedin_url' | 'twitter_handle' | 'company_twitter';
type FilterOperator = 'equals' | 'contains' | 'starts_with' | 'greater_than' | 'less_than';

interface Filter {
  id: string;
  field: FilterField;
  operator: FilterOperator;
  value: string;
  customFieldKey?: string; // For custom_field filters
}

interface ExistingList {
  id: string;
  name: string;
  description: string | null;
  filter_criteria: {
    filters: Array<{ field: FilterField; operator: FilterOperator; value: string; customFieldKey?: string }>;
    autoRefresh: boolean;
  } | null;
  is_shared: boolean;
}

interface ListBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  existingList?: ExistingList | null;
}

export default function ListBuilderModal({ isOpen, onClose, onSuccess, existingList }: ListBuilderModalProps) {
  const isEditMode = !!existingList;
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [filters, setFilters] = useState<Filter[]>([]);
  const [matchingCount, setMatchingCount] = useState<number | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Pre-fill when editing, reset when closing or creating new
  useEffect(() => {
    if (isOpen && existingList) {
      // Edit mode: pre-fill from existing list
      setName(existingList.name || '');
      setDescription(existingList.description || '');
      setAutoRefresh(existingList.filter_criteria?.autoRefresh ?? true);
      if (existingList.filter_criteria?.filters) {
        setFilters(
          existingList.filter_criteria.filters.map(f => ({
            id: crypto.randomUUID(),
            field: f.field,
            operator: f.operator,
            value: f.value,
            customFieldKey: f.customFieldKey,
          }))
        );
      } else {
        setFilters([]);
      }
      setError('');
    } else if (!isOpen) {
      // Reset on close
      setName('');
      setDescription('');
      setFilters([]);
      setMatchingCount(null);
      setAutoRefresh(true);
      setError('');
    }
  }, [isOpen, existingList]);

  // Live preview: count matching contacts whenever filters change (debounced)
  useEffect(() => {
    // Clear previous timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    if (isOpen && filters.length > 0) {
      // Debounce the preview query by 400ms to avoid firing on every keystroke
      debounceTimeoutRef.current = setTimeout(() => {
        updateMatchingCount();
      }, 400);
    } else {
      setMatchingCount(null);
    }

    // Cleanup timeout on unmount or when deps change
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [filters, isOpen]);

  const addFilter = () => {
    const newFilter: Filter = {
      id: crypto.randomUUID(),
      field: 'company',
      operator: 'equals',
      value: '',
    };
    setFilters([...filters, newFilter]);
  };

  const removeFilter = (id: string) => {
    setFilters(filters.filter(f => f.id !== id));
  };

  const updateFilter = (id: string, updates: Partial<Filter>) => {
    setFilters(filters.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const updateMatchingCount = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get user's org_id
      const { data: userData } = await supabase
        .from('users')
        .select('org_id')
        .eq('id', user.id)
        .single();

      if (!userData) return;

      // Build query with filters
      let query = supabase
        .from('contacts')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', userData.org_id);

      // Apply each filter (AND logic)
      filters.forEach(filter => {
        if (!filter.value) return; // Skip empty values

        if (filter.field === 'custom_field' && filter.customFieldKey) {
          // Query JSONB custom_fields
          const jsonbPath = `custom_fields->${filter.customFieldKey}`;
          if (filter.operator === 'equals') {
            query = query.eq(jsonbPath, filter.value);
          } else if (filter.operator === 'contains') {
            query = query.ilike(jsonbPath, `%${filter.value}%`);
          }
        } else {
          // Standard fields
          if (filter.operator === 'equals') {
            query = query.eq(filter.field, filter.value);
          } else if (filter.operator === 'contains') {
            query = query.ilike(filter.field, `%${filter.value}%`);
          } else if (filter.operator === 'starts_with') {
            query = query.ilike(filter.field, `${filter.value}%`);
          } else if (filter.operator === 'greater_than' && filter.field === 'created_at') {
            query = query.gt(filter.field, filter.value);
          } else if (filter.operator === 'less_than' && filter.field === 'created_at') {
            query = query.lt(filter.field, filter.value);
          }
        }
      });

      const { count } = await query;
      setMatchingCount(count || 0);
    } catch (err) {
      console.error('Error counting contacts:', err);
      setMatchingCount(null);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError('List name is required');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Get user's org_id — check error explicitly
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('org_id')
        .eq('id', user.id)
        .single();

      if (userError) {
        console.error('Error fetching user data:', userError);
        throw new Error(`Could not load user data: ${userError.message}`);
      }
      if (!userData) throw new Error('User data not found');

      // Prepare filter criteria as JSONB
      const filterCriteria = {
        filters: filters.map(f => ({
          field: f.field,
          operator: f.operator,
          value: f.value,
          customFieldKey: f.customFieldKey,
        })),
        autoRefresh,
      };

      let listId: string;

      if (isEditMode && existingList) {
        // UPDATE existing list
        const { error: updateError } = await supabase
          .from('lists')
          .update({
            name: name.trim(),
            description: description.trim() || null,
            filter_criteria: filterCriteria,
          })
          .eq('id', existingList.id);

        if (updateError) {
          console.error('Error updating list:', updateError);
          throw updateError;
        }
        listId = existingList.id;

        // Remove old list_contacts, then re-populate
        const { error: deleteError } = await supabase
          .from('list_contacts')
          .delete()
          .eq('list_id', listId);
        if (deleteError) console.error('Error clearing list_contacts:', deleteError);
      } else {
        // INSERT new list
        const { data: newList, error: listError } = await supabase
          .from('lists')
          .insert({
            org_id: userData.org_id,
            owner_id: user.id,
            name: name.trim(),
            description: description.trim() || null,
            filter_criteria: filterCriteria,
            is_shared: false,
          })
          .select()
          .single();

        if (listError) {
          console.error('Error inserting list:', listError);
          throw listError;
        }
        if (!newList) throw new Error('List was not created — no data returned');
        listId = newList.id;
      }

      // Get matching contacts and add to list_contacts junction table
      let contactQuery = supabase
        .from('contacts')
        .select('id')
        .eq('org_id', userData.org_id);

      // Apply filters to get matching contact IDs
      filters.forEach(filter => {
        if (!filter.value) return;

        if (filter.field === 'custom_field' && filter.customFieldKey) {
          const jsonbPath = `custom_fields->${filter.customFieldKey}`;
          if (filter.operator === 'equals') {
            contactQuery = contactQuery.eq(jsonbPath, filter.value);
          } else if (filter.operator === 'contains') {
            contactQuery = contactQuery.ilike(jsonbPath, `%${filter.value}%`);
          }
        } else {
          if (filter.operator === 'equals') {
            contactQuery = contactQuery.eq(filter.field, filter.value);
          } else if (filter.operator === 'contains') {
            contactQuery = contactQuery.ilike(filter.field, `%${filter.value}%`);
          } else if (filter.operator === 'starts_with') {
            contactQuery = contactQuery.ilike(filter.field, `${filter.value}%`);
          } else if (filter.operator === 'greater_than' && filter.field === 'created_at') {
            contactQuery = contactQuery.gt(filter.field, filter.value);
          } else if (filter.operator === 'less_than' && filter.field === 'created_at') {
            contactQuery = contactQuery.lt(filter.field, filter.value);
          }
        }
      });

      const { data: matchingContacts, error: contactError } = await contactQuery;
      if (contactError) console.error('Error fetching matching contacts:', contactError);

      // Insert into junction table
      if (matchingContacts && matchingContacts.length > 0) {
        const junctionRecords = matchingContacts.map((contact, index) => ({
          list_id: listId,
          contact_id: contact.id,
          position: index,
        }));

        const { error: junctionError } = await supabase
          .from('list_contacts')
          .insert(junctionRecords);
        if (junctionError) console.error('Error populating list_contacts:', junctionError);
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      console.error('Error saving list:', err);
      const message = err instanceof Error ? err.message :
        (typeof err === 'object' && err !== null && 'message' in err)
          ? String((err as { message: string }).message)
          : 'Failed to save list';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            {isEditMode ? 'Edit List' : 'Create List'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              List Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Enterprise Prospects Q1"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe this list..."
              rows={2}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          {/* Filters */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Filter Criteria
              </label>
              <button
                onClick={addFilter}
                className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
              >
                <Plus className="w-4 h-4" />
                Add Filter
              </button>
            </div>

            <div className="space-y-3">
              {filters.map((filter) => (
                <div key={filter.id} className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  {/* Field */}
                  <select
                    value={filter.field}
                    onChange={(e) => {
                      const newField = e.target.value as FilterField;
                      updateFilter(filter.id, {
                        field: newField,
                        customFieldKey: newField === 'custom_field' ? '' : undefined,
                      });
                    }}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                  >
                    <option value="company">Company</option>
                    <option value="title">Title</option>
                    <option value="domain">Domain</option>
                    <option value="source">Source</option>
                    <option value="linkedin_url">Prospect LinkedIn</option>
                    <option value="company_linkedin_url">Company LinkedIn</option>
                    <option value="twitter_handle">Prospect Twitter/X</option>
                    <option value="company_twitter">Company Twitter/X</option>
                    <option value="created_at">Date Added</option>
                    <option value="custom_field">Custom Field</option>
                  </select>

                  {/* Custom field key input */}
                  {filter.field === 'custom_field' && (
                    <input
                      type="text"
                      value={filter.customFieldKey || ''}
                      onChange={(e) => updateFilter(filter.id, { customFieldKey: e.target.value })}
                      placeholder="Field name"
                      className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                    />
                  )}

                  {/* Operator */}
                  <select
                    value={filter.operator}
                    onChange={(e) => updateFilter(filter.id, { operator: e.target.value as FilterOperator })}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                  >
                    <option value="equals">equals</option>
                    <option value="contains">contains</option>
                    <option value="starts_with">starts with</option>
                    {filter.field === 'created_at' && (
                      <>
                        <option value="greater_than">after</option>
                        <option value="less_than">before</option>
                      </>
                    )}
                  </select>

                  {/* Value */}
                  {filter.field === 'created_at' ? (
                    <input
                      type="date"
                      value={filter.value}
                      onChange={(e) => updateFilter(filter.id, { value: e.target.value })}
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                    />
                  ) : filter.field === 'source' ? (
                    <select
                      value={filter.value}
                      onChange={(e) => updateFilter(filter.id, { value: e.target.value })}
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                    >
                      <option value="">Select source</option>
                      <option value="csv">CSV</option>
                      <option value="salesforce">Salesforce</option>
                      <option value="manual">Manual</option>
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={filter.value}
                      onChange={(e) => updateFilter(filter.id, { value: e.target.value })}
                      placeholder="Value"
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                    />
                  )}

                  {/* Remove button */}
                  <button
                    onClick={() => removeFilter(filter.id)}
                    className="text-red-600 hover:text-red-700 dark:text-red-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}

              {filters.length === 0 && (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                  No filters added. Click "Add Filter" to create filter criteria.
                </p>
              )}
            </div>
          </div>

          {/* Auto-refresh toggle */}
          <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <RefreshCw className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <div className="flex-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  Auto-refresh list
                </span>
              </label>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                When enabled, the list will re-run filter criteria each time you view it
              </p>
            </div>
          </div>

          {/* Live preview */}
          {matchingCount !== null && (
            <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
              <p className="text-sm font-medium text-green-900 dark:text-green-100">
                Live Preview: <span className="font-bold">{matchingCount}</span> contacts match your filters
              </p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
              <p className="text-sm text-red-900 dark:text-red-100">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isLoading || !name.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (isEditMode ? 'Saving...' : 'Creating...') : (isEditMode ? 'Save Changes' : 'Create List')}
          </button>
        </div>
      </div>
    </div>
  );
}
