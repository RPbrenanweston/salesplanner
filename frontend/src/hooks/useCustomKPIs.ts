/**
 * useCustomKPIs - Platform-level KPI definition management
 *
 * Provides builtin KPIs that always exist plus custom org-specific KPIs
 * fetched from the custom_kpis table (with graceful degradation).
 */
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import { logError } from '../lib/error-logger'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface KPIDefinition {
  id: string
  name: string
  icon: string
  activity_type: string
  formula_type: 'count' | 'ratio' | 'sum'
  numerator_metric?: string
  denominator_metric?: string
  is_builtin: boolean
  points_per_unit: number
}

export interface UseCustomKPIsReturn {
  allKPIs: KPIDefinition[]
  builtinKPIs: KPIDefinition[]
  customKPIs: KPIDefinition[]
  createKPI: (kpi: Omit<KPIDefinition, 'id' | 'is_builtin'>) => Promise<void>
  isLoading: boolean
}

// ---------------------------------------------------------------------------
// Built-in KPIs (always available)
// ---------------------------------------------------------------------------

export const BUILTIN_KPIS: KPIDefinition[] = [
  { id: 'calls', name: 'Calls Made', icon: 'Phone', activity_type: 'call', formula_type: 'count', is_builtin: true, points_per_unit: 1 },
  { id: 'emails', name: 'Emails Sent', icon: 'Mail', activity_type: 'email', formula_type: 'count', is_builtin: true, points_per_unit: 1 },
  { id: 'deals', name: 'Deals Moved', icon: 'TrendingUp', activity_type: 'pipeline_move', formula_type: 'count', is_builtin: true, points_per_unit: 3 },
  { id: 'social', name: 'Social Touches', icon: 'Share2', activity_type: 'social_touch', formula_type: 'count', is_builtin: true, points_per_unit: 1 },
  { id: 'meetings', name: 'Meetings Booked', icon: 'Calendar', activity_type: 'meeting_booked', formula_type: 'count', is_builtin: true, points_per_unit: 5 },
]

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useCustomKPIs(): UseCustomKPIsReturn {
  const { user } = useAuth()
  const [customKPIs, setCustomKPIs] = useState<KPIDefinition[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchCustomKPIs = useCallback(async () => {
    if (!user) {
      setIsLoading(false)
      return
    }

    try {
      // Get org_id for the user
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('org_id')
        .eq('id', user.id)
        .single()

      if (userError) throw userError

      const orgId = (userData as { org_id: string }).org_id

      // Fetch custom KPIs for the org
      const { data: kpiData, error: kpiError } = await supabase
        .from('custom_kpis')
        .select('*')
        .eq('org_id', orgId)

      if (kpiError) throw kpiError

      if (kpiData && Array.isArray(kpiData)) {
        const mapped: KPIDefinition[] = kpiData.map((row: Record<string, unknown>) => ({
          id: row.id as string,
          name: row.name as string,
          icon: 'BarChart3',
          activity_type: (row.numerator_metric as string) || 'custom',
          formula_type: (row.formula_type as KPIDefinition['formula_type']) || 'count',
          numerator_metric: row.numerator_metric as string | undefined,
          denominator_metric: row.denominator_metric as string | undefined,
          is_builtin: false,
          points_per_unit: (row.points_per_unit as number) || 1,
        }))
        setCustomKPIs(mapped)
      }
    } catch {
      // Table likely doesn't exist -- graceful degradation, no custom KPIs
      setCustomKPIs([])
    } finally {
      setIsLoading(false)
    }
  }, [user])

  useEffect(() => {
    fetchCustomKPIs()
  }, [fetchCustomKPIs])

  const createKPI = useCallback(
    async (kpi: Omit<KPIDefinition, 'id' | 'is_builtin'>) => {
      if (!user) return

      try {
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('org_id')
          .eq('id', user.id)
          .single()

        if (userError) throw userError

        const orgId = (userData as { org_id: string }).org_id

        const { data, error: insertError } = await supabase
          .from('custom_kpis')
          .insert({
            org_id: orgId,
            user_id: user.id,
            name: kpi.name,
            formula_type: kpi.formula_type,
            numerator_metric: kpi.activity_type,
            denominator_metric: kpi.denominator_metric || null,
            points_per_unit: kpi.points_per_unit,
          })
          .select()
          .single()

        if (insertError) throw insertError

        if (data) {
          const row = data as Record<string, unknown>
          const newKPI: KPIDefinition = {
            id: row.id as string,
            name: row.name as string,
            icon: 'BarChart3',
            activity_type: kpi.activity_type,
            formula_type: kpi.formula_type,
            is_builtin: false,
            points_per_unit: kpi.points_per_unit,
          }
          setCustomKPIs((prev) => [...prev, newKPI])
        }
      } catch (err) {
        logError(err, 'useCustomKPIs.createKPI')
        // If table doesn't exist, add locally only
        const localKPI: KPIDefinition = {
          id: `local-${Date.now()}`,
          name: kpi.name,
          icon: 'BarChart3',
          activity_type: kpi.activity_type,
          formula_type: kpi.formula_type,
          is_builtin: false,
          points_per_unit: kpi.points_per_unit,
        }
        setCustomKPIs((prev) => [...prev, localKPI])
      }
    },
    [user],
  )

  const allKPIs = [...BUILTIN_KPIS, ...customKPIs]

  return {
    allKPIs,
    builtinKPIs: BUILTIN_KPIS,
    customKPIs,
    createKPI,
    isLoading,
  }
}
