/** @id salesblock.pages.contacts.contacts-list */
import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Search, User, Building2, Mail, Phone, ChevronRight } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { ROUTES } from '../lib/routes'
import type { Contact } from '../types/domain'

export default function ContactsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')

  const { data: contacts = [], isLoading } = useQuery<Contact[]>({
    queryKey: ['all-contacts', user?.id],
    queryFn: async () => {
      if (!user?.id) return []
      // Get user's org_id from profile
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('org_id')
        .eq('user_id', user.id)
        .maybeSingle()

      if (!profile?.org_id) return []

      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('org_id', profile.org_id)
        .order('created_at', { ascending: false })
        .limit(500)

      if (error) throw error
      return (data ?? []) as Contact[]
    },
    enabled: !!user?.id,
    staleTime: 30 * 1000,
  })

  const filtered = useMemo(() => {
    if (!search.trim()) return contacts
    const q = search.toLowerCase()
    return contacts.filter(
      (c) =>
        c.first_name?.toLowerCase().includes(q) ||
        c.last_name?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.company?.toLowerCase().includes(q) ||
        c.title?.toLowerCase().includes(q),
    )
  }, [contacts, search])

  return (
    <div className="min-h-full bg-gray-50 dark:bg-void-950 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="vv-section-title mb-1">CRM</p>
          <h1 className="font-display text-3xl font-bold text-gray-900 dark:text-white">
            Contacts
          </h1>
        </div>
        <div className="text-sm font-mono text-gray-500 dark:text-white/40">
          {contacts.length} total
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-white/30" />
        <input
          type="text"
          placeholder="Search contacts..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-indigo-electric/40"
        />
      </div>

      {/* Contact List */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="glass-card p-4 animate-pulse">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-white/10" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-40 bg-gray-200 dark:bg-white/10 rounded" />
                  <div className="h-3 w-56 bg-gray-200 dark:bg-white/10 rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <User className="w-10 h-10 text-gray-300 dark:text-white/20 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-white/40 text-sm">
            {search ? 'No contacts match your search.' : 'No contacts yet. Import or add contacts from your lists.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((contact) => (
            <button
              key={contact.id}
              onClick={() => navigate(ROUTES.CONTACT_DETAIL(contact.id))}
              className="w-full glass-card p-4 flex items-center gap-4 hover:bg-gray-50 dark:hover:bg-white/[0.08] transition-colors duration-150 text-left group"
            >
              {/* Avatar */}
              <div className="w-10 h-10 rounded-full bg-indigo-electric/10 text-indigo-electric flex items-center justify-center text-sm font-semibold flex-shrink-0">
                {(contact.first_name?.[0] ?? '').toUpperCase()}
                {(contact.last_name?.[0] ?? '').toUpperCase()}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                    {contact.first_name} {contact.last_name}
                  </span>
                  {contact.title && (
                    <span className="text-xs text-gray-400 dark:text-white/30 truncate hidden sm:inline">
                      {contact.title}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4 mt-0.5">
                  {contact.company && (
                    <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-white/40 truncate">
                      <Building2 className="w-3 h-3 flex-shrink-0" />
                      {contact.company}
                    </span>
                  )}
                  {contact.email && (
                    <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-white/40 truncate hidden md:flex">
                      <Mail className="w-3 h-3 flex-shrink-0" />
                      {contact.email}
                    </span>
                  )}
                  {contact.phone && (
                    <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-white/40 truncate hidden lg:flex">
                      <Phone className="w-3 h-3 flex-shrink-0" />
                      {contact.phone}
                    </span>
                  )}
                </div>
              </div>

              {/* Arrow */}
              <ChevronRight className="w-4 h-4 text-gray-300 dark:text-white/20 group-hover:text-indigo-electric transition-colors duration-150 flex-shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
