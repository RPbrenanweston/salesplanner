'use client'

import { useState, useEffect } from 'react'
import { FileText, Phone, Mail, Calendar, MessageSquare, Users } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { getSupabaseBrowser } from '@/lib/supabase/browser'
import { formatTimeAgo } from '@/lib/planner/time'

interface ActivityRecord {
  id: string
  type: string
  notes: string | null
  created_at: string
  contact_id: string | null
  account_id: string | null
}

export default function ActivityFeedPage() {
  const supabase = getSupabaseBrowser()
  const { user } = useAuth()
  const [activities, setActivities] = useState<ActivityRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return

    async function loadActivities() {
      setLoading(true)
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const { data } = await supabase
        .from('sp_activities')
        .select('id, type, notes, created_at, contact_id, account_id')
        .eq('user_id', user!.id)
        .gte('created_at', today.toISOString())
        .order('created_at', { ascending: false })
        .limit(100)

      setActivities((data as ActivityRecord[] | null) ?? [])
      setLoading(false)
    }

    loadActivities()
  }, [user])

  const totals = activities.reduce(
    (acc, a) => {
      if (a.type === 'call') acc.calls++
      else if (a.type === 'email') acc.emails++
      else if (a.type === 'meeting') acc.meetings++
      else if (a.type === 'social') acc.social++
      return acc
    },
    { calls: 0, emails: 0, meetings: 0, social: 0 }
  )

  const activityIcon = (type: string) => {
    switch (type) {
      case 'call': return <Phone className="w-4 h-4" />
      case 'email': return <Mail className="w-4 h-4" />
      case 'meeting': return <Calendar className="w-4 h-4" />
      default: return <MessageSquare className="w-4 h-4" />
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-display font-bold text-gray-900 dark:text-white mb-6">
        Today's Activity
      </h1>

      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Calls', value: totals.calls, icon: Phone, color: 'text-blue-500' },
          { label: 'Emails', value: totals.emails, icon: Mail, color: 'text-purple-500' },
          { label: 'Meetings', value: totals.meetings, icon: Calendar, color: 'text-green-500' },
          { label: 'Social', value: totals.social, icon: MessageSquare, color: 'text-orange-500' },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-white dark:bg-void-900 rounded-lg border border-gray-200 dark:border-white/10 p-4 text-center"
          >
            <stat.icon className={`w-5 h-5 ${stat.color} mx-auto mb-2`} />
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{stat.value}</div>
            <div className="text-xs text-gray-500 dark:text-white/50">{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-void-900 rounded-lg border border-gray-200 dark:border-white/10 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5 text-purple-600" />
          Timeline
        </h2>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-lg animate-pulse">
                <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-40" />
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-56" />
                </div>
              </div>
            ))}
          </div>
        ) : activities.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-gray-300 dark:text-white/20 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-white/50 text-sm">
              No activity yet today. Start a focus session to begin.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {activities.map((activity) => (
              <div
                key={activity.id}
                className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-void-950 rounded-lg"
              >
                <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                  {activityIcon(activity.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 dark:text-white text-sm capitalize">
                    {activity.type}
                  </div>
                  {activity.notes && (
                    <p className="text-sm text-gray-600 dark:text-gray-400">{activity.notes}</p>
                  )}
                  <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                    {formatTimeAgo(activity.created_at)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
