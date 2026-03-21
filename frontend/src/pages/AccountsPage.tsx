import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Building2, Plus, Users } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { ROUTES } from '../lib/routes'
import { CreateAccountModal } from '../components/CreateAccountModal'
import type { Account } from '../types/domain'

interface AccountWithCount extends Account {
  contact_count: number
}

export default function AccountsPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [accounts, setAccounts] = useState<AccountWithCount[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)

  useEffect(() => {
    if (user) {
      loadAccounts()
    }
  }, [user])

  const loadAccounts = async () => {
    setIsLoading(true)
    try {
      // Get user's org_id
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('org_id')
        .eq('id', user!.id)
        .single()

      if (userError) {
        console.error('Error fetching user org_id:', userError)
        return
      }

      const orgId = userData.org_id

      // Fetch accounts filtered by org_id
      const { data: accountsData, error: accountsError } = await supabase
        .from('accounts')
        .select('*')
        .eq('org_id', orgId)
        .order('updated_at', { ascending: false })

      if (accountsError) {
        console.error('Error fetching accounts:', accountsError)
        return
      }

      // Get contact counts for each account
      const accountsWithCounts = await Promise.all(
        (accountsData || []).map(async (account) => {
          let contactCount = 0
          try {
            const { count, error: countError } = await supabase
              .from('contacts')
              .select('id', { count: 'exact', head: true })
              .eq('account_id', account.id)

            if (countError) {
              console.error(`Error counting contacts for account ${account.id}:`, countError)
            } else {
              contactCount = count || 0
            }
          } catch (err) {
            console.error(`Exception counting contacts for account ${account.id}:`, err)
          }

          return {
            ...account,
            contact_count: contactCount,
          }
        })
      )

      setAccounts(accountsWithCounts)
    } catch (err) {
      console.error('Error loading accounts:', err)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-full bg-gray-50 dark:bg-void-950 p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="vv-section-title mb-1">Intelligence</p>
          <h1 className="font-display text-3xl font-bold text-gray-900 dark:text-white">
            Accounts
          </h1>
        </div>

        <div className="flex gap-2 flex-wrap justify-end">
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-electric hover:bg-indigo-electric/80 text-white rounded-lg text-sm font-semibold transition-all duration-200 ease-snappy"
          >
            <Plus className="w-4 h-4" />
            Create Account
          </button>
        </div>
      </div>

      {/* Accounts Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-white/5 border-b border-gray-200 dark:border-white/10">
              <tr>
                <th className="px-6 py-3 text-left">
                  <span className="vv-section-title">Name</span>
                </th>
                <th className="px-6 py-3 text-left">
                  <span className="vv-section-title">Domain</span>
                </th>
                <th className="px-6 py-3 text-left">
                  <span className="vv-section-title">Industry</span>
                </th>
                <th className="px-6 py-3 text-left">
                  <span className="vv-section-title">Contacts</span>
                </th>
                <th className="px-6 py-3 text-left">
                  <span className="vv-section-title">Last Updated</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-white/10">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <div className="flex items-center justify-center gap-3 text-gray-400 dark:text-white/40">
                      <div className="w-5 h-5 border-2 border-indigo-electric border-t-transparent rounded-full animate-spin" />
                      <span className="font-mono text-sm tracking-widest uppercase">Loading Accounts...</span>
                    </div>
                  </td>
                </tr>
              ) : accounts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center">
                    <Building2 className="w-10 h-10 text-gray-300 dark:text-white/20 mx-auto mb-3" />
                    <p className="font-display font-semibold text-gray-900 dark:text-white mb-1">No accounts yet</p>
                    <p className="text-sm text-gray-400 dark:text-white/40">
                      Create your first account to start tracking intelligence
                    </p>
                  </td>
                </tr>
              ) : (
                accounts.map((account) => (
                  <tr
                    key={account.id}
                    onClick={() => navigate(ROUTES.ACCOUNT_DETAIL(account.id))}
                    className="hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer transition-colors duration-150 ease-snappy"
                  >
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {account.name}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-600 dark:text-white/50">
                        {account.domain || '\u2014'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-600 dark:text-white/50">
                        {account.industry || '\u2014'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1 text-sm text-gray-900 dark:text-white">
                        <Users className="w-4 h-4 text-gray-400 dark:text-white/30" />
                        {account.contact_count}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-600 dark:text-white/50 font-mono">
                        {new Date(account.updated_at).toLocaleDateString()}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <CreateAccountModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={() => loadAccounts()}
      />
    </div>
  )
}
