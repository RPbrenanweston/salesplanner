/**
 * Hook for loading dashboard data (user, salesblocks, activities)
 */
import { useState, useEffect } from 'react'
import { useAuth } from './useAuth'
import { supabase } from '../lib/supabase'
import type { SalesBlock, Activity } from '../types'

export type { SalesBlock, Activity }

interface UseDashboardDataReturn {
  userDisplayName: string
  todaysSalesblocks: SalesBlock[]
  upcomingSalesblocks: SalesBlock[]
  recentActivities: Activity[]
  loading: boolean
  refreshData: () => Promise<void>
}

export function useDashboardData(): UseDashboardDataReturn {
  const [userDisplayName, setUserDisplayName] = useState<string>('')
  const [todaysSalesblocks, setTodaysSalesblocks] = useState<SalesBlock[]>([])
  const [upcomingSalesblocks, setUpcomingSalesblocks] = useState<SalesBlock[]>([])
  const [recentActivities, setRecentActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const { user } = useAuth()

  const loadDashboardData = async () => {
    if (!user) {
      setLoading(false)
      return
    }

    setLoading(true)

    try {
      // Load user display name
      const { data: userData } = await supabase
        .from('users')
        .select('display_name')
        .eq('id', user.id)
        .maybeSingle()

      if (userData) {
        setUserDisplayName(userData.display_name || 'there')
      }

      // Load today's salesblocks
      const today = new Date()
      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
      const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)

      const { data: todaysData } = await supabase
        .from('salesblocks')
        .select(`
          *,
          list:lists(name)
        `)
        .eq('user_id', user.id)
        .gte('scheduled_start', todayStart.toISOString())
        .lt('scheduled_start', todayEnd.toISOString())
        .in('status', ['scheduled', 'in_progress'])
        .order('scheduled_start', { ascending: true })

      if (todaysData) {
        // Enrich with contact counts
        const enriched = await Promise.all(
          todaysData.map(async (sb) => {
            const { count } = await supabase
              .from('list_contacts')
              .select('*', { count: 'exact', head: true })
              .eq('list_id', sb.list_id)
            return { ...sb, contact_count: count || 0 }
          })
        )
        setTodaysSalesblocks(enriched)
      }

      // Load upcoming salesblocks (next 7 days, excluding today)
      const tomorrowStart = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)
      const weekEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 8)

      const { data: upcomingData } = await supabase
        .from('salesblocks')
        .select(`
          *,
          list:lists(name)
        `)
        .eq('user_id', user.id)
        .eq('status', 'scheduled')
        .gte('scheduled_start', tomorrowStart.toISOString())
        .lt('scheduled_start', weekEnd.toISOString())
        .order('scheduled_start', { ascending: true })

      if (upcomingData) {
        // Enrich with contact counts
        const enriched = await Promise.all(
          upcomingData.map(async (sb) => {
            const { count } = await supabase
              .from('list_contacts')
              .select('*', { count: 'exact', head: true })
              .eq('list_id', sb.list_id)
            return { ...sb, contact_count: count || 0 }
          })
        )
        setUpcomingSalesblocks(enriched)
      }

      // Load recent activities (last 10)
      const { data: activitiesData } = await supabase
        .from('activities')
        .select(`
          id,
          type,
          outcome,
          notes,
          created_at,
          contact:contacts(first_name, last_name)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10)

      if (activitiesData) {
        // Transform the data to match our Activity interface
        // Supabase may return contact as an array for joined data, extract first element
        const transformedActivities: Activity[] = activitiesData.map((a) => {
          // Handle both array and object forms of the contact relation
          const contactData = Array.isArray(a.contact) ? a.contact[0] : a.contact
          return {
            id: a.id,
            type: a.type,
            outcome: a.outcome,
            notes: a.notes,
            created_at: a.created_at,
            contact: contactData as { first_name: string; last_name: string } | undefined,
          }
        })
        setRecentActivities(transformedActivities)
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user) {
      loadDashboardData()
    }
  }, [user])

  return {
    userDisplayName,
    todaysSalesblocks,
    upcomingSalesblocks,
    recentActivities,
    loading,
    refreshData: loadDashboardData,
  }
}
