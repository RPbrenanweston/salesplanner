// @crumb frontend-page-social
// UI/PAGES | load_social_activities | filter_by_platform | display_activity_feed | timestamps_and_outcomes
// why: Social outreach activity log — view and filter social touchpoints (LinkedIn, Twitter/X) logged against contacts
// in:supabase(activities joined to contacts,type='social'),useAuth(user/org_id) out:filtered social activity feed with platform icons,contact names,timestamps,outcome labels err:Supabase join failure(contact name not returned),empty state has no messaging
// hazard: activities.contact join depends on contact_id FK — if contact deleted, join returns null and card renders with missing contact name
// hazard: Platform filter assumes activity.platform field exists — if field not present, filter silently shows all activities
// edge:frontend/src/lib/supabase.ts -> CALLS
// edge:frontend/src/hooks/useAuth.ts -> CALLS
// edge:frontend/src/App.tsx -> RELATES
// edge:social#1 -> STEP_IN
// prompt: Add null guard for deleted contacts. Verify platform field exists on activities table. Add empty state with CTA. Add date range filter.
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
        return <Linkedin className="w-5 h-5 text-indigo-electric" />;
      case 'twitter':
        return <Twitter className="w-5 h-5 text-cyan-neon" />;
      default:
        return <Share2 className="w-5 h-5 text-gray-400 dark:text-white/30" />;
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
      <div className="min-h-full bg-gray-50 dark:bg-void-950 p-6 flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-400 dark:text-white/40">
          <div className="w-5 h-5 border-2 border-indigo-electric border-t-transparent rounded-full animate-spin" />
          <span className="font-mono text-sm tracking-widest uppercase">Loading Social...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-gray-50 dark:bg-void-950 p-6 space-y-6">
      {/* Header */}
      <div>
        <p className="vv-section-title mb-1">Engagement</p>
        <h1 className="font-display text-3xl font-bold text-gray-900 dark:text-white">Social Outreach</h1>
        <p className="text-sm text-gray-500 dark:text-white/50 mt-1">
          Track LinkedIn and social media activity
        </p>
      </div>

      {/* Filters */}
      <div className="glass-card p-4">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-4 h-4 text-gray-400 dark:text-white/30" />
          <h2 className="font-display font-semibold text-gray-900 dark:text-white text-sm">Filters</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Platform Filter */}
          <div>
            <label className="vv-section-title block mb-1">Platform</label>
            <select
              value={platformFilter}
              onChange={(e) => setPlatformFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-indigo-electric focus:outline-none bg-white dark:bg-white/5 text-gray-900 dark:text-white text-sm transition-colors duration-150"
            >
              <option value="all">All Platforms</option>
              <option value="linkedin">LinkedIn</option>
              <option value="twitter">Twitter / X</option>
              <option value="other">Other</option>
            </select>
          </div>

          {/* Type Filter */}
          <div>
            <label className="vv-section-title block mb-1">Activity Type</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-indigo-electric focus:outline-none bg-white dark:bg-white/5 text-gray-900 dark:text-white text-sm transition-colors duration-150"
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
            <label className="vv-section-title block mb-1">Date Range</label>
            <select
              value={dateRangeFilter}
              onChange={(e) => setDateRangeFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-indigo-electric focus:outline-none bg-white dark:bg-white/5 text-gray-900 dark:text-white text-sm transition-colors duration-150"
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
        <div className="glass-card text-center py-16">
          <Share2 className="w-10 h-10 text-gray-300 dark:text-white/20 mx-auto mb-3" />
          <p className="font-display font-semibold text-gray-900 dark:text-white mb-1">
            {activities.length === 0 ? 'No social activities yet' : 'No activities match filters'}
          </p>
          <p className="text-sm text-gray-400 dark:text-white/40">
            {activities.length === 0
              ? 'Log social touchpoints from contact pages or during SalesBlocks'
              : 'Try adjusting your filter selections'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredActivities.map((activity) => {
            const parsed = parseNotes(activity.notes);
            return (
              <div
                key={activity.id}
                className="glass-card p-4 hover:bg-gray-50 dark:hover:bg-white/[0.08] transition-all duration-150 ease-snappy"
              >
                <div className="flex items-start gap-4">
                  <div className="mt-0.5 flex-shrink-0">{getPlatformIcon(parsed.platform)}</div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="font-display font-semibold text-gray-900 dark:text-white">
                        {getContactName(activity.contact)}
                      </h3>
                      {getContactCompany(activity.contact) && (
                        <span className="text-sm text-gray-500 dark:text-white/40">
                          {getContactCompany(activity.contact)}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-electric/15 text-indigo-electric">
                        {getPlatformLabel(parsed.platform)}
                      </span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-white/50">
                        {getActivityTypeLabel(parsed.activity_type)}
                      </span>
                    </div>

                    {parsed.user_notes && (
                      <p className="text-sm text-gray-600 dark:text-white/50 mb-2">
                        {parsed.user_notes}
                      </p>
                    )}

                    <p className="text-xs text-gray-400 dark:text-white/30 font-mono">
                      {formatDate(activity.created_at)}
                    </p>
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
