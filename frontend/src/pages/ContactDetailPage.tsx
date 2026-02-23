import { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Mail, Phone, Building2, Briefcase, Share2, Calendar } from 'lucide-react';
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

  if (loading || !contact) {
    return (
      <div className="p-8">
        <p className="text-gray-500 dark:text-gray-400">Loading contact...</p>
      </div>
    );
  }

  return (
    <div className="p-8">
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
  );
}
