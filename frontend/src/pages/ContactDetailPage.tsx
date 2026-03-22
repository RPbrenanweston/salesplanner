// @crumb frontend-page-contact-detail
// UI/PAGES | load_contact_by_id | render_editable_fields | activity_timeline | action_modals | deal_associations | back_navigation
// why: Full contact record view — display and edit contact fields, log activities, compose email, book meeting, view timeline
// in:useParams(contactId),useLocation(back state),useAuth(user),supabase(contacts,activities,deals),4 action modal components out:contact detail card with inline edit,activity timeline,action button row,deal association panel err:contact not found(404 UI),Supabase update failure(alert shown),research save failure(alert)
// hazard: useLocation back navigation depends on location.state.from — if navigated directly, state is null and back button navigates wrong
// hazard: Inline field editing with no optimistic rollback — if save fails, input shows new value but DB has old value
// edge:frontend/src/components/LogActivityModal.tsx -> CALLS
// edge:frontend/src/components/ComposeEmailModal.tsx -> CALLS
// edge:frontend/src/components/BookMeetingModal.tsx -> CALLS
// edge:frontend/src/components/ContactActivityTimeline.tsx -> RELATES
// edge:frontend/src/lib/supabase.ts -> CALLS
// edge:frontend/src/App.tsx -> RELATES
// edge:contact#1 -> STEP_IN
// prompt: Fix back navigation null guard (location.state?.from ?? '/lists'). Add error toast on field save failure. Confirm contacts table has org_id scoping.
import { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Mail, Phone, Building2, Briefcase, Share2, Calendar, Zap, X, Search, Pencil, Check, Globe, Linkedin, Twitter } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import ContactActivityTimeline from '../components/ContactActivityTimeline';
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
  notes: string | null;
  created_at: string;
  domain: string | null;
  linkedin_url: string | null;
  company_linkedin_url: string | null;
  twitter_handle: string | null;
  company_twitter: string | null;
}

interface ResearchData {
  scratchpad: string;
  intelNotes: string;
  signals: string[];
}

const SIGNAL_OPTIONS = ['Hiring', 'Funding', 'Expansion', 'Leadership Change', 'Product Launch', 'Partnership'];

export default function ContactDetailPage() {
  const { contactId } = useParams<{ contactId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const [contact, setContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [isSocialModalOpen, setIsSocialModalOpen] = useState(false);
  const [isMeetingModalOpen, setIsMeetingModalOpen] = useState(false);
  const [orgId, setOrgId] = useState<string>('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [researchData, setResearchData] = useState<ResearchData>({
    scratchpad: '',
    intelNotes: '',
    signals: [],
  });
  const [isSavingResearch, setIsSavingResearch] = useState(false);
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [editableNotes, setEditableNotes] = useState('');
  const [isSavingNotes, setIsSavingNotes] = useState(false);

  // Get return path from location state.
  // If user navigated directly (no history) or state is missing, fall back to /contacts.
  const returnPath =
    (location.state as any)?.returnPath ||
    (window.history.length <= 1 ? '/contacts' : '/contacts');

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
    if (contactId) {
      loadContact();
      loadResearchData();
    }
  }, [contactId]);

  const loadContact = async () => {
    setLoading(true);
    setNotFound(false);
    try {
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('id', contactId)
        .single();

      if (error) throw error;
      if (!data) {
        setNotFound(true);
        return;
      }
      setContact(data);
    } catch (err) {
      console.error('Error loading contact:', err);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  const loadResearchData = async () => {
    try {
      // Research data is stored as a 'note' activity with JSON in the notes field
      // We identify research notes by outcome='research_lab'
      const { data, error } = await supabase
        .from('activities')
        .select('notes')
        .eq('contact_id', contactId)
        .eq('type', 'note')
        .eq('outcome', 'other')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      // Find the most recent research lab entry (JSON with scratchpad key)
      const researchEntry = (data || []).find((row) => {
        if (!row.notes) return false;
        try {
          const parsed = JSON.parse(row.notes);
          return parsed._type === 'research_lab';
        } catch {
          return false;
        }
      });

      if (researchEntry?.notes) {
        const parsed = JSON.parse(researchEntry.notes);
        setResearchData({
          scratchpad: parsed.scratchpad || '',
          intelNotes: parsed.intelNotes || '',
          signals: parsed.signals || [],
        });
      }
    } catch (err) {
      console.error('Error loading research data:', err);
    }
  };

  const saveResearchData = async () => {
    if (!user || !orgId) return;

    setIsSavingResearch(true);
    try {
      const researchPayload = {
        _type: 'research_lab',
        scratchpad: researchData.scratchpad,
        intelNotes: researchData.intelNotes,
        signals: researchData.signals,
      };

      const { error } = await supabase
        .from('activities')
        .insert([
          {
            org_id: orgId,
            contact_id: contactId,
            user_id: user.id,
            type: 'note',
            outcome: 'other',
            notes: JSON.stringify(researchPayload),
          },
        ]);

      if (error) throw error;
      await loadResearchData();
    } catch (err) {
      console.error('Error saving research data:', err);
      alert('Failed to save research data');
    } finally {
      setIsSavingResearch(false);
    }
  };

  const saveNotes = async () => {
    if (!contact) return;
    setIsSavingNotes(true);
    try {
      const { error } = await supabase
        .from('contacts')
        .update({ notes: editableNotes || null })
        .eq('id', contact.id);

      if (error) throw error;
      setContact({ ...contact, notes: editableNotes || null });
      setIsEditingNotes(false);
    } catch (err) {
      console.error('Error saving notes:', err);
      alert('Failed to save notes');
    } finally {
      setIsSavingNotes(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-full bg-gray-50 dark:bg-void-950 p-6 flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-400 dark:text-white/40">
          <div className="w-5 h-5 border-2 border-indigo-electric border-t-transparent rounded-full animate-spin" />
          <span className="font-mono text-sm tracking-widest uppercase">Loading Contact...</span>
        </div>
      </div>
    );
  }

  if (notFound || !contact) {
    return (
      <div className="min-h-full bg-gray-50 dark:bg-void-950 p-6 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 mx-auto bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
            <X className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="font-display text-xl font-semibold text-gray-900 dark:text-white">Contact Not Found</h2>
          <p className="text-gray-500 dark:text-white/50 text-sm max-w-md">
            This contact may have been deleted or you may not have permission to view it.
          </p>
          <button
            onClick={() => navigate(returnPath)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-electric hover:bg-indigo-electric/80 text-white rounded-lg text-sm font-semibold transition-all duration-200 ease-snappy"
          >
            <ArrowLeft className="w-4 h-4" />
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-full bg-gray-50 dark:bg-void-950">
      <div className="flex-1 p-6 overflow-y-auto space-y-6">
        {/* Header */}
        <div>
          <button
            onClick={() => navigate(returnPath)}
            className="flex items-center gap-2 text-gray-500 dark:text-white/50 hover:text-gray-900 dark:hover:text-white mb-4 transition-colors duration-150"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>

          <div className="flex items-start justify-between">
            <div>
              <p className="vv-section-title mb-1">Contact</p>
              <h1 className="font-display text-3xl font-bold text-gray-900 dark:text-white mb-2">
                {contact.first_name} {contact.last_name}
              </h1>
              <div className="space-y-1 text-gray-500 dark:text-white/50">
                {contact.title && contact.company && (
                  <p className="flex items-center gap-2">
                    <Briefcase className="w-4 h-4" />
                    {contact.title} at {contact.company}
                  </p>
                )}
                {contact.title && !contact.company && (
                  <p className="flex items-center gap-2">
                    <Briefcase className="w-4 h-4" />
                    {contact.title}
                  </p>
                )}
                {!contact.title && contact.company && (
                  <p className="flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    {contact.company}
                  </p>
                )}
                <p className="flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  <a
                    href={`mailto:${contact.email}`}
                    className="text-indigo-electric hover:text-indigo-electric/70 transition-colors duration-150"
                  >
                    {contact.email}
                  </a>
                </p>
                {contact.phone && (
                  <p className="flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    <a
                      href={`tel:${contact.phone}`}
                      className="text-indigo-electric hover:text-indigo-electric/70 transition-colors duration-150"
                    >
                      {contact.phone}
                    </a>
                  </p>
                )}
                {contact.domain && (
                  <p className="flex items-center gap-2">
                    <Globe className="w-4 h-4" />
                    <a
                      href={`https://${contact.domain}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-electric hover:text-indigo-electric/70 transition-colors duration-150"
                    >
                      {contact.domain}
                    </a>
                  </p>
                )}
                {contact.linkedin_url && (
                  <p className="flex items-center gap-2">
                    <Linkedin className="w-4 h-4" />
                    <a
                      href={contact.linkedin_url.startsWith('http') ? contact.linkedin_url : `https://${contact.linkedin_url}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-electric hover:text-indigo-electric/70 transition-colors duration-150"
                    >
                      LinkedIn Profile
                    </a>
                  </p>
                )}
                {contact.twitter_handle && (
                  <p className="flex items-center gap-2">
                    <Twitter className="w-4 h-4" />
                    <a
                      href={`https://x.com/${contact.twitter_handle.replace('@', '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-electric hover:text-indigo-electric/70 transition-colors duration-150"
                    >
                      @{contact.twitter_handle.replace('@', '')}
                    </a>
                  </p>
                )}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex gap-2">
              <button
                onClick={() => setIsEmailModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-electric hover:bg-indigo-electric/80 text-white rounded-lg text-sm font-semibold transition-all duration-200 ease-snappy"
              >
                <Mail className="w-4 h-4" />
                Send Email
              </button>
              <button
                onClick={() => setIsSocialModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-white/10 border border-gray-200 dark:border-white/10 text-gray-700 dark:text-white/70 rounded-lg text-sm font-semibold hover:bg-gray-50 dark:hover:bg-white/20 transition-all duration-200 ease-snappy"
              >
                <Share2 className="w-4 h-4" />
                Log Social
              </button>
              <button
                onClick={() => setIsMeetingModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-signal hover:bg-emerald-signal/80 text-white rounded-lg text-sm font-semibold transition-all duration-200 ease-snappy"
              >
                <Calendar className="w-4 h-4" />
                Book Meeting
              </button>
            </div>
          </div>
        </div>

        {/* Contact Notes — Editable */}
        <div className="glass-card p-4 border-l-4 border-amber-400">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-display font-semibold text-gray-900 dark:text-white">Contact Notes</h3>
            {!isEditingNotes ? (
              <button
                onClick={() => {
                  setEditableNotes(contact.notes || '');
                  setIsEditingNotes(true);
                }}
                className="flex items-center gap-1 text-xs text-gray-500 dark:text-white/40 hover:text-indigo-electric dark:hover:text-indigo-electric transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" />
                Edit
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={saveNotes}
                  disabled={isSavingNotes}
                  className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 disabled:opacity-50 transition-colors"
                >
                  <Check className="w-3.5 h-3.5" />
                  {isSavingNotes ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={() => setIsEditingNotes(false)}
                  className="flex items-center gap-1 text-xs text-gray-500 dark:text-white/40 hover:text-red-500 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                  Cancel
                </button>
              </div>
            )}
          </div>
          {isEditingNotes ? (
            <textarea
              value={editableNotes}
              onChange={(e) => setEditableNotes(e.target.value)}
              placeholder="Add notes about this contact, call session details, follow-up items..."
              className="w-full min-h-[100px] px-3 py-2 border border-gray-300 dark:border-white/10 rounded-lg bg-white dark:bg-void-800/50 text-gray-900 dark:text-white text-sm resize-y focus:outline-none focus:border-indigo-electric focus:ring-1 focus:ring-indigo-electric/30"
              autoFocus
            />
          ) : (
            <p className="text-sm text-gray-600 dark:text-white/50 whitespace-pre-wrap">
              {contact.notes || 'No notes yet — click Edit to add session notes, follow-ups, or context.'}
            </p>
          )}
        </div>

        {/* Activity Timeline */}
        <div className="glass-card p-6">
          <h2 className="font-display text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Activity Timeline
          </h2>
          <ContactActivityTimeline contactId={contact.id} showAddNote={true} />
        </div>

        {/* Modals */}
        {isEmailModalOpen && contact && (
          <ComposeEmailModal
            isOpen={isEmailModalOpen}
            contact={contact}
            onClose={() => setIsEmailModalOpen(false)}
            onSuccess={() => {
              setIsEmailModalOpen(false);
              loadContact(); // Refresh to update activity
            }}
          />
        )}

        {isSocialModalOpen && contact && user && (
          <LogSocialActivityModal
            isOpen={isSocialModalOpen}
            contactId={contact.id}
            salesblockId={null}
            userId={user.id}
            orgId={orgId}
            onClose={() => setIsSocialModalOpen(false)}
            onSuccess={() => {
              setIsSocialModalOpen(false);
              loadContact(); // Refresh to update activity
            }}
          />
        )}

        {isMeetingModalOpen && contact && (
          <BookMeetingModal
            isOpen={isMeetingModalOpen}
            contact={contact}
            salesblockId={null}
            onClose={() => setIsMeetingModalOpen(false)}
            onSuccess={() => {
              setIsMeetingModalOpen(false);
              loadContact(); // Refresh to update activity
            }}
          />
        )}
      </div>

      {/* Research Lab Sidebar */}
      <div
        className={`fixed right-0 top-0 h-screen w-96 bg-gradient-to-b from-void-900/95 to-void-950/95 border-l border-white/10 backdrop-blur-md transform transition-transform duration-300 ease-in-out shadow-2xl ${
          isSidebarOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Sidebar Header */}
          <div className="flex items-center justify-between p-6 border-b border-white/10">
            <div className="flex items-center gap-2">
              <Search className="w-5 h-5 text-cyan-neon" />
              <h2 className="text-lg font-semibold text-white">Research Lab</h2>
            </div>
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-400 hover:text-white" />
            </button>
          </div>

          {/* Sidebar Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* LinkedIn Scratchpad */}
            <div>
              <label className="block text-sm font-semibold text-white mb-2">LinkedIn Scratchpad</label>
              <textarea
                value={researchData.scratchpad}
                onChange={(e) =>
                  setResearchData({ ...researchData, scratchpad: e.target.value })
                }
                placeholder="Notes from LinkedIn profile, posts, activity..."
                className="w-full h-24 bg-void-800/50 border border-white/10 rounded-lg p-3 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-cyan-neon/50 focus:bg-void-800/80 transition-colors"
              />
            </div>

            {/* Company Intel */}
            <div>
              <label className="block text-sm font-semibold text-white mb-2">Company Intel</label>
              <textarea
                value={researchData.intelNotes}
                onChange={(e) =>
                  setResearchData({ ...researchData, intelNotes: e.target.value })
                }
                placeholder="Recent news, product updates, market position..."
                className="w-full h-24 bg-void-800/50 border border-white/10 rounded-lg p-3 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-cyan-neon/50 focus:bg-void-800/80 transition-colors"
              />
            </div>

            {/* Signal Tags */}
            <div>
              <label className="block text-sm font-semibold text-white mb-3">Signals</label>
              <div className="grid grid-cols-2 gap-2">
                {SIGNAL_OPTIONS.map((signal) => (
                  <button
                    key={signal}
                    onClick={() => {
                      setResearchData((prev) => ({
                        ...prev,
                        signals: prev.signals.includes(signal)
                          ? prev.signals.filter((s) => s !== signal)
                          : [...prev.signals, signal],
                      }));
                    }}
                    className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                      researchData.signals.includes(signal)
                        ? 'bg-indigo-electric text-white border border-indigo-electric shadow-lg'
                        : 'bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10'
                    }`}
                  >
                    {signal}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="border-t border-white/10 p-6">
            <button
              onClick={saveResearchData}
              disabled={isSavingResearch}
              className="w-full px-4 py-2 bg-indigo-electric hover:bg-indigo-electric/80 text-white rounded-lg font-semibold disabled:opacity-50 transition-all duration-200 ease-snappy flex items-center justify-center gap-2"
            >
              <Zap className="w-4 h-4" />
              {isSavingResearch ? 'Saving...' : 'Save Research'}
            </button>
          </div>
        </div>
      </div>

      {/* Sidebar Toggle Button */}
      <button
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className={`fixed right-0 top-8 transform transition-all duration-300 ${
          isSidebarOpen ? 'translate-x-96' : 'translate-x-0'
        } z-40 p-3 bg-indigo-electric hover:bg-indigo-electric/80 text-white rounded-l-lg shadow-lg transition-colors duration-150`}
      >
        <Search className="w-5 h-5" />
      </button>
    </div>
  );
}
