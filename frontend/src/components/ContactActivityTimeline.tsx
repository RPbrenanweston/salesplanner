// @crumb frontend-component-contact-activity-timeline
// UI/Contacts | fetch_activities | render_typed_entries | icons_and_timestamps | pagination
// why: Contact activity timeline — display chronological activity feed for a single contact (calls, emails, social, meetings, notes)
// in:contactId,supabase activities table out:Sorted activity feed with type icons,empty state if none err:Supabase select failure (silently not shown),contactId undefined (empty query)
// hazard: Activities fetched without pagination — 100+ activities cause unbounded query, slow render, high memory
// hazard: Activity type icons statically mapped — new backend types render without icon or throw
// edge:frontend/src/components/LogActivityModal.tsx -> RELATES
// edge:contact-timeline#1 -> STEP_IN
// prompt: Add pagination or cursor-based infinite scroll. Expand activity type icon map with fallback icon. Pass userId to filter own activities.
import { useEffect, useState } from 'react';
import { Phone, Mail, Share2, Calendar, FileText, MessageCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { logError } from '../lib/error-logger';

interface Activity {
  id: string;
  type: 'call' | 'email' | 'social' | 'meeting' | 'note';
  outcome: string | null;
  notes: string | null;
  created_at: string;
  duration_seconds: number | null;
}

interface ContactActivityTimelineProps {
  contactId: string;
  filterType?: 'call' | 'email' | 'social' | 'meeting' | 'note' | 'all';
  showAddNote?: boolean;
  onActivityLogged?: () => void;
}

const PAGE_SIZE = 20;

export default function ContactActivityTimeline({
  contactId,
  filterType = 'all',
  showAddNote = true,
  onActivityLogged,
}: ContactActivityTimelineProps) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(0);
  const [selectedFilter, setSelectedFilter] = useState<typeof filterType>(filterType);
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [noteText, setNoteText] = useState('');

  useEffect(() => {
    setPage(0);
    setActivities([]);
    loadActivities(0, true);
  }, [contactId, selectedFilter]);

  const loadActivities = async (pageNum: number, reset = false) => {
    if (reset) setLoading(true); else setLoadingMore(true);
    try {
      let query = supabase
        .from('activities')
        .select('id, type, outcome, notes, created_at, duration_seconds')
        .eq('contact_id', contactId)
        .order('created_at', { ascending: false })
        .range(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE - 1);

      if (selectedFilter !== 'all') {
        query = query.eq('type', selectedFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      const fetched = data || [];
      setActivities((prev) => reset ? fetched : [...prev, ...fetched]);
      setHasMore(fetched.length === PAGE_SIZE);
    } catch (err) {
      logError(err, 'ContactActivityTimeline.loadActivities');
    } finally {
      if (reset) setLoading(false); else setLoadingMore(false);
    }
  };

  const loadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    loadActivities(nextPage);
  };

  const handleAddNote = async () => {
    if (!noteText.trim()) return;

    try {
      // Get user's org_id for activity creation
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      const { data: userRecord } = await supabase
        .from('users')
        .select('org_id')
        .eq('id', userData.user.id)
        .single();

      if (!userRecord) throw new Error('User record not found');

      const { error } = await supabase.from('activities').insert({
        org_id: userRecord.org_id,
        contact_id: contactId,
        user_id: userData.user.id,
        type: 'note',
        outcome: 'other',
        notes: noteText,
      });

      if (error) throw error;

      setNoteText('');
      setIsAddingNote(false);
      loadActivities(0, true);
      onActivityLogged?.();
    } catch (err) {
      logError(err, 'ContactActivityTimeline.handleAddNote');
      alert('Failed to add note');
    }
  };

  const getTypeIcon = (type: Activity['type']) => {
    switch (type) {
      case 'call':
        return <Phone className="w-5 h-5 text-blue-600" />;
      case 'email':
        return <Mail className="w-5 h-5 text-green-600" />;
      case 'social':
        return <Share2 className="w-5 h-5 text-purple-600" />;
      case 'meeting':
        return <Calendar className="w-5 h-5 text-orange-600" />;
      case 'note':
        return <FileText className="w-5 h-5 text-gray-600" />;
      default:
        return <MessageCircle className="w-5 h-5 text-gray-600" />;
    }
  };

  const getOutcomeBadge = (type: Activity['type'], outcome: string | null) => {
    if (!outcome || type === 'note') return null;

    const outcomeColors: Record<string, string> = {
      connect: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      conversation: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      meeting_booked: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      voicemail: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      no_answer: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
      not_interested: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      follow_up: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      other: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
    };

    const colorClass = outcomeColors[outcome] || outcomeColors['other'];

    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${colorClass}`}>
        {outcome.replace(/_/g, ' ')}
      </span>
    );
  };

  const formatTimestamp = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;

    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    }).format(date);
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return null;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const truncateNotes = (notes: string | null, maxLength = 60) => {
    if (!notes) return '';
    return notes.length > maxLength ? `${notes.substring(0, maxLength)}...` : notes;
  };

  const parseNotes = (activity: Activity) => {
    if (activity.type === 'social' && activity.notes) {
      try {
        const parsed = JSON.parse(activity.notes);
        return {
          platform: parsed.platform || 'Unknown',
          activityType: parsed.activity_type || '',
          userNotes: parsed.user_notes || '',
        };
      } catch {
        return { platform: 'Unknown', activityType: '', userNotes: activity.notes };
      }
    }
    return null;
  };

  if (loading) {
    return (
      <div className="p-4">
        <p className="text-gray-500 dark:text-gray-400 text-sm">Loading activity timeline...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter Buttons */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setSelectedFilter('all')}
          className={`px-3 py-1 text-sm rounded-full ${
            selectedFilter === 'all'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
          }`}
        >
          All
        </button>
        <button
          onClick={() => setSelectedFilter('call')}
          className={`px-3 py-1 text-sm rounded-full ${
            selectedFilter === 'call'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
          }`}
        >
          Calls
        </button>
        <button
          onClick={() => setSelectedFilter('email')}
          className={`px-3 py-1 text-sm rounded-full ${
            selectedFilter === 'email'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
          }`}
        >
          Emails
        </button>
        <button
          onClick={() => setSelectedFilter('social')}
          className={`px-3 py-1 text-sm rounded-full ${
            selectedFilter === 'social'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
          }`}
        >
          Social
        </button>
        <button
          onClick={() => setSelectedFilter('meeting')}
          className={`px-3 py-1 text-sm rounded-full ${
            selectedFilter === 'meeting'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
          }`}
        >
          Meetings
        </button>
        <button
          onClick={() => setSelectedFilter('note')}
          className={`px-3 py-1 text-sm rounded-full ${
            selectedFilter === 'note'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
          }`}
        >
          Notes
        </button>
      </div>

      {/* Add Note Section */}
      {showAddNote && (
        <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
          {isAddingNote ? (
            <div className="space-y-2">
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Add a note about this contact..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none"
                rows={3}
              />
              <div className="flex gap-2">
                <button
                  onClick={handleAddNote}
                  disabled={!noteText.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Save Note
                </button>
                <button
                  onClick={() => {
                    setIsAddingNote(false);
                    setNoteText('');
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setIsAddingNote(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700"
            >
              <FileText className="w-4 h-4" />
              Add Note
            </button>
          )}
        </div>
      )}

      {/* Activity Timeline */}
      <div className="space-y-3">
        {activities.length === 0 ? (
          <div className="text-center py-8">
            <MessageCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400">
              {selectedFilter === 'all'
                ? 'No activities yet'
                : `No ${selectedFilter} activities yet`}
            </p>
          </div>
        ) : (
          activities.map((activity) => {
            const socialData = parseNotes(activity);

            return (
              <div
                key={activity.id}
                className="flex gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
              >
                {/* Icon */}
                <div className="flex-shrink-0 mt-1">{getTypeIcon(activity.type)}</div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-900 dark:text-white capitalize">
                        {activity.type}
                      </span>
                      {getOutcomeBadge(activity.type, activity.outcome)}
                      {activity.duration_seconds && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {formatDuration(activity.duration_seconds)}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
                      {formatTimestamp(activity.created_at)}
                    </span>
                  </div>

                  {/* Notes */}
                  {socialData ? (
                    <div className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                      <span className="font-medium">{socialData.platform}</span>
                      {socialData.activityType && (
                        <span className="text-gray-500 dark:text-gray-400">
                          {' '}
                          • {socialData.activityType}
                        </span>
                      )}
                      {socialData.userNotes && (
                        <p className="mt-1">{truncateNotes(socialData.userNotes)}</p>
                      )}
                    </div>
                  ) : (
                    activity.notes && (
                      <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                        {truncateNotes(activity.notes)}
                      </p>
                    )
                  )}
                </div>
              </div>
            );
          })
        )}

        {/* Load more */}
        {hasMore && (
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="w-full py-2 text-sm text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50"
          >
            {loadingMore ? 'Loading...' : 'Load more'}
          </button>
        )}
      </div>
    </div>
  );
}
