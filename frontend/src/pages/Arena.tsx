/**
 * Arena - Competitive sales leaderboard and competition management
 *
 * War Room design: competition header, dynamic KPI cards, podium, leaderboard table,
 * personal stats, and competition management tabs.
 * KPI columns are driven by the active competition's kpi_config.
 */
import { useState, useMemo } from 'react'
import {
  Trophy,
  Phone,
  Mail,
  TrendingUp,
  Share2,
  Calendar,
  BarChart3,
  Plus,
  Clock,
  Users,
  Target,
  Award,
  ChevronUp,
  ChevronDown,
  Minus,
  Zap,
  RefreshCw,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import {
  useArena,
  periodLabel,
  type Competition,
  type ArenaParticipant,
  type CompetitionKPI,
} from '../hooks/useArena'
import { CreateCompetitionModal } from '../components/CreateCompetitionModal'

// ---------------------------------------------------------------------------
// Icon resolver
// ---------------------------------------------------------------------------

const ICON_MAP: Record<string, React.ReactNode> = {
  Phone: <Phone className="w-5 h-5 text-blue-500" />,
  Mail: <Mail className="w-5 h-5 text-purple-500" />,
  TrendingUp: <TrendingUp className="w-5 h-5 text-indigo-500" />,
  Share2: <Share2 className="w-5 h-5 text-cyan-500" />,
  Calendar: <Calendar className="w-5 h-5 text-green-500" />,
  BarChart3: <BarChart3 className="w-5 h-5 text-orange-500" />,
}

const ACCENT_MAP: Record<string, string> = {
  Phone: 'bg-blue-50 dark:bg-blue-900/30',
  Mail: 'bg-purple-50 dark:bg-purple-900/30',
  TrendingUp: 'bg-indigo-50 dark:bg-indigo-900/30',
  Share2: 'bg-cyan-50 dark:bg-cyan-900/30',
  Calendar: 'bg-green-50 dark:bg-green-900/30',
  BarChart3: 'bg-orange-50 dark:bg-orange-900/30',
}

// Map KPI IDs to icon names for built-in KPIs
const KPI_ICON_MAP: Record<string, string> = {
  calls: 'Phone',
  emails: 'Mail',
  deals: 'TrendingUp',
  social: 'Share2',
  meetings: 'Calendar',
}

function resolveKPIIcon(kpiId: string): React.ReactNode {
  const iconName = KPI_ICON_MAP[kpiId] || 'BarChart3'
  return ICON_MAP[iconName] || ICON_MAP.BarChart3
}

function resolveKPIAccent(kpiId: string): string {
  const iconName = KPI_ICON_MAP[kpiId] || 'BarChart3'
  return ACCENT_MAP[iconName] || ACCENT_MAP.BarChart3
}

// Bar chart colors per KPI index
const BAR_COLORS = ['bg-blue-500', 'bg-purple-500', 'bg-indigo-500', 'bg-cyan-500', 'bg-green-500', 'bg-orange-500', 'bg-pink-500', 'bg-teal-500']

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

type ArenaTab = 'leaderboard' | 'my-stats' | 'competitions'

function TabNav({ active, onChange }: { active: ArenaTab; onChange: (t: ArenaTab) => void }) {
  const tabs: { key: ArenaTab; label: string }[] = [
    { key: 'leaderboard', label: 'Leaderboard' },
    { key: 'my-stats', label: 'My Stats' },
    { key: 'competitions', label: 'Competitions' },
  ]

  return (
    <div className="flex gap-1 rounded-lg bg-gray-100 dark:bg-gray-800 p-1">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={`
            px-4 py-2 rounded-md text-sm font-medium transition
            ${
              active === t.key
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }
          `}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

function TrendIcon({ trend }: { trend: 'up' | 'down' | 'stable' }) {
  if (trend === 'up') return <ChevronUp className="w-4 h-4 text-green-500" />
  if (trend === 'down') return <ChevronDown className="w-4 h-4 text-red-500" />
  return <Minus className="w-4 h-4 text-gray-400" />
}

function StatCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string
  value: string | number
  icon: React.ReactNode
  accent?: string
}) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm">
      <div className="flex items-center gap-3 mb-2">
        <div className={`p-2 rounded-lg ${accent || 'bg-gray-100 dark:bg-gray-700'}`}>{icon}</div>
        <span className="text-sm text-gray-500 dark:text-gray-400">{label}</span>
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
    </div>
  )
}

function TimeRemaining({ endDate }: { endDate: string }) {
  const end = new Date(endDate)
  const now = new Date()
  const diffMs = end.getTime() - now.getTime()

  if (diffMs <= 0) return <span className="text-sm text-gray-500 dark:text-gray-400">Ended</span>

  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))

  return (
    <div className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400">
      <Clock className="w-4 h-4" />
      <span>
        {days > 0 && `${days}d `}
        {hours}h remaining
      </span>
    </div>
  )
}

function UserInitials({ name }: { name: string }) {
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-sm font-bold">
      {initials}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Podium (Top 3)
// ---------------------------------------------------------------------------

function Podium({
  participants,
  currentUserId,
  kpiConfig,
}: {
  participants: ArenaParticipant[]
  currentUserId?: string
  kpiConfig: CompetitionKPI[]
}) {
  if (participants.length === 0) return null

  const top3 = participants.slice(0, 3)
  const medalStyles = [
    { bg: 'bg-yellow-50 dark:bg-yellow-900/20', border: 'border-yellow-300 dark:border-yellow-700', badge: 'bg-yellow-400 text-yellow-900', label: '1st' },
    { bg: 'bg-gray-50 dark:bg-gray-800', border: 'border-gray-300 dark:border-gray-600', badge: 'bg-gray-400 text-white', label: '2nd' },
    { bg: 'bg-orange-50 dark:bg-orange-900/20', border: 'border-orange-300 dark:border-orange-700', badge: 'bg-orange-400 text-orange-900', label: '3rd' },
  ]
  // Display order: 2nd - 1st - 3rd
  const displayOrder = top3.length >= 3 ? [top3[1], top3[0], top3[2]] : top3
  const styleOrder = top3.length >= 3 ? [medalStyles[1], medalStyles[0], medalStyles[2]] : medalStyles.slice(0, top3.length)

  // Show top 3 KPIs on podium cards
  const topKPIs = kpiConfig.slice(0, 3)

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {displayOrder.map((p, i) => {
        const style = styleOrder[i]
        const isCenter = top3.length >= 3 && i === 1
        const isMe = p.user_id === currentUserId

        return (
          <div
            key={p.user_id}
            className={`
              rounded-xl border-2 ${style.border} ${style.bg} p-6 text-center
              ${isCenter ? 'md:scale-105 md:-mt-2 md:shadow-lg' : ''}
              ${isMe ? 'ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-gray-900' : ''}
              transition
            `}
          >
            <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${style.badge} mb-3`}>
              {style.label}
            </span>
            <div className="flex justify-center mb-2">
              <div className="w-14 h-14 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-lg font-bold">
                {p.user_name
                  .split(' ')
                  .map((w) => w[0])
                  .join('')
                  .toUpperCase()
                  .slice(0, 2)}
              </div>
            </div>
            <p className="font-semibold text-gray-900 dark:text-white">{p.user_name}</p>
            {isMe && <p className="text-xs text-indigo-600 dark:text-indigo-400 font-medium mt-0.5">You</p>}
            <div className="mt-4 space-y-1.5 text-sm">
              {topKPIs.map((kpi, ki) => {
                const count = p.kpi_scores[kpi.kpi_id] || 0
                const isLast = ki === topKPIs.length - 1
                return (
                  <div
                    key={kpi.kpi_id}
                    className={`flex items-center justify-center gap-2 ${
                      isLast ? 'text-indigo-600 dark:text-indigo-400 font-medium' : 'text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    <span className="w-4 h-4 flex items-center justify-center">{resolveKPIIcon(kpi.kpi_id)}</span>
                    <span>{count} {kpi.name.toLowerCase()}</span>
                  </div>
                )
              })}
            </div>
            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
              <span className="text-lg font-bold text-gray-900 dark:text-white">{p.total_score}</span>
              <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">pts</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Leaderboard Table (Dynamic KPI columns)
// ---------------------------------------------------------------------------

function LeaderboardTable({
  participants,
  currentUserId,
  kpiConfig,
}: {
  participants: ArenaParticipant[]
  currentUserId?: string
  kpiConfig: CompetitionKPI[]
}) {
  if (participants.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-12 text-center">
        <Zap className="mx-auto h-8 w-8 text-gray-300 dark:text-gray-600 mb-3" />
        <p className="text-gray-500 dark:text-gray-400">No activity data yet. Start logging activities to compete.</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80">
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Rank
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Rep
              </th>
              {kpiConfig.map((kpi) => (
                <th
                  key={kpi.kpi_id}
                  className="px-6 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                >
                  {kpi.name}
                </th>
              ))}
              <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Score
              </th>
              <th className="px-6 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Trend
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
            {participants.map((p) => {
              const isMe = p.user_id === currentUserId
              return (
                <tr
                  key={p.user_id}
                  className={`
                    transition
                    ${isMe ? 'bg-indigo-50 dark:bg-indigo-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700/30'}
                  `}
                >
                  <td className="px-6 py-4">
                    <span className="text-sm font-bold text-gray-500 dark:text-gray-400">#{p.rank}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <UserInitials name={p.user_name} />
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {p.user_name}
                          {isMe && (
                            <span className="ml-2 text-xs font-medium text-indigo-600 dark:text-indigo-400">(You)</span>
                          )}
                        </p>
                      </div>
                    </div>
                  </td>
                  {kpiConfig.map((kpi) => (
                    <td key={kpi.kpi_id} className="px-6 py-4 text-right text-sm text-gray-700 dark:text-gray-300">
                      {p.kpi_scores[kpi.kpi_id] || 0}
                    </td>
                  ))}
                  <td className="px-6 py-4 text-right">
                    <span className="text-sm font-bold text-gray-900 dark:text-white">{p.total_score}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-center">
                      <TrendIcon trend={p.trend} />
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// My Stats Tab (Dynamic KPIs)
// ---------------------------------------------------------------------------

function MyStatsTab({
  personalStats,
  kpiConfig,
}: {
  personalStats: {
    rank: number
    total_participants: number
    kpi_scores: Record<string, number>
    total_score: number
    points_to_next_rank: number
    win_rate: number
  } | null
  kpiConfig: CompetitionKPI[]
}) {
  if (!personalStats) {
    return (
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-12 text-center">
        <Target className="mx-auto h-8 w-8 text-gray-300 dark:text-gray-600 mb-3" />
        <p className="text-gray-500 dark:text-gray-400">No personal stats yet. Start logging activities to see your progress.</p>
      </div>
    )
  }

  const progressPct =
    personalStats.total_score > 0 && personalStats.points_to_next_rank >= 0
      ? Math.min(100, Math.round((personalStats.total_score / (personalStats.total_score + personalStats.points_to_next_rank)) * 100))
      : personalStats.rank === 1
        ? 100
        : 0

  // Build bar chart data from KPI config
  const barData = kpiConfig.map((kpi, i) => ({
    label: kpi.name,
    value: personalStats.kpi_scores[kpi.kpi_id] || 0,
    color: BAR_COLORS[i % BAR_COLORS.length],
  }))
  const maxStat = Math.max(...barData.map((b) => b.value), 1)

  // Build scoring formula text
  const formulaParts = kpiConfig.map((kpi) => {
    if (kpi.points_per_unit === 1) return kpi.name
    return `(${kpi.name} x${kpi.points_per_unit})`
  })
  const formulaText = formulaParts.join(' + ')

  return (
    <div className="space-y-6">
      {/* Rank Card */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Current Rank</p>
            <p className="text-4xl font-bold text-gray-900 dark:text-white">
              #{personalStats.rank}
              <span className="text-lg text-gray-400 dark:text-gray-500 font-normal ml-1">
                / {personalStats.total_participants}
              </span>
            </p>
          </div>
          <div className="p-3 rounded-xl bg-indigo-100 dark:bg-indigo-900/40">
            <Award className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
          </div>
        </div>

        {personalStats.rank > 1 && (
          <div>
            <div className="flex items-center justify-between text-sm mb-1.5">
              <span className="text-gray-500 dark:text-gray-400">Progress to #{personalStats.rank - 1}</span>
              <span className="font-medium text-gray-700 dark:text-gray-300">{personalStats.points_to_next_rank} pts to go</span>
            </div>
            <div className="w-full h-2.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        )}

        {personalStats.rank === 1 && (
          <p className="text-sm text-indigo-600 dark:text-indigo-400 font-medium">You are in the lead!</p>
        )}
      </div>

      {/* Personal KPIs -- dynamic stat cards */}
      <div className={`grid grid-cols-1 md:grid-cols-${Math.min(kpiConfig.length, 4)} gap-4`}>
        {kpiConfig.slice(0, 4).map((kpi) => (
          <StatCard
            key={kpi.kpi_id}
            label={kpi.name}
            value={personalStats.kpi_scores[kpi.kpi_id] || 0}
            icon={resolveKPIIcon(kpi.kpi_id)}
            accent={resolveKPIAccent(kpi.kpi_id)}
          />
        ))}
      </div>

      {/* Activity Breakdown Bar Chart */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Activity Breakdown</h3>
        <div className="space-y-4">
          {barData.map((bar) => (
            <div key={bar.label}>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-gray-600 dark:text-gray-400">{bar.label}</span>
                <span className="font-medium text-gray-900 dark:text-white">{bar.value}</span>
              </div>
              <div className="w-full h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full ${bar.color} rounded-full transition-all duration-700`}
                  style={{ width: `${Math.round((bar.value / maxStat) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Total Score */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-sm text-center">
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Total Score</p>
        <p className="text-5xl font-bold text-gray-900 dark:text-white">{personalStats.total_score}</p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{formulaText}</p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Competitions Tab
// ---------------------------------------------------------------------------

function CompetitionsTab({
  competitions,
  activeId,
  onSwitch,
  onCreateClick,
}: {
  competitions: Competition[]
  activeId: string
  onSwitch: (c: Competition) => void
  onCreateClick: () => void
}) {
  return (
    <div className="space-y-6">
      {/* Create CTA */}
      <div className="rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50 p-8 text-center">
        <Trophy className="mx-auto h-10 w-10 text-gray-400 dark:text-gray-500 mb-3" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Create a New Competition</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Set a time period, choose KPIs, and challenge your team to compete.
        </p>
        <button
          onClick={onCreateClick}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm transition shadow-sm"
        >
          <Plus className="w-4 h-4" />
          New Competition
        </button>
      </div>

      {/* Competitions List */}
      {competitions.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider">
            All Competitions
          </h3>
          {competitions.map((c) => {
            const isActive = c.id === activeId
            const startDate = new Date(c.start_date).toLocaleDateString()
            const endDate = new Date(c.end_date).toLocaleDateString()

            return (
              <div
                key={c.id}
                className={`
                  rounded-xl border p-4 flex items-center justify-between transition cursor-pointer
                  ${
                    isActive
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 dark:border-indigo-600'
                      : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600'
                  }
                `}
                onClick={() => onSwitch(c)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') onSwitch(c)
                }}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-gray-900 dark:text-white">{c.name}</p>
                    {isActive && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                        Active
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                    {periodLabel(c.period)} &middot; {startDate} - {endDate}
                    {c.participant_ids.length > 0 && (
                      <span> &middot; {c.participant_ids.length} participant{c.participant_ids.length !== 1 ? 's' : ''}</span>
                    )}
                    {c.kpi_config.length > 0 && (
                      <span> &middot; {c.kpi_config.length} KPI{c.kpi_config.length !== 1 ? 's' : ''}</span>
                    )}
                  </p>
                </div>
                {!isActive && (
                  <span className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">View</span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Arena Page
// ---------------------------------------------------------------------------

export default function Arena() {
  const { user } = useAuth()
  const {
    competition,
    competitions,
    leaderboard,
    personalStats,
    aggregates,
    loading,
    error,
    createCompetition,
    switchCompetition,
    refresh,
  } = useArena()

  const [activeTab, setActiveTab] = useState<ArenaTab>('leaderboard')
  const [showCreateModal, setShowCreateModal] = useState(false)

  const participantCount = useMemo(() => {
    // Show actual participant count from competition config, or leaderboard count
    return competition.participant_ids.length > 0 ? competition.participant_ids.length : leaderboard.length
  }, [competition.participant_ids, leaderboard])

  // Build dynamic KPI stat cards from aggregates
  const kpiStatCards = useMemo(() => {
    return competition.kpi_config.slice(0, 3).map((kpi) => ({
      label: `Total ${kpi.name}`,
      value: aggregates.kpi_totals[kpi.kpi_id] || 0,
      icon: resolveKPIIcon(kpi.kpi_id),
      accent: resolveKPIAccent(kpi.kpi_id),
    }))
  }, [competition.kpi_config, aggregates.kpi_totals])

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Competition Header */}
      <div className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="mx-auto max-w-6xl px-6 py-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <Trophy className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white font-display">
                  The Arena
                </h1>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  Live
                </span>
              </div>
              {competitions.length > 1 ? (
                <div className="flex items-center gap-2 mt-1">
                  <select
                    value={competition.id}
                    onChange={(e) => {
                      const selected = competitions.find((c) => c.id === e.target.value)
                      if (selected) switchCompetition(selected)
                    }}
                    className="text-sm bg-transparent border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 cursor-pointer max-w-xs"
                  >
                    {competitions.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} · {periodLabel(c.period)}{c.is_active ? ' (Active)' : ''}
                      </option>
                    ))}
                  </select>
                  {competition.description && (
                    <span className="text-xs text-gray-400 dark:text-gray-500 italic truncate max-w-xs">
                      {competition.description}
                    </span>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {competition.name} &middot; {periodLabel(competition.period)}
                  {competition.description && (
                    <span className="ml-2 italic">-- {competition.description}</span>
                  )}
                </p>
              )}
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400">
                <Users className="w-4 h-4" />
                <span>{participantCount} participant{participantCount !== 1 ? 's' : ''}</span>
              </div>
              <TimeRemaining endDate={competition.end_date} />
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition shadow-sm"
              >
                <Plus className="w-4 h-4" />
                Create Competition
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-6xl px-6 py-6">
        {/* Tab Nav */}
        <div className="flex items-center justify-between mb-6">
          <TabNav active={activeTab} onChange={setActiveTab} />
          <button
            onClick={refresh}
            className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition"
            title="Refresh data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 mb-6">
            <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Loading */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400">
              <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              Loading arena data...
            </div>
          </div>
        ) : (
          <>
            {/* Leaderboard Tab */}
            {activeTab === 'leaderboard' && (
              <div className="space-y-6">
                {/* Dynamic KPI Cards + Avg Score */}
                <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-${Math.min(kpiStatCards.length + 1, 4)} gap-4`}>
                  {kpiStatCards.map((card) => (
                    <StatCard
                      key={card.label}
                      label={card.label}
                      value={card.value}
                      icon={card.icon}
                      accent={card.accent}
                    />
                  ))}
                  <StatCard
                    label="Avg Score"
                    value={aggregates.avg_score}
                    icon={<Target className="w-5 h-5 text-green-500" />}
                    accent="bg-green-50 dark:bg-green-900/30"
                  />
                </div>

                {/* Podium */}
                <Podium participants={leaderboard} currentUserId={user?.id} kpiConfig={competition.kpi_config} />

                {/* Full Table */}
                <LeaderboardTable participants={leaderboard} currentUserId={user?.id} kpiConfig={competition.kpi_config} />
              </div>
            )}

            {/* My Stats Tab */}
            {activeTab === 'my-stats' && (
              <MyStatsTab personalStats={personalStats} kpiConfig={competition.kpi_config} />
            )}

            {/* Competitions Tab */}
            {activeTab === 'competitions' && (
              <CompetitionsTab
                competitions={competitions}
                activeId={competition.id}
                onSwitch={switchCompetition}
                onCreateClick={() => setShowCreateModal(true)}
              />
            )}
          </>
        )}
      </div>

      {/* Create Competition Modal */}
      <CreateCompetitionModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={createCompetition}
      />
    </div>
  )
}
