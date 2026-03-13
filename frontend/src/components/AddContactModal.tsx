// @crumb frontend-component-add-contact-modal
// UI/Contacts | contact_creation_form | field_validation | supabase_insert | on_contact_added_callback
// why: Add contact modal — form to create a new contact with multi-value email/phone fields, linked to a salesblock and org
// in:salesBlockId,supabase contacts table,useAuth(user+org_id) out:New contact row,onContactAdded called err:Supabase insert failure,missing required fields (validation prevents submit)
// hazard: Multi-value email/phone stored as arrays — single primary email column type may silently truncate
// edge:frontend/src/lib/supabase.ts -> CALLS
// edge:frontend/src/hooks/useAuth.ts -> CALLS
// edge:add-contact#1 -> STEP_IN
// prompt: Validate email format before submit. Confirm array column type. Consider real-time duplicate check.
import { useState, useEffect } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

interface AddContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface CustomField {
  key: string;
  value: string;
}

export function AddContactModal({ isOpen, onClose, onSuccess }: AddContactModalProps) {
  const { user } = useAuth();
  const [orgId, setOrgId] = useState<string | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [company, setCompany] = useState('');
  const [title, setTitle] = useState('');
  const [domain, setDomain] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [companyLinkedinUrl, setCompanyLinkedinUrl] = useState('');
  const [twitterHandle, setTwitterHandle] = useState('');
  const [companyTwitter, setCompanyTwitter] = useState('');
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [existingContactId, setExistingContactId] = useState<string | null>(null);
  const [showListAssignment, setShowListAssignment] = useState(false);
  const [selectedListId, setSelectedListId] = useState<string>('');
  const [lists, setLists] = useState<Array<{ id: string; name: string }>>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdContactId, setCreatedContactId] = useState<string | null>(null);

  // Fetch org_id once when modal opens — avoids redundant DB round-trips in checkDuplicate/loadLists/handleSubmit
  useEffect(() => {
    if (!isOpen || !user) return;
    supabase
      .from('users')
      .select('org_id')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (data) setOrgId(data.org_id);
      });
  }, [isOpen, user]);

  if (!isOpen) return null;

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const checkDuplicate = async () => {
    if (!email || !validateEmail(email) || !orgId) {
      return;
    }

    const { data: existing } = await supabase
      .from('contacts')
      .select('id, first_name, last_name, company')
      .eq('org_id', orgId)
      .eq('email', email.toLowerCase())
      .maybeSingle();

    if (existing) {
      setDuplicateWarning(
        `Contact already exists: ${existing.first_name} ${existing.last_name}${
          existing.company ? ` at ${existing.company}` : ''
        }`
      );
      setExistingContactId(existing.id);
    } else {
      setDuplicateWarning(null);
      setExistingContactId(null);
    }
  };

  const addCustomField = () => {
    setCustomFields([...customFields, { key: '', value: '' }]);
  };

  const removeCustomField = (index: number) => {
    setCustomFields(customFields.filter((_, i) => i !== index));
  };

  const updateCustomField = (index: number, field: 'key' | 'value', value: string) => {
    const updated = [...customFields];
    updated[index][field] = value;
    setCustomFields(updated);
  };

  const loadLists = async () => {
    if (!user || !orgId) return;

    const { data: listsData } = await supabase
      .from('lists')
      .select('id, name')
      .eq('org_id', orgId)
      .or(`owner_id.eq.${user.id},and(is_shared.eq.true,org_id.eq.${orgId})`)
      .order('name');

    if (listsData) {
      setLists(listsData);
    }
  };

  const handleSubmit = async () => {
    if (!email || !validateEmail(email)) {
      alert('Please enter a valid email address');
      return;
    }

    if (duplicateWarning && !existingContactId) {
      // Show warning, require confirmation
      return;
    }

    if (!user || !orgId) {
      alert('Not authenticated');
      return;
    }

    setIsSubmitting(true);

    try {
      // Build custom_fields object from key-value pairs
      const customFieldsObj: Record<string, string> = {};
      customFields.forEach((cf) => {
        if (cf.key && cf.value) {
          customFieldsObj[cf.key] = cf.value;
        }
      });

      const { data: newContact, error } = await supabase
        .from('contacts')
        .insert({
          org_id: orgId,
          first_name: firstName,
          last_name: lastName,
          email: email.toLowerCase(),
          phone: phone || null,
          company: company || null,
          title: title || null,
          domain: domain || null,
          linkedin_url: linkedinUrl || null,
          company_linkedin_url: companyLinkedinUrl || null,
          twitter_handle: twitterHandle || null,
          company_twitter: companyTwitter || null,
          source: 'manual',
          custom_fields: Object.keys(customFieldsObj).length > 0 ? customFieldsObj : null,
          created_by: user.id,
        })
        .select('id')
        .single();

      if (error) {
        console.error('Error creating contact:', error);
        alert('Failed to create contact');
        setIsSubmitting(false);
        return;
      }

      setCreatedContactId(newContact.id);
      await loadLists();
      setShowListAssignment(true);
    } catch (err) {
      console.error('Unexpected error:', err);
      alert('An unexpected error occurred');
      setIsSubmitting(false);
    }
  };

  const handleAddToList = async () => {
    if (!selectedListId || !createdContactId) {
      // Skip list assignment
      onSuccess();
      resetAndClose();
      return;
    }

    try {
      const { error } = await supabase.from('list_contacts').insert({
        list_id: selectedListId,
        contact_id: createdContactId,
        position: 0, // Could calculate max position + 1 for ordering
      });

      if (error) {
        console.error('Error adding to list:', error);
        alert('Contact created but failed to add to list');
      }

      onSuccess();
      resetAndClose();
    } catch (err) {
      console.error('Unexpected error:', err);
      alert('Contact created but failed to add to list');
      onSuccess();
      resetAndClose();
    }
  };

  const resetAndClose = () => {
    setFirstName('');
    setLastName('');
    setEmail('');
    setPhone('');
    setCompany('');
    setTitle('');
    setDomain('');
    setLinkedinUrl('');
    setCompanyLinkedinUrl('');
    setTwitterHandle('');
    setCompanyTwitter('');
    setCustomFields([]);
    setDuplicateWarning(null);
    setExistingContactId(null);
    setShowListAssignment(false);
    setSelectedListId('');
    setLists([]);
    setIsSubmitting(false);
    setCreatedContactId(null);
    setOrgId(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {showListAssignment ? 'Add to a list?' : 'Add Contact'}
          </h2>
          <button
            onClick={resetAndClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        {showListAssignment ? (
          <div className="p-6 space-y-4">
            <p className="text-gray-600 dark:text-gray-400">
              Contact created successfully! Would you like to add them to a list?
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Select a list (optional)
              </label>
              <select
                value={selectedListId}
                onChange={(e) => setSelectedListId(e.target.value)}
                className="w-full px-3 py-2 border dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">Skip - Don't add to a list</option>
                {lists.map((list) => (
                  <option key={list.id} value={list.id}>
                    {list.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <button
                onClick={() => handleAddToList()}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                {selectedListId ? 'Add to List' : 'Skip'}
              </button>
            </div>
          </div>
        ) : (
          <div className="p-6 space-y-4">
            {/* Email validation warning */}
            {email && !validateEmail(email) && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md p-3">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  Please enter a valid email address
                </p>
              </div>
            )}

            {/* Duplicate warning */}
            {duplicateWarning && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md p-3">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  {duplicateWarning}
                </p>
                <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                  Click "Create Contact" again to proceed anyway
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  First Name
                </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Last Name
                </label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={checkDuplicate}
                className="w-full px-3 py-2 border dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Phone
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Company
                </label>
                <input
                  type="text"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 border dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            {/* Enrichment / Intel */}
            <div className="border-t dark:border-gray-700 pt-4 mt-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">
                Enrichment / Intel
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Domain
                </label>
                <input
                  type="text"
                  placeholder="e.g. acme.com"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-4 mt-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Prospect LinkedIn URL
                  </label>
                  <input
                    type="url"
                    placeholder="https://linkedin.com/in/..."
                    value={linkedinUrl}
                    onChange={(e) => setLinkedinUrl(e.target.value)}
                    className="w-full px-3 py-2 border dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Company LinkedIn URL
                  </label>
                  <input
                    type="url"
                    placeholder="https://linkedin.com/company/..."
                    value={companyLinkedinUrl}
                    onChange={(e) => setCompanyLinkedinUrl(e.target.value)}
                    className="w-full px-3 py-2 border dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Prospect Twitter/X
                  </label>
                  <input
                    type="text"
                    placeholder="@handle"
                    value={twitterHandle}
                    onChange={(e) => setTwitterHandle(e.target.value)}
                    className="w-full px-3 py-2 border dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Company Twitter/X
                  </label>
                  <input
                    type="text"
                    placeholder="@company"
                    value={companyTwitter}
                    onChange={(e) => setCompanyTwitter(e.target.value)}
                    className="w-full px-3 py-2 border dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>
            </div>

            {/* Custom Fields */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Custom Fields
                </label>
                <button
                  onClick={addCustomField}
                  className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 text-sm flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" /> Add Field
                </button>
              </div>
              {customFields.map((field, index) => (
                <div key={index} className="flex gap-2 mb-2">
                  <input
                    type="text"
                    placeholder="Field name"
                    value={field.key}
                    onChange={(e) => updateCustomField(index, 'key', e.target.value)}
                    className="flex-1 px-3 py-2 border dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                  <input
                    type="text"
                    placeholder="Value"
                    value={field.value}
                    onChange={(e) => updateCustomField(index, 'value', e.target.value)}
                    className="flex-1 px-3 py-2 border dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                  <button
                    onClick={() => removeCustomField(index)}
                    className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-4">
              <button
                onClick={resetAndClose}
                className="px-4 py-2 border dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || !email || !validateEmail(email)}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Creating...' : 'Create Contact'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
