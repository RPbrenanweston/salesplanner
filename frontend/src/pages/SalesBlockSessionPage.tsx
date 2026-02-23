import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Phone, Mail, ChevronRight, SkipForward, Check, PhoneCall, Send, Share2, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import LogActivityModal from '../components/LogActivityModal';

interface Contact {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  company: string | null;
  title: string | null;
  notes: string | null;
  hasActivity?: boolean;
}

interface SalesBlock {
  id: string;
  title: string;
  scheduled_start: string;
  duration_minutes: number;
  status: string;
  list_id: string;
}

export default function SalesBlockSessionPage() {
  const { salesblockId } = useParams<{ salesblockId: string }>();
  const { user } = useAuth();

  const [salesblock, setSalesblock] = useState<SalesBlock | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [loading, setLoading] = useState(true);
  const [orgId, setOrgId] = useState<string>('');

  // Activity modal state
  const [activityModalOpen, setActivityModalOpen] = useState(false);
  const [activityType, setActivityType] = useState<'call' | 'email' | 'social' | 'note'>('call');

  // Call script panel state
  const [scriptExpanded, setScriptExpanded] = useState(false);

  // Load user's org_id
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

  // Load salesblock and contacts
  useEffect(() => {
    if (!salesblockId || !user) return;

    async function loadData() {
      try {
        // Fetch salesblock
        const { data: sbData, error: sbError } = await supabase
          .from('salesblocks')
          .select('*')
          .eq('id', salesblockId)
          .single();

        if (sbError) throw sbError;
        setSalesblock(sbData);

        // Fetch contacts from the list
        const { data: listContactsData, error: lcError } = await supabase
          .from('list_contacts')
          .select('contact_id')
          .eq('list_id', sbData.list_id)
          .order('position', { ascending: true });

        if (lcError) throw lcError;

        const contactIds = listContactsData.map((lc) => lc.contact_id);

        if (contactIds.length === 0) {
          setContacts([]);
          setLoading(false);
          return;
        }

        // Fetch contact details
        const { data: contactsData, error: contactsError } = await supabase
          .from('contacts')
          .select('id, first_name, last_name, email, phone, company, title, notes')
          .in('id', contactIds);

        if (contactsError) throw contactsError;

        // Fetch activity status for each contact
        const contactsWithActivity = await Promise.all(
          (contactsData || []).map(async (contact) => {
            const { count } = await supabase
              .from('activities')
              .select('id', { count: 'exact', head: true })
              .eq('contact_id', contact.id);

            return { ...contact, hasActivity: (count ?? 0) > 0 };
          })
        );

        setContacts(contactsWithActivity);
      } catch (error) {
        console.error('Error loading session data:', error);
        alert('Failed to load session data');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [salesblockId, user]);

  // Start session (update status to in_progress and set actual_start)
  useEffect(() => {
    if (!salesblockId || !salesblock || salesblock.status !== 'scheduled') return;

    async function startSession() {
      const { error } = await supabase
        .from('salesblocks')
        .update({
          status: 'in_progress',
          actual_start: new Date().toISOString(),
        })
        .eq('id', salesblockId);

      if (error) {
        console.error('Error starting session:', error);
      } else {
        setSalesblock((prev) => (prev ? { ...prev, status: 'in_progress' } : null));
      }
    }

    startSession();
  }, [salesblockId, salesblock]);

  // Timer interval (counts up from 0)
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const totalDurationSeconds = salesblock ? salesblock.duration_minutes * 60 : 0;
  const progressPercentage = totalDurationSeconds > 0 ? (elapsedSeconds / totalDurationSeconds) * 100 : 0;

  const activeContact = contacts[activeIndex] || null;

  const handleNext = () => {
    if (activeIndex < contacts.length - 1) {
      setActiveIndex((prev) => prev + 1);
    }
  };

  const handleSkip = () => {
    // Move current contact to end of queue
    const skippedContact = contacts[activeIndex];
    const newContacts = [
      ...contacts.slice(0, activeIndex),
      ...contacts.slice(activeIndex + 1),
      skippedContact,
    ];
    setContacts(newContacts);
  };

  const openActivityModal = (type: 'call' | 'email' | 'social' | 'note') => {
    setActivityType(type);
    setActivityModalOpen(true);
  };

  const refreshActivityStatus = async () => {
    // Re-fetch activity status for all contacts
    const contactsWithActivity = await Promise.all(
      contacts.map(async (contact) => {
        const { count } = await supabase
          .from('activities')
          .select('id', { count: 'exact', head: true })
          .eq('contact_id', contact.id);

        return { ...contact, hasActivity: (count ?? 0) > 0 };
      })
    );

    setContacts(contactsWithActivity);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-500 dark:text-gray-400">Loading session...</p>
      </div>
    );
  }

  if (!salesblock) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-red-500">SalesBlock not found</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900">
      {/* Timer Bar */}
      <div className="bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{salesblock.title}</h2>
          <div className="text-sm text-gray-600 dark:text-gray-300">
            {formatTime(elapsedSeconds)} / {salesblock.duration_minutes} min
          </div>
        </div>
        <div className="w-full bg-gray-300 dark:bg-gray-700 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${Math.min(progressPercentage, 100)}%` }}
          />
        </div>
      </div>

      {/* Main Content: Queue + Active Contact */}
      <div className="flex flex-1 overflow-hidden">
        {/* Contact Queue (Left Sidebar) */}
        <div className="w-80 border-r border-gray-200 dark:border-gray-700 overflow-y-auto bg-gray-50 dark:bg-gray-800">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
              Contact Queue ({contacts.length})
            </h3>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {contacts.map((contact, index) => (
              <div
                key={contact.id}
                className={`p-4 cursor-pointer transition-colors ${
                  index === activeIndex
                    ? 'bg-blue-100 dark:bg-blue-900 border-l-4 border-blue-600'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
                onClick={() => setActiveIndex(index)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {contact.first_name} {contact.last_name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{contact.company || 'No company'}</p>
                  </div>
                  {contact.hasActivity && (
                    <Check className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 ml-2" />
                  )}
                </div>
              </div>
            ))}
            {contacts.length === 0 && (
              <div className="p-8 text-center">
                <p className="text-sm text-gray-500 dark:text-gray-400">No contacts in this list</p>
              </div>
            )}
          </div>
        </div>

        {/* Active Contact Detail (Right Panel) */}
        <div className="flex-1 overflow-y-auto p-8">
          {activeContact ? (
            <div>
              <div className="mb-6">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                  {activeContact.first_name} {activeContact.last_name}
                </h1>
                <p className="text-lg text-gray-600 dark:text-gray-300">
                  {activeContact.title || 'No title'} at {activeContact.company || 'No company'}
                </p>
              </div>

              <div className="space-y-4 mb-6">
                {activeContact.phone && (
                  <div className="flex items-center space-x-3">
                    <Phone className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                    <a
                      href={`tel:${activeContact.phone}`}
                      className="text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {activeContact.phone}
                    </a>
                  </div>
                )}
                <div className="flex items-center space-x-3">
                  <Mail className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                  <a
                    href={`mailto:${activeContact.email}`}
                    className="text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {activeContact.email}
                  </a>
                </div>
              </div>

              {activeContact.notes && (
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Notes</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{activeContact.notes}</p>
                </div>
              )}

              {/* Activity Buttons */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Log Activity</h3>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => openActivityModal('call')}
                    className="flex items-center justify-center space-x-2 px-4 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <PhoneCall className="w-5 h-5" />
                    <span>Log Call</span>
                  </button>
                  <button
                    onClick={() => openActivityModal('email')}
                    className="flex items-center justify-center space-x-2 px-4 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <Send className="w-5 h-5" />
                    <span>Log Email</span>
                  </button>
                  <button
                    onClick={() => openActivityModal('social')}
                    className="flex items-center justify-center space-x-2 px-4 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <Share2 className="w-5 h-5" />
                    <span>Log Social</span>
                  </button>
                  <button
                    onClick={() => openActivityModal('note')}
                    className="flex items-center justify-center space-x-2 px-4 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <FileText className="w-5 h-5" />
                    <span>Log Note</span>
                  </button>
                </div>
              </div>

              {/* Call Script Panel */}
              <div className="mb-6">
                <button
                  onClick={() => setScriptExpanded(!scriptExpanded)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                >
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Call Script</span>
                  {scriptExpanded ? (
                    <ChevronUp className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                  )}
                </button>
                {scriptExpanded && (
                  <div className="mt-3 p-4 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg">
                    <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                      {/* Placeholder: Future integration with call_scripts table */}
                      Hi, this is [Your Name] from [Company]. I'm reaching out because we help companies like{' '}
                      {activeContact.company || '[Company]'} with [Value Proposition].
                      {'\n\n'}
                      I wanted to see if you have a few minutes to discuss how we could help you with [Specific Pain Point]?
                      {'\n\n'}
                      [Listen for response and move to qualification questions...]
                    </p>
                  </div>
                )}
              </div>

              {/* Navigation Buttons */}
              <div className="flex space-x-3 mt-8">
                <button
                  onClick={handleNext}
                  disabled={activeIndex >= contacts.length - 1}
                  className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  <span>Next Contact</span>
                  <ChevronRight className="w-5 h-5" />
                </button>
                <button
                  onClick={handleSkip}
                  disabled={contacts.length <= 1}
                  className="flex items-center space-x-2 px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <SkipForward className="w-5 h-5" />
                  <span>Skip</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-gray-500 dark:text-gray-400">No contact selected</p>
            </div>
          )}
        </div>
      </div>

      {/* Activity Logging Modal */}
      {activeContact && (
        <LogActivityModal
          isOpen={activityModalOpen}
          onClose={() => setActivityModalOpen(false)}
          contactId={activeContact.id}
          salesblockId={salesblockId!}
          userId={user!.id}
          orgId={orgId}
          activityType={activityType}
          onSuccess={refreshActivityStatus}
        />
      )}
    </div>
  );
}
