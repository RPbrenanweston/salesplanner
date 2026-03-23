import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Globe, Users, Briefcase, Edit2, Save, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { ROUTES } from '../lib/routes'
import AccountContactsPanel from '../components/intelligence/AccountContactsPanel'
import IntelligenceSignalsPanel from '../components/intelligence/IntelligenceSignalsPanel'
import FrameworkNotesPanel from '../components/intelligence/FrameworkNotesPanel'
import AccountTimelinePanel from '../components/intelligence/AccountTimelinePanel'
import type { Account } from '../types/domain'

type TabKey = 'intelligence' | 'contacts' | 'timeline'

export default function AccountDetailPage() {
  const { accountId } = useParams<{ accountId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [account, setAccount] = useState<Account | null>(null)
  const [contactCount, setContactCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [activeTab, setActiveTab] = useState<TabKey>('intelligence')
  const [orgId, setOrgId] = useState<string>('')

  // Inline edit state
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editDomain, setEditDomain] = useState('')
  const [editIndustry, setEditIndustry] = useState('')
  const [editEmployeeRange, setEditEmployeeRange] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (!user) return

    async function loadOrgId() {
      const { data, error } = await supabase
        .from('users')
        .select('org_id')
        .eq('id', user!.id)
        .single()

      if (error) {
        console.error('Error loading org_id:', error)
      } else if (data) {
        setOrgId(data.org_id)
      }
    }

    loadOrgId()
  }, [user])

  useEffect(() => {
    if (accountId && orgId) {
      loadAccount()
    }
  }, [accountId, orgId])

  const loadAccount = async () => {
    setLoading(true)
    setNotFound(false)
    try {
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .eq('id', accountId)
        .single()

      if (error) throw error
      if (!data) {
        setNotFound(true)
        return
      }

      // Verify org ownership
      if (data.org_id !== orgId) {
        setNotFound(true)
        return
      }

      setAccount(data)
    } catch (err) {
      console.error('Error loading account:', err)
      setNotFound(true)
    } finally {
      setLoading(false)
    }
  }

  const startEditing = () => {
    if (!account) return
    setEditName(account.name)
    setEditDomain(account.domain || '')
    setEditIndustry(account.industry || '')
    setEditEmployeeRange(account.employee_count_range || '')
    setIsEditing(true)
  }

  const cancelEditing = () => {
    setIsEditing(false)
  }

  const saveEdits = async () => {
    if (!account) return
    setIsSaving(true)
    try {
      const { error } = await supabase
        .from('accounts')
        .update({
          name: editName.trim(),
          domain: editDomain.trim() || null,
          industry: editIndustry.trim() || null,
          employee_count_range: editEmployeeRange.trim() || null,
        })
        .eq('id', account.id)

      if (error) throw error

      setAccount({
        ...account,
        name: editName.trim(),
        domain: editDomain.trim() || null,
        industry: editIndustry.trim() || null,
        employee_count_range: editEmployeeRange.trim() || null,
      })
      setIsEditing(false)
    } catch (err) {
      console.error('Error saving account:', err)
      alert('Failed to save account changes')
    } finally {
      setIsSaving(false)
    }
  }

  const tabs: { key: TabKey; label: string; badge?: number }[] = [
    { key: 'intelligence', label: 'Intelligence' },
    { key: 'contacts', label: 'Contacts', badge: contactCount },
    { key: 'timeline', label: 'Timeline' },
  ]

  if (loading) {
    return (
      <div className="min-h-full bg-gray-50 dark:bg-void-950 p-6 flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-400 dark:text-white/40">
          <div className="w-5 h-5 border-2 border-indigo-electric border-t-transparent rounded-full animate-spin" />
          <span className="font-mono text-sm tracking-widest uppercase">Loading Account...</span>
        </div>
      </div>
    )
  }

  if (notFound || !account) {
    return (
      <div className="min-h-full bg-gray-50 dark:bg-void-950 p-6 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 mx-auto bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
            <X className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="font-display text-xl font-semibold text-gray-900 dark:text-white">Account Not Found</h2>
          <p className="text-gray-500 dark:text-white/50 text-sm max-w-md">
            This account may have been deleted or you may not have permission to view it.
          </p>
          <button
            onClick={() => navigate(ROUTES.ACCOUNTS)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-electric hover:bg-indigo-electric/80 text-white rounded-lg text-sm font-semibold transition-all duration-200 ease-snappy"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Accounts
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-full bg-gray-50 dark:bg-void-950 p-6 space-y-6">
      {/* Back button */}
      <button
        onClick={() => navigate(ROUTES.ACCOUNTS)}
        className="flex items-center gap-2 text-gray-500 dark:text-white/50 hover:text-gray-900 dark:hover:text-white transition-colors duration-150"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Accounts
      </button>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          {isEditing ? (
            <div className="space-y-3">
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="font-display text-3xl font-bold text-gray-900 dark:text-white bg-transparent border-b-2 border-indigo-electric focus:outline-none w-full"
                placeholder="Account name"
                autoFocus
              />
              <div className="flex flex-wrap gap-2">
                <input
                  type="text"
                  value={editDomain}
                  onChange={(e) => setEditDomain(e.target.value)}
                  placeholder="Domain"
                  className="px-3 py-1 text-sm border border-gray-300 dark:border-white/10 rounded-full bg-white dark:bg-void-800/50 text-gray-900 dark:text-white focus:outline-none focus:border-indigo-electric"
                />
                <input
                  type="text"
                  value={editIndustry}
                  onChange={(e) => setEditIndustry(e.target.value)}
                  placeholder="Industry"
                  className="px-3 py-1 text-sm border border-gray-300 dark:border-white/10 rounded-full bg-white dark:bg-void-800/50 text-gray-900 dark:text-white focus:outline-none focus:border-indigo-electric"
                />
                <input
                  type="text"
                  value={editEmployeeRange}
                  onChange={(e) => setEditEmployeeRange(e.target.value)}
                  placeholder="Employee range"
                  className="px-3 py-1 text-sm border border-gray-300 dark:border-white/10 rounded-full bg-white dark:bg-void-800/50 text-gray-900 dark:text-white focus:outline-none focus:border-indigo-electric"
                />
              </div>
            </div>
          ) : (
            <>
              <h1 className="font-display text-3xl font-bold text-gray-900 dark:text-white mb-3">
                {account.name}
              </h1>
              <div className="flex flex-wrap items-center gap-2">
                {account.domain && (
                  <span className="inline-flex items-center gap-1.5 bg-gray-100 dark:bg-white/10 rounded-full px-3 py-1 text-sm text-gray-700 dark:text-white/70">
                    <Globe className="w-3.5 h-3.5" />
                    {account.domain}
                  </span>
                )}
                {account.industry && (
                  <span className="inline-flex items-center gap-1.5 bg-gray-100 dark:bg-white/10 rounded-full px-3 py-1 text-sm text-gray-700 dark:text-white/70">
                    <Briefcase className="w-3.5 h-3.5" />
                    {account.industry}
                  </span>
                )}
                {account.employee_count_range && (
                  <span className="inline-flex items-center gap-1.5 bg-gray-100 dark:bg-white/10 rounded-full px-3 py-1 text-sm text-gray-700 dark:text-white/70">
                    <Users className="w-3.5 h-3.5" />
                    {account.employee_count_range}
                  </span>
                )}
              </div>
            </>
          )}
        </div>

        {/* Edit / Save / Cancel buttons */}
        <div className="flex gap-2">
          {isEditing ? (
            <>
              <button
                onClick={saveEdits}
                disabled={isSaving || !editName.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-electric hover:bg-indigo-electric/80 text-white rounded-lg text-sm font-semibold transition-all duration-200 ease-snappy disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {isSaving ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={cancelEditing}
                className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-white/10 border border-gray-200 dark:border-white/10 text-gray-700 dark:text-white/70 rounded-lg text-sm font-semibold hover:bg-gray-50 dark:hover:bg-white/20 transition-all duration-200 ease-snappy"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
            </>
          ) : (
            <button
              onClick={startEditing}
              className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-white/10 border border-gray-200 dark:border-white/10 text-gray-700 dark:text-white/70 rounded-lg text-sm font-semibold hover:bg-gray-50 dark:hover:bg-white/20 transition-all duration-200 ease-snappy"
            >
              <Edit2 className="w-4 h-4" />
              Edit
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-white/10">
        <div className="flex gap-0">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={
                activeTab === tab.key
                  ? 'px-4 py-2 text-sm font-semibold text-indigo-electric border-b-2 border-indigo-electric'
                  : 'px-4 py-2 text-sm font-semibold text-gray-500 dark:text-white/40 hover:text-gray-700 dark:hover:text-white/60'
              }
            >
              {tab.label}
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-200 dark:bg-white/10 text-gray-700 dark:text-white/60">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'intelligence' && (
        <div className="space-y-6">
          <div className="glass-card p-6">
            <h3 className="font-display font-semibold text-gray-900 dark:text-white mb-4">
              Account Intelligence
            </h3>
            <IntelligenceSignalsPanel
              accountId={accountId!}
              orgId={orgId}
              level="account"
            />
          </div>
          <div className="glass-card p-6">
            <h3 className="font-display font-semibold text-gray-900 dark:text-white mb-4">
              Qualification Framework
            </h3>
            <FrameworkNotesPanel
              accountId={accountId!}
              orgId={orgId}
            />
          </div>
        </div>
      )}

      {activeTab === 'contacts' && (
        <AccountContactsPanel
          accountId={accountId!}
          orgId={orgId}
          onContactCountChange={setContactCount}
        />
      )}

      {activeTab === 'timeline' && (
        <AccountTimelinePanel
          accountId={accountId!}
          orgId={orgId}
        />
      )}
    </div>
  )
}
