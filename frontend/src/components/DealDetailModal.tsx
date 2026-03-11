// @crumb frontend-component-deal-detail-modal
// UI/Deals | fetch_deal_with_joins | editable_deal_fields | supabase_update | on_updated_callback
// why: Deal detail modal — view and edit full deal information including linked contact, company, value, stage, close date, and notes
// in:dealId,supabase deals + contacts + companies tables out:Updated deal row,onUpdated called,current deal state displayed err:Supabase fetch failure,Supabase update failure,dealId undefined
// hazard: Null join columns (contact_id, company_id) cause absent joined data with no visible error
// hazard: Stage update in modal and pipeline board are separate code paths — inconsistent stage state between views
// edge:frontend/src/components/AddDealModal.tsx -> RELATES
// edge:deal-detail#1 -> STEP_IN
// prompt: Add optimistic update with rollback on save failure. Sync stage change events between modal and pipeline board. Guard null joins gracefully.
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
      meeting_booked: 'bg-emerald-signal/15 text-emerald-signal',
      conversation: 'bg-cyan-neon/15 text-cyan-neon',
      connect: 'bg-cyan-neon/15 text-cyan-neon',
      voicemail: 'bg-yellow-400/15 text-yellow-400',
      no_answer: 'bg-gray-200/50 text-gray-500 dark:bg-white/10 dark:text-white/40',
      not_interested: 'bg-red-alert/15 text-red-alert',
      follow_up: 'bg-purple-neon/15 text-purple-neon',
    }

    return (
      <span className={`px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wide font-mono ${colors[outcome] || 'bg-gray-200/50 text-gray-500 dark:bg-white/10 dark:text-white/40'}`}>
        {outcome.replace('_', ' ')}
      </span>
    )
  }

  if (!isOpen || !deal) return null

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-void-900 border border-gray-200 dark:border-white/10 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-void-900 border-b border-gray-200 dark:border-white/10 px-6 py-4 flex items-center justify-between rounded-t-xl">
          <div>
            <h2 className="font-display text-xl font-semibold text-gray-900 dark:text-white">{deal.title}</h2>
            <div className="flex items-center gap-3 mt-1">
              <span
                className="px-2 py-0.5 rounded text-xs font-semibold font-mono uppercase tracking-wide text-white"
                style={{ backgroundColor: deal.pipeline_stages.color }}
              >
                {deal.pipeline_stages.name}
              </span>
              <span className="font-mono text-xs text-gray-400 dark:text-white/30">
                Created {formatDate(deal.created_at)}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:text-white/30 dark:hover:text-white/70 transition-colors duration-150"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left: Deal Details */}
          <div className="lg:col-span-2 space-y-5">
            <div className="flex items-start gap-3">
              <DollarSign className="w-4 h-4 text-gray-400 dark:text-white/30 mt-1" />
              <div>
                <p className="vv-section-title mb-0.5">Deal Value</p>
                <div className="font-mono text-2xl font-bold text-gray-900 dark:text-white">
                  {formatCurrency(deal.value, deal.currency)}
                </div>
              </div>
            </div>

            {deal.close_date && (
              <div className="flex items-start gap-3">
                <Calendar className="w-4 h-4 text-gray-400 dark:text-white/30 mt-1" />
                <div>
                  <p className="vv-section-title mb-0.5">Expected Close</p>
                  <div className="font-mono text-base font-semibold text-gray-900 dark:text-white">
                    {formatDate(deal.close_date)}
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-start gap-3">
              <User className="w-4 h-4 text-gray-400 dark:text-white/30 mt-1" />
              <div>
                <p className="vv-section-title mb-0.5">Contact</p>
                <div className="font-display font-semibold text-gray-900 dark:text-white">
                  {deal.contacts.first_name} {deal.contacts.last_name}
                </div>
                {deal.contacts.title && (
                  <div className="text-sm text-gray-500 dark:text-white/40">
                    {deal.contacts.title}
                  </div>
                )}
                <div className="text-sm text-gray-500 dark:text-white/40 font-mono">
                  {deal.contacts.email}
                </div>
              </div>
            </div>

            {deal.contacts.company && (
              <div className="flex items-start gap-3">
                <Building2 className="w-4 h-4 text-gray-400 dark:text-white/30 mt-1" />
                <div>
                  <p className="vv-section-title mb-0.5">Company</p>
                  <div className="font-display font-semibold text-gray-900 dark:text-white">
                    {deal.contacts.company}
                  </div>
                </div>
              </div>
            )}

            {deal.notes && (
              <div className="flex items-start gap-3">
                <FileText className="w-4 h-4 text-gray-400 dark:text-white/30 mt-1" />
                <div className="flex-1">
                  <p className="vv-section-title mb-1">Notes</p>
                  <div className="text-sm text-gray-700 dark:text-white/70 whitespace-pre-wrap leading-relaxed">
                    {deal.notes}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right: Activity Timeline */}
          <div>
            <p className="vv-section-title mb-3">Activity Timeline</p>
            <div className="space-y-2">
              {activities.length === 0 ? (
                <p className="text-sm text-gray-400 dark:text-white/30 font-mono">
                  No activities yet
                </p>
              ) : (
                activities.map((activity) => (
                  <div
                    key={activity.id}
                    className="bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg p-3"
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-base">{getActivityIcon(activity.type)}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-semibold text-gray-900 dark:text-white capitalize">
                            {activity.type}
                          </span>
                          {activity.outcome && getOutcomeBadge(activity.outcome)}
                        </div>
                        {activity.notes && (
                          <p className="text-xs text-gray-500 dark:text-white/40 line-clamp-2 mb-1 leading-relaxed">
                            {activity.notes}
                          </p>
                        )}
                        <div className="font-mono text-xs text-gray-400 dark:text-white/30">
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
