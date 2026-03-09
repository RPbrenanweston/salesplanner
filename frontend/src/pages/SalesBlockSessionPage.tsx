/**
 * @crumb
 * @id frontend-page-salesblock-session
 * @area UI/Pages
 * @intent Core session execution engine — step through contacts in a SalesBlock with live activity logging, elapsed timer, call script panel, and session completion summary
 * @responsibilities Load SalesBlock + contacts list, run elapsed timer, advance contact index, log calls/emails/social/meetings via modals, display inline call script, mark session complete with stats summary, persist session_notes
 * @contracts SalesBlockSessionPage() → JSX; receives salesblockId via useParams; reads salesblocks+lists+contacts from Supabase; writes activities on every log action; writes session_notes on complete
 * @in useParams (salesblockId), useAuth (user/org_id), supabase (salesblocks, lists, contacts, activities tables), 4 activity modal components
 * @out Full-screen session UI with contact card, action buttons, script panel, timer, progress bar; completion screen with stats breakdown
 * @err Contact load failure (session starts with empty contacts array, no error shown); Supabase write failure on activity log (silent loss — no retry, no error toast)
 * @hazard Elapsed timer uses setInterval with no cleanup guard — if component unmounts mid-session (navigate away), interval leaks and continues firing; causes memory leak + stale state updates
 * @hazard Session completion writes sessionNotes to a field that may not exist on the salesblocks table — verify notes column exists before trusting completion persistence
 * @shared-edges frontend/src/components/LogActivityModal.tsx→LAUNCHES for call/email/note; frontend/src/components/LogSocialActivityModal.tsx→LAUNCHES for social; frontend/src/components/ComposeEmailModal.tsx→LAUNCHES for email compose; frontend/src/components/BookMeetingModal.tsx→LAUNCHES for meetings; frontend/src/components/ContactActivityTimeline.tsx→RENDERS below contact card; frontend/src/lib/supabase.ts→ALL queries
 * @trail session#1 | Page mounts with salesblockId → load salesblock+contacts → start elapsed timer → show first contact → log activity via modal → advance index → script panel expandable → all contacts done → show completion screen with stats
 * @prompt Fix setInterval cleanup — add clearInterval in useEffect return. Verify session_notes column exists on salesblocks table. Add error toast on activity log failure (currently silent). Consider persisting progress so session can be resumed if navigated away.
 */
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Phone, Mail, ChevronRight, SkipForward, Check, PhoneCall, Send, Share2, FileText, ChevronDown, ChevronUp, Home, Calendar } from 'lucide-react';
import LogActivityModal from '../components/LogActivityModal';
import LogSocialActivityModal from '../components/LogSocialActivityModal';
import ComposeEmailModal from '../components/ComposeEmailModal';
import BookMeetingModal from '../components/BookMeetingModal';
import ContactActivityTimeline from '../components/ContactActivityTimeline';

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

interface SessionStats {
  totalContacts: number;
  contactsWorked: number;
  calls: number;
  emails: number;
  social: number;
  meetings: number;
  connects: number;
  conversations: number;
}

export default function SalesBlockSessionPage() {
  const { salesblockId } = useParams<{ salesblockId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [salesblock, setSalesblock] = useState<SalesBlock | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [loading, setLoading] = useState(true);
  const [orgId, setOrgId] = useState<string>('');

  // Activity modal state
  const [activityModalOpen, setActivityModalOpen] = useState(false);
  const [isSocialModalOpen, setIsSocialModalOpen] = useState(false);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [isMeetingModalOpen, setIsMeetingModalOpen] = useState(false);
  const [activityType, setActivityType] = useState<'call' | 'email' | 'note'>('call');

  // Call script panel state
  const [scriptExpanded, setScriptExpanded] = useState(false);

  // Completion state
  const [isCompleted, setIsCompleted] = useState(false);
  const [sessionStats, setSessionStats] = useState<SessionStats | null>(null);
  const [sessionNotes, setSessionNotes] = useState('');

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

  // Timer interval (counts up from 0, triggers completion on expiry)
  useEffect(() => {
    if (isCompleted) return; // Don't run timer if already completed

    const interval = setInterval(() => {
      setElapsedSeconds((prev) => {
        const newElapsed = prev + 1;

        // Check if timer expired
        if (salesblock && newElapsed >= salesblock.duration_minutes * 60) {
          handleEndSession();
          return newElapsed;
        }

        return newElapsed;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [salesblock, isCompleted]);

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

  const openActivityModal = (type: 'call' | 'email' | 'note') => {
    setActivityType(type);
    setActivityModalOpen(true);
  };

  const openSocialModal = () => {
    setIsSocialModalOpen(true);
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

  const handleEndSession = async () => {
    if (!salesblockId) return;

    try {
      // Calculate session stats
      const stats = await calculateSessionStats();

      // Update salesblock status
      const { error } = await supabase
        .from('salesblocks')
        .update({
          status: 'completed',
          actual_end: new Date().toISOString(),
        })
        .eq('id', salesblockId);

      if (error) throw error;

      setSessionStats(stats);
      setIsCompleted(true);
    } catch (error) {
      console.error('Error ending session:', error);
      alert('Failed to end session');
    }
  };

  const calculateSessionStats = async (): Promise<SessionStats> => {
    if (!salesblockId) {
      return {
        totalContacts: contacts.length,
        contactsWorked: 0,
        calls: 0,
        emails: 0,
        social: 0,
        meetings: 0,
        connects: 0,
        conversations: 0,
      };
    }

    // Fetch all activities for this salesblock
    const { data: activities, error } = await supabase
      .from('activities')
      .select('type, outcome, contact_id')
      .eq('salesblock_id', salesblockId);

    if (error) {
      console.error('Error fetching activities:', error);
      return {
        totalContacts: contacts.length,
        contactsWorked: 0,
        calls: 0,
        emails: 0,
        social: 0,
        meetings: 0,
        connects: 0,
        conversations: 0,
      };
    }

    // Calculate stats
    const uniqueContacts = new Set(activities?.map((a) => a.contact_id)).size;
    const calls = activities?.filter((a) => a.type === 'call').length || 0;
    const emails = activities?.filter((a) => a.type === 'email').length || 0;
    const social = activities?.filter((a) => a.type === 'social').length || 0;
    const meetings = activities?.filter((a) => a.outcome === 'meeting_booked').length || 0;
    const connects = activities?.filter((a) => a.outcome === 'connect' || a.outcome === 'conversation').length || 0;
    const conversations = activities?.filter((a) => a.outcome === 'conversation').length || 0;

    return {
      totalContacts: contacts.length,
      contactsWorked: uniqueContacts,
      calls,
      emails,
      social,
      meetings,
      connects,
      conversations,
    };
  };

  const handleSaveNotes = async () => {
    if (!salesblockId) return;

    try {
      const { error } = await supabase
        .from('salesblocks')
        .update({ notes: sessionNotes })
        .eq('id', salesblockId);

      if (error) throw error;
    } catch (error) {
      console.error('Error saving notes:', error);
    }
  };

  const handleBackToHome = async () => {
    await handleSaveNotes();
    navigate('/');
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

  // Summary Screen (shown after completion)
  if (isCompleted && sessionStats) {
    const contactWorkedPercentage =
      sessionStats.totalContacts > 0
        ? Math.round((sessionStats.contactsWorked / sessionStats.totalContacts) * 100)
        : 0;

    const callsToConnects =
      sessionStats.calls > 0 ? Math.round((sessionStats.connects / sessionStats.calls) * 100) : 0;

    const connectsToMeetings =
      sessionStats.connects > 0 ? Math.round((sessionStats.meetings / sessionStats.connects) * 100) : 0;

    return (
      <div className="flex flex-col h-full bg-white dark:bg-gray-900 p-8 overflow-y-auto">
        <div className="max-w-4xl mx-auto w-full">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Session Complete</h1>
          <h2 className="text-xl text-gray-600 dark:text-gray-300 mb-8">{salesblock.title}</h2>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-blue-50 dark:bg-blue-900 p-6 rounded-lg">
              <p className="text-sm text-blue-600 dark:text-blue-300 font-semibold mb-1">Contacts Worked</p>
              <p className="text-3xl font-bold text-blue-700 dark:text-blue-200">
                {sessionStats.contactsWorked}
              </p>
              <p className="text-xs text-blue-500 dark:text-blue-400 mt-1">
                of {sessionStats.totalContacts} ({contactWorkedPercentage}%)
              </p>
            </div>

            <div className="bg-green-50 dark:bg-green-900 p-6 rounded-lg">
              <p className="text-sm text-green-600 dark:text-green-300 font-semibold mb-1">Calls Made</p>
              <p className="text-3xl font-bold text-green-700 dark:text-green-200">{sessionStats.calls}</p>
            </div>

            <div className="bg-purple-50 dark:bg-purple-900 p-6 rounded-lg">
              <p className="text-sm text-purple-600 dark:text-purple-300 font-semibold mb-1">Emails Sent</p>
              <p className="text-3xl font-bold text-purple-700 dark:text-purple-200">{sessionStats.emails}</p>
            </div>

            <div className="bg-orange-50 dark:bg-orange-900 p-6 rounded-lg">
              <p className="text-sm text-orange-600 dark:text-orange-300 font-semibold mb-1">Social Touches</p>
              <p className="text-3xl font-bold text-orange-700 dark:text-orange-200">{sessionStats.social}</p>
            </div>

            <div className="bg-pink-50 dark:bg-pink-900 p-6 rounded-lg">
              <p className="text-sm text-pink-600 dark:text-pink-300 font-semibold mb-1">Meetings Booked</p>
              <p className="text-3xl font-bold text-pink-700 dark:text-pink-200">{sessionStats.meetings}</p>
            </div>

            <div className="bg-indigo-50 dark:bg-indigo-900 p-6 rounded-lg">
              <p className="text-sm text-indigo-600 dark:text-indigo-300 font-semibold mb-1">Duration</p>
              <p className="text-3xl font-bold text-indigo-700 dark:text-indigo-200">
                {Math.round(elapsedSeconds / 60)} min
              </p>
            </div>
          </div>

          {/* Conversion Ratios */}
          <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-lg mb-8">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Conversion Ratios</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Contacts Worked / Total</p>
                <div className="flex items-center space-x-3">
                  <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                    <div
                      className="bg-blue-600 h-3 rounded-full transition-all"
                      style={{ width: `${contactWorkedPercentage}%` }}
                    />
                  </div>
                  <span className="text-lg font-bold text-gray-900 dark:text-white">{contactWorkedPercentage}%</span>
                </div>
              </div>

              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Calls to Connects</p>
                <div className="flex items-center space-x-3">
                  <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                    <div
                      className="bg-green-600 h-3 rounded-full transition-all"
                      style={{ width: `${callsToConnects}%` }}
                    />
                  </div>
                  <span className="text-lg font-bold text-gray-900 dark:text-white">{callsToConnects}%</span>
                </div>
              </div>

              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Connects to Meetings</p>
                <div className="flex items-center space-x-3">
                  <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                    <div
                      className="bg-pink-600 h-3 rounded-full transition-all"
                      style={{ width: `${connectsToMeetings}%` }}
                    />
                  </div>
                  <span className="text-lg font-bold text-gray-900 dark:text-white">{connectsToMeetings}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Session Notes */}
          <div className="mb-8">
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Session Notes
            </label>
            <textarea
              value={sessionNotes}
              onChange={(e) => setSessionNotes(e.target.value)}
              placeholder="Add any observations or follow-up items from this session..."
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={4}
            />
          </div>

          {/* Back to Home */}
          <button
            onClick={handleBackToHome}
            className="flex items-center justify-center space-x-2 w-full md:w-auto px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Home className="w-5 h-5" />
            <span>Back to Home</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900">
      {/* Timer Bar */}
      <div className="bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{salesblock.title}</h2>
          <div className="flex items-center space-x-4">
            <div className="text-sm text-gray-600 dark:text-gray-300">
              {formatTime(elapsedSeconds)} / {salesblock.duration_minutes} min
            </div>
            <button
              onClick={handleEndSession}
              className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors"
            >
              End Session
            </button>
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

              {/* Quick Actions */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Quick Actions</h3>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setIsEmailModalOpen(true)}
                    className="flex items-center justify-center space-x-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Mail className="w-5 h-5" />
                    <span>Send Email</span>
                  </button>
                  <button
                    onClick={() => setIsMeetingModalOpen(true)}
                    className="flex items-center justify-center space-x-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    <Calendar className="w-5 h-5" />
                    <span>Book Meeting</span>
                  </button>
                </div>
              </div>

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
                    onClick={openSocialModal}
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

              {/* Activity Timeline */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Activity Timeline</h3>
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <ContactActivityTimeline
                    contactId={activeContact.id}
                    showAddNote={false}
                    onActivityLogged={refreshActivityStatus}
                  />
                </div>
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

      {/* Social Activity Modal */}
      {activeContact && (
        <LogSocialActivityModal
          isOpen={isSocialModalOpen}
          onClose={() => setIsSocialModalOpen(false)}
          contactId={activeContact.id}
          salesblockId={salesblockId}
          userId={user!.id}
          orgId={orgId}
          onSuccess={refreshActivityStatus}
        />
      )}

      {/* Compose Email Modal */}
      {activeContact && (
        <ComposeEmailModal
          isOpen={isEmailModalOpen}
          onClose={() => setIsEmailModalOpen(false)}
          contact={activeContact}
          onSuccess={() => {
            setIsEmailModalOpen(false);
            refreshActivityStatus();
          }}
        />
      )}

      {/* Book Meeting Modal */}
      {activeContact && (
        <BookMeetingModal
          isOpen={isMeetingModalOpen}
          onClose={() => setIsMeetingModalOpen(false)}
          contact={activeContact}
          salesblockId={salesblockId}
          onSuccess={() => {
            setIsMeetingModalOpen(false);
            refreshActivityStatus();
          }}
        />
      )}
    </div>
  );
}
