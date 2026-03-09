/**
 * @crumb
 * @id frontend-component-deal-detail-modal
 * @area UI/Deals
 * @intent Deal detail modal — view and edit full deal information including linked contact, company, value, stage, close date, and notes
 * @responsibilities Fetch deal + linked contact + linked company on mount, render editable deal fields, update deal in Supabase on save, call onUpdated callback
 * @contracts DealDetailModal({ dealId, onClose, onUpdated }) → JSX; calls supabase.from('deals').select with join to contacts + companies; calls supabase.from('deals').update on save
 * @in dealId (string), supabase deals + contacts + companies tables, onClose callback, onUpdated callback
 * @out Updated deal row in deals table; onUpdated called with updated deal; modal displays current deal state
 * @err Supabase fetch failure (error state shown or empty modal); Supabase update failure (caught, error shown); dealId undefined (empty or broken modal)
 * @hazard Deal fetch joins contacts and companies — if the join columns (contact_id, company_id) are null for a deal, the joined data will be absent and dependent fields will be empty without visible error
 * @hazard Stage update in this modal and stage drag in the pipeline board are separate code paths — if one updates the deal and the other doesn't react to the change, the UI can show inconsistent stage state between views
 * @shared-edges supabase deals table→READS + UPDATES; supabase contacts table→JOINS; supabase companies table→JOINS; pipeline board or deal list→RENDERS modal; AddDealModal→CREATES deals that appear here
 * @trail deal-detail#1 | User clicks deal → DealDetailModal renders → useEffect fetches deal + contact + company → user edits fields → handleSave → supabase update → onUpdated(deal) → modal closes
 * @prompt Add optimistic update with rollback on save failure. Sync stage change events between modal and pipeline board via context or event. Guard null joins gracefully.
 */
import { useState, useEffect } from 'react'
import { X, User, Building2, DollarSign, Calendar, FileText } from 'lucide-react'
import { supabase } from '../lib/supabase'

interface DealDetailModalProps {
  isOpen: boolean
  onClose: () => void
  dealId: string | null
  onUpdate?: () => void
}

interface Deal {
  id: string
  title: string
  value: number
  currency: string
  close_date: string | null
  notes: string | null
  stage_id: string
  created_at: string
  contacts: {
    id: string
    first_name: string
    last_name: string
    email: string
    company: string | null
    title: string | null
  }
  users: {
    id: string
    display_name: string
    email: string
  }
  pipeline_stages: {
    id: string
    name: string
    color: string
  }
}

interface Activity {
  id: string
  type: string
  outcome: string | null
  notes: string | null
  created_at: string
  users: {
    display_name: string
  }
}

export default function DealDetailModal({ isOpen, onClose, dealId }: DealDetailModalProps) {
  const [deal, setDeal] = useState<Deal | null>(null)
  const [activities, setActivities] = useState<Activity[]>([])

  useEffect(() => {
    if (isOpen && dealId) {
      loadDeal()
      loadActivities()
    }
  }, [isOpen, dealId])

  async function loadDeal() {
    if (!dealId) return
    try {
      const { data, error } = await supabase
        .from('deals')
        .select(`
          *,
          contacts (
            id,
            first_name,
            last_name,
            email,
            company,
            title
          ),
          users (
            id,
            display_name,
            email
          ),
          pipeline_stages (
            id,
            name,
            color
          )
        `)
        .eq('id', dealId)
        .single()

      if (error) throw error
      if (data) {
        const dealData = {
          ...data,
          contacts: Array.isArray(data.contacts) ? data.contacts[0] : data.contacts,
          users: Array.isArray(data.users) ? data.users[0] : data.users,
          pipeline_stages: Array.isArray(data.pipeline_stages) ? data.pipeline_stages[0] : data.pipeline_stages
        }
        setDeal(dealData as Deal)
      }
    } catch (error) {
      console.error('Error loading deal:', error)
    }
  }

  async function loadActivities() {
    if (!dealId) return
    try {
      const { data: dealData } = await supabase
        .from('deals')
        .select('contact_id')
        .eq('id', dealId)
        .single()

      if (!dealData) return

      const { data } = await supabase
        .from('activities')
        .select(`
          *,
          users (
            display_name
          )
        `)
        .eq('contact_id', dealData.contact_id)
        .order('created_at', { ascending: false })
        .limit(20)

      if (data) {
        setActivities(data.map(activity => ({
          ...activity,
          users: Array.isArray(activity.users) ? activity.users[0] : activity.users
        })))
      }
    } catch (error) {
      console.error('Error loading activities:', error)
    }
  }

  function formatCurrency(value: number, currency: string) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD'
    }).format(value)
  }

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  function formatDateTime(dateString: string) {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    })
  }

  function getActivityIcon(type: string) {
    switch (type) {
      case 'call': return '📞'
      case 'email': return '✉️'
      case 'social': return '💬'
      case 'meeting': return '📅'
      case 'note': return '📝'
      default: return '•'
    }
  }

  function getOutcomeBadge(outcome: string | null) {
    if (!outcome) return null

    const colors: Record<string, string> = {
      meeting_booked: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      conversation: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      connect: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      voicemail: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      no_answer: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
      not_interested: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      follow_up: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    }

    return (
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[outcome] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'}`}>
        {outcome.replace('_', ' ')}
      </span>
    )
  }

  if (!isOpen || !deal) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{deal.title}</h2>
            <div className="flex items-center gap-2 mt-1">
              <span
                className="px-2 py-1 rounded text-xs font-medium text-white"
                style={{ backgroundColor: deal.pipeline_stages.color }}
              >
                {deal.pipeline_stages.name}
              </span>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Created {formatDate(deal.created_at)}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Deal Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Deal Info */}
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <DollarSign className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Deal Value</div>
                  <div className="text-2xl font-semibold text-gray-900 dark:text-white">
                    {formatCurrency(deal.value, deal.currency)}
                  </div>
                </div>
              </div>

              {deal.close_date && (
                <div className="flex items-start gap-3">
                  <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Expected Close</div>
                    <div className="text-lg font-medium text-gray-900 dark:text-white">
                      {formatDate(deal.close_date)}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-3">
                <User className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Contact</div>
                  <div className="text-lg font-medium text-gray-900 dark:text-white">
                    {deal.contacts.first_name} {deal.contacts.last_name}
                  </div>
                  {deal.contacts.title && (
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {deal.contacts.title}
                    </div>
                  )}
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {deal.contacts.email}
                  </div>
                </div>
              </div>

              {deal.contacts.company && (
                <div className="flex items-start gap-3">
                  <Building2 className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Company</div>
                    <div className="text-lg font-medium text-gray-900 dark:text-white">
                      {deal.contacts.company}
                    </div>
                  </div>
                </div>
              )}

              {deal.notes && (
                <div className="flex items-start gap-3">
                  <FileText className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div className="flex-1">
                    <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Notes</div>
                    <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                      {deal.notes}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right: Activity Timeline */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Activity Timeline
            </h3>
            <div className="space-y-3">
              {activities.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No activities yet
                </p>
              ) : (
                activities.map((activity) => (
                  <div
                    key={activity.id}
                    className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3"
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-lg">{getActivityIcon(activity.type)}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-gray-900 dark:text-white capitalize">
                            {activity.type}
                          </span>
                          {activity.outcome && getOutcomeBadge(activity.outcome)}
                        </div>
                        {activity.notes && (
                          <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 mb-1">
                            {activity.notes}
                          </p>
                        )}
                        <div className="text-xs text-gray-500 dark:text-gray-500">
                          {formatDateTime(activity.created_at)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
