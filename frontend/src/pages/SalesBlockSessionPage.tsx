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
 * @prompt Fix setInterval cleanup — add clearInterval in useEffect return. Verify session_notes column exists on salesblocks table. Add error toast on activity log failure (currently silent). Consider persisting progress so session can be resumed if navigated away. VV design applied: void-950 bg, VV spinner, font-display headings, glass-card summary cards with indigo-electric/emerald-signal/cyan-neon/purple-neon labels, indigo-electric progress bars, VV secondary outlined buttons, indigo-electric active queue item, white/10 borders, font-mono timer, dark:text-white/40 muted text, ease-snappy CTAs.
 */
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ROUTES } from '../lib/routes';
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
  const [noteSaveError, setNoteSaveError] = useState('');

  // Session resume state
  const [resumeBannerVisible, setResumeBannerVisible] = useState(false);
  const [savedState, setSavedState] = useState<{ activeIndex: number; elapsedSeconds: number; sessionNotes: string } | null>(null);

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

        let contactIds = listContactsData.map((lc) => lc.contact_id);

        if (contactIds.length === 0) {
          // Fallback: re-resolve contacts via list filter_criteria.
          // list_contacts may be empty if contacts were added after the list was saved,
          // or if the list_contacts insert failed silently at creation time.
          const { data: listData } = await supabase
            .from('lists')
            .select('filter_criteria, org_id')
            .eq('id', sbData.list_id)
            .single();

          const filters = listData?.filter_criteria?.filters;
          if (filters && filters.length > 0) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let contactQuery: any = supabase
              .from('contacts')
              .select('id')
              .eq('org_id', listData.org_id);

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
              // Re-populate list_contacts so future sessions load instantly
              const junctionRecords = resolved.map((c, index) => ({
                list_id: sbData.list_id,
                contact_id: c.id,
                position: index,
              }));
              await supabase.from('list_contacts').insert(junctionRecords);
              contactIds = resolved.map((c) => c.id);
            }
          }

          if (contactIds.length === 0) {
            setContacts([]);
            setLoading(false);
            return;
          }
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

        // Check for saved session state to offer resume
        const savedRaw = localStorage.getItem(`salesblock_session_${salesblockId}`);
        if (savedRaw) {
          try {
            const saved = JSON.parse(savedRaw) as { activeIndex: number; elapsedSeconds: number; sessionNotes: string };
            setSavedState(saved);
            setResumeBannerVisible(true);
          } catch {
            localStorage.removeItem(`salesblock_session_${salesblockId}`);
          }
        }
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

  // Auto-save session state to localStorage when active contact or notes change
  useEffect(() => {
    if (!salesblockId || loading || isCompleted) return;
    localStorage.setItem(`salesblock_session_${salesblockId}`, JSON.stringify({
      activeIndex,
      elapsedSeconds,
      sessionNotes,
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, sessionNotes]);

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
      // Clear saved resume state — session is now complete
      if (salesblockId) localStorage.removeItem(`salesblock_session_${salesblockId}`);
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

  const handleResume = () => {
    if (savedState) {
      setActiveIndex(Math.min(savedState.activeIndex, contacts.length - 1));
      setElapsedSeconds(savedState.elapsedSeconds);
      setSessionNotes(savedState.sessionNotes);
    }
    setResumeBannerVisible(false);
  };

  const handleStartFresh = () => {
    if (salesblockId) localStorage.removeItem(`salesblock_session_${salesblockId}`);
    setResumeBannerVisible(false);
  };

  const handleSaveNotes = async () => {
    if (!salesblockId) return;

    setNoteSaveError('');
    try {
      const { error } = await supabase
        .from('salesblocks')
        .update({ notes: sessionNotes })
        .eq('id', salesblockId);

      if (error) throw error;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to save session notes';
      setNoteSaveError(errorMsg);
      console.error('Error saving notes:', error);
    }
  };

  const handleBackToHome = async () => {
    await handleSaveNotes();
    navigate(ROUTES.HOME);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50 dark:bg-void-950">
        <div className="flex items-center gap-3 text-gray-400 dark:text-white/40">
          <div className="w-5 h-5 border-2 border-indigo-electric border-t-transparent rounded-full animate-spin" />
          <span className="font-mono text-sm tracking-widest uppercase">Loading Session...</span>
        </div>
      </div>
    );
  }

  if (!salesblock) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50 dark:bg-void-950">
        <div className="glass-card p-6 border-l-4 border-red-alert">
          <p className="text-red-600 dark:text-red-alert text-sm font-semibold">SalesBlock not found</p>
        </div>
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
      <div className="flex flex-col h-full bg-gray-50 dark:bg-void-950 p-8 overflow-y-auto">
        <div className="max-w-4xl mx-auto w-full space-y-6">
          <div>
            <p className="vv-section-title mb-1">Session Complete</p>
            <h1 className="font-display text-3xl font-bold text-gray-900 dark:text-white mb-1">{salesblock.title}</h1>
            <p className="text-sm text-gray-500 dark:text-white/50">Great work — here's your session summary</p>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="glass-card p-6">
              <p className="vv-section-title mb-1">Contacts Worked</p>
              <p className="font-display text-3xl font-bold text-gray-900 dark:text-white">
                {sessionStats.contactsWorked}
              </p>
              <p className="text-xs text-gray-400 dark:text-white/40 font-mono mt-1">
                of {sessionStats.totalContacts} ({contactWorkedPercentage}%)
              </p>
            </div>

            <div className="glass-card p-6">
              <p className="vv-section-title mb-1">Calls Made</p>
              <p className="font-display text-3xl font-bold text-gray-900 dark:text-white">{sessionStats.calls}</p>
            </div>

            <div className="glass-card p-6">
              <p className="vv-section-title mb-1">Emails Sent</p>
              <p className="font-display text-3xl font-bold text-gray-900 dark:text-white">{sessionStats.emails}</p>
            </div>

            <div className="glass-card p-6">
              <p className="vv-section-title mb-1">Social Touches</p>
              <p className="font-display text-3xl font-bold text-gray-900 dark:text-white">{sessionStats.social}</p>
            </div>

            <div className="glass-card p-6">
              <p className="vv-section-title mb-1">Meetings Booked</p>
              <p className="font-display text-3xl font-bold text-emerald-signal">{sessionStats.meetings}</p>
            </div>

            <div className="glass-card p-6">
              <p className="vv-section-title mb-1">Duration</p>
              <p className="font-display text-3xl font-bold text-gray-900 dark:text-white font-mono">
                {Math.round(elapsedSeconds / 60)} min
              </p>
            </div>
          </div>

          {/* Conversion Ratios */}
          <div className="glass-card p-6">
            <h3 className="font-display font-semibold text-gray-900 dark:text-white mb-4">Conversion Ratios</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <p className="text-sm text-gray-500 dark:text-white/50 mb-2">Contacts Worked / Total</p>
                <div className="flex items-center gap-3">
                  <div className="flex-1 bg-gray-200 dark:bg-white/10 rounded-full h-2">
                    <div
                      className="bg-indigo-electric h-2 rounded-full transition-all"
                      style={{ width: `${contactWorkedPercentage}%` }}
                    />
                  </div>
                  <span className="font-mono text-sm font-bold text-gray-900 dark:text-white">{contactWorkedPercentage}%</span>
                </div>
              </div>

              <div>
                <p className="text-sm text-gray-500 dark:text-white/50 mb-2">Calls to Connects</p>
                <div className="flex items-center gap-3">
                  <div className="flex-1 bg-gray-200 dark:bg-white/10 rounded-full h-2">
                    <div
                      className="bg-emerald-signal h-2 rounded-full transition-all"
                      style={{ width: `${callsToConnects}%` }}
                    />
                  </div>
                  <span className="font-mono text-sm font-bold text-gray-900 dark:text-white">{callsToConnects}%</span>
                </div>
              </div>

              <div>
                <p className="text-sm text-gray-500 dark:text-white/50 mb-2">Connects to Meetings</p>
                <div className="flex items-center gap-3">
                  <div className="flex-1 bg-gray-200 dark:bg-white/10 rounded-full h-2">
                    <div
                      className="bg-purple-neon h-2 rounded-full transition-all"
                      style={{ width: `${connectsToMeetings}%` }}
                    />
                  </div>
                  <span className="font-mono text-sm font-bold text-gray-900 dark:text-white">{connectsToMeetings}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Session Notes */}
          <div className="glass-card p-6">
            <label className="vv-section-title block mb-2">
              Session Notes
            </label>
            <textarea
              value={sessionNotes}
              onChange={(e) => setSessionNotes(e.target.value)}
              placeholder="Add any observations or follow-up items from this session..."
              className="w-full px-4 py-3 border border-gray-200 dark:border-white/10 rounded-lg bg-white dark:bg-white/5 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-indigo-electric text-sm"
              rows={4}
            />
            {noteSaveError && (
              <div className="mt-3 p-3 bg-red-alert/10 border border-red-alert rounded-lg flex items-center gap-2">
                <span className="text-red-alert text-sm">⚠ {noteSaveError}</span>
              </div>
            )}
          </div>

          {/* Back to Home */}
          <button
            onClick={handleBackToHome}
            className="flex items-center gap-2 px-6 py-3 bg-indigo-electric hover:bg-indigo-electric/80 text-white rounded-lg font-semibold transition-all duration-200 ease-snappy"
          >
            <Home className="w-5 h-5" />
            <span>Back to Home</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-void-950">
      {/* Timer Bar */}
      <div className="bg-white dark:bg-white/5 border-b border-gray-200 dark:border-white/10 p-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-display text-lg font-semibold text-gray-900 dark:text-white">{salesblock.title}</h2>
          <div className="flex items-center gap-4">
            <div className="text-sm text-gray-600 dark:text-white/50 font-mono">
              {formatTime(elapsedSeconds)} / {salesblock.duration_minutes} min
            </div>
            <button
              onClick={handleEndSession}
              className="px-4 py-2 bg-red-alert text-white text-sm rounded-lg hover:bg-red-alert/80 transition-all duration-200 ease-snappy"
            >
              End Session
            </button>
          </div>
        </div>
        <div className="w-full bg-gray-200 dark:bg-white/10 rounded-full h-2">
          <div
            className="bg-indigo-electric h-2 rounded-full transition-all duration-300"
            style={{ width: `${Math.min(progressPercentage, 100)}%` }}
          />
        </div>
      </div>

      {/* Session Resume Banner */}
      {resumeBannerVisible && (
        <div className="bg-indigo-electric/10 border-b border-indigo-electric/30 px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-indigo-electric">Resume where you left off?</p>
            <p className="text-xs text-gray-500 dark:text-white/40 mt-0.5">
              Saved progress found — contact {(savedState?.activeIndex ?? 0) + 1} of {contacts.length}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleStartFresh}
              className="px-3 py-1.5 text-xs border border-gray-200 dark:border-white/10 text-gray-600 dark:text-white/60 rounded-lg hover:bg-gray-50 dark:hover:bg-white/[0.08] transition-all duration-150 ease-snappy"
            >
              Start Fresh
            </button>
            <button
              onClick={handleResume}
              className="px-3 py-1.5 text-xs bg-indigo-electric text-white rounded-lg hover:bg-indigo-electric/80 transition-all duration-200 ease-snappy"
            >
              Resume
            </button>
          </div>
        </div>
      )}

      {/* Main Content: Queue + Active Contact */}
      <div className="flex flex-1 overflow-hidden">
        {/* Contact Queue (Left Sidebar) */}
        <div className="w-80 border-r border-gray-200 dark:border-white/10 overflow-y-auto bg-gray-50 dark:bg-white/[0.02]">
          <div className="p-4 border-b border-gray-200 dark:border-white/10">
            <h3 className="vv-section-title">
              Contact Queue ({contacts.length})
            </h3>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-white/10">
            {contacts.map((contact, index) => (
              <div
                key={contact.id}
                className={`p-4 cursor-pointer transition-all duration-150 ease-snappy ${
                  index === activeIndex
                    ? 'bg-indigo-electric/10 dark:bg-indigo-electric/10 border-l-4 border-indigo-electric'
                    : 'hover:bg-gray-50 dark:hover:bg-white/[0.08]'
                }`}
                onClick={() => setActiveIndex(index)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {contact.first_name} {contact.last_name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-white/40 truncate">{contact.company || 'No company'}</p>
                  </div>
                  {contact.hasActivity && (
                    <Check className="w-5 h-5 text-emerald-signal flex-shrink-0 ml-2" />
                  )}
                </div>
              </div>
            ))}
            {contacts.length === 0 && (
              <div className="p-8 text-center">
                <p className="text-sm text-gray-500 dark:text-white/40">No contacts in this list</p>
              </div>
            )}
          </div>
        </div>

        {/* Active Contact Detail (Right Panel) */}
        <div className="flex-1 overflow-y-auto p-8">
          {activeContact ? (
            <div>
              <div className="mb-6">
                <h1 className="font-display text-3xl font-bold text-gray-900 dark:text-white mb-2">
                  {activeContact.first_name} {activeContact.last_name}
                </h1>
                <p className="text-lg text-gray-600 dark:text-white/50">
                  {activeContact.title || 'No title'} at {activeContact.company || 'No company'}
                </p>
              </div>

              <div className="space-y-4 mb-6">
                {activeContact.phone && (
                  <div className="flex items-center gap-3">
                    <Phone className="w-5 h-5 text-gray-500 dark:text-white/40" />
                    <a
                      href={`tel:${activeContact.phone}`}
                      className="text-indigo-electric hover:text-indigo-electric/70 transition-colors duration-150"
                    >
                      {activeContact.phone}
                    </a>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <Mail className="w-5 h-5 text-gray-500 dark:text-white/40" />
                  <a
                    href={`mailto:${activeContact.email}`}
                    className="text-indigo-electric hover:text-indigo-electric/70 transition-colors duration-150"
                  >
                    {activeContact.email}
                  </a>
                </div>
              </div>

              {activeContact.notes && (
                <div className="mb-6">
                  <h3 className="vv-section-title mb-2">Notes</h3>
                  <p className="text-sm text-gray-600 dark:text-white/40 whitespace-pre-wrap">{activeContact.notes}</p>
                </div>
              )}

              {/* Quick Actions */}
              <div className="mb-6">
                <h3 className="vv-section-title mb-3">Quick Actions</h3>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setIsEmailModalOpen(true)}
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-indigo-electric text-white rounded-lg hover:bg-indigo-electric/80 transition-all duration-200 ease-snappy"
                  >
                    <Mail className="w-5 h-5" />
                    <span>Send Email</span>
                  </button>
                  <button
                    onClick={() => setIsMeetingModalOpen(true)}
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-emerald-signal text-white rounded-lg hover:bg-emerald-signal/80 transition-all duration-200 ease-snappy"
                  >
                    <Calendar className="w-5 h-5" />
                    <span>Book Meeting</span>
                  </button>
                </div>
              </div>

              {/* Activity Buttons */}
              <div className="mb-6">
                <h3 className="vv-section-title mb-3">Log Activity</h3>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => openActivityModal('call')}
                    className="flex items-center justify-center gap-2 px-4 py-3 border border-gray-200 dark:border-white/10 text-gray-700 dark:text-white/70 rounded-lg hover:bg-gray-50 dark:hover:bg-white/[0.08] transition-all duration-150 ease-snappy"
                  >
                    <PhoneCall className="w-5 h-5" />
                    <span>Log Call</span>
                  </button>
                  <button
                    onClick={() => openActivityModal('email')}
                    className="flex items-center justify-center gap-2 px-4 py-3 border border-gray-200 dark:border-white/10 text-gray-700 dark:text-white/70 rounded-lg hover:bg-gray-50 dark:hover:bg-white/[0.08] transition-all duration-150 ease-snappy"
                  >
                    <Send className="w-5 h-5" />
                    <span>Log Email</span>
                  </button>
                  <button
                    onClick={openSocialModal}
                    className="flex items-center justify-center gap-2 px-4 py-3 border border-gray-200 dark:border-white/10 text-gray-700 dark:text-white/70 rounded-lg hover:bg-gray-50 dark:hover:bg-white/[0.08] transition-all duration-150 ease-snappy"
                  >
                    <Share2 className="w-5 h-5" />
                    <span>Log Social</span>
                  </button>
                  <button
                    onClick={() => openActivityModal('note')}
                    className="flex items-center justify-center gap-2 px-4 py-3 border border-gray-200 dark:border-white/10 text-gray-700 dark:text-white/70 rounded-lg hover:bg-gray-50 dark:hover:bg-white/[0.08] transition-all duration-150 ease-snappy"
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
                  className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 transition-all duration-150 ease-snappy"
                >
                  <span className="text-sm font-semibold text-gray-700 dark:text-white/70">Call Script</span>
                  {scriptExpanded ? (
                    <ChevronUp className="w-5 h-5 text-gray-500 dark:text-white/40" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-500 dark:text-white/40" />
                  )}
                </button>
                {scriptExpanded && (
                  <div className="mt-3 p-4 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg">
                    <p className="text-sm text-gray-600 dark:text-white/50 whitespace-pre-wrap">
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
                <h3 className="vv-section-title mb-3">Activity Timeline</h3>
                <div className="glass-card p-4">
                  <ContactActivityTimeline
                    contactId={activeContact.id}
                    showAddNote={false}
                    onActivityLogged={refreshActivityStatus}
                  />
                </div>
              </div>

              {/* Navigation Buttons */}
              <div className="flex gap-3 mt-8">
                <button
                  onClick={handleNext}
                  disabled={activeIndex >= contacts.length - 1}
                  className="flex items-center gap-2 px-6 py-3 bg-indigo-electric text-white rounded-lg hover:bg-indigo-electric/80 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 ease-snappy"
                >
                  <span>Next Contact</span>
                  <ChevronRight className="w-5 h-5" />
                </button>
                <button
                  onClick={handleSkip}
                  disabled={contacts.length <= 1}
                  className="flex items-center gap-2 px-6 py-3 border border-gray-200 dark:border-white/10 text-gray-700 dark:text-white/70 rounded-lg hover:bg-gray-50 dark:hover:bg-white/[0.08] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150 ease-snappy"
                >
                  <SkipForward className="w-5 h-5" />
                  <span>Skip</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-gray-500 dark:text-white/40">No contact selected</p>
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
