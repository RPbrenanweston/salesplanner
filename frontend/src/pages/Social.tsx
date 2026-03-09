/**
 * @crumb
 * @id frontend-page-social
 * @area UI/Pages
 * @intent Social outreach activity log — view and filter social touchpoints (LinkedIn, Twitter/X) logged against contacts
 * @responsibilities Load social-type activities with contact names, filter by platform type, display activity feed with timestamps and outcome notes
 * @contracts Social() → JSX; reads activities (type='social') joined to contacts from Supabase; uses useAuth for user/org_id scoping
 * @in supabase (activities joined to contacts, filtered by type='social'), useAuth (user/org_id)
 * @out Filtered social activity feed with platform icons, contact names, timestamps, outcome labels
 * @err Supabase join failure (contact name not returned — shows undefined or null in feed); empty state has no messaging if no social activities logged
 * @hazard activities.contact join depends on contact_id FK — if contact was deleted, join returns null and card renders with missing contact name (no null guard)
 * @hazard Platform filter assumes activity.platform field exists — if field not present in schema, filter silently shows all activities regardless of selection
 * @shared-edges frontend/src/lib/supabase.ts→QUERIES activities+contacts; frontend/src/hooks/useAuth.ts→CALLS; frontend/src/App.tsx→ROUTES to /social
 * @trail social#1 | Social mounts → load social activities with contact join → render activity feed → platform filter updates query → empty state if none
 * @prompt Add null guard for deleted contacts in activity join. Verify platform field exists on activities table schema. Add empty state with CTA to log first social activity. Add date range filter.
 */
import { useEffect, useState } from 'react';
import { Share2, Linkedin, Twitter, Filter } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface SocialActivity {
  id: string;
  contact_id: string;
  user_id: string;
  salesblock_id: string | null;
  notes: string;
  created_at: string;
  contact: {
    first_name: string;
    last_name: string;
    company: string;
  };
}

interface ParsedNotes {
  platform: string;
  activity_type: string;
  user_notes: string | null;
}

export default function Social() {
  const [activities, setActivities] = useState<SocialActivity[]>([]);
  const [filteredActivities, setFilteredActivities] = useState<SocialActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [platformFilter, setPlatformFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [dateRangeFilter, setDateRangeFilter] = useState<string>('all');

  useEffect(() => {
    loadActivities();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [activities, platformFilter, typeFilter, dateRangeFilter]);

  const loadActivities = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase
        .from('activities')
        .select(`
          id,
          contact_id,
          user_id,
          salesblock_id,
          notes,
          created_at,
          contact:contacts (
            first_name,
            last_name,
            company
          )
        `)
        .eq('type', 'social')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setActivities((data as any[]) || []);
    } catch (err) {
      console.error('Error loading social activities:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...activities];

    // Platform filter
    if (platformFilter !== 'all') {
      filtered = filtered.filter((activity) => {
        try {
          const parsed: ParsedNotes = JSON.parse(activity.notes);
          return parsed.platform === platformFilter;
        } catch {
          return false;
        }
      });
    }

    // Activity type filter
    if (typeFilter !== 'all') {
      filtered = filtered.filter((activity) => {
        try {
          const parsed: ParsedNotes = JSON.parse(activity.notes);
          return parsed.activity_type === typeFilter;
        } catch {
          return false;
        }
      });
    }

    // Date range filter
    if (dateRangeFilter !== 'all') {
      const now = new Date();
      let startDate: Date;

      switch (dateRangeFilter) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        default:
          startDate = new Date(0);
      }

      filtered = filtered.filter((activity) => {
        const activityDate = new Date(activity.created_at);
        return activityDate >= startDate;
      });
    }

    setFilteredActivities(filtered);
  };

  const parseNotes = (notes: string): ParsedNotes => {
    try {
      return JSON.parse(notes);
    } catch {
      return { platform: 'unknown', activity_type: 'unknown', user_notes: notes };
    }
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'linkedin':
        return <Linkedin className="w-5 h-5 text-blue-600 dark:text-blue-400" />;
      case 'twitter':
        return <Twitter className="w-5 h-5 text-sky-500 dark:text-sky-400" />;
      default:
        return <Share2 className="w-5 h-5 text-gray-600 dark:text-gray-400" />;
    }
  };

  const getPlatformLabel = (platform: string): string => {
    const labels: Record<string, string> = {
      linkedin: 'LinkedIn',
      twitter: 'Twitter / X',
      other: 'Other',
      unknown: 'Unknown',
    };
    return labels[platform] || platform;
  };

  const getActivityTypeLabel = (activityType: string): string => {
    const labels: Record<string, string> = {
      connection_request: 'Connection Request',
      message_sent: 'Message Sent',
      inmail: 'InMail',
      comment: 'Comment',
      post_engagement: 'Post Engagement',
      unknown: 'Unknown',
    };
    return labels[activityType] || activityType;
  };

  const getContactName = (contact: any): string => {
    if (Array.isArray(contact)) {
      const c = contact[0];
      return `${c.first_name} ${c.last_name}`;
    }
    return `${contact.first_name} ${contact.last_name}`;
  };

  const getContactCompany = (contact: any): string => {
    if (Array.isArray(contact)) {
      return contact[0].company || '';
    }
    return contact.company || '';
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <p className="text-gray-600 dark:text-gray-400">Loading social activities...</p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Social Outreach</h1>
      <p className="text-gray-600 dark:text-gray-400 mb-6">
        Track LinkedIn and social media activity
      </p>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6">
        <div className="flex items-center space-x-2 mb-4">
          <Filter className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Filters</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Platform Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Platform
            </label>
            <select
              value={platformFilter}
              onChange={(e) => setPlatformFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="all">All Platforms</option>
              <option value="linkedin">LinkedIn</option>
              <option value="twitter">Twitter / X</option>
              <option value="other">Other</option>
            </select>
          </div>

          {/* Type Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Activity Type
            </label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="all">All Types</option>
              <option value="connection_request">Connection Request</option>
              <option value="message_sent">Message Sent</option>
              <option value="inmail">InMail</option>
              <option value="comment">Comment</option>
              <option value="post_engagement">Post Engagement</option>
            </select>
          </div>

          {/* Date Range Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Date Range
            </label>
            <select
              value={dateRangeFilter}
              onChange={(e) => setDateRangeFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="week">Last 7 Days</option>
              <option value="month">This Month</option>
            </select>
          </div>
        </div>
      </div>

      {/* Activities List */}
      {filteredActivities.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
          <Share2 className="w-16 h-16 text-gray-400 dark:text-gray-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">
            {activities.length === 0
              ? 'No social activities logged yet. Start logging from contact detail pages or during salesblocks.'
              : 'No activities match the selected filters.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredActivities.map((activity) => {
            const parsed = parseNotes(activity.notes);
            return (
              <div
                key={activity.id}
                className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-4 flex-1">
                    <div className="mt-1">{getPlatformIcon(parsed.platform)}</div>

                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-1">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                          {getContactName(activity.contact)}
                        </h3>
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {getContactCompany(activity.contact)}
                        </span>
                      </div>

                      <div className="flex items-center space-x-4 mb-2">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                          {getPlatformLabel(parsed.platform)}
                        </span>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">
                          {getActivityTypeLabel(parsed.activity_type)}
                        </span>
                      </div>

                      {parsed.user_notes && (
                        <p className="text-gray-700 dark:text-gray-300 text-sm mb-2">
                          {parsed.user_notes}
                        </p>
                      )}

                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {formatDate(activity.created_at)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
