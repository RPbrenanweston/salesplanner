/**
 * @crumb
 * @id frontend-page-list-detail
 * @area UI/Pages
 * @intent Contact list detail view — browse, search, sort, and act on contacts in a specific list; remove contacts; launch email/social/meeting actions; start SalesBlock session
 * @responsibilities Load list metadata + contacts by listId param, render sortable contact table, search contacts, remove contacts from list, open action modals per contact, navigate to ContactDetailPage, start SalesBlock from list
 * @contracts ListDetailPage() → JSX; receives listId via useParams; reads lists + list_contacts + contacts from Supabase; writes on contact remove; uses useAuth
 * @in useParams (listId), useAuth (user), supabase (lists + list_contacts joined to contacts), ComposeEmailModal + LogSocialActivityModal + BookMeetingModal + ListBuilderModal components
 * @out Searchable sortable contact table with action buttons per row, list header with metadata, Run SalesBlock CTA
 * @err listId not found in Supabase (undefined state — page renders blank with no 404); contact remove failure (silent)
 * @hazard Remove contact fires Supabase delete immediately without confirmation — user can accidentally remove contacts from list with no undo
 * @hazard Sort state is client-side only — if contact list is paginated in future, sort breaks silently (sorts only the loaded page, not full list)
 * @shared-edges frontend/src/lib/supabase.ts→QUERIES lists+list_contacts+contacts; frontend/src/hooks/useAuth.ts→CALLS; frontend/src/components/ComposeEmailModal.tsx→LAUNCHES; frontend/src/components/LogSocialActivityModal.tsx→LAUNCHES; frontend/src/components/BookMeetingModal.tsx→LAUNCHES; frontend/src/pages/ContactDetailPage.tsx→NAVIGATES to; frontend/src/App.tsx→ROUTES to /lists/:id
 * @trail list-detail#1 | ListDetailPage mounts with listId → load list + contacts → render table → user searches → filter client-side → user removes contact → immediate delete → user emails → ComposeEmailModal
 * @prompt Add confirmation on contact remove. Add 404 state when list not found. Move sort to server-side when list grows. Add bulk select for mass actions. VV design applied: void-950 page bg, VV spinner loading state, vv-section-title "Lists" label + font-display h1, indigo-electric Start SalesBlock CTA + links, glass-card table container, white/5 thead bg + vv-section-title th cells, white/10 table dividers + dark hover rows, font-display contact name, font-mono last activity dates, emerald-signal meeting icon, purple-neon social icon, red-alert remove icon, ease-snappy transitions.
 */
import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, UserMinus, Play, ChevronUp, ChevronDown, Mail, Share2, Calendar, Pencil } from 'lucide-react';
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

interface ListDetail {
  id: string;
  name: string;
  description: string | null;
  filter_criteria: Record<string, unknown> | null;
  is_shared: boolean;
  owner_id: string;
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
  const listDetailRef = useRef<ListDetail | null>(null);

  useEffect(() => {
    if (listId) {
      // Load list detail first, then contacts (contacts may need filter_criteria from list)
      loadListDetail().then(() => loadContacts());
    }
  }, [listId]);

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

  useEffect(() => {
    // Filter contacts based on search query
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
  }, [searchQuery, contacts]);

  useEffect(() => {
    // Sort contacts whenever sortField or sortDirection changes
    const sorted = [...filteredContacts].sort((a, b) => {
      let aVal: string | number | null;
      let bVal: string | number | null;

      if (sortField === 'name') {
        aVal = `${a.first_name} ${a.last_name}`;
        bVal = `${b.first_name} ${b.last_name}`;
      } else if (sortField === 'last_activity_date') {
        aVal = a.last_activity_date || '';
        bVal = b.last_activity_date || '';
      } else {
        aVal = a[sortField] || '';
        bVal = b[sortField] || '';
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        const comparison = aVal.localeCompare(bVal);
        return sortDirection === 'asc' ? comparison : -comparison;
      }

      return 0;
    });
    setFilteredContacts(sorted);
  }, [sortField, sortDirection]);

  const loadListDetail = async () => {
    try {
      const { data, error } = await supabase
        .from('lists')
        .select('id, name, description, filter_criteria, is_shared, owner_id')
        .eq('id', listId)
        .single();

      if (error) throw error;
      setListDetail(data);
      listDetailRef.current = data;
    } catch (err) {
      console.error('Error loading list detail:', err);
    }
  };

  const loadContacts = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      // Get contacts in this list via the junction table
      const { data: listContactsData, error: listContactsError } = await supabase
        .from('list_contacts')
        .select('contact_id')
        .eq('list_id', listId);

      if (listContactsError) throw listContactsError;

      let contactIds = (listContactsData || []).map((lc) => lc.contact_id);

      // Fallback: if list_contacts is empty, re-resolve via filter_criteria.
      // Lists created before the junction table fix may only have filter_criteria stored.
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
            // Re-populate list_contacts so future loads are instant
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

      // Fetch the actual contact records (chunk .in() for large lists)
      const CHUNK_SIZE = 200;
      let allContactsData: typeof contacts = [];
      for (let i = 0; i < contactIds.length; i += CHUNK_SIZE) {
        const chunk = contactIds.slice(i, i + CHUNK_SIZE);
        const { data: contactsData, error: contactsError } = await supabase
          .from('contacts')
          .select('id, first_name, last_name, email, phone, company, title, created_at')
          .in('id', chunk);

        if (contactsError) throw contactsError;
        allContactsData = allContactsData.concat(contactsData || []);
      }

      // Batch-fetch last activity dates (single query instead of N+1)
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
            // First occurrence per contact_id is the latest (ordered desc)
            if (!activityMap.has(row.contact_id)) {
              activityMap.set(row.contact_id, row.created_at);
            }
          }
        }
      } catch {
        // Activity dates are non-critical — show contacts without them
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

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Toggle direction if clicking the same column
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new field and default to ascending
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

      // Reload contacts
      loadContacts();
    } catch (err) {
      console.error('Error removing contact:', err);
      alert('Failed to remove contact from list');
    }
  };

  const handleStartSalesBlock = () => {
    // Navigate to create salesblock with this list pre-selected
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
    if (!dateString) return '—';
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
            <p className="vv-section-title mb-1">Lists</p>
            <h1 className="font-display text-3xl font-bold text-gray-900 dark:text-white mb-2">
              {listDetail.name}
            </h1>
            {listDetail.description && (
              <p className="text-gray-600 dark:text-white/50">{listDetail.description}</p>
            )}
            {!isLoading && (
              <p className="text-sm text-gray-400 dark:text-white/30 mt-1">
                {contacts.length} contact{contacts.length !== 1 ? 's' : ''}
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
            <button
              onClick={handleStartSalesBlock}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-electric hover:bg-indigo-electric/80 text-white rounded-lg transition-all duration-200 ease-snappy"
            >
              <Play className="w-4 h-4" />
              Start SalesBlock
            </button>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search contacts by name, email, or company..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-indigo-electric focus:outline-none bg-white dark:bg-white/5 text-gray-900 dark:text-white transition-colors duration-150"
          />
        </div>
      </div>

      {/* Contacts Table */}
      <div className="glass-card">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-white/5">
              <tr>
                <th
                  onClick={() => handleSort('name')}
                  className="px-6 py-3 text-left vv-section-title cursor-pointer hover:bg-gray-100 dark:hover:bg-white/[0.08] transition-colors duration-150"
                >
                  Name <SortIcon field="name" />
                </th>
                <th
                  onClick={() => handleSort('company')}
                  className="px-6 py-3 text-left vv-section-title cursor-pointer hover:bg-gray-100 dark:hover:bg-white/[0.08] transition-colors duration-150"
                >
                  Company <SortIcon field="company" />
                </th>
                <th
                  onClick={() => handleSort('title')}
                  className="px-6 py-3 text-left vv-section-title cursor-pointer hover:bg-gray-100 dark:hover:bg-white/[0.08] transition-colors duration-150"
                >
                  Title <SortIcon field="title" />
                </th>
                <th
                  onClick={() => handleSort('email')}
                  className="px-6 py-3 text-left vv-section-title cursor-pointer hover:bg-gray-100 dark:hover:bg-white/[0.08] transition-colors duration-150"
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
                <th className="px-6 py-3 text-right vv-section-title">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-white/10">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <div className="flex items-center justify-center gap-3 text-gray-400 dark:text-white/40">
                      <div className="w-5 h-5 border-2 border-indigo-electric border-t-transparent rounded-full animate-spin" />
                      <span className="font-mono text-sm">Loading contacts...</span>
                    </div>
                  </td>
                </tr>
              ) : loadError ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
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
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <p className="text-gray-500 dark:text-white/40 mb-2">
                      {searchQuery ? 'No contacts match your search' : 'No contacts in this list'}
                    </p>
                    <p className="text-sm text-gray-400 dark:text-white/30">
                      {searchQuery ? 'Try a different search term' : 'Edit the list filters or import contacts via CSV'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredContacts.map((contact) => (
                  <tr key={contact.id} className="hover:bg-gray-50 dark:hover:bg-white/[0.08] transition-all duration-150">
                    <td className="px-6 py-4">
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
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-600 dark:text-white/50">
                        {contact.company || '—'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-600 dark:text-white/50">
                        {contact.title || '—'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <a
                        href={`mailto:${contact.email}`}
                        className="text-sm text-indigo-electric hover:text-indigo-electric/70 transition-colors duration-150"
                      >
                        {contact.email}
                      </a>
                    </td>
                    <td className="px-6 py-4">
                      {contact.phone ? (
                        <a
                          href={`tel:${contact.phone}`}
                          className="text-sm text-indigo-electric hover:text-indigo-electric/70 transition-colors duration-150"
                        >
                          {contact.phone}
                        </a>
                      ) : (
                        <span className="text-sm text-gray-400 dark:text-white/30">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-600 dark:text-white/40 font-mono">
                        {formatDate(contact.last_activity_date ?? null)}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
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
        </div>
      </div>

      {/* Email Modal */}
      {selectedContact && (
        <ComposeEmailModal
          isOpen={isEmailModalOpen}
          onClose={() => setIsEmailModalOpen(false)}
          contact={selectedContact}
          onSuccess={() => {
            setIsEmailModalOpen(false);
            loadContacts(); // Refresh to update last activity
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
            loadContacts(); // Refresh to update last activity
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
            loadContacts(); // Refresh to update last activity
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
          loadListDetail(); // Refresh list name/description
          loadContacts(); // Re-fetch contacts (filters may have changed)
        }}
      />
    </div>
  );
}
