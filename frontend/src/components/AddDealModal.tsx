/**
 * @crumb
 * @id frontend-component-add-deal-modal
 * @area UI/Deals
 * @intent Add deal modal — form to create a new deal with contact search/link, pipeline stage selection, and value entry
 * @responsibilities Render deal creation form (name, value, stage, close date), search and link existing contacts, insert into deals table, call onDealAdded callback
 * @contracts AddDealModal({ salesBlockId, onClose, onDealAdded }) → JSX; calls supabase.from('deals').insert; useEffect fetches contacts for search; requires salesBlockId prop
 * @in salesBlockId (string), supabase deals + contacts tables, onClose callback, onDealAdded callback
 * @out New deal row in deals table with linked contact_id; onDealAdded called with new deal; modal closed via onClose
 * @err Supabase insert failure (caught, error message shown); contact search failure (silent — search results empty)
 * @hazard Deal stage options are fetched from Supabase pipeline_stages table — if no stages exist for the org, the stage dropdown will be empty and the deal cannot be created with a valid stage
 * @hazard Contact search within the modal fetches all contacts for the org — on large datasets this is an unbounded query that will slow the modal open time and may hit Supabase row limits
 * @shared-edges frontend/src/lib/supabase.ts→CALLS deals insert + contacts select; parent page→RENDERS modal; deals table→INSERTS to; pipeline_stages table→READS stages from
 * @trail add-deal#1 | User clicks "Add Deal" → AddDealModal renders → useEffect fetches contacts + stages → user fills form → handleSubmit → supabase insert → onDealAdded(newDeal) → modal closes
 * @prompt Paginate or debounce contact search. Verify stage options gracefully handle empty pipeline_stages. Add deal value currency selector.
 */
import { useState, useEffect } from 'react'
import { X, Search } from 'lucide-react'
import { supabase } from '../lib/supabase'

interface AddDealModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  initialStageId?: string
}

interface Contact {
  id: string
  first_name: string
  last_name: string
  email: string
  company: string | null
}

interface PipelineStage {
  id: string
  name: string
}

export default function AddDealModal({ isOpen, onClose, onSuccess, initialStageId }: AddDealModalProps) {
  const [title, setTitle] = useState('')
  const [contactSearch, setContactSearch] = useState('')
  const [selectedContactId, setSelectedContactId] = useState('')
  const [value, setValue] = useState('')
  const [closeDate, setCloseDate] = useState('')
  const [stageId, setStageId] = useState(initialStageId || '')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [searchResults, setSearchResults] = useState<Contact[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [stages, setStages] = useState<PipelineStage[]>([])

  useEffect(() => {
    if (isOpen) {
      loadStages()
      if (initialStageId) {
        setStageId(initialStageId)
      }
    }
  }, [isOpen, initialStageId])

  useEffect(() => {
    if (contactSearch.length >= 2) {
      searchContacts()
    } else {
      setSearchResults([])
      setShowDropdown(false)
    }
  }, [contactSearch])

  async function loadStages() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: userData } = await supabase
      .from('users')
      .select('org_id')
      .eq('id', user.id)
      .single()

    if (!userData) return

    const { data } = await supabase
      .from('pipeline_stages')
      .select('id, name')
      .eq('org_id', userData.org_id)
      .order('position')

    if (data) {
      setStages(data)
      if (!stageId && data.length > 0) {
        setStageId(data[0].id)
      }
    }
  }

  async function searchContacts() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: userData } = await supabase
      .from('users')
      .select('org_id')
      .eq('id', user.id)
      .single()

    if (!userData) return

    const { data } = await supabase
      .from('contacts')
      .select('id, first_name, last_name, email, company')
      .eq('org_id', userData.org_id)
      .or(`first_name.ilike.%${contactSearch}%,last_name.ilike.%${contactSearch}%,email.ilike.%${contactSearch}%,company.ilike.%${contactSearch}%`)
      .limit(10)

    if (data) {
      setSearchResults(data)
      setShowDropdown(true)
    }
  }

  function selectContact(contact: Contact) {
    setSelectedContactId(contact.id)
    setContactSearch(`${contact.first_name} ${contact.last_name}`)
    setShowDropdown(false)
    if (!title) {
      setTitle(`${contact.company || 'Deal'} - ${contact.first_name} ${contact.last_name}`)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedContactId || !stageId) {
      alert('Please select a contact and stage')
      return
    }

    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data: userData } = await supabase
        .from('users')
        .select('org_id')
        .eq('id', user.id)
        .single()

      if (!userData) throw new Error('User data not found')

      const dealValue = parseFloat(value) || 0

      const { error } = await supabase
        .from('deals')
        .insert({
          org_id: userData.org_id,
          contact_id: selectedContactId,
          user_id: user.id,
          stage_id: stageId,
          title,
          value: dealValue,
          currency: 'USD',
          close_date: closeDate || null,
          notes
        })

      if (error) throw error

      resetAndClose()
      onSuccess()
    } catch (error) {
      console.error('Error creating deal:', error)
      alert('Failed to create deal')
    } finally {
      setLoading(false)
    }
  }

  function resetAndClose() {
    setTitle('')
    setContactSearch('')
    setSelectedContactId('')
    setValue('')
    setCloseDate('')
    setStageId(initialStageId || '')
    setNotes('')
    setSearchResults([])
    setShowDropdown(false)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Add Deal</h2>
          <button
            onClick={resetAndClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Contact Search */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Contact *
            </label>
            <div className="relative">
              <input
                type="text"
                value={contactSearch}
                onChange={(e) => setContactSearch(e.target.value)}
                onFocus={() => {
                  if (searchResults.length > 0) setShowDropdown(true)
                }}
                placeholder="Search by name, email, or company..."
                className="w-full px-3 py-2 pl-10 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                required
              />
              <Search className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
            </div>
            {showDropdown && searchResults.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {searchResults.map((contact) => (
                  <button
                    key={contact.id}
                    type="button"
                    onClick={() => selectContact(contact)}
                    className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-600"
                  >
                    <div className="font-medium text-gray-900 dark:text-white">
                      {contact.first_name} {contact.last_name}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {contact.email} {contact.company && `• ${contact.company}`}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              required
            />
          </div>

          {/* Value */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Value (USD)
            </label>
            <input
              type="number"
              step="0.01"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="0.00"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          {/* Stage */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Stage *
            </label>
            <select
              value={stageId}
              onChange={(e) => setStageId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              required
            >
              <option value="">Select a stage</option>
              {stages.map((stage) => (
                <option key={stage.id} value={stage.id}>
                  {stage.name}
                </option>
              ))}
            </select>
          </div>

          {/* Close Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Expected Close Date
            </label>
            <input
              type="date"
              value={closeDate}
              onChange={(e) => setCloseDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={resetAndClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !selectedContactId || !stageId}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating...' : 'Create Deal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
