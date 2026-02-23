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

type DateRange = 'today' | 'this_week' | 'this_month' | 'custom';

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
  const [dateRange, setDateRange] = useState<DateRange>('this_week');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
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
  }, [user, dateRange, customStartDate, customEndDate]);

  const getDateRangeBounds = (): { start: Date; end: Date } => {
    const now = new Date();
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);

    let start: Date;

    switch (dateRange) {
      case 'today':
        start = new Date(now);
        start.setHours(0, 0, 0, 0);
        break;

      case 'this_week':
        start = new Date(now);
        const dayOfWeek = start.getDay();
        const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Monday = 0
        start.setDate(start.getDate() - diff);
        start.setHours(0, 0, 0, 0);
        break;

      case 'this_month':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        start.setHours(0, 0, 0, 0);
        break;

      case 'custom':
        if (customStartDate && customEndDate) {
          start = new Date(customStartDate);
          const customEnd = new Date(customEndDate);
          customEnd.setHours(23, 59, 59, 999);
          return { start, end: customEnd };
        } else {
          // Fallback to this week if custom dates not set
          start = new Date(now);
          const dayOfWeek = start.getDay();
          const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
          start.setDate(start.getDate() - diff);
          start.setHours(0, 0, 0, 0);
        }
        break;

      default:
        start = new Date(now);
        start.setHours(0, 0, 0, 0);
    }

    return { start, end };
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
    const { data: activities } = await supabase
      .from('activities')
      .select('type, outcome, replied_at')
      .eq('user_id', user.id)
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString());

    if (!activities) return 0;

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
          // TODO: Implement pipeline value calculation from deals table
          return 0;
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
      const { data: activities, error } = await supabase
        .from('activities')
        .select('id, type, outcome, replied_at, created_at')
        .eq('user_id', user.id)
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Query previous period for comparison
      const periodDuration = end.getTime() - start.getTime();
      const prevEnd = new Date(start.getTime() - 1);
      const prevStart = new Date(start.getTime() - periodDuration);

      const { data: prevActivities } = await supabase
        .from('activities')
        .select('id, type, outcome, replied_at')
        .eq('user_id', user.id)
        .gte('created_at', prevStart.toISOString())
        .lte('created_at', prevEnd.toISOString());

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

      // Initialize all dates in range
      const current = new Date(start);
      while (current <= end) {
        const dateKey = current.toISOString().split('T')[0];
        dailyMap[dateKey] = {
          date: dateKey,
          calls: 0,
          emails: 0,
          social: 0,
          meetings: 0,
        };
        current.setDate(current.getDate() + 1);
      }

      // Populate with activity data
      activities?.forEach((activity) => {
        const dateKey = activity.created_at.split('T')[0];
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
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
    }).format(date);
  };

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444'];

  if (loading) {
    return (
      <div className="p-8">
        <p className="text-gray-500 dark:text-gray-400">Loading analytics...</p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Analytics</h1>

        {/* Date Range Selector */}
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => setDateRange('today')}
            className={`px-4 py-2 rounded-lg ${
              dateRange === 'today'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
            }`}
          >
            Today
          </button>
          <button
            onClick={() => setDateRange('this_week')}
            className={`px-4 py-2 rounded-lg ${
              dateRange === 'this_week'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
            }`}
          >
            This Week
          </button>
          <button
            onClick={() => setDateRange('this_month')}
            className={`px-4 py-2 rounded-lg ${
              dateRange === 'this_month'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
            }`}
          >
            This Month
          </button>
          <button
            onClick={() => setDateRange('custom')}
            className={`px-4 py-2 rounded-lg ${
              dateRange === 'custom'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
            }`}
          >
            Custom
          </button>

          {dateRange === 'custom' && (
            <>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
              <span className="text-gray-600 dark:text-gray-400">to</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </>
          )}
        </div>
      </div>

      {/* Activity Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
              <Phone className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Calls</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">{metrics.totalCalls}</p>
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
              <Mail className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Emails</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">{metrics.totalEmails}</p>
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-orange-100 dark:bg-orange-900 rounded-lg">
              <Share2 className="w-6 h-6 text-orange-600 dark:text-orange-400" />
            </div>
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Social Touches</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">{metrics.totalSocial}</p>
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-red-100 dark:bg-red-900 rounded-lg">
              <Calendar className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Meetings Booked</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">{metrics.totalMeetings}</p>
        </div>
      </div>

      {/* Activity Trend Chart */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-6 mb-8">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Activity Trend</h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={dailyData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="date"
              tickFormatter={formatDate}
              stroke="#9CA3AF"
              style={{ fontSize: '12px' }}
            />
            <YAxis stroke="#9CA3AF" style={{ fontSize: '12px' }} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1F2937',
                border: '1px solid #374151',
                borderRadius: '8px',
                color: '#F3F4F6',
              }}
              labelFormatter={(label) => formatDate(label as string)}
            />
            <Legend />
            <Line type="monotone" dataKey="calls" stroke="#3B82F6" strokeWidth={2} name="Calls" />
            <Line type="monotone" dataKey="emails" stroke="#10B981" strokeWidth={2} name="Emails" />
            <Line type="monotone" dataKey="social" stroke="#F59E0B" strokeWidth={2} name="Social" />
            <Line
              type="monotone"
              dataKey="meetings"
              stroke="#EF4444"
              strokeWidth={2}
              name="Meetings"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Activity Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Stacked Bar Chart */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Daily Activity Breakdown
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={dailyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                stroke="#9CA3AF"
                style={{ fontSize: '12px' }}
              />
              <YAxis stroke="#9CA3AF" style={{ fontSize: '12px' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1F2937',
                  border: '1px solid #374151',
                  borderRadius: '8px',
                  color: '#F3F4F6',
                }}
                labelFormatter={(label) => formatDate(label as string)}
              />
              <Legend />
              <Bar dataKey="calls" stackId="a" fill="#3B82F6" name="Calls" />
              <Bar dataKey="emails" stackId="a" fill="#10B981" name="Emails" />
              <Bar dataKey="social" stackId="a" fill="#F59E0B" name="Social" />
              <Bar dataKey="meetings" stackId="a" fill="#EF4444" name="Meetings" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pie Chart */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
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
                  backgroundColor: '#1F2937',
                  border: '1px solid #374151',
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
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Custom KPIs</h2>
            <button
              onClick={() => setShowKPIModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
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
        <div className="mb-8 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <div className="text-center">
            <TrendingUp className="w-12 h-12 text-gray-400 dark:text-gray-600 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Custom KPIs Yet</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Create custom KPIs to track metrics specific to your workflow.
            </p>
            <button
              onClick={() => setShowKPIModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 mx-auto"
            >
              <Plus className="w-4 h-4" />
              Add Custom KPI
            </button>
          </div>
        </div>
      )}

      {/* Conversion Funnel */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">Conversion Funnel</h2>

        {/* Funnel Stages */}
        <div className="space-y-4">
          {/* Calls to Connects */}
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Calls → Connects
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-gray-900 dark:text-white">
                    {conversionMetrics.callToConnectRate.toFixed(1)}%
                  </span>
                  {previousPeriod.callToConnectChange !== 0 && (
                    <span
                      className={`text-xs font-medium ${
                        previousPeriod.callToConnectChange > 0
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {previousPeriod.callToConnectChange > 0 ? '+' : ''}
                      {previousPeriod.callToConnectChange.toFixed(1)}%
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <span>{conversionMetrics.totalCalls} calls</span>
                <span>→</span>
                <span>{conversionMetrics.connects} connects</span>
              </div>
              <div className="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all"
                  style={{ width: `${Math.min(conversionMetrics.callToConnectRate, 100)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Connects to Meetings */}
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Connects → Meetings
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-gray-900 dark:text-white">
                    {conversionMetrics.connectToMeetingRate.toFixed(1)}%
                  </span>
                  {previousPeriod.connectToMeetingChange !== 0 && (
                    <span
                      className={`text-xs font-medium ${
                        previousPeriod.connectToMeetingChange > 0
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {previousPeriod.connectToMeetingChange > 0 ? '+' : ''}
                      {previousPeriod.connectToMeetingChange.toFixed(1)}%
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <span>{conversionMetrics.connects} connects</span>
                <span>→</span>
                <span>{conversionMetrics.meetings} meetings</span>
              </div>
              <div className="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-green-600 h-2 rounded-full transition-all"
                  style={{ width: `${Math.min(conversionMetrics.connectToMeetingRate, 100)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Emails to Replies */}
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Emails → Replies
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-gray-900 dark:text-white">
                    {conversionMetrics.emailToReplyRate.toFixed(1)}%
                  </span>
                  {previousPeriod.emailToReplyChange !== 0 && (
                    <span
                      className={`text-xs font-medium ${
                        previousPeriod.emailToReplyChange > 0
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {previousPeriod.emailToReplyChange > 0 ? '+' : ''}
                      {previousPeriod.emailToReplyChange.toFixed(1)}%
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <span>{conversionMetrics.totalEmails} emails</span>
                <span>→</span>
                <span>{conversionMetrics.replies} replies</span>
              </div>
              <div className="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-orange-600 h-2 rounded-full transition-all"
                  style={{ width: `${Math.min(conversionMetrics.emailToReplyRate, 100)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Calls to Meetings (End-to-End) */}
          <div className="flex items-center gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Calls → Meetings (End-to-End)
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-gray-900 dark:text-white">
                    {conversionMetrics.totalCalls > 0
                      ? ((conversionMetrics.meetings / conversionMetrics.totalCalls) * 100).toFixed(1)
                      : 0}
                    %
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <span>{conversionMetrics.totalCalls} calls</span>
                <span>→</span>
                <span>{conversionMetrics.meetings} meetings</span>
              </div>
              <div className="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-purple-600 h-2 rounded-full transition-all"
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
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
          <TrendingUp className="w-6 h-6 text-purple-600 dark:text-purple-400" />
        </div>
        <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">{kpi.name}</h3>
      </div>
      <p className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
        {loading ? '...' : formatValue()}
      </p>
      <p className="text-xs text-gray-500 dark:text-gray-400">{getFormulaDescription()}</p>
      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 capitalize">{kpi.period}</p>
    </div>
  );
}
