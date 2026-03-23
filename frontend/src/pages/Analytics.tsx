// @crumb frontend-page-analytics
// UI/PAGES | load_activity_counts | render_kpi_cards | trend_indicators | custom_kpi_tracking | custom_kpi_modal
// why: Activity analytics dashboard — aggregate and visualise rep performance metrics with custom KPI tracking
// in:supabase(activities table),useAuth(user/org_id),CustomKPIModal out:KPI summary cards(calls/emails/social/meetings),trend lines,custom KPI section err:Supabase aggregation failure(all metrics show 0),custom KPI load failure(silently empty)
// hazard: No time-range filter on activity aggregation — loads all-time counts; grows unbounded causing slow queries
// hazard: Custom KPI values are user-entered targets without server-side validation — negative or large values render without bounds checking
// edge:frontend/src/components/CustomKPIModal.tsx -> CALLS
// edge:frontend/src/lib/supabase.ts -> CALLS
// edge:frontend/src/hooks/useAuth.ts -> CALLS
// edge:frontend/src/App.tsx -> RELATES
// edge:analytics#1 -> STEP_IN
// prompt: Add time-range filter to activity queries. Add loading skeleton per KPI card. Validate custom KPI bounds on input. Consider Recharts for trend visualisation.
import { useEffect, useState } from 'react';
import { Phone, Mail, Share2, Calendar, Plus, TrendingUp } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import CustomKPIModal from '../components/CustomKPIModal';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

type DateRange = 'last_7' | 'last_30' | 'last_90' | 'all_time';

interface ActivityMetrics {
  totalCalls: number;
  totalEmails: number;
  totalSocial: number;
  totalMeetings: number;
}

interface DailyActivity {
  date: string;
  calls: number;
  emails: number;
  social: number;
  meetings: number;
}

interface TypeBreakdown {
  name: string;
  value: number;
}

interface ConversionMetrics {
  totalCalls: number;
  connects: number;
  meetings: number;
  totalEmails: number;
  replies: number;
  callToConnectRate: number;
  connectToMeetingRate: number;
  emailToReplyRate: number;
}

interface PreviousPeriodComparison {
  callToConnectChange: number;
  connectToMeetingChange: number;
  emailToReplyChange: number;
}

interface CustomKPI {
  id: string;
  name: string;
  formula_type: 'count' | 'ratio' | 'sum';
  numerator_metric: string;
  denominator_metric: string | null;
  period: 'daily' | 'weekly' | 'monthly';
  value?: number;
}

export default function Analytics() {
  const { user } = useAuth();
  const [dateRange, setDateRange] = useState<DateRange>('last_30');
  const [metrics, setMetrics] = useState<ActivityMetrics>({
    totalCalls: 0,
    totalEmails: 0,
    totalSocial: 0,
    totalMeetings: 0,
  });
  const [dailyData, setDailyData] = useState<DailyActivity[]>([]);
  const [typeBreakdown, setTypeBreakdown] = useState<TypeBreakdown[]>([]);
  const [conversionMetrics, setConversionMetrics] = useState<ConversionMetrics>({
    totalCalls: 0,
    connects: 0,
    meetings: 0,
    totalEmails: 0,
    replies: 0,
    callToConnectRate: 0,
    connectToMeetingRate: 0,
    emailToReplyRate: 0,
  });
  const [previousPeriod, setPreviousPeriod] = useState<PreviousPeriodComparison>({
    callToConnectChange: 0,
    connectToMeetingChange: 0,
    emailToReplyChange: 0,
  });
  const [customKPIs, setCustomKPIs] = useState<CustomKPI[]>([]);
  const [showKPIModal, setShowKPIModal] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadAnalytics();
      loadCustomKPIs();
    }
  }, [user, dateRange]);

  const getDateRangeBounds = (): { start: Date | null; end: Date } => {
    const now = new Date();
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);

    switch (dateRange) {
      case 'last_7': {
        const start = new Date(now);
        start.setDate(start.getDate() - 6);
        start.setHours(0, 0, 0, 0);
        return { start, end };
      }
      case 'last_30': {
        const start = new Date(now);
        start.setDate(start.getDate() - 29);
        start.setHours(0, 0, 0, 0);
        return { start, end };
      }
      case 'last_90': {
        const start = new Date(now);
        start.setDate(start.getDate() - 89);
        start.setHours(0, 0, 0, 0);
        return { start, end };
      }
      case 'all_time':
        return { start: null, end };
    }
  };

  const loadCustomKPIs = async () => {
    if (!user) return;

    try {
      // Get user's org_id
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('org_id')
        .eq('id', user.id)
        .single();

      if (userError) throw userError;

      // Load custom KPIs for the user's org
      const { data: kpis, error } = await supabase
        .from('custom_kpis')
        .select('*')
        .eq('org_id', userData.org_id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setCustomKPIs(kpis || []);
    } catch (err) {
      console.error('Error loading custom KPIs:', err);
    }
  };

  const calculateKPIValue = async (kpi: CustomKPI): Promise<number> => {
    if (!user) return 0;

    const { start, end } = getDateRangeBounds();

    // Query activities in date range
    let activitiesQuery = supabase
      .from('activities')
      .select('type, outcome, replied_at')
      .eq('user_id', user.id)
      .lte('created_at', end.toISOString());
    if (start) activitiesQuery = activitiesQuery.gte('created_at', start.toISOString());
    const { data: activities } = await activitiesQuery;

    if (!activities) return 0;

    // Pre-fetch deals for pipeline_value metric
    let pipelineValue = 0;
    if (kpi.numerator_metric === 'pipeline_value' || kpi.denominator_metric === 'pipeline_value') {
      const { data: deals } = await supabase
        .from('deals')
        .select('value, stage')
        .eq('user_id', user.id);
      if (deals) {
        pipelineValue = deals
          .filter(d => d.stage !== 'Closed Won' && d.stage !== 'Closed Lost')
          .reduce((sum, d) => sum + (d.value || 0), 0);
      }
    }

    const metricValue = (metric: string): number => {
      switch (metric) {
        case 'calls':
          return activities.filter((a) => a.type === 'call').length;
        case 'emails':
          return activities.filter((a) => a.type === 'email').length;
        case 'social_touches':
          return activities.filter((a) => a.type === 'social').length;
        case 'meetings_booked':
          return activities.filter((a) => a.outcome === 'meeting_booked').length;
        case 'connects':
          return activities.filter(
            (a) =>
              a.type === 'call' &&
              (a.outcome === 'connect' || a.outcome === 'conversation' || a.outcome === 'meeting_booked')
          ).length;
        case 'replies':
          return activities.filter((a) => a.type === 'email' && a.replied_at !== null).length;
        case 'pipeline_value':
          return pipelineValue;
        default:
          return 0;
      }
    };

    const numerator = metricValue(kpi.numerator_metric);

    if (kpi.formula_type === 'count') {
      return numerator;
    } else if (kpi.formula_type === 'sum') {
      return numerator; // For sum, just return the total
    } else if (kpi.formula_type === 'ratio' && kpi.denominator_metric) {
      const denominator = metricValue(kpi.denominator_metric);
      return denominator > 0 ? (numerator / denominator) * 100 : 0;
    }

    return 0;
  };

  const loadAnalytics = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { start, end } = getDateRangeBounds();

      // Query activities in date range
      let activitiesQuery = supabase
        .from('activities')
        .select('id, type, outcome, replied_at, created_at')
        .eq('user_id', user.id)
        .lte('created_at', end.toISOString())
        .order('created_at', { ascending: true });
      if (start) activitiesQuery = activitiesQuery.gte('created_at', start.toISOString());
      const { data: activities, error } = await activitiesQuery;

      if (error) throw error;

      // Query previous period for comparison (skip for all_time — no prior period)
      let prevActivities: typeof activities = [];
      if (start) {
        const periodDuration = end.getTime() - start.getTime();
        const prevEnd = new Date(start.getTime() - 1);
        const prevStart = new Date(start.getTime() - periodDuration);

        const { data: prev } = await supabase
          .from('activities')
          .select('id, type, outcome, replied_at, created_at')
          .eq('user_id', user.id)
          .gte('created_at', prevStart.toISOString())
          .lte('created_at', prevEnd.toISOString());
        prevActivities = prev || [];
      }

      // Calculate metrics
      const calls = activities?.filter((a) => a.type === 'call').length || 0;
      const emails = activities?.filter((a) => a.type === 'email').length || 0;
      const social = activities?.filter((a) => a.type === 'social').length || 0;
      const meetings = activities?.filter((a) => a.type === 'meeting').length || 0;

      setMetrics({
        totalCalls: calls,
        totalEmails: emails,
        totalSocial: social,
        totalMeetings: meetings,
      });

      // Build daily activity data
      const dailyMap: Record<string, DailyActivity> = {};

      // Initialize all dates in range using local dates so the chart
      // groups activities by the user's local day, not UTC day.
      const toLocalDateKey = (d: Date) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      };

      // For all_time, seed from the earliest activity date; if none, skip seeding
      const chartStart = start ?? (activities && activities.length > 0 ? new Date(activities[0].created_at) : null);
      if (chartStart) {
        const current = new Date(chartStart);
        while (current <= end) {
          const dateKey = toLocalDateKey(current);
          dailyMap[dateKey] = {
            date: dateKey,
            calls: 0,
            emails: 0,
            social: 0,
            meetings: 0,
          };
          current.setDate(current.getDate() + 1);
        }
      }

      // Populate with activity data — use local date so a 11pm activity
      // appears on the user's local day, not the UTC next-day.
      activities?.forEach((activity) => {
        const dateKey = toLocalDateKey(new Date(activity.created_at));
        if (dailyMap[dateKey]) {
          if (activity.type === 'call') dailyMap[dateKey].calls += 1;
          if (activity.type === 'email') dailyMap[dateKey].emails += 1;
          if (activity.type === 'social') dailyMap[dateKey].social += 1;
          if (activity.type === 'meeting') dailyMap[dateKey].meetings += 1;
        }
      });

      const dailyArray = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));
      setDailyData(dailyArray);

      // Build type breakdown
      setTypeBreakdown([
        { name: 'Calls', value: calls },
        { name: 'Emails', value: emails },
        { name: 'Social', value: social },
        { name: 'Meetings', value: meetings },
      ]);

      // Calculate conversion metrics
      const callActivities = activities?.filter((a) => a.type === 'call') || [];
      const emailActivities = activities?.filter((a) => a.type === 'email') || [];

      const connects = callActivities.filter(
        (a) => a.outcome === 'connect' || a.outcome === 'conversation' || a.outcome === 'meeting_booked'
      ).length;

      const meetingsBooked = callActivities.filter((a) => a.outcome === 'meeting_booked').length;

      const emailReplies = emailActivities.filter((a) => a.replied_at !== null).length;

      const callToConnectRate = calls > 0 ? (connects / calls) * 100 : 0;
      const connectToMeetingRate = connects > 0 ? (meetingsBooked / connects) * 100 : 0;
      const emailToReplyRate = emails > 0 ? (emailReplies / emails) * 100 : 0;

      setConversionMetrics({
        totalCalls: calls,
        connects,
        meetings: meetingsBooked,
        totalEmails: emails,
        replies: emailReplies,
        callToConnectRate,
        connectToMeetingRate,
        emailToReplyRate,
      });

      // Calculate previous period conversions for comparison
      if (prevActivities) {
        const prevCalls = prevActivities.filter((a) => a.type === 'call');
        const prevEmails = prevActivities.filter((a) => a.type === 'email');

        const prevConnects = prevCalls.filter(
          (a) => a.outcome === 'connect' || a.outcome === 'conversation' || a.outcome === 'meeting_booked'
        ).length;

        const prevMeetings = prevCalls.filter((a) => a.outcome === 'meeting_booked').length;
        const prevReplies = prevEmails.filter((a) => a.replied_at !== null).length;

        const prevCallToConnect = prevCalls.length > 0 ? (prevConnects / prevCalls.length) * 100 : 0;
        const prevConnectToMeeting = prevConnects > 0 ? (prevMeetings / prevConnects) * 100 : 0;
        const prevEmailToReply = prevEmails.length > 0 ? (prevReplies / prevEmails.length) * 100 : 0;

        setPreviousPeriod({
          callToConnectChange: callToConnectRate - prevCallToConnect,
          connectToMeetingChange: connectToMeetingRate - prevConnectToMeeting,
          emailToReplyChange: emailToReplyRate - prevEmailToReply,
        });
      }
    } catch (err) {
      console.error('Error loading analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    // Parse YYYY-MM-DD keys as local midnight to avoid UTC-to-local shift
    // that would show the previous day for users in negative-offset timezones.
    const [year, month, day] = (dateString as string).split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
    }).format(date);
  };

  const COLORS = ['#6366F1', '#0db9f2', '#F59E0B', '#10b981'];

  if (loading) {
    return (
      <div className="min-h-full bg-gray-50 dark:bg-void-950 p-6 flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-400 dark:text-white/40">
          <div className="w-5 h-5 border-2 border-indigo-electric border-t-transparent rounded-full animate-spin" />
          <span className="font-mono text-sm tracking-widest uppercase">Loading Analytics...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-gray-50 dark:bg-void-950 p-6">
      <div className="mb-8">
        <p className="vv-section-title mb-1">Insights</p>
        <h1 className="font-display text-3xl font-bold text-gray-900 dark:text-white mb-1">Command Center</h1>
        <p className="text-sm text-gray-500 dark:text-white/50 mb-6">Real-time sales velocity and team performance</p>

        {/* Date Range Selector */}
        <div className="flex items-center gap-3 flex-wrap">
          {(['last_7', 'last_30', 'last_90', 'all_time'] as const).map((range) => {
            const labels: Record<DateRange, string> = {
              last_7: 'Last 7 Days',
              last_30: 'Last 30 Days',
              last_90: 'Last 90 Days',
              all_time: 'All Time',
            };
            return (
              <button
                key={range}
                onClick={() => setDateRange(range)}
                className={`px-4 py-2 rounded-lg border text-sm font-semibold transition-all duration-150 ease-snappy ${
                  dateRange === range
                    ? 'bg-indigo-electric border-indigo-electric text-white'
                    : 'bg-white dark:bg-white/5 text-gray-700 dark:text-white/70 border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/10'
                }`}
              >
                {labels[range]}
              </button>
            );
          })}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[
          { icon: <Phone className="w-6 h-6 text-indigo-electric" />, bg: 'bg-indigo-electric/10', label: 'Total Calls', value: metrics.totalCalls },
          { icon: <Mail className="w-6 h-6 text-cyan-neon" />, bg: 'bg-cyan-neon/10', label: 'Total Emails', value: metrics.totalEmails },
          { icon: <Share2 className="w-6 h-6 text-amber-400" />, bg: 'bg-amber-400/10', label: 'Social Touches', value: metrics.totalSocial },
          { icon: <Calendar className="w-6 h-6 text-red-alert" />, bg: 'bg-red-alert/10', label: 'Meetings Booked', value: metrics.totalMeetings },
        ].map((card) => (
          <div key={card.label} className="glass-card p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className={`p-3 ${card.bg} rounded-lg`}>{card.icon}</div>
              <h3 className="vv-section-title">{card.label}</h3>
            </div>
            {loading ? (
              <div className="h-10 w-20 bg-gray-200 dark:bg-white/10 rounded animate-pulse" />
            ) : (
              <p className="font-display font-mono text-4xl font-black text-gray-900 dark:text-white">{card.value}</p>
            )}
          </div>
        ))}
      </div>

      {/* Activity Trend Chart */}
      <div className="glass-card mb-8 p-6">
        <h2 className="font-display font-semibold text-gray-900 dark:text-white mb-4">Activity Trend</h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={dailyData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
            <XAxis
              dataKey="date"
              tickFormatter={formatDate}
              stroke="rgba(255,255,255,0.6)"
              style={{ fontSize: '12px' }}
            />
            <YAxis stroke="rgba(255,255,255,0.6)" style={{ fontSize: '12px' }} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(15, 23, 42, 0.8)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px',
                color: '#F3F4F6',
              }}
              labelFormatter={(label) => formatDate(label as string)}
            />
            <Legend wrapperStyle={{ paddingTop: '20px' }} />
            <Line type="monotone" dataKey="calls" stroke="#6366F1" strokeWidth={2} name="Calls" />
            <Line type="monotone" dataKey="emails" stroke="#0db9f2" strokeWidth={2} name="Emails" />
            <Line type="monotone" dataKey="social" stroke="#F59E0B" strokeWidth={2} name="Social" />
            <Line
              type="monotone"
              dataKey="meetings"
              stroke="#10b981"
              strokeWidth={2}
              name="Meetings"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Activity Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Stacked Bar Chart */}
        <div className="glass-card p-6">
          <h2 className="font-display font-semibold text-gray-900 dark:text-white mb-4">
            Daily Activity Breakdown
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={dailyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                stroke="rgba(255,255,255,0.6)"
                style={{ fontSize: '12px' }}
              />
              <YAxis stroke="rgba(255,255,255,0.6)" style={{ fontSize: '12px' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(15, 23, 42, 0.8)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  color: '#F3F4F6',
                }}
                labelFormatter={(label) => formatDate(label as string)}
              />
              <Legend wrapperStyle={{ paddingTop: '20px' }} />
              <Bar dataKey="calls" stackId="a" fill="#6366F1" name="Calls" radius={[8, 8, 0, 0]} />
              <Bar dataKey="emails" stackId="a" fill="#0db9f2" name="Emails" radius={[8, 8, 0, 0]} />
              <Bar dataKey="social" stackId="a" fill="#F59E0B" name="Social" radius={[8, 8, 0, 0]} />
              <Bar dataKey="meetings" stackId="a" fill="#10b981" name="Meetings" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pie Chart */}
        <div className="glass-card p-6">
          <h2 className="font-display font-semibold text-gray-900 dark:text-white mb-4">
            Activity Type Distribution
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={typeBreakdown}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) =>
                  `${name}: ${percent ? (percent * 100).toFixed(0) : 0}%`
                }
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {typeBreakdown.map((_entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(15, 23, 42, 0.8)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  color: '#F3F4F6',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Custom KPIs */}
      {customKPIs.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-semibold text-gray-900 dark:text-white">Custom KPIs</h2>
            <button
              onClick={() => setShowKPIModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-electric hover:bg-indigo-electric/80 text-white rounded-lg text-sm font-semibold transition-all duration-200 ease-snappy"
            >
              <Plus className="w-4 h-4" />
              Add KPI
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {customKPIs.map((kpi) => (
              <CustomKPICard key={kpi.id} kpi={kpi} calculateValue={calculateKPIValue} />
            ))}
          </div>
        </div>
      )}

      {customKPIs.length === 0 && (
        <div className="mb-8 glass-card p-6">
          <div className="text-center">
            <TrendingUp className="w-12 h-12 text-white/40 mx-auto mb-3" />
            <h3 className="font-display font-semibold text-gray-900 dark:text-white mb-2">No Custom KPIs Yet</h3>
            <p className="text-sm text-gray-500 dark:text-white/50 mb-4">
              Create custom KPIs to track metrics specific to your workflow.
            </p>
            <button
              onClick={() => setShowKPIModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-electric hover:bg-indigo-electric/80 text-white rounded-lg text-sm font-semibold transition-all duration-200 ease-snappy mx-auto"
            >
              <Plus className="w-4 h-4" />
              Add Custom KPI
            </button>
          </div>
        </div>
      )}

      {/* Conversion Funnel */}
      <div className="glass-card p-6">
        <h2 className="font-display font-semibold text-gray-900 dark:text-white mb-6">Conversion Funnel</h2>

        {/* Funnel Stages */}
        <div className="space-y-4">
          {/* Calls to Connects */}
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700 dark:text-white/70">
                  Calls → Connects
                </span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-lg font-bold text-gray-900 dark:text-white">
                    {conversionMetrics.callToConnectRate.toFixed(1)}%
                  </span>
                  {previousPeriod.callToConnectChange !== 0 && (
                    <span
                      className={`text-xs font-medium ${
                        previousPeriod.callToConnectChange > 0
                          ? 'text-emerald-signal'
                          : 'text-red-alert'
                      }`}
                    >
                      {previousPeriod.callToConnectChange > 0 ? '+' : ''}
                      {previousPeriod.callToConnectChange.toFixed(1)}%
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-white/50">
                <span>{conversionMetrics.totalCalls} calls</span>
                <span>→</span>
                <span>{conversionMetrics.connects} connects</span>
              </div>
              <div className="mt-2 w-full bg-gray-100 dark:bg-white/10 rounded-full h-2">
                <div
                  className="bg-indigo-electric h-2 rounded-full transition-all"
                  style={{ width: `${Math.min(conversionMetrics.callToConnectRate, 100)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Connects to Meetings */}
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700 dark:text-white/70">
                  Connects → Meetings
                </span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-lg font-bold text-gray-900 dark:text-white">
                    {conversionMetrics.connectToMeetingRate.toFixed(1)}%
                  </span>
                  {previousPeriod.connectToMeetingChange !== 0 && (
                    <span
                      className={`text-xs font-medium ${
                        previousPeriod.connectToMeetingChange > 0
                          ? 'text-emerald-signal'
                          : 'text-red-alert'
                      }`}
                    >
                      {previousPeriod.connectToMeetingChange > 0 ? '+' : ''}
                      {previousPeriod.connectToMeetingChange.toFixed(1)}%
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-white/50">
                <span>{conversionMetrics.connects} connects</span>
                <span>→</span>
                <span>{conversionMetrics.meetings} meetings</span>
              </div>
              <div className="mt-2 w-full bg-gray-100 dark:bg-white/10 rounded-full h-2">
                <div
                  className="bg-cyan-neon h-2 rounded-full transition-all"
                  style={{ width: `${Math.min(conversionMetrics.connectToMeetingRate, 100)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Emails to Replies */}
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700 dark:text-white/70">
                  Emails → Replies
                </span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-lg font-bold text-gray-900 dark:text-white">
                    {conversionMetrics.emailToReplyRate.toFixed(1)}%
                  </span>
                  {previousPeriod.emailToReplyChange !== 0 && (
                    <span
                      className={`text-xs font-medium ${
                        previousPeriod.emailToReplyChange > 0
                          ? 'text-emerald-signal'
                          : 'text-red-alert'
                      }`}
                    >
                      {previousPeriod.emailToReplyChange > 0 ? '+' : ''}
                      {previousPeriod.emailToReplyChange.toFixed(1)}%
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-white/50">
                <span>{conversionMetrics.totalEmails} emails</span>
                <span>→</span>
                <span>{conversionMetrics.replies} replies</span>
              </div>
              <div className="mt-2 w-full bg-gray-100 dark:bg-white/10 rounded-full h-2">
                <div
                  className="bg-amber-400 h-2 rounded-full transition-all"
                  style={{ width: `${Math.min(conversionMetrics.emailToReplyRate, 100)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Calls to Meetings (End-to-End) */}
          <div className="flex items-center gap-4 pt-4 border-t border-gray-200 dark:border-white/10">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700 dark:text-white/70">
                  Calls → Meetings (End-to-End)
                </span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-lg font-bold text-gray-900 dark:text-white">
                    {conversionMetrics.totalCalls > 0
                      ? ((conversionMetrics.meetings / conversionMetrics.totalCalls) * 100).toFixed(1)
                      : 0}
                    %
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-white/50">
                <span>{conversionMetrics.totalCalls} calls</span>
                <span>→</span>
                <span>{conversionMetrics.meetings} meetings</span>
              </div>
              <div className="mt-2 w-full bg-gray-100 dark:bg-white/10 rounded-full h-2">
                <div
                  className="bg-emerald-signal h-2 rounded-full transition-all"
                  style={{
                    width: `${Math.min(
                      conversionMetrics.totalCalls > 0
                        ? (conversionMetrics.meetings / conversionMetrics.totalCalls) * 100
                        : 0,
                      100
                    )}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Custom KPI Modal */}
      <CustomKPIModal
        isOpen={showKPIModal}
        onClose={() => setShowKPIModal(false)}
        onSuccess={() => {
          loadCustomKPIs();
        }}
      />
    </div>
  );
}

// Custom KPI Card Component
interface CustomKPICardProps {
  kpi: CustomKPI;
  calculateValue: (kpi: CustomKPI) => Promise<number>;
}

function CustomKPICard({ kpi, calculateValue }: CustomKPICardProps) {
  const [value, setValue] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadValue = async () => {
      setLoading(true);
      const result = await calculateValue(kpi);
      setValue(result);
      setLoading(false);
    };
    loadValue();
  }, [kpi]);

  const formatValue = (): string => {
    if (value === null) return '...';
    if (kpi.formula_type === 'ratio') {
      return `${value.toFixed(1)}%`;
    }
    return Math.round(value).toString();
  };

  const getFormulaDescription = (): string => {
    if (kpi.formula_type === 'count') {
      return `Total ${kpi.numerator_metric.replace(/_/g, ' ')}`;
    } else if (kpi.formula_type === 'ratio') {
      return `${kpi.numerator_metric.replace(/_/g, ' ')} / ${kpi.denominator_metric?.replace(/_/g, ' ')}`;
    } else {
      return `Sum of ${kpi.numerator_metric.replace(/_/g, ' ')}`;
    }
  };

  return (
    <div className="glass-card p-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 bg-purple-neon/10 rounded-lg">
          <TrendingUp className="w-6 h-6 text-purple-neon" />
        </div>
        <h3 className="vv-section-title">{kpi.name}</h3>
      </div>
      <p className="font-display font-mono text-3xl font-bold text-gray-900 dark:text-white mb-1">
        {loading ? '...' : formatValue()}
      </p>
      <p className="text-xs text-gray-500 dark:text-white/50">{getFormulaDescription()}</p>
      <p className="text-xs text-gray-400 dark:text-white/40 mt-1 capitalize">{kpi.period}</p>
    </div>
  );
}
