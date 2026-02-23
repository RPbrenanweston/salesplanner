import { useState, useEffect } from 'react';
import { X, Mail, Calendar } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { getFreeBusySlots, formatAvailabilityText } from '../lib/calendar';

interface ComposeEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  contact: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    company: string | null;
    title: string | null;
  };
  onSuccess?: () => void;
}

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
}

interface OAuthConnection {
  provider: 'gmail' | 'outlook';
  access_token: string;
  refresh_token: string;
  expires_at: string;
}

export default function ComposeEmailModal({ isOpen, onClose, contact, onSuccess }: ComposeEmailModalProps) {
  const { user } = useAuth();
  const [to, setTo] = useState(contact.email);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');
  const [oauthConnection, setOauthConnection] = useState<OAuthConnection | null>(null);
  const [isInsertingAvailability, setIsInsertingAvailability] = useState(false);

  useEffect(() => {
    if (isOpen && user) {
      loadTemplates();
      loadOAuthConnection();
      setTo(contact.email);
    }
  }, [isOpen, user, contact.email]);

  const loadTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('email_templates')
        .select('id, name, subject, body')
        .or(`owner_id.eq.${user?.id},and(is_shared.eq.true)`)
        .order('name');

      if (error) throw error;
      setTemplates(data || []);
    } catch (err) {
      console.error('Error loading templates:', err);
    }
  };

  const loadOAuthConnection = async () => {
    try {
      const { data, error } = await supabase
        .from('oauth_connections')
        .select('provider, access_token, refresh_token, expires_at')
        .in('provider', ['gmail', 'outlook'])
        .maybeSingle();

      if (error) throw error;
      setOauthConnection(data);
    } catch (err) {
      console.error('Error loading OAuth connection:', err);
    }
  };

  const fillTemplate = (template: EmailTemplate) => {
    let filledSubject = template.subject;
    let filledBody = template.body;

    // Replace variables with contact data
    const replacements: Record<string, string> = {
      '{{first_name}}': contact.first_name,
      '{{last_name}}': contact.last_name,
      '{{company}}': contact.company || '',
      '{{title}}': contact.title || '',
    };

    Object.entries(replacements).forEach(([placeholder, value]) => {
      const regex = new RegExp(placeholder, 'g');
      filledSubject = filledSubject.replace(regex, value);
      filledBody = filledBody.replace(regex, value);
    });

    setSubject(filledSubject);
    setBody(filledBody);
  };

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplateId(templateId);
    if (templateId) {
      const template = templates.find((t) => t.id === templateId);
      if (template) {
        fillTemplate(template);
      }
    } else {
      setSubject('');
      setBody('');
    }
  };

  const sendViaGmail = async (accessToken: string) => {
    // Create RFC 2822 formatted message
    const message = [
      `To: ${to}`,
      `Subject: ${subject}`,
      'Content-Type: text/plain; charset=utf-8',
      '',
      body,
    ].join('\n');

    const encodedMessage = btoa(unescape(encodeURIComponent(message)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw: encodedMessage }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'Failed to send email via Gmail');
    }

    const result = await response.json();

    // Return thread ID for reply tracking
    return { threadId: result.threadId };
  };

  const sendViaOutlook = async (accessToken: string) => {
    // First, save to Sent Items to get conversation ID
    const message = {
      subject: subject,
      body: {
        contentType: 'Text',
        content: body,
      },
      toRecipients: [
        {
          emailAddress: {
            address: to,
          },
        },
      ],
    };

    // Create draft and send
    const createResponse = await fetch('https://graph.microsoft.com/v1.0/me/messages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    if (!createResponse.ok) {
      const errorData = await createResponse.json();
      throw new Error(errorData.error?.message || 'Failed to create email via Outlook');
    }

    const createdMessage = await createResponse.json();

    // Send the draft
    const sendResponse = await fetch(
      `https://graph.microsoft.com/v1.0/me/messages/${createdMessage.id}/send`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    if (!sendResponse.ok) {
      const errorData = await sendResponse.json();
      throw new Error(errorData.error?.message || 'Failed to send email via Outlook');
    }

    // Return conversation ID for reply tracking
    return { conversationId: createdMessage.conversationId };
  };

  const logActivity = async (threadId?: string, conversationId?: string) => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      const { data: dbUser } = await supabase
        .from('users')
        .select('org_id')
        .eq('id', userData.user?.id)
        .single();

      await supabase.from('activities').insert({
        org_id: dbUser?.org_id,
        contact_id: contact.id,
        user_id: userData.user?.id,
        type: 'email',
        outcome: 'other',
        notes: subject,
        thread_id: threadId || null,
        conversation_id: conversationId || null,
        created_at: new Date().toISOString(),
      });
    } catch (err) {
      console.error('Error logging activity:', err);
      // Don't throw - email was sent successfully
    }
  };

  const handleSend = async () => {
    setError('');

    if (!to || !subject || !body) {
      setError('Please fill in all fields');
      return;
    }

    if (!oauthConnection) {
      setError('No email account connected. Please connect Gmail or Outlook in Settings > Integrations.');
      return;
    }

    setIsSending(true);

    try {
      let threadId: string | undefined;
      let conversationId: string | undefined;

      if (oauthConnection.provider === 'gmail') {
        const result = await sendViaGmail(oauthConnection.access_token);
        threadId = result.threadId;
      } else if (oauthConnection.provider === 'outlook') {
        const result = await sendViaOutlook(oauthConnection.access_token);
        conversationId = result.conversationId;
      }

      // Log activity after successful send with thread/conversation ID for reply tracking
      await logActivity(threadId, conversationId);

      // Increment times_used on template if one was used
      if (selectedTemplateId) {
        const template = templates.find((t) => t.id === selectedTemplateId);
        if (template) {
          await supabase
            .from('email_templates')
            .update({ times_used: (template as any).times_used + 1 })
            .eq('id', selectedTemplateId);
        }
      }

      onSuccess?.();
      resetAndClose();
    } catch (err: any) {
      console.error('Error sending email:', err);
      setError(err.message || 'Failed to send email');
    } finally {
      setIsSending(false);
    }
  };

  const handleInsertAvailability = async () => {
    setIsInsertingAvailability(true);
    setError('');

    try {
      const slots = await getFreeBusySlots(7);
      if (!slots || slots.length === 0) {
        setError('No calendar connection or no availability found.');
        return;
      }

      const availabilityText = formatAvailabilityText(slots, 6);
      const insertText = `\n\nHere are some times that work for me:\n\n${availabilityText}\n\nLet me know what works best for you!`;

      setBody((prevBody) => prevBody + insertText);
    } catch (err: any) {
      console.error('Error inserting availability:', err);
      setError(err.message || 'Failed to fetch availability');
    } finally {
      setIsInsertingAvailability(false);
    }
  };

  const resetAndClose = () => {
    setSubject('');
    setBody('');
    setSelectedTemplateId('');
    setError('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
              <Mail className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Compose Email</h2>
          </div>
          <button
            onClick={resetAndClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          {!oauthConnection && (
            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg text-yellow-700 dark:text-yellow-400 text-sm">
              No email account connected. Please connect Gmail or Outlook in Settings &gt; Integrations.
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Use Template (optional)
            </label>
            <select
              value={selectedTemplateId}
              onChange={(e) => handleTemplateChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
            >
              <option value="">-- No template --</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              To
            </label>
            <input
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
              readOnly
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Subject
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
              placeholder="Email subject"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Body
              </label>
              <button
                type="button"
                onClick={handleInsertAvailability}
                disabled={isInsertingAvailability}
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 disabled:opacity-50"
              >
                <Calendar className="w-4 h-4" />
                {isInsertingAvailability ? 'Loading...' : 'Insert Availability'}
              </button>
            </div>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={10}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
              placeholder="Email body"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={resetAndClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={isSending || !oauthConnection}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Mail className="w-4 h-4" />
            {isSending ? 'Sending...' : 'Send Email'}
          </button>
        </div>
      </div>
    </div>
  );
}
