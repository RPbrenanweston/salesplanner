import { useEffect, useState } from 'react';
import { Phone, Mail, Share2, Calendar } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadAnalytics();
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

  const loadAnalytics = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { start, end } = getDateRangeBounds();

      // Query activities in date range
      const { data: activities, error } = await supabase
        .from('activities')
        .select('id, type, created_at')
        .eq('user_id', user.id)
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())
        .order('created_at', { ascending: true });

      if (error) throw error;

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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
    </div>
  );
}
