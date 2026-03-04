import { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Mail, Phone, Building2, Briefcase, Share2, Calendar, Zap, X, Search } from 'lucide-react';
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

  // Get return path from location state (fallback to /lists)
  const returnPath = (location.state as any)?.returnPath || '/lists';

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
    try {
      const { data, error } = await supabase
        .from('contacts')
        .select('id, first_name, last_name, email, phone, company, title, notes, created_at')
        .eq('id', contactId)
        .single();

      if (error) throw error;
      setContact(data);
    } catch (err) {
      console.error('Error loading contact:', err);
      alert('Failed to load contact details');
    } finally {
      setLoading(false);
    }
  };

  const loadResearchData = async () => {
    try {
      const { data, error } = await supabase
        .from('activities')
        .select('metadata')
        .eq('contact_id', contactId)
        .eq('type', 'research_note')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows

      if (data && data.metadata) {
        const metadata = typeof data.metadata === 'string' ? JSON.parse(data.metadata) : data.metadata;
        setResearchData({
          scratchpad: metadata.scratchpad || '',
          intelNotes: metadata.intelNotes || '',
          signals: metadata.signals || [],
        });
      }
    } catch (err) {
      console.error('Error loading research data:', err);
    }
  };

  const saveResearchData = async () => {
    if (!user) return;

    setIsSavingResearch(true);
    try {
      const { error } = await supabase
        .from('activities')
        .insert([
          {
            contact_id: contactId,
            user_id: user.id,
            type: 'research_note',
            description: 'Research Lab update',
            metadata: JSON.stringify(researchData),
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

  if (loading || !contact) {
    return (
      <div className="p-8">
        <p className="text-gray-500 dark:text-gray-400">Loading contact...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-white dark:bg-gray-950">
      <div className="flex-1 p-8 overflow-y-auto">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => navigate(returnPath)}
            className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>

          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                {contact.first_name} {contact.last_name}
              </h1>
              <div className="space-y-1 text-gray-600 dark:text-gray-400">
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
                    className="text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {contact.email}
                  </a>
                </p>
                {contact.phone && (
                  <p className="flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    <a
                      href={`tel:${contact.phone}`}
                      className="text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {contact.phone}
                    </a>
                  </p>
                )}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex gap-2">
              <button
                onClick={() => setIsEmailModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Mail className="w-4 h-4" />
                Send Email
              </button>
              <button
                onClick={() => setIsSocialModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
              >
                <Share2 className="w-4 h-4" />
                Log Social
              </button>
              <button
                onClick={() => setIsMeetingModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                <Calendar className="w-4 h-4" />
                Book Meeting
              </button>
            </div>
          </div>
        </div>

        {/* Contact Notes */}
        {contact.notes && (
          <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Contact Notes</h3>
            <p className="text-gray-700 dark:text-gray-300">{contact.notes}</p>
          </div>
        )}

        {/* Activity Timeline */}
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
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
              className="w-full px-4 py-2 bg-indigo-electric text-white rounded-lg font-medium hover:bg-indigo-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
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
        } z-40 p-3 bg-indigo-electric text-white rounded-l-lg hover:bg-indigo-600 shadow-lg`}
      >
        <Search className="w-5 h-5" />
      </button>
    </div>
  );
}
