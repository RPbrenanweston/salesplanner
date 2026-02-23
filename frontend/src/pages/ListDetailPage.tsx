import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, UserMinus, Play, ChevronUp, ChevronDown, Mail, Share2, Calendar } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
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

  useEffect(() => {
    if (listId) {
      loadListDetail();
      loadContacts();
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
        .select('id, name, description')
        .eq('id', listId)
        .single();

      if (error) throw error;
      setListDetail(data);
    } catch (err) {
      console.error('Error loading list detail:', err);
    }
  };

  const loadContacts = async () => {
    setIsLoading(true);
    try {
      // Get contacts in this list via the junction table
      const { data: listContactsData, error: listContactsError } = await supabase
        .from('list_contacts')
        .select('contact_id')
        .eq('list_id', listId);

      if (listContactsError) throw listContactsError;

      const contactIds = (listContactsData || []).map((lc) => lc.contact_id);

      if (contactIds.length === 0) {
        setContacts([]);
        setFilteredContacts([]);
        setIsLoading(false);
        return;
      }

      // Fetch the actual contact records
      const { data: contactsData, error: contactsError } = await supabase
        .from('contacts')
        .select('id, first_name, last_name, email, phone, company, title, created_at')
        .in('id', contactIds);

      if (contactsError) throw contactsError;

      // For each contact, get the last activity date
      const contactsWithActivity = await Promise.all(
        (contactsData || []).map(async (contact) => {
          const { data: activityData } = await supabase
            .from('activities')
            .select('created_at')
            .eq('contact_id', contact.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          return {
            ...contact,
            last_activity_date: activityData?.created_at || null,
          };
        })
      );

      setContacts(contactsWithActivity);
      setFilteredContacts(contactsWithActivity);
    } catch (err) {
      console.error('Error loading contacts:', err);
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
    // For now, just navigate to SalesBlocks page (US-014 will implement full create flow)
    navigate('/salesblocks', { state: { preselectedListId: listId } });
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
      <div className="p-8">
        <p className="text-gray-500 dark:text-gray-400">Loading list...</p>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/lists')}
          className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Lists
        </button>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              {listDetail.name}
            </h1>
            {listDetail.description && (
              <p className="text-gray-600 dark:text-gray-400">{listDetail.description}</p>
            )}
          </div>

          <button
            onClick={handleStartSalesBlock}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            <Play className="w-4 h-4" />
            Start SalesBlock
          </button>
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
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          />
        </div>
      </div>

      {/* Contacts Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th
                  onClick={() => handleSort('name')}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                >
                  Name <SortIcon field="name" />
                </th>
                <th
                  onClick={() => handleSort('company')}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                >
                  Company <SortIcon field="company" />
                </th>
                <th
                  onClick={() => handleSort('title')}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                >
                  Title <SortIcon field="title" />
                </th>
                <th
                  onClick={() => handleSort('email')}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                >
                  Email <SortIcon field="email" />
                </th>
                <th
                  onClick={() => handleSort('phone')}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                >
                  Phone <SortIcon field="phone" />
                </th>
                <th
                  onClick={() => handleSort('last_activity_date')}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                >
                  Last Activity <SortIcon field="last_activity_date" />
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                    Loading contacts...
                  </td>
                </tr>
              ) : filteredContacts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <p className="text-gray-500 dark:text-gray-400 mb-2">
                      {searchQuery ? 'No contacts match your search' : 'No contacts in this list'}
                    </p>
                    <p className="text-sm text-gray-400 dark:text-gray-500">
                      {searchQuery ? 'Try a different search term' : 'Add contacts from the Lists page'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredContacts.map((contact) => (
                  <tr key={contact.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-6 py-4">
                      <button
                        onClick={() =>
                          navigate(`/contacts/${contact.id}`, {
                            state: { returnPath: `/lists/${listId}` },
                          })
                        }
                        className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline text-left"
                      >
                        {contact.first_name} {contact.last_name}
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {contact.company || '—'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {contact.title || '—'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <a
                        href={`mailto:${contact.email}`}
                        className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        {contact.email}
                      </a>
                    </td>
                    <td className="px-6 py-4">
                      {contact.phone ? (
                        <a
                          href={`tel:${contact.phone}`}
                          className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          {contact.phone}
                        </a>
                      ) : (
                        <span className="text-sm text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {formatDate(contact.last_activity_date ?? null)}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleEmailClick(contact)}
                          className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                          title="Send email"
                        >
                          <Mail className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleMeetingClick(contact)}
                          className="text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300"
                          title="Book meeting"
                        >
                          <Calendar className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleSocialClick(contact)}
                          className="text-orange-600 dark:text-orange-400 hover:text-orange-800 dark:hover:text-orange-300"
                          title="Log social activity"
                        >
                          <Share2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleRemoveContact(contact.id)}
                          className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
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
    </div>
  );
}
