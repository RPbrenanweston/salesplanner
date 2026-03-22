// @crumb frontend-component-account-contacts-panel
// UI/Intelligence | fetch_linked_contacts | link_contact | unlink_contact | purpose_classification | timeline_event_creation
// why: Manage contact-to-account relationships with purpose classification — the relationship layer connecting people to organizations
// in:accountId,orgId,onContactCountChange callback out:Contact table with link/unlink actions,searchable contact picker overlay err:Supabase query failure (logged),missing auth (early return)
// hazard: Unlinked contacts fetched without pagination — orgs with thousands of contacts could slow picker
// hazard: Timeline event insert failure after contact update leaves inconsistent audit trail
// edge:frontend/src/lib/supabase.ts -> CALLS
// edge:frontend/src/hooks/useAuth.ts -> CALLS
// edge:frontend/src/lib/error-logger.ts -> CALLS
// edge:frontend/src/pages/AccountDetailPage.tsx -> RENDERS
// prompt: Add pagination for orgs with 100+ unlinked contacts. Consider optimistic UI for link/unlink. Batch contact update + timeline insert in a transaction via RPC.

import { useEffect, useState, useCallback, useRef } from 'react';
import { Users, Link2, Unlink, Search, ChevronDown, Mail, Phone } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { logError } from '../../lib/error-logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AccountContactsPanelProps {
  accountId: string;
  orgId: string;
  onContactCountChange?: (count: number) => void;
}

interface LinkedContact {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  contact_purpose: string;
}

interface UnlinkedContact {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  company: string | null;
}

type ContactPurpose = 'prospect' | 'intel_source' | 'internal_champion';

const PURPOSE_OPTIONS: { value: ContactPurpose; label: string }[] = [
  { value: 'prospect', label: 'Prospect' },
  { value: 'intel_source', label: 'Intel Source' },
  { value: 'internal_champion', label: 'Internal Champion' },
];

const PURPOSE_BADGE_STYLES: Record<string, string> = {
  prospect: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  intel_source: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  internal_champion: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  unknown: 'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-white/50',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatPurpose(purpose: string): string {
  return purpose
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AccountContactsPanel({
  accountId,
  orgId,
  onContactCountChange,
}: AccountContactsPanelProps) {
  const { user } = useAuth();

  // Linked contacts state
  const [contacts, setContacts] = useState<LinkedContact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(true);

  // Link picker state
  const [showPicker, setShowPicker] = useState(false);
  const [unlinkedContacts, setUnlinkedContacts] = useState<UnlinkedContact[]>([]);
  const [loadingUnlinked, setLoadingUnlinked] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [selectedPurpose, setSelectedPurpose] = useState<ContactPurpose>('prospect');
  const [linking, setLinking] = useState(false);

  // Unlink state
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null);

  // Ref for closing picker on outside click
  const pickerRef = useRef<HTMLDivElement>(null);

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------

  const loadLinkedContacts = useCallback(async () => {
    setLoadingContacts(true);
    try {
      const { data, error } = await supabase
        .from('contacts')
        .select('id, first_name, last_name, email, phone, contact_purpose')
        .eq('account_id', accountId)
        .order('contact_purpose', { ascending: true })
        .order('first_name', { ascending: true });

      if (error) throw error;

      const result = (data || []) as LinkedContact[];
      setContacts(result);
      onContactCountChange?.(result.length);
    } catch (err) {
      logError(err, 'AccountContactsPanel.loadLinkedContacts');
    } finally {
      setLoadingContacts(false);
    }
  }, [accountId, onContactCountChange]);

  const loadUnlinkedContacts = useCallback(async () => {
    setLoadingUnlinked(true);
    try {
      const { data, error } = await supabase
        .from('contacts')
        .select('id, first_name, last_name, email, company')
        .eq('org_id', orgId)
        .is('account_id', null)
        .order('first_name', { ascending: true });

      if (error) throw error;
      setUnlinkedContacts((data || []) as UnlinkedContact[]);
    } catch (err) {
      logError(err, 'AccountContactsPanel.loadUnlinkedContacts');
    } finally {
      setLoadingUnlinked(false);
    }
  }, [orgId]);

  useEffect(() => {
    if (accountId && orgId) {
      loadLinkedContacts();
    }
  }, [accountId, orgId, loadLinkedContacts]);

  // Load unlinked contacts when picker opens
  useEffect(() => {
    if (showPicker) {
      loadUnlinkedContacts();
      setSearchQuery('');
      setSelectedContactId(null);
      setSelectedPurpose('prospect');
    }
  }, [showPicker, loadUnlinkedContacts]);

  // Close picker on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPicker(false);
      }
    }

    if (showPicker) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showPicker]);

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  const handleLinkContact = async () => {
    if (!selectedContactId || !user) return;

    setLinking(true);
    try {
      // Find the contact for the timeline event title
      const contact = unlinkedContacts.find((c) => c.id === selectedContactId);
      const contactName = contact
        ? `${contact.first_name} ${contact.last_name}`.trim()
        : 'Contact';

      // Update the contact with account_id and purpose
      const { error: updateError } = await supabase
        .from('contacts')
        .update({
          account_id: accountId,
          contact_purpose: selectedPurpose,
        })
        .eq('id', selectedContactId);

      if (updateError) throw updateError;

      // Insert timeline event
      await supabase.from('timeline_events').insert({
        account_id: accountId,
        contact_id: selectedContactId,
        event_type: 'engagement_event',
        title: `Linked ${contactName} as ${formatPurpose(selectedPurpose)}`,
        org_id: orgId,
        actor_type: 'user',
        actor_id: user.id,
      });

      // Reset picker state
      setSelectedContactId(null);
      setSelectedPurpose('prospect');
      setShowPicker(false);

      // Refresh
      await loadLinkedContacts();
    } catch (err) {
      logError(err, 'AccountContactsPanel.handleLinkContact');
    } finally {
      setLinking(false);
    }
  };

  const handleUnlinkContact = async (contactId: string) => {
    if (!user) return;

    setUnlinkingId(contactId);
    try {
      // Find contact name for timeline
      const contact = contacts.find((c) => c.id === contactId);
      const contactName = contact
        ? `${contact.first_name} ${contact.last_name}`.trim()
        : 'Contact';

      // Remove account link and reset purpose
      const { error: updateError } = await supabase
        .from('contacts')
        .update({
          account_id: null,
          contact_purpose: 'unknown',
        })
        .eq('id', contactId);

      if (updateError) throw updateError;

      // Insert timeline event
      await supabase.from('timeline_events').insert({
        account_id: accountId,
        contact_id: contactId,
        event_type: 'engagement_event',
        title: `Unlinked ${contactName} from account`,
        org_id: orgId,
        actor_type: 'user',
        actor_id: user.id,
      });

      // Refresh
      await loadLinkedContacts();
    } catch (err) {
      logError(err, 'AccountContactsPanel.handleUnlinkContact');
    } finally {
      setUnlinkingId(null);
    }
  };

  // ---------------------------------------------------------------------------
  // Filtered unlinked contacts
  // ---------------------------------------------------------------------------

  const filteredUnlinked = unlinkedContacts.filter((c) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const fullName = `${c.first_name} ${c.last_name}`.toLowerCase();
    const email = (c.email || '').toLowerCase();
    return fullName.includes(query) || email.includes(query);
  });

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="glass-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-white/10">
        <h3 className="font-display font-semibold text-gray-900 dark:text-white">
          Linked Contacts ({contacts.length})
        </h3>
        <div className="relative" ref={pickerRef}>
          <button
            onClick={() => setShowPicker(!showPicker)}
            className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-white/10 border border-gray-200 dark:border-white/10 text-gray-700 dark:text-white/70 rounded-lg text-sm font-semibold hover:bg-gray-50 dark:hover:bg-white/20 transition-all duration-200 ease-snappy"
          >
            <Link2 className="w-4 h-4" />
            Link Contact
          </button>

          {/* Contact Picker Overlay */}
          {showPicker && (
            <div className="absolute right-0 top-full mt-2 w-96 bg-white dark:bg-void-950 border border-gray-200 dark:border-white/10 rounded-xl shadow-lg z-50">
              {/* Search */}
              <div className="p-3 border-b border-gray-200 dark:border-white/10">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-white/30" />
                  <input
                    type="text"
                    placeholder="Search by name or email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-indigo-electric/40 focus:border-indigo-electric"
                    autoFocus
                  />
                </div>
              </div>

              {/* Contact List */}
              <div className="max-h-[300px] overflow-y-auto">
                {loadingUnlinked ? (
                  <div className="p-6 text-center">
                    <div className="w-5 h-5 border-2 border-indigo-electric border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <span className="text-xs text-gray-400 dark:text-white/40">Loading contacts...</span>
                  </div>
                ) : filteredUnlinked.length === 0 ? (
                  <div className="p-6 text-center">
                    <Users className="w-8 h-8 text-gray-300 dark:text-white/20 mx-auto mb-2" />
                    <p className="text-sm text-gray-500 dark:text-white/40">
                      {searchQuery.trim()
                        ? 'No matching unlinked contacts'
                        : 'No unlinked contacts available'}
                    </p>
                  </div>
                ) : (
                  filteredUnlinked.map((contact) => {
                    const isSelected = selectedContactId === contact.id;
                    return (
                      <div key={contact.id}>
                        <button
                          onClick={() =>
                            setSelectedContactId(isSelected ? null : contact.id)
                          }
                          className={`w-full text-left px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-white/5 transition-colors duration-150 ${
                            isSelected
                              ? 'bg-indigo-50 dark:bg-indigo-electric/10'
                              : ''
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                              {contact.first_name} {contact.last_name}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-white/40 truncate">
                              {contact.email || contact.company || 'No email'}
                            </p>
                          </div>
                          <ChevronDown
                            className={`w-4 h-4 text-gray-400 dark:text-white/30 transition-transform duration-150 flex-shrink-0 ml-2 ${
                              isSelected ? 'rotate-180' : ''
                            }`}
                          />
                        </button>

                        {/* Purpose selector + confirm (inline) */}
                        {isSelected && (
                          <div className="px-4 py-3 bg-gray-50 dark:bg-white/5 border-t border-gray-200 dark:border-white/10 flex items-center gap-2">
                            <select
                              value={selectedPurpose}
                              onChange={(e) =>
                                setSelectedPurpose(e.target.value as ContactPurpose)
                              }
                              className="flex-1 text-sm px-2 py-1.5 bg-white dark:bg-void-800/50 border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-electric/40"
                            >
                              {PURPOSE_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                            <button
                              onClick={handleLinkContact}
                              disabled={linking}
                              className="px-3 py-1.5 bg-indigo-electric hover:bg-indigo-electric/80 text-white text-sm font-semibold rounded-lg transition-all duration-200 ease-snappy disabled:opacity-50 flex items-center gap-1.5"
                            >
                              <Link2 className="w-3.5 h-3.5" />
                              {linking ? 'Linking...' : 'Link'}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Contacts Table */}
      {loadingContacts ? (
        <div className="p-8 text-center">
          <div className="w-5 h-5 border-2 border-indigo-electric border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <span className="text-xs text-gray-400 dark:text-white/40 font-mono tracking-widest uppercase">
            Loading contacts...
          </span>
        </div>
      ) : contacts.length === 0 ? (
        <div className="p-8 text-center">
          <Users className="w-10 h-10 text-gray-300 dark:text-white/20 mx-auto mb-3" />
          <p className="font-display font-semibold text-gray-900 dark:text-white mb-1">
            No contacts linked
          </p>
          <p className="text-sm text-gray-400 dark:text-white/40">
            Click &apos;Link Contact&apos; to associate contacts with this account.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-white/5 border-b border-gray-200 dark:border-white/10">
              <tr>
                <th className="px-6 py-3 text-left">
                  <span className="vv-section-title">Name</span>
                </th>
                <th className="px-6 py-3 text-left">
                  <span className="vv-section-title">Email</span>
                </th>
                <th className="px-6 py-3 text-left">
                  <span className="vv-section-title">Purpose</span>
                </th>
                <th className="px-6 py-3 text-left">
                  <span className="vv-section-title">Phone</span>
                </th>
                <th className="px-6 py-3 text-left">
                  <span className="vv-section-title">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-white/10">
              {contacts.map((contact) => (
                <tr
                  key={contact.id}
                  className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors duration-150 ease-snappy"
                >
                  <td className="px-6 py-4">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {contact.first_name} {contact.last_name}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-gray-600 dark:text-white/50 flex items-center gap-1.5">
                      {contact.email ? (
                        <>
                          <Mail className="w-3.5 h-3.5" />
                          {contact.email}
                        </>
                      ) : (
                        '\u2014'
                      )}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        PURPOSE_BADGE_STYLES[contact.contact_purpose] ||
                        PURPOSE_BADGE_STYLES.unknown
                      }`}
                    >
                      {formatPurpose(contact.contact_purpose)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-gray-600 dark:text-white/50 flex items-center gap-1.5">
                      {contact.phone ? (
                        <>
                          <Phone className="w-3.5 h-3.5" />
                          {contact.phone}
                        </>
                      ) : (
                        '\u2014'
                      )}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => handleUnlinkContact(contact.id)}
                      disabled={unlinkingId === contact.id}
                      title="Unlink contact from account"
                      className="p-1.5 text-gray-400 dark:text-white/30 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all duration-150 disabled:opacity-50"
                    >
                      <Unlink className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
