// @crumb frontend-page-lists
// UI/PAGES | load_contact_lists | display_list_cards | import_modals | list_builder | salesblock_launch | navigate_to_detail
// why: Contact list management — create, view, import, and navigate into contact lists for prospecting and SalesBlock targeting
// in:supabase(lists+list_contacts),useNavigate,ImportCSVModal+AddContactModal+ListBuilderModal+CreateSalesBlockModal+ImportSalesforceModal,getSalesforceConnection out:list cards grid with contact counts,import buttons,create list button,run SalesBlock CTA err:Salesforce connection check failure(silently disables import),list load failure(empty state)
// hazard: getSalesforceConnection called on mount — if salesforce.ts throws, error propagates and may crash the component
// hazard: list_contacts count is a separate aggregation per list — N+1 pattern; load time scales linearly with list count
// edge:frontend/src/lib/supabase.ts -> CALLS
// edge:frontend/src/lib/salesforce.ts -> CALLS
// edge:frontend/src/components/ImportCSVModal.tsx -> CALLS
// edge:frontend/src/components/ListBuilderModal.tsx -> CALLS
// edge:frontend/src/pages/ListDetailPage.tsx -> RELATES
// edge:frontend/src/App.tsx -> RELATES
// edge:lists#1 -> STEP_IN
// prompt: Add error catch around getSalesforceConnection. Batch list_contacts count into single query. Add list sorting and search.
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
    try {
      const connection = await getSalesforceConnection();
      setSalesforceConnection(connection);
    } catch (err) {
      console.error('getSalesforceConnection error (non-fatal):', err);
    }
  };

  const loadLists = async () => {
    setIsLoadingLists(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.warn('loadLists: No authenticated user found');
        return;
      }

      // Fetch lists
      const { data: listsData, error } = await supabase
        .from('lists')
        .select('id, name, description, owner_id, is_shared, filter_criteria, created_at, updated_at')
        .order('updated_at', { ascending: false })
        .limit(200);

      if (error) {
        console.error('Error fetching lists from Supabase:', error);
        throw error;
      }

      if ((listsData?.length ?? 0) >= 200) {
        console.warn('loadLists: hit 200-record limit — pagination needed');
      }

      const listIds = (listsData || []).map((l) => l.id);
      if (listIds.length === 0) {
        setLists([]);
        return;
      }

      // Single batch query for all contact counts — fixes N+1 pattern
      const { data: contactRows } = await supabase
        .from('list_contacts')
        .select('list_id')
        .in('list_id', listIds);

      const countByListId: Record<string, number> = {};
      for (const row of contactRows || []) {
        countByListId[row.list_id] = (countByListId[row.list_id] ?? 0) + 1;
      }

      // Collect unique owner IDs and batch-fetch display names
      const ownerIds = [...new Set((listsData || []).map((l) => l.owner_id))];
      const { data: ownerRows } = await supabase
        .from('users')
        .select('id, display_name')
        .in('id', ownerIds);

      const nameByOwnerId: Record<string, string> = {};
      for (const row of ownerRows || []) {
        nameByOwnerId[row.id] = row.display_name || 'Unknown';
      }

      const listsWithCounts = (listsData || []).map((list) => ({
        ...list,
        contact_count: countByListId[list.id] ?? 0,
        owner_name: nameByOwnerId[list.owner_id] ?? 'Unknown',
      }));

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
    <div className="min-h-full bg-gray-50 dark:bg-void-950 p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="vv-section-title mb-1">Prospecting</p>
          <h1 className="font-display text-3xl font-bold text-gray-900 dark:text-white">
            Contact Lists
          </h1>
        </div>

        <div className="flex gap-2 flex-wrap justify-end">
          <button
            onClick={() => setIsCreateSalesBlockOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-electric hover:bg-indigo-electric/80 text-white rounded-lg text-sm font-semibold transition-all duration-200 ease-snappy"
          >
            <Clock className="w-4 h-4" />
            Create SalesBlock
          </button>
          <button
            onClick={() => setIsListBuilderOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white rounded-lg text-sm font-semibold hover:bg-gray-50 dark:hover:bg-white/10 transition-all duration-200 ease-snappy"
          >
            <List className="w-4 h-4" />
            Create List
          </button>
          <button
            onClick={() => setIsAddContactModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white rounded-lg text-sm font-semibold hover:bg-gray-50 dark:hover:bg-white/10 transition-all duration-200 ease-snappy"
          >
            <Plus className="w-4 h-4" />
            Add Contact
          </button>
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white rounded-lg text-sm font-semibold hover:bg-gray-50 dark:hover:bg-white/10 transition-all duration-200 ease-snappy"
          >
            <Upload className="w-4 h-4" />
            Import CSV
          </button>
          {salesforceConnection && (
            <button
              onClick={() => setIsImportSalesforceModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white rounded-lg text-sm font-semibold hover:bg-gray-50 dark:hover:bg-white/10 transition-all duration-200 ease-snappy"
            >
              <Database className="w-4 h-4" />
              Import from Salesforce
            </button>
          )}
        </div>
      </div>

      {/* Lists Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-white/5 border-b border-gray-200 dark:border-white/10">
              <tr>
                <th className="px-6 py-3 text-left">
                  <span className="vv-section-title">Name</span>
                </th>
                <th className="px-6 py-3 text-left">
                  <span className="vv-section-title">Description</span>
                </th>
                <th className="px-6 py-3 text-left">
                  <span className="vv-section-title">Contacts</span>
                </th>
                <th className="px-6 py-3 text-left">
                  <span className="vv-section-title">Owner</span>
                </th>
                <th className="px-6 py-3 text-left">
                  <span className="vv-section-title">Last Updated</span>
                </th>
                <th className="px-6 py-3 text-left">
                  <span className="vv-section-title">Auto-Refresh</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-white/10">
              {isLoadingLists ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="flex items-center justify-center gap-3 text-gray-400 dark:text-white/40">
                      <div className="w-5 h-5 border-2 border-indigo-electric border-t-transparent rounded-full animate-spin" />
                      <span className="font-mono text-sm tracking-widest uppercase">Loading Lists...</span>
                    </div>
                  </td>
                </tr>
              ) : lists.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center">
                    <List className="w-10 h-10 text-gray-300 dark:text-white/20 mx-auto mb-3" />
                    <p className="font-display font-semibold text-gray-900 dark:text-white mb-1">No lists yet</p>
                    <p className="text-sm text-gray-400 dark:text-white/40">
                      Click "Create List" to build your first filtered contact list
                    </p>
                  </td>
                </tr>
              ) : (
                lists.map((list) => (
                  <tr
                    key={list.id}
                    onClick={() => navigate(`/lists/${list.id}`)}
                    className="hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer transition-colors duration-150 ease-snappy"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {list.name}
                        </div>
                        {list.is_shared && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-electric/15 text-indigo-electric">
                            Shared
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-600 dark:text-white/50 max-w-xs truncate">
                        {list.description || '—'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1 text-sm text-gray-900 dark:text-white">
                        <Users className="w-4 h-4 text-gray-400 dark:text-white/30" />
                        {list.contact_count}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-600 dark:text-white/50">
                        {list.owner_name}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-600 dark:text-white/50 font-mono">
                        {formatDate(list.updated_at)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1">
                        {list.filter_criteria?.autoRefresh ? (
                          <>
                            <RefreshCw className="w-4 h-4 text-emerald-signal" />
                            <span className="text-sm text-emerald-signal font-semibold">On</span>
                          </>
                        ) : (
                          <span className="text-sm text-gray-400 dark:text-white/30">Off</span>
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
