/**
 * useArena - Competition management and leaderboard data hook
 *
 * Fetches leaderboard data from activities table, filtered by competition date ranges.
 * Gracefully degrades if competitions table doesn't exist (falls back to current month).
 */
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CompetitionPeriod = 'day' | 'week' | 'month' | 'quarter' | 'half' | 'year'

export interface Competition {
  id: string
  name: string
  period: CompetitionPeriod
  start_date: string
  end_date: string
  created_by: string
  is_active: boolean
}

export interface ArenaParticipant {
  user_id: string
  user_name: string
  calls_made: number
  emails_sent: number
  deals_moved: number
  total_score: number
  rank: number
  trend: 'up' | 'down' | 'stable'
}

export interface PersonalStats {
  rank: number
  total_participants: number
  calls_made: number
  emails_sent: number
  deals_moved: number
  total_score: number
  points_to_next_rank: number
  win_rate: number
}

export interface ArenaAggregates {
  total_calls: number
  total_emails: number
  total_deals: number
  avg_score: number
}

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

export function computeDateRange(period: CompetitionPeriod, refDate: Date = new Date()): { start: string; end: string } {
  const y = refDate.getFullYear()
  const m = refDate.getMonth()
  const d = refDate.getDate()

  switch (period) {
    case 'day': {
      const start = new Date(y, m, d)
      const end = new Date(y, m, d, 23, 59, 59, 999)
      return { start: start.toISOString(), end: end.toISOString() }
    }
    case 'week': {
      const dayOfWeek = refDate.getDay()
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
      const monday = new Date(y, m, d + mondayOffset)
      const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6, 23, 59, 59, 999)
      return { start: monday.toISOString(), end: sunday.toISOString() }
    }
    case 'month': {
      const start = new Date(y, m, 1)
      const end = new Date(y, m + 1, 0, 23, 59, 59, 999)
      return { start: start.toISOString(), end: end.toISOString() }
    }
    case 'quarter': {
      const qStart = Math.floor(m / 3) * 3
      const start = new Date(y, qStart, 1)
      const end = new Date(y, qStart + 3, 0, 23, 59, 59, 999)
      return { start: start.toISOString(), end: end.toISOString() }
    }
    case 'half': {
      const hStart = m < 6 ? 0 : 6
      const start = new Date(y, hStart, 1)
      const end = new Date(y, hStart + 6, 0, 23, 59, 59, 999)
      return { start: start.toISOString(), end: end.toISOString() }
    }
    case 'year': {
      const start = new Date(y, 0, 1)
      const end = new Date(y, 11, 31, 23, 59, 59, 999)
      return { start: start.toISOString(), end: end.toISOString() }
    }
  }
}

export function periodLabel(period: CompetitionPeriod): string {
  const labels: Record<CompetitionPeriod, string> = {
    day: 'Daily',
    week: 'Weekly',
    month: 'Monthly',
    quarter: 'Quarterly',
    half: 'Half-Year',
    year: 'Yearly',
  }
  return labels[period]
}

function defaultCompetitionName(): string {
  const now = new Date()
  const monthName = now.toLocaleString('default', { month: 'long' })
  return `${monthName} ${now.getFullYear()} Sprint`
}

function buildDefaultCompetition(): Competition {
  const range = computeDateRange('month')
  return {
    id: 'default',
    name: defaultCompetitionName(),
    period: 'month',
    start_date: range.start,
    end_date: range.end,
    created_by: '',
    is_active: true,
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useArena() {
  const { user } = useAuth()

  const [competition, setCompetition] = useState<Competition>(buildDefaultCompetition())
  const [competitions, setCompetitions] = useState<Competition[]>([])
  const [leaderboard, setLeaderboard] = useState<ArenaParticipant[]>([])
  const [personalStats, setPersonalStats] = useState<PersonalStats | null>(null)
  const [aggregates, setAggregates] = useState<ArenaAggregates>({ total_calls: 0, total_emails: 0, total_deals: 0, avg_score: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // ------- fetch competitions table (graceful) -------
  const fetchCompetitions = useCallback(async () => {
    try {
      const { data, error: queryError } = await supabase
        .from('competitions')
        .select('*')
        .order('created_at', { ascending: false })

      if (queryError) throw queryError

      if (data && data.length > 0) {
        const mapped: Competition[] = data.map((row: Record<string, unknown>) => ({
          id: row.id as string,
          name: row.name as string,
          period: (row.period as CompetitionPeriod) || 'month',
          start_date: row.start_date as string,
          end_date: row.end_date as string,
          created_by: (row.created_by as string) || '',
          is_active: row.is_active as boolean,
        }))
        setCompetitions(mapped)

        const active = mapped.find((c) => c.is_active)
        if (active) setCompetition(active)
      }
    } catch {
      // Table likely doesn't exist -- fall back to default competition
      setCompetitions([buildDefaultCompetition()])
    }
  }, [])

  // ------- fetch leaderboard from activities -------
  const fetchLeaderboard = useCallback(
    async (comp: Competition) => {
      try {
        setLoading(true)
        setError(null)

        const { data: activities, error: queryError } = await supabase
          .from('activities')
          .select('user_id, type, created_at, users!activities_user_id_fkey(display_name)')
          .gte('created_at', comp.start_date)
          .lte('created_at', comp.end_date)
          .order('created_at', { ascending: false })

        if (queryError) throw queryError

        const userMap = new Map<string, ArenaParticipant>()

        ;(activities || []).forEach((a: Record<string, unknown>) => {
          const userId = a.user_id as string
          const users = a.users as { display_name?: string } | null
          const userName = users?.display_name || 'Unknown'

          if (!userMap.has(userId)) {
            userMap.set(userId, {
              user_id: userId,
              user_name: userName,
              calls_made: 0,
              emails_sent: 0,
              deals_moved: 0,
              total_score: 0,
              rank: 0,
              trend: 'stable',
            })
          }

          const entry = userMap.get(userId)!
          const activityType = a.type as string
          if (activityType === 'call') entry.calls_made++
          if (activityType === 'email') entry.emails_sent++
          if (activityType === 'pipeline_move') entry.deals_moved++
          entry.total_score = entry.calls_made + entry.emails_sent + entry.deals_moved * 3
        })

        const sorted = Array.from(userMap.values())
          .sort((a, b) => b.total_score - a.total_score)
          .map((p, i) => ({ ...p, rank: i + 1 }))

        setLeaderboard(sorted)

        // Aggregates
        const totalCalls = sorted.reduce((s, p) => s + p.calls_made, 0)
        const totalEmails = sorted.reduce((s, p) => s + p.emails_sent, 0)
        const totalDeals = sorted.reduce((s, p) => s + p.deals_moved, 0)
        const avgScore = sorted.length > 0 ? Math.round(sorted.reduce((s, p) => s + p.total_score, 0) / sorted.length) : 0
        setAggregates({ total_calls: totalCalls, total_emails: totalEmails, total_deals: totalDeals, avg_score: avgScore })

        // Personal stats
        if (user) {
          const me = sorted.find((p) => p.user_id === user.id)
          if (me) {
            const nextRankScore = me.rank > 1 ? sorted[me.rank - 2].total_score : me.total_score
            const pointsToNext = me.rank > 1 ? nextRankScore - me.total_score : 0
            const totalWins = 0 // placeholder -- would need duel data
            setPersonalStats({
              rank: me.rank,
              total_participants: sorted.length,
              calls_made: me.calls_made,
              emails_sent: me.emails_sent,
              deals_moved: me.deals_moved,
              total_score: me.total_score,
              points_to_next_rank: pointsToNext,
              win_rate: totalWins,
            })
          } else {
            setPersonalStats({
              rank: sorted.length + 1,
              total_participants: sorted.length,
              calls_made: 0,
              emails_sent: 0,
              deals_moved: 0,
              total_score: 0,
              points_to_next_rank: sorted.length > 0 ? sorted[sorted.length - 1].total_score : 0,
              win_rate: 0,
            })
          }
        }
      } catch (err) {
        console.error('Arena leaderboard fetch failed:', err)
        setError('Failed to load leaderboard data.')
      } finally {
        setLoading(false)
      }
    },
    [user],
  )

  // ------- create competition -------
  const createCompetition = useCallback(
    async (name: string, period: CompetitionPeriod, startDate?: string, endDate?: string) => {
      if (!user) return

      const range = computeDateRange(period)
      const newComp: Omit<Competition, 'id'> & { id?: string } = {
        name,
        period,
        start_date: startDate || range.start,
        end_date: endDate || range.end,
        created_by: user.id,
        is_active: true,
      }

      try {
        const { data, error: insertError } = await supabase
          .from('competitions')
          .insert([newComp])
          .select()
          .single()

        if (insertError) throw insertError

        if (data) {
          const created: Competition = {
            id: data.id as string,
            name: data.name as string,
            period: data.period as CompetitionPeriod,
            start_date: data.start_date as string,
            end_date: data.end_date as string,
            created_by: data.created_by as string,
            is_active: data.is_active as boolean,
          }
          setCompetition(created)
          setCompetitions((prev) => [created, ...prev])
        }
      } catch {
        // Table doesn't exist -- create a local-only competition
        const localComp: Competition = {
          id: `local-${Date.now()}`,
          name,
          period,
          start_date: startDate || range.start,
          end_date: endDate || range.end,
          created_by: user.id,
          is_active: true,
        }
        setCompetition(localComp)
        setCompetitions((prev) => [localComp, ...prev])
      }
    },
    [user],
  )

  // ------- switch active competition -------
  const switchCompetition = useCallback(
    (comp: Competition) => {
      setCompetition(comp)
      fetchLeaderboard(comp)
    },
    [fetchLeaderboard],
  )

  // ------- initial load -------
  useEffect(() => {
    if (!user) return

    const init = async () => {
      await fetchCompetitions()
    }
    init()
  }, [user, fetchCompetitions])

  // Re-fetch leaderboard when competition changes
  useEffect(() => {
    if (!user) return
    fetchLeaderboard(competition)
  }, [user, competition, fetchLeaderboard])

  return {
    competition,
    competitions,
    leaderboard,
    personalStats,
    aggregates,
    loading,
    error,
    createCompetition,
    switchCompetition,
    refresh: () => fetchLeaderboard(competition),
  }
}
