// @crumb frontend-page-list-detail
// UI/PAGES | load_list_metadata | render_sortable_contact_table | render_account_table | checkbox_selection | bulk_remove | single_remove | action_modals | salesblock_launch | list_edit
// why: List detail view — browse, search, sort, bulk-select, and act on contacts or accounts in a specific list
import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, UserMinus, Play, ChevronUp, ChevronDown, Mail, Share2, Calendar, Pencil, Trash2, AlertTriangle, Building2, Globe, Briefcase } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { ROUTES, getSalesBlocksRoute } from '../lib/routes';
import ListBuilderModal from '../components/ListBuilderModal';
import ComposeEmailModal from '../components/ComposeEmailModal';
import LogSocialActivityModal from '../components/LogSocialActivityModal';
import BookMeetingModal from '../components/BookMeetingModal';

interface Contact {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  company: string | null;
  title: string | null;
  created_at: string;
  last_activity_date?: string | null;
}

interface Account {
  id: string;
  name: string;
  domain: string | null;
  industry: string | null;
  created_at: string;
}

interface ListDetail {
  id: string;
  name: string;
  description: string | null;
  filter_criteria: Record<string, unknown> | null;
  is_shared: boolean;
  owner_id: string;
  list_type: string | null;
}

type SortField = 'name' | 'company' | 'title' | 'email' | 'phone' | 'last_activity_date';
type SortDirection = 'asc' | 'desc';

export default function ListDetailPage() {
  const { listId } = useParams<{ listId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [listDetail, setListDetail] = useState<ListDetail | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [filteredAccounts, setFilteredAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [isSocialModalOpen, setIsSocialModalOpen] = useState(false);
  const [isMeetingModalOpen, setIsMeetingModalOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [orgId, setOrgId] = useState<string>('');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set());
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [pageSize, setPageSize] = useState<number>(25);
  const [currentPage, setCurrentPage] = useState(1);
  const listDetailRef = useRef<ListDetail | null>(null);

  const isAccountList = listDetail?.list_type === 'accounts';

  useEffect(() => {
    if (listId) {
      loadListDetail().then(() => {
        // loadContacts or loadAccounts happens after list_type is known
      });
    }
  }, [listId]);

  // Load the correct data once listDetail is available
  useEffect(() => {
    if (!listDetail) return;
    if (listDetail.list_type === 'accounts') {
      loadAccounts();
    } else {
      loadContacts(sortField, sortDirection);
    }
  }, [listDetail?.id, listDetail?.list_type]);

  useEffect(() => {
    if (!isLoading && !isAccountList && contacts.length > 0) {
      loadContacts(sortField, sortDirection);
    }
  }, [sortField, sortDirection]);

  useEffect(() => {
    if (!user) return;

    async function loadOrgId() {
      const { data, error } = await supabase
        .from('users')
        .select('org_id')
        .eq('id', user!.id)
        .single();

      if (error) {
        console.error('Error loading org_id:', error);
      } else if (data) {
        setOrgId(data.org_id);
      }
    }

    loadOrgId();
  }, [user]);

  // Filter contacts based on search query
  useEffect(() => {
    if (isAccountList) return;
    if (searchQuery.trim() === '') {
      setFilteredContacts(contacts);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = contacts.filter((contact) => {
        const fullName = `${contact.first_name} ${contact.last_name}`.toLowerCase();
        const email = contact.email.toLowerCase();
        const company = (contact.company || '').toLowerCase();
        return fullName.includes(query) || email.includes(query) || company.includes(query);
      });
      setFilteredContacts(filtered);
    }
    setCurrentPage(1);
  }, [searchQuery, contacts, isAccountList]);

  // Filter accounts based on search query
  useEffect(() => {
    if (!isAccountList) return;
    if (searchQuery.trim() === '') {
      setFilteredAccounts(accounts);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = accounts.filter((account) => {
        const name = account.name.toLowerCase();
        const domain = (account.domain || '').toLowerCase();
        const industry = (account.industry || '').toLowerCase();
        return name.includes(query) || domain.includes(query) || industry.includes(query);
      });
      setFilteredAccounts(filtered);
    }
    setCurrentPage(1);
  }, [searchQuery, accounts, isAccountList]);

  useEffect(() => {
    if (isAccountList) return;
    if (sortField !== 'last_activity_date') return;
    const sorted = [...filteredContacts].sort((a, b) => {
      const aVal = a.last_activity_date || '';
      const bVal = b.last_activity_date || '';
      const comparison = aVal.localeCompare(bVal);
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    setFilteredContacts(sorted);
  }, [sortField, sortDirection]);

  const loadListDetail = async () => {
    try {
      const { data, error } = await supabase
        .from('lists')
        .select('id, name, description, filter_criteria, is_shared, owner_id, list_type')
        .eq('id', listId)
        .single();

      if (error) throw error;
      setListDetail(data);
      listDetailRef.current = data;
    } catch (err) {
      console.error('Error loading list detail:', err);
    }
  };

  const loadAccounts = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const { data: listItems, error: listItemsError } = await supabase
        .from('account_list_items')
        .select('account_id')
        .eq('list_id', listId);

      if (listItemsError) throw listItemsError;

      const accountIds = (listItems || []).map((li) => li.account_id);

      if (accountIds.length === 0) {
        setAccounts([]);
        setFilteredAccounts([]);
        setIsLoading(false);
        return;
      }

      // Fetch accounts in chunks
      const CHUNK_SIZE = 200;
      let allAccounts: Account[] = [];
      for (let i = 0; i < accountIds.length; i += CHUNK_SIZE) {
        const chunk = accountIds.slice(i, i + CHUNK_SIZE);
        const { data: accountsData, error: accountsError } = await supabase
          .from('accounts')
          .select('id, name, domain, industry, created_at')
          .in('id', chunk)
          .order('name', { ascending: true });

        if (accountsError) throw accountsError;
        allAccounts = allAccounts.concat(accountsData || []);
      }

      setAccounts(allAccounts);
      setFilteredAccounts(allAccounts);
    } catch (err) {
      console.error('Error loading accounts:', err);
      setLoadError(err instanceof Error ? err.message : 'Failed to load accounts');
    } finally {
      setIsLoading(false);
    }
  };

  const loadContacts = async (sortBy: SortField = 'name', sortDir: SortDirection = 'asc') => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const { data: listContactsData, error: listContactsError } = await supabase
        .from('list_contacts')
        .select('contact_id')
        .eq('list_id', listId);

      if (listContactsError) throw listContactsError;

      let contactIds = (listContactsData || []).map((lc) => lc.contact_id);

      // Fallback: if list_contacts is empty, re-resolve via filter_criteria
      const currentList = listDetailRef.current;
      if (contactIds.length === 0 && currentList?.filter_criteria) {
        const filters = (currentList.filter_criteria as { filters?: Array<{ field: string; operator: string; value: string; customFieldKey?: string }> }).filters;
        if (filters && filters.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          let contactQuery: any = supabase
            .from('contacts')
            .select('id');

          for (const filter of filters) {
            if (!filter.value) continue;
            if (filter.field === 'custom_field' && filter.customFieldKey) {
              const jsonbPath = `custom_fields->${filter.customFieldKey}`;
              if (filter.operator === 'equals') contactQuery = contactQuery.eq(jsonbPath, filter.value);
              else if (filter.operator === 'contains') contactQuery = contactQuery.ilike(jsonbPath, `%${filter.value}%`);
            } else {
              if (filter.operator === 'equals') contactQuery = contactQuery.eq(filter.field, filter.value);
              else if (filter.operator === 'contains') contactQuery = contactQuery.ilike(filter.field, `%${filter.value}%`);
              else if (filter.operator === 'starts_with') contactQuery = contactQuery.ilike(filter.field, `${filter.value}%`);
              else if (filter.operator === 'greater_than' && filter.field === 'created_at') contactQuery = contactQuery.gt(filter.field, filter.value);
              else if (filter.operator === 'less_than' && filter.field === 'created_at') contactQuery = contactQuery.lt(filter.field, filter.value);
            }
          }

          const { data: resolvedContacts } = await contactQuery;
          const resolved = (resolvedContacts ?? []) as { id: string }[];
          if (resolved.length > 0) {
            const BATCH_SIZE = 500;
            for (let i = 0; i < resolved.length; i += BATCH_SIZE) {
              const batch = resolved.slice(i, i + BATCH_SIZE).map((c, idx) => ({
                list_id: listId!,
                contact_id: c.id,
                position: i + idx,
              }));
              await supabase.from('list_contacts').insert(batch);
            }
            contactIds = resolved.map((c) => c.id);
          }
        }
      }

      if (contactIds.length === 0) {
        setContacts([]);
        setFilteredContacts([]);
        setIsLoading(false);
        return;
      }

      const CHUNK_SIZE = 200;
      const serverSortColumn = sortBy === 'name' ? 'first_name'
        : sortBy === 'last_activity_date' ? null
        : sortBy;
      let allContactsData: typeof contacts = [];
      for (let i = 0; i < contactIds.length; i += CHUNK_SIZE) {
        const chunk = contactIds.slice(i, i + CHUNK_SIZE);
        let contactsQuery = supabase
          .from('contacts')
          .select('id, first_name, last_name, email, phone, company, title, created_at')
          .in('id', chunk);
        if (serverSortColumn) {
          contactsQuery = contactsQuery.order(serverSortColumn, { ascending: sortDir === 'asc' });
        }
        const { data: contactsData, error: contactsError } = await contactsQuery;

        if (contactsError) throw contactsError;
        allContactsData = allContactsData.concat(contactsData || []);
      }

      // Batch-fetch last activity dates
      const activityMap = new Map<string, string>();
      try {
        for (let i = 0; i < contactIds.length; i += CHUNK_SIZE) {
          const chunk = contactIds.slice(i, i + CHUNK_SIZE);
          const { data: actData } = await supabase
            .from('activities')
            .select('contact_id, created_at')
            .in('contact_id', chunk)
            .order('created_at', { ascending: false });

          for (const row of actData || []) {
            if (!activityMap.has(row.contact_id)) {
              activityMap.set(row.contact_id, row.created_at);
            }
          }
        }
      } catch {
        // Activity dates are non-critical
      }

      const contactsWithActivity = allContactsData.map((contact) => ({
        ...contact,
        last_activity_date: activityMap.get(contact.id) || null,
      }));

      setContacts(contactsWithActivity);
      setFilteredContacts(contactsWithActivity);
    } catch (err) {
      console.error('Error loading contacts:', err);
      setLoadError(err instanceof Error ? err.message : 'Failed to load contacts');
    } finally {
      setIsLoading(false);
    }
  };

  // Pagination computed values
  const currentItems = isAccountList ? filteredAccounts : filteredContacts;
  const totalPages = Math.ceil(currentItems.length / pageSize);
  const paginatedItems = currentItems.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );
  const paginationStart = currentItems.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const paginationEnd = Math.min(currentPage * pageSize, currentItems.length);

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setCurrentPage(1);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleRemoveContact = async (contactId: string) => {
    if (!confirm('Remove this contact from the list?')) return;

    try {
      const { error } = await supabase
        .from('list_contacts')
        .delete()
        .eq('list_id', listId)
        .eq('contact_id', contactId);

      if (error) throw error;
      loadContacts();
    } catch (err) {
      console.error('Error removing contact:', err);
      alert('Failed to remove contact from list');
    }
  };

  const handleRemoveAccount = async (accountId: string) => {
    if (!confirm('Remove this account from the list?')) return;

    try {
      const { error } = await supabase
        .from('account_list_items')
        .delete()
        .eq('list_id', listId)
        .eq('account_id', accountId);

      if (error) throw error;
      loadAccounts();
    } catch (err) {
      console.error('Error removing account:', err);
      alert('Failed to remove account from list');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedContactIds.size === 0) return;
    setIsDeleting(true);

    try {
      const ids = Array.from(selectedContactIds);
      const CHUNK_SIZE = 200;
      const tableName = isAccountList ? 'account_list_items' : 'list_contacts';
      const idColumn = isAccountList ? 'account_id' : 'contact_id';

      for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
        const chunk = ids.slice(i, i + CHUNK_SIZE);
        const { error } = await supabase
          .from(tableName)
          .delete()
          .eq('list_id', listId)
          .in(idColumn, chunk);

        if (error) throw error;
      }

      setSelectedContactIds(new Set());
      setIsDeleteModalOpen(false);
      if (isAccountList) {
        loadAccounts();
      } else {
        loadContacts();
      }
    } catch (err) {
      console.error('Error removing items:', err);
      alert('Failed to remove some items from list');
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleSelectContact = (contactId: string) => {
    setSelectedContactIds((prev) => {
      const next = new Set(prev);
      if (next.has(contactId)) {
        next.delete(contactId);
      } else {
        next.add(contactId);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedContactIds.size === currentItems.length) {
      setSelectedContactIds(new Set());
    } else {
      setSelectedContactIds(new Set(currentItems.map((c) => c.id)));
    }
  };

  const handleStartSalesBlock = () => {
    navigate(getSalesBlocksRoute(listId));
  };

  const handleEmailClick = (contact: Contact) => {
    setSelectedContact(contact);
    setIsEmailModalOpen(true);
  };

  const handleSocialClick = (contact: Contact) => {
    setSelectedContact(contact);
    setIsSocialModalOpen(true);
  };

  const handleMeetingClick = (contact: Contact) => {
    setSelectedContact(contact);
    setIsMeetingModalOpen(true);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '\u2014';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(date);
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? (
      <ChevronUp className="w-4 h-4 inline ml-1" />
    ) : (
      <ChevronDown className="w-4 h-4 inline ml-1" />
    );
  };

  if (!listDetail) {
    return (
      <div className="min-h-full bg-gray-50 dark:bg-void-950 p-6 flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-400 dark:text-white/40">
          <div className="w-5 h-5 border-2 border-indigo-electric border-t-transparent rounded-full animate-spin" />
          <span className="font-mono text-sm tracking-widest uppercase">Loading List...</span>
        </div>
      </div>
    );
  }

  const itemLabel = isAccountList ? 'account' : 'contact';
  const itemCount = isAccountList ? accounts.length : contacts.length;

  return (
    <div className="min-h-full bg-gray-50 dark:bg-void-950 p-6 space-y-6">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate(ROUTES.LISTS)}
          className="flex items-center gap-2 text-gray-500 dark:text-white/40 hover:text-gray-900 dark:hover:text-white mb-4 transition-colors duration-150"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Lists
        </button>

        <div className="flex items-center justify-between">
          <div>
            <p className="vv-section-title mb-1">
              {isAccountList ? 'Account Lists' : 'Lists'}
            </p>
            <h1 className="font-display text-3xl font-bold text-gray-900 dark:text-white mb-2">
              {listDetail.name}
            </h1>
            {listDetail.description && (
              <p className="text-gray-600 dark:text-white/50">{listDetail.description}</p>
            )}
            {!isLoading && (
              <p className="text-sm text-gray-400 dark:text-white/30 mt-1">
                {itemCount} {itemLabel}{itemCount !== 1 ? 's' : ''}
              </p>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsEditModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-white/10 text-gray-700 dark:text-white/70 rounded-lg hover:bg-gray-100 dark:hover:bg-white/[0.08] transition-all duration-150 ease-snappy"
            >
              <Pencil className="w-4 h-4" />
              Edit List
            </button>
            {!isAccountList && (
              <button
                onClick={handleStartSalesBlock}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-electric hover:bg-indigo-electric/80 text-white rounded-lg transition-all duration-200 ease-snappy"
              >
                <Play className="w-4 h-4" />
                Start SalesBlock
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
          <input
            type="text"
            placeholder={isAccountList
              ? 'Search accounts by name, domain, or industry...'
              : 'Search contacts by name, email, or company...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-indigo-electric focus:outline-none bg-white dark:bg-white/5 text-gray-900 dark:text-white transition-colors duration-150"
          />
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selectedContactIds.size > 0 && (
        <div className="flex items-center justify-between px-4 py-3 bg-indigo-50 dark:bg-indigo-electric/10 border border-indigo-200 dark:border-indigo-electric/20 rounded-lg">
          <span className="text-sm font-medium text-indigo-700 dark:text-indigo-electric">
            {selectedContactIds.size} {itemLabel}{selectedContactIds.size !== 1 ? 's' : ''} selected
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedContactIds(new Set())}
              className="text-sm text-gray-500 dark:text-white/40 hover:text-gray-700 dark:hover:text-white/70 transition-colors"
            >
              Clear selection
            </button>
            <button
              onClick={() => setIsDeleteModalOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Remove from list
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="glass-card">
        <div className="overflow-x-auto">
          {isAccountList ? (
            /* ===== ACCOUNTS TABLE ===== */
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-white/5">
                <tr>
                  <th className="px-3 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={filteredAccounts.length > 0 && selectedContactIds.size === filteredAccounts.length}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded border-gray-300 dark:border-white/20 text-indigo-electric focus:ring-indigo-electric cursor-pointer"
                    />
                  </th>
                  <th className="px-6 py-3 text-left vv-section-title min-w-[200px]">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left vv-section-title min-w-[180px]">
                    Domain
                  </th>
                  <th className="px-6 py-3 text-left vv-section-title min-w-[150px]">
                    Industry
                  </th>
                  <th className="px-6 py-3 text-left vv-section-title">
                    Created
                  </th>
                  <th className="px-6 py-3 text-right vv-section-title sticky right-0 bg-gray-50 dark:bg-white/5">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-white/10">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <div className="flex items-center justify-center gap-3 text-gray-400 dark:text-white/40">
                        <div className="w-5 h-5 border-2 border-indigo-electric border-t-transparent rounded-full animate-spin" />
                        <span className="font-mono text-sm">Loading accounts...</span>
                      </div>
                    </td>
                  </tr>
                ) : loadError ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <p className="text-red-500 dark:text-red-alert mb-2">Failed to load accounts</p>
                      <p className="text-sm text-gray-400 dark:text-white/30 mb-3">{loadError}</p>
                      <button
                        onClick={() => loadAccounts()}
                        className="text-sm text-indigo-electric hover:text-indigo-electric/70 transition-colors"
                      >
                        Try again
                      </button>
                    </td>
                  </tr>
                ) : filteredAccounts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <Building2 className="w-10 h-10 text-gray-300 dark:text-white/20 mx-auto mb-3" />
                      <p className="text-gray-500 dark:text-white/50 mb-2">
                        {searchQuery ? 'No accounts match your search' : 'No accounts in this list'}
                      </p>
                      <p className="text-sm text-gray-400 dark:text-white/30">
                        {searchQuery ? 'Try a different search term' : 'Import accounts from Attio or add them manually'}
                      </p>
                    </td>
                  </tr>
                ) : (
                  (paginatedItems as Account[]).map((account) => (
                    <tr key={account.id} className="hover:bg-gray-50 dark:hover:bg-white/[0.08] transition-all duration-150">
                      <td className="px-3 py-4 w-10">
                        <input
                          type="checkbox"
                          checked={selectedContactIds.has(account.id)}
                          onChange={() => toggleSelectContact(account.id)}
                          className="w-4 h-4 rounded border-gray-300 dark:border-white/20 text-indigo-electric focus:ring-indigo-electric cursor-pointer"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap min-w-[200px]">
                        <button
                          onClick={() =>
                            navigate(`/accounts/${account.id}`, {
                              state: { returnPath: `/lists/${listId}` },
                            })
                          }
                          className="flex items-center gap-2 font-display text-sm font-medium text-indigo-electric hover:text-indigo-electric/70 transition-colors duration-150 text-left"
                        >
                          <Building2 className="w-4 h-4 flex-shrink-0" />
                          {account.name}
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap min-w-[180px]">
                        {account.domain ? (
                          <a
                            href={`https://${account.domain}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-sm text-indigo-electric hover:text-indigo-electric/70 transition-colors duration-150"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Globe className="w-3 h-3" />
                            {account.domain}
                          </a>
                        ) : (
                          <span className="text-sm text-gray-400 dark:text-white/30">{'\u2014'}</span>
                        )}
                      </td>
                      <td className="px-6 py-4 max-w-[150px]">
                        {account.industry ? (
                          <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-white/50">
                            <Briefcase className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate" title={account.industry}>{account.industry}</span>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400 dark:text-white/30">{'\u2014'}</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-600 dark:text-white/40 font-mono">
                          {formatDate(account.created_at)}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right sticky right-0 bg-white dark:bg-void-950">
                        <button
                          onClick={() => handleRemoveAccount(account.id)}
                          className="text-red-alert hover:text-red-alert/70 transition-colors duration-150"
                          title="Remove from list"
                        >
                          <UserMinus className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : (
            /* ===== CONTACTS TABLE ===== */
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-white/5">
                <tr>
                  <th className="px-3 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={filteredContacts.length > 0 && selectedContactIds.size === filteredContacts.length}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded border-gray-300 dark:border-white/20 text-indigo-electric focus:ring-indigo-electric cursor-pointer"
                    />
                  </th>
                  <th
                    onClick={() => handleSort('name')}
                    className="px-6 py-3 text-left vv-section-title cursor-pointer hover:bg-gray-100 dark:hover:bg-white/[0.08] transition-colors duration-150 min-w-[200px]"
                  >
                    Name <SortIcon field="name" />
                  </th>
                  <th
                    onClick={() => handleSort('company')}
                    className="px-6 py-3 text-left vv-section-title cursor-pointer hover:bg-gray-100 dark:hover:bg-white/[0.08] transition-colors duration-150 min-w-[180px]"
                  >
                    Company <SortIcon field="company" />
                  </th>
                  <th
                    onClick={() => handleSort('title')}
                    className="px-6 py-3 text-left vv-section-title cursor-pointer hover:bg-gray-100 dark:hover:bg-white/[0.08] transition-colors duration-150 max-w-[150px]"
                  >
                    Title <SortIcon field="title" />
                  </th>
                  <th
                    onClick={() => handleSort('email')}
                    className="px-6 py-3 text-left vv-section-title cursor-pointer hover:bg-gray-100 dark:hover:bg-white/[0.08] transition-colors duration-150 min-w-[200px]"
                  >
                    Email <SortIcon field="email" />
                  </th>
                  <th
                    onClick={() => handleSort('phone')}
                    className="px-6 py-3 text-left vv-section-title cursor-pointer hover:bg-gray-100 dark:hover:bg-white/[0.08] transition-colors duration-150"
                  >
                    Phone <SortIcon field="phone" />
                  </th>
                  <th
                    onClick={() => handleSort('last_activity_date')}
                    className="px-6 py-3 text-left vv-section-title cursor-pointer hover:bg-gray-100 dark:hover:bg-white/[0.08] transition-colors duration-150"
                  >
                    Last Activity <SortIcon field="last_activity_date" />
                  </th>
                  <th className="px-6 py-3 text-right vv-section-title sticky right-0 bg-gray-50 dark:bg-white/5">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-white/10">
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center">
                      <div className="flex items-center justify-center gap-3 text-gray-400 dark:text-white/40">
                        <div className="w-5 h-5 border-2 border-indigo-electric border-t-transparent rounded-full animate-spin" />
                        <span className="font-mono text-sm">Loading contacts...</span>
                      </div>
                    </td>
                  </tr>
                ) : loadError ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center">
                      <p className="text-red-500 dark:text-red-alert mb-2">Failed to load contacts</p>
                      <p className="text-sm text-gray-400 dark:text-white/30 mb-3">{loadError}</p>
                      <button
                        onClick={() => loadContacts()}
                        className="text-sm text-indigo-electric hover:text-indigo-electric/70 transition-colors"
                      >
                        Try again
                      </button>
                    </td>
                  </tr>
                ) : filteredContacts.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center">
                      <p className="text-gray-500 dark:text-white/50 mb-2">
                        {searchQuery ? 'No contacts match your search' : 'No contacts in this list'}
                      </p>
                      <p className="text-sm text-gray-400 dark:text-white/30">
                        {searchQuery ? 'Try a different search term' : 'Edit the list filters or import contacts via CSV'}
                      </p>
                    </td>
                  </tr>
                ) : (
                  (paginatedItems as Contact[]).map((contact) => (
                    <tr key={contact.id} className="hover:bg-gray-50 dark:hover:bg-white/[0.08] transition-all duration-150">
                      <td className="px-3 py-4 w-10">
                        <input
                          type="checkbox"
                          checked={selectedContactIds.has(contact.id)}
                          onChange={() => toggleSelectContact(contact.id)}
                          className="w-4 h-4 rounded border-gray-300 dark:border-white/20 text-indigo-electric focus:ring-indigo-electric cursor-pointer"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap min-w-[200px]">
                        <button
                          onClick={() =>
                            navigate(`/contacts/${contact.id}`, {
                              state: { returnPath: `/lists/${listId}` },
                            })
                          }
                          className="font-display text-sm font-medium text-indigo-electric hover:text-indigo-electric/70 transition-colors duration-150 text-left"
                        >
                          {contact.first_name} {contact.last_name}
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap min-w-[180px]">
                        <div className="text-sm text-gray-600 dark:text-white/50">
                          {contact.company || '\u2014'}
                        </div>
                      </td>
                      <td className="px-6 py-4 max-w-[150px]">
                        <div className="text-sm text-gray-600 dark:text-white/50 truncate" title={contact.title || undefined}>
                          {contact.title || '\u2014'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap min-w-[200px]">
                        <a
                          href={`mailto:${contact.email}`}
                          className="text-sm text-indigo-electric hover:text-indigo-electric/70 transition-colors duration-150"
                        >
                          {contact.email}
                        </a>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {contact.phone ? (
                          <a
                            href={`tel:${contact.phone}`}
                            className="text-sm text-indigo-electric hover:text-indigo-electric/70 transition-colors duration-150"
                          >
                            {contact.phone}
                          </a>
                        ) : (
                          <span className="text-sm text-gray-400 dark:text-white/30">{'\u2014'}</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-600 dark:text-white/40 font-mono">
                          {formatDate(contact.last_activity_date ?? null)}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right sticky right-0 bg-white dark:bg-void-950 group-hover:bg-gray-50 dark:group-hover:bg-white/[0.08]">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleEmailClick(contact)}
                            className="text-indigo-electric hover:text-indigo-electric/70 transition-colors duration-150"
                            title="Send email"
                          >
                            <Mail className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleMeetingClick(contact)}
                            className="text-emerald-signal hover:text-emerald-signal/70 transition-colors duration-150"
                            title="Book meeting"
                          >
                            <Calendar className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleSocialClick(contact)}
                            className="text-purple-neon hover:text-purple-neon/70 transition-colors duration-150"
                            title="Log social activity"
                          >
                            <Share2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleRemoveContact(contact.id)}
                            className="text-red-alert hover:text-red-alert/70 transition-colors duration-150"
                            title="Remove from list"
                          >
                            <UserMinus className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination Bar */}
        {currentItems.length > 0 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/[0.02]">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500 dark:text-white/40">Rows per page</span>
                <select
                  value={pageSize}
                  onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                  className="px-2 py-1 text-sm border border-gray-300 dark:border-white/10 rounded-md bg-white dark:bg-white/5 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-electric focus:outline-none"
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
              <span className="text-sm text-gray-500 dark:text-white/40">
                Showing {paginationStart}--{paginationEnd} of {currentItems.length} {itemLabel}s
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="px-3 py-1.5 text-sm border border-gray-300 dark:border-white/10 rounded-md text-gray-700 dark:text-white/70 hover:bg-gray-100 dark:hover:bg-white/[0.08] disabled:opacity-30 disabled:cursor-not-allowed transition-colors duration-150"
              >
                Previous
              </button>
              <span className="text-sm text-gray-600 dark:text-white/50 px-2">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="px-3 py-1.5 text-sm border border-gray-300 dark:border-white/10 rounded-md text-gray-700 dark:text-white/70 hover:bg-gray-100 dark:hover:bg-white/[0.08] disabled:opacity-30 disabled:cursor-not-allowed transition-colors duration-150"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Email Modal */}
      {selectedContact && (
        <ComposeEmailModal
          isOpen={isEmailModalOpen}
          onClose={() => setIsEmailModalOpen(false)}
          contact={selectedContact}
          onSuccess={() => {
            setIsEmailModalOpen(false);
            loadContacts();
          }}
        />
      )}

      {/* Social Activity Modal */}
      {selectedContact && user && (
        <LogSocialActivityModal
          isOpen={isSocialModalOpen}
          onClose={() => setIsSocialModalOpen(false)}
          contactId={selectedContact.id}
          salesblockId={null}
          userId={user.id}
          orgId={orgId}
          onSuccess={() => {
            setIsSocialModalOpen(false);
            loadContacts();
          }}
        />
      )}

      {/* Book Meeting Modal */}
      {selectedContact && (
        <BookMeetingModal
          isOpen={isMeetingModalOpen}
          onClose={() => setIsMeetingModalOpen(false)}
          contact={selectedContact}
          salesblockId={null}
          onSuccess={() => {
            setIsMeetingModalOpen(false);
            loadContacts();
          }}
        />
      )}

      {/* Edit List Modal */}
      <ListBuilderModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        existingList={listDetail ? {
          id: listDetail.id,
          name: listDetail.name,
          description: listDetail.description,
          filter_criteria: listDetail.filter_criteria as any,
          is_shared: listDetail.is_shared,
        } : null}
        onSuccess={() => {
          setIsEditModalOpen(false);
          loadListDetail();
          if (isAccountList) {
            loadAccounts();
          } else {
            loadContacts();
          }
        }}
      />

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-void-900 rounded-lg shadow-xl w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-alert" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Remove {itemLabel}s</h3>
                <p className="text-sm text-gray-500 dark:text-white/50">This cannot be undone</p>
              </div>
            </div>

            <p className="text-sm text-gray-600 dark:text-white/60 mb-6">
              Remove <strong>{selectedContactIds.size}</strong> {itemLabel}{selectedContactIds.size !== 1 ? 's' : ''} from
              {' '}<strong>{listDetail?.name}</strong>? The {itemLabel}s will still exist in your database but will no
              longer be in this list.
            </p>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setIsDeleteModalOpen(false)}
                disabled={isDeleting}
                className="px-4 py-2 text-gray-700 dark:text-white/70 hover:bg-gray-100 dark:hover:bg-white/[0.08] rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={isDeleting}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Removing...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Remove {selectedContactIds.size} {itemLabel}{selectedContactIds.size !== 1 ? 's' : ''}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
