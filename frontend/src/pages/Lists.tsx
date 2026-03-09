/**
 * @crumb
 * @id frontend-page-lists
 * @area UI/Pages
 * @intent Contact list management — create, view, import, and navigate into contact lists for prospecting and SalesBlock targeting
 * @responsibilities Load user's contact lists, display list cards with contact count and metadata, open import modals (CSV/Salesforce), open ListBuilderModal, open CreateSalesBlockModal, navigate to ListDetailPage
 * @contracts Lists() → JSX; reads lists table + list_contacts count from Supabase; uses useNavigate; uses getSalesforceConnection for integration check
 * @in supabase (lists + list_contacts tables), useNavigate, ImportCSVModal + AddContactModal + ListBuilderModal + CreateSalesBlockModal + ImportSalesforceModal components, getSalesforceConnection lib
 * @out List cards grid with contact counts, import buttons, create list button, run SalesBlock CTA
 * @err Salesforce connection check failure (silently disables import button); list load failure (empty state renders)
 * @hazard getSalesforceConnection is called on mount to check integration status — if salesforce.ts throws, the error propagates and may crash the component (no catch)
 * @hazard list_contacts count is a separate aggregation query per list — N+1 pattern if many lists exist; page load time scales linearly with list count
 * @shared-edges frontend/src/lib/supabase.ts→QUERIES lists+list_contacts; frontend/src/lib/salesforce.ts→CALLS getSalesforceConnection; frontend/src/components/ImportCSVModal.tsx→LAUNCHES; frontend/src/components/ListBuilderModal.tsx→LAUNCHES; frontend/src/pages/ListDetailPage.tsx→NAVIGATES to; frontend/src/App.tsx→ROUTES to /lists
 * @trail lists#1 | Lists mounts → load lists + contact counts → render cards → user clicks list → navigate to ListDetailPage → user creates → ListBuilderModal → user imports → CSV or Salesforce modal
 * @prompt Add error catch around getSalesforceConnection. Batch list_contacts count into single query. Add list sorting (by size, recency). Add list search.
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, Plus, List, RefreshCw, Users, Clock, Database } from 'lucide-react';
import ImportCSVModal from '../components/ImportCSVModal';
import { AddContactModal } from '../components/AddContactModal';
import ListBuilderModal from '../components/ListBuilderModal';
import { CreateSalesBlockModal } from '../components/CreateSalesBlockModal';
import ImportSalesforceModal from '../components/ImportSalesforceModal';
import { supabase } from '../lib/supabase';
import { getSalesforceConnection } from '../lib/salesforce';

interface ListRecord {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
  is_shared: boolean;
  filter_criteria: {
    autoRefresh?: boolean;
  };
  created_at: string;
  updated_at: string;
  contact_count?: number;
  owner_name?: string;
}

export default function Lists() {
  const navigate = useNavigate();
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isImportSalesforceModalOpen, setIsImportSalesforceModalOpen] = useState(false);
  const [isAddContactModalOpen, setIsAddContactModalOpen] = useState(false);
  const [isListBuilderOpen, setIsListBuilderOpen] = useState(false);
  const [isCreateSalesBlockOpen, setIsCreateSalesBlockOpen] = useState(false);
  const [lists, setLists] = useState<ListRecord[]>([]);
  const [isLoadingLists, setIsLoadingLists] = useState(true);
  const [salesforceConnection, setSalesforceConnection] = useState<{
    access_token: string;
    instance_url: string;
  } | null>(null);

  useEffect(() => {
    loadLists();
    checkSalesforceConnection();
  }, []);

  const checkSalesforceConnection = async () => {
    const connection = await getSalesforceConnection();
    setSalesforceConnection(connection);
  };

  const loadLists = async () => {
    setIsLoadingLists(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.warn('loadLists: No authenticated user found');
        return;
      }

      // Fetch lists with owner info
      const { data: listsData, error } = await supabase
        .from('lists')
        .select(`
          id,
          name,
          description,
          owner_id,
          is_shared,
          filter_criteria,
          created_at,
          updated_at
        `)
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('Error fetching lists from Supabase:', error);
        throw error;
      }

      console.log(`loadLists: Fetched ${listsData?.length ?? 0} lists from Supabase`);

      // For each list, count contacts and get owner — each sub-query is wrapped
      // individually so one failure doesn't kill the entire list display
      const listsWithCounts = await Promise.all(
        (listsData || []).map(async (list) => {
          let contactCount = 0;
          let ownerName = 'Unknown';

          // Get contact count — wrapped individually
          try {
            const { count, error: countError } = await supabase
              .from('list_contacts')
              .select('contact_id', { count: 'exact', head: true })
              .eq('list_id', list.id);

            if (countError) {
              console.error(`Error counting contacts for list ${list.id}:`, countError);
            } else {
              contactCount = count || 0;
            }
          } catch (countErr) {
            console.error(`Exception counting contacts for list ${list.id}:`, countErr);
          }

          // Get owner name — wrapped individually
          try {
            const { data: ownerData, error: ownerError } = await supabase
              .from('users')
              .select('display_name')
              .eq('id', list.owner_id)
              .single();

            if (ownerError) {
              console.error(`Error fetching owner for list ${list.id}:`, ownerError);
            } else {
              ownerName = ownerData?.display_name || 'Unknown';
            }
          } catch (ownerErr) {
            console.error(`Exception fetching owner for list ${list.id}:`, ownerErr);
          }

          return {
            ...list,
            contact_count: contactCount,
            owner_name: ownerName,
          };
        })
      );

      setLists(listsWithCounts);
    } catch (err) {
      console.error('Error loading lists:', err);
    } finally {
      setIsLoadingLists(false);
    }
  };

  const handleImportComplete = () => {
    loadLists();
  };

  const handleContactCreated = () => {
    loadLists();
  };

  const handleListCreated = () => {
    loadLists();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(date);
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Contact Lists
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage your contact lists and segments
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setIsCreateSalesBlockOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
          >
            <Clock className="w-4 h-4" />
            Create SalesBlock
          </button>
          <button
            onClick={() => setIsListBuilderOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            <List className="w-4 h-4" />
            Create List
          </button>
          <button
            onClick={() => setIsAddContactModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            <Plus className="w-4 h-4" />
            Add Contact
          </button>
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Upload className="w-4 h-4" />
            Import CSV
          </button>
          {salesforceConnection && (
            <button
              onClick={() => setIsImportSalesforceModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              <Database className="w-4 h-4" />
              Import from Salesforce
            </button>
          )}
        </div>
      </div>

      {/* Lists Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Description
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Contacts
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Owner
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Last Updated
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Auto-Refresh
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {isLoadingLists ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                    Loading lists...
                  </td>
                </tr>
              ) : lists.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <List className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-500 dark:text-gray-400 mb-2">No lists created yet</p>
                    <p className="text-sm text-gray-400 dark:text-gray-500">
                      Click "Create List" to build your first filtered contact list
                    </p>
                  </td>
                </tr>
              ) : (
                lists.map((list) => (
                  <tr
                    key={list.id}
                    onClick={() => navigate(`/lists/${list.id}`)}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {list.name}
                        </div>
                        {list.is_shared && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                            Shared
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-600 dark:text-gray-400 max-w-xs truncate">
                        {list.description || '—'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1 text-sm text-gray-900 dark:text-white">
                        <Users className="w-4 h-4 text-gray-400" />
                        {list.contact_count}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {list.owner_name}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {formatDate(list.updated_at)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1">
                        {list.filter_criteria?.autoRefresh ? (
                          <>
                            <RefreshCw className="w-4 h-4 text-green-600 dark:text-green-400" />
                            <span className="text-sm text-green-600 dark:text-green-400">On</span>
                          </>
                        ) : (
                          <span className="text-sm text-gray-400 dark:text-gray-500">Off</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AddContactModal
        isOpen={isAddContactModalOpen}
        onClose={() => setIsAddContactModalOpen(false)}
        onSuccess={handleContactCreated}
      />

      <ImportCSVModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportComplete={handleImportComplete}
      />

      <ListBuilderModal
        isOpen={isListBuilderOpen}
        onClose={() => setIsListBuilderOpen(false)}
        onSuccess={handleListCreated}
      />

      <CreateSalesBlockModal
        isOpen={isCreateSalesBlockOpen}
        onClose={() => setIsCreateSalesBlockOpen(false)}
        onSuccess={() => {
          setIsCreateSalesBlockOpen(false);
          // No need to reload lists - salesblock creation doesn't affect list data
        }}
      />

      {salesforceConnection && (
        <ImportSalesforceModal
          isOpen={isImportSalesforceModalOpen}
          onClose={() => setIsImportSalesforceModalOpen(false)}
          onSuccess={handleImportComplete}
          accessToken={salesforceConnection.access_token}
          instanceUrl={salesforceConnection.instance_url}
        />
      )}
    </div>
  );
}
