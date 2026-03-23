/**
 * useArena - Competition management and leaderboard data hook
 *
 * Fetches leaderboard data from activities table, filtered by competition date ranges.
 * Supports dynamic KPI scoring based on competition configuration.
 * Gracefully degrades if competitions table doesn't exist (falls back to current month).
 */
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import { BUILTIN_KPIS } from './useCustomKPIs'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CompetitionPeriod = 'day' | 'week' | 'month' | 'quarter' | 'half' | 'year'

export interface CompetitionKPI {
  kpi_id: string
  name: string
  activity_type: string
  points_per_unit: number
}

export interface Competition {
  id: string
  name: string
  period: CompetitionPeriod
  start_date: string
  end_date: string
  created_by: string
  is_active: boolean
  description?: string
  kpi_config: CompetitionKPI[]
  participant_ids: string[]
}

export interface ArenaParticipant {
  user_id: string
  user_name: string
  kpi_scores: Record<string, number>
  total_score: number
  rank: number
  trend: 'up' | 'down' | 'stable'
}

export interface PersonalStats {
  rank: number
  total_participants: number
  kpi_scores: Record<string, number>
  total_score: number
  points_to_next_rank: number
  win_rate: number
}

export interface ArenaAggregates {
  kpi_totals: Record<string, number>
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

function defaultKPIConfig(): CompetitionKPI[] {
  return BUILTIN_KPIS.map((kpi) => ({
    kpi_id: kpi.id,
    name: kpi.name,
    activity_type: kpi.activity_type,
    points_per_unit: kpi.points_per_unit,
  }))
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
    kpi_config: defaultKPIConfig(),
    participant_ids: [],
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
  const [aggregates, setAggregates] = useState<ArenaAggregates>({ kpi_totals: {}, avg_score: 0 })
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
        const mapped: Competition[] = data.map((row: Record<string, unknown>) => {
          // Parse kpi_config: could be JSON string or array
          let kpiConfig: CompetitionKPI[] = defaultKPIConfig()
          if (row.kpi_config) {
            try {
              const parsed = typeof row.kpi_config === 'string'
                ? JSON.parse(row.kpi_config as string)
                : row.kpi_config
              if (Array.isArray(parsed) && parsed.length > 0) {
                kpiConfig = parsed as CompetitionKPI[]
              }
            } catch {
              // Fall back to defaults
            }
          }

          // Parse participant_ids
          let participantIds: string[] = []
          if (row.participant_ids) {
            try {
              const parsed = typeof row.participant_ids === 'string'
                ? JSON.parse(row.participant_ids as string)
                : row.participant_ids
              if (Array.isArray(parsed)) {
                participantIds = parsed as string[]
              }
            } catch {
              // Fall back to empty
            }
          }

          return {
            id: row.id as string,
            name: row.name as string,
            period: (row.period as CompetitionPeriod) || 'month',
            start_date: row.start_date as string,
            end_date: row.end_date as string,
            created_by: (row.created_by as string) || '',
            is_active: row.is_active as boolean,
            description: (row.description as string) || undefined,
            kpi_config: kpiConfig,
            participant_ids: participantIds,
          }
        })
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

        // Build the activity type filter from kpi_config
        const trackedTypes = comp.kpi_config.map((k) => k.activity_type)

        let query = supabase
          .from('activities')
          .select('user_id, type, created_at, users!activities_user_id_fkey(display_name)')
          .gte('created_at', comp.start_date)
          .lte('created_at', comp.end_date)
          .order('created_at', { ascending: false })

        // Filter by tracked activity types if we have KPI config
        if (trackedTypes.length > 0) {
          query = query.in('type', trackedTypes)
        }

        // Filter by participant IDs if set
        if (comp.participant_ids.length > 0) {
          query = query.in('user_id', comp.participant_ids)
        }

        const { data: activities, error: queryError } = await query

        if (queryError) throw queryError

        // Build a map of activity_type -> points_per_unit from kpi_config
        const kpiLookup = new Map<string, { kpi_id: string; points_per_unit: number }>()
        for (const kpi of comp.kpi_config) {
          kpiLookup.set(kpi.activity_type, { kpi_id: kpi.kpi_id, points_per_unit: kpi.points_per_unit })
        }

        const userMap = new Map<string, ArenaParticipant>()

        ;(activities || []).forEach((a: Record<string, unknown>) => {
          const userId = a.user_id as string
          const users = a.users as { display_name?: string } | null
          const userName = users?.display_name || 'Unknown'

          if (!userMap.has(userId)) {
            // Initialize kpi_scores with zeros for all tracked KPIs
            const kpiScores: Record<string, number> = {}
            for (const kpi of comp.kpi_config) {
              kpiScores[kpi.kpi_id] = 0
            }
            userMap.set(userId, {
              user_id: userId,
              user_name: userName,
              kpi_scores: kpiScores,
              total_score: 0,
              rank: 0,
              trend: 'stable',
            })
          }

          const entry = userMap.get(userId)!
          const activityType = a.type as string
          const kpiInfo = kpiLookup.get(activityType)

          if (kpiInfo) {
            entry.kpi_scores[kpiInfo.kpi_id] = (entry.kpi_scores[kpiInfo.kpi_id] || 0) + 1
          }
        })

        // Calculate total scores
        for (const participant of userMap.values()) {
          let total = 0
          for (const kpi of comp.kpi_config) {
            const count = participant.kpi_scores[kpi.kpi_id] || 0
            total += count * kpi.points_per_unit
          }
          participant.total_score = total
        }

        const sorted = Array.from(userMap.values())
          .sort((a, b) => b.total_score - a.total_score)
          .map((p, i) => ({ ...p, rank: i + 1 }))

        setLeaderboard(sorted)

        // Aggregates -- totals per KPI
        const kpiTotals: Record<string, number> = {}
        for (const kpi of comp.kpi_config) {
          kpiTotals[kpi.kpi_id] = sorted.reduce((s, p) => s + (p.kpi_scores[kpi.kpi_id] || 0), 0)
        }
        const avgScore = sorted.length > 0 ? Math.round(sorted.reduce((s, p) => s + p.total_score, 0) / sorted.length) : 0
        setAggregates({ kpi_totals: kpiTotals, avg_score: avgScore })

        // Personal stats
        if (user) {
          const me = sorted.find((p) => p.user_id === user.id)
          if (me) {
            const nextRankScore = me.rank > 1 ? sorted[me.rank - 2].total_score : me.total_score
            const pointsToNext = me.rank > 1 ? nextRankScore - me.total_score : 0
            setPersonalStats({
              rank: me.rank,
              total_participants: sorted.length,
              kpi_scores: me.kpi_scores,
              total_score: me.total_score,
              points_to_next_rank: pointsToNext,
              win_rate: 0,
            })
          } else {
            const emptyScores: Record<string, number> = {}
            for (const kpi of comp.kpi_config) {
              emptyScores[kpi.kpi_id] = 0
            }
            setPersonalStats({
              rank: sorted.length + 1,
              total_participants: sorted.length,
              kpi_scores: emptyScores,
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
    async (
      name: string,
      period: CompetitionPeriod,
      startDate?: string,
      endDate?: string,
      description?: string,
      kpiConfig?: CompetitionKPI[],
      participantIds?: string[],
    ) => {
      if (!user) return

      const range = computeDateRange(period)
      const resolvedKpiConfig = kpiConfig && kpiConfig.length > 0 ? kpiConfig : defaultKPIConfig()
      const resolvedParticipantIds = participantIds && participantIds.length > 0 ? participantIds : [user.id]

      const newComp: Record<string, unknown> = {
        name,
        period,
        start_date: startDate || range.start,
        end_date: endDate || range.end,
        created_by: user.id,
        is_active: true,
        description: description || null,
        kpi_config: JSON.stringify(resolvedKpiConfig),
        participant_ids: JSON.stringify(resolvedParticipantIds),
      }

      try {
        const { data, error: insertError } = await supabase
          .from('competitions')
          .insert([newComp])
          .select()
          .single()

        if (insertError) throw insertError

        if (data) {
          const row = data as Record<string, unknown>
          const created: Competition = {
            id: row.id as string,
            name: row.name as string,
            period: row.period as CompetitionPeriod,
            start_date: row.start_date as string,
            end_date: row.end_date as string,
            created_by: row.created_by as string,
            is_active: row.is_active as boolean,
            description: (row.description as string) || undefined,
            kpi_config: resolvedKpiConfig,
            participant_ids: resolvedParticipantIds,
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
          description,
          kpi_config: resolvedKpiConfig,
          participant_ids: resolvedParticipantIds,
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
