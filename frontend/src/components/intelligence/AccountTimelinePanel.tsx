// @crumb frontend-component-account-timeline-panel
// UI/Intelligence | fetch_timeline_events | date_grouping | actor_resolution | pagination
// why: Chronological intelligence feed for an account — shows all timeline events grouped by date with actor attribution
// in:accountId,orgId,supabase timeline_events+users tables out:Date-grouped event cards with icons,actor names,relative timestamps,load-more pagination err:Supabase query failure (logged),missing events (empty state)
// hazard: Actor resolution does N+1 queries for user actors — batch fetch mitigates but unique actor set could grow
// hazard: Offset pagination can miss or duplicate events if new events are inserted between pages
// edge:frontend/src/components/intelligence/IntelligenceSignalsPanel.tsx -> RELATES
// edge:frontend/src/lib/supabase.ts -> CALLS
// edge:frontend/src/lib/error-logger.ts -> CALLS
// prompt: Consider cursor-based pagination to avoid offset drift. Cache actor names in a context or map to avoid re-fetching across re-renders.

import { useEffect, useState, useCallback } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  UserCheck,
  Link2,
  FileText,
  Zap,
  ClipboardCheck,
  Clock,
  Loader2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { logError } from '../../lib/error-logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AccountTimelinePanelProps {
  accountId: string;
  orgId: string;
}

interface TimelineEvent {
  id: string;
  event_type: string;
  title: string;
  body: string | null;
  actor_type: string | null;
  actor_id: string | null;
  created_at: string;
}

interface DateGroup {
  label: string;
  events: TimelineEventWithActor[];
}

interface TimelineEventWithActor extends TimelineEvent {
  actorName: string;
}

// ---------------------------------------------------------------------------
// Event type configuration
// ---------------------------------------------------------------------------

const EVENT_TYPE_CONFIG: Record<string, { icon: LucideIcon; color: string; label: string }> = {
  signal_created: { icon: Plus, color: 'text-emerald-500', label: 'Signal Added' },
  signal_updated: { icon: Edit2, color: 'text-blue-500', label: 'Signal Updated' },
  signal_deleted: { icon: Trash2, color: 'text-red-500', label: 'Signal Removed' },
  classification_changed: { icon: UserCheck, color: 'text-purple-500', label: 'Classification Changed' },
  engagement_event: { icon: Link2, color: 'text-indigo-500', label: 'Engagement' },
  research_note: { icon: FileText, color: 'text-amber-500', label: 'Research Note' },
  ai_suggestion: { icon: Zap, color: 'text-cyan-500', label: 'AI Suggestion' },
  framework_review: { icon: ClipboardCheck, color: 'text-teal-500', label: 'Framework Review' },
};

const PAGE_SIZE = 20;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getDateGroup(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function getRelativeTime(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function truncateBody(body: string | null, maxLength = 100): string {
  if (!body) return '';
  return body.length > maxLength ? `${body.substring(0, maxLength)}...` : body;
}

function groupEventsByDate(events: TimelineEventWithActor[]): DateGroup[] {
  const groupMap = new Map<string, TimelineEventWithActor[]>();

  for (const event of events) {
    const label = getDateGroup(event.created_at);
    const existing = groupMap.get(label);
    if (existing) {
      existing.push(event);
    } else {
      groupMap.set(label, [event]);
    }
  }

  return Array.from(groupMap.entries()).map(([label, groupEvents]) => ({
    label,
    events: groupEvents,
  }));
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AccountTimelinePanel({ accountId, orgId }: AccountTimelinePanelProps) {
  const [events, setEvents] = useState<TimelineEventWithActor[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);

  // Resolve actor names for user-type actors
  const resolveActorNames = useCallback(
    async (rawEvents: TimelineEvent[]): Promise<TimelineEventWithActor[]> => {
      const userActorIds = [
        ...new Set(
          rawEvents
            .filter((e) => e.actor_type === 'user' && e.actor_id)
            .map((e) => e.actor_id as string)
        ),
      ];

      let actorMap: Record<string, string> = {};

      if (userActorIds.length > 0) {
        try {
          const { data: users } = await supabase
            .from('users')
            .select('id, full_name')
            .in('id', userActorIds);

          if (users) {
            actorMap = Object.fromEntries(
              users.map((u: { id: string; full_name: string | null }) => [
                u.id,
                u.full_name || 'Unknown User',
              ])
            );
          }
        } catch (err) {
          logError(err, 'AccountTimelinePanel.resolveActorNames');
        }
      }

      return rawEvents.map((event) => {
        let actorName = 'System';
        if (event.actor_type === 'user' && event.actor_id) {
          actorName = actorMap[event.actor_id] || 'Unknown User';
        } else if (event.actor_type === 'ai') {
          actorName = 'AI';
        }
        return { ...event, actorName };
      });
    },
    []
  );

  const loadEvents = useCallback(
    async (currentOffset: number, append: boolean) => {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      try {
        const { data, error } = await supabase
          .from('timeline_events')
          .select('id, event_type, title, body, actor_type, actor_id, created_at')
          .eq('account_id', accountId)
          .eq('org_id', orgId)
          .order('created_at', { ascending: false })
          .range(currentOffset, currentOffset + PAGE_SIZE);

        if (error) throw error;

        const rawEvents: TimelineEvent[] = data || [];
        const resolved = await resolveActorNames(rawEvents);

        // If we got PAGE_SIZE + 1 results, there are more pages
        if (resolved.length > PAGE_SIZE) {
          setHasMore(true);
          resolved.pop();
        } else {
          setHasMore(false);
        }

        if (append) {
          setEvents((prev: TimelineEventWithActor[]) => [...prev, ...resolved]);
        } else {
          setEvents(resolved);
        }
      } catch (err) {
        logError(err, 'AccountTimelinePanel.loadEvents');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [accountId, orgId, resolveActorNames]
  );

  useEffect(() => {
    setOffset(0);
    setEvents([]);
    loadEvents(0, false);
  }, [accountId, orgId, loadEvents]);

  const handleLoadMore = () => {
    const newOffset = offset + PAGE_SIZE;
    setOffset(newOffset);
    loadEvents(newOffset, true);
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
        <span className="ml-2 text-sm text-gray-500 dark:text-white/40">Loading timeline...</span>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Clock className="w-10 h-10 text-gray-300 dark:text-white/20 mb-3" />
        <p className="text-sm text-gray-500 dark:text-white/40">
          No activity yet — add your first intelligence signal to start building the timeline
        </p>
      </div>
    );
  }

  const dateGroups = groupEventsByDate(events);

  return (
    <div>
      {dateGroups.map((group, groupIdx) => (
        <div key={group.label}>
          <h4
            className={`text-xs font-semibold text-gray-500 dark:text-white/40 uppercase tracking-wider mb-2 ${
              groupIdx === 0 ? '' : 'mt-4'
            }`}
          >
            {group.label}
          </h4>

          {group.events.map((event) => {
            const config = EVENT_TYPE_CONFIG[event.event_type] || {
              icon: Zap,
              color: 'text-gray-400',
              label: event.event_type,
            };
            const IconComponent = config.icon;

            return (
              <div
                key={event.id}
                className="flex gap-3 p-3 bg-white dark:bg-void-800/50 rounded-lg border border-gray-200 dark:border-white/10 mb-2"
              >
                {/* Icon */}
                <div className="w-8 h-8 rounded-full flex items-center justify-center bg-gray-100 dark:bg-white/10 flex-shrink-0">
                  <IconComponent className={`w-4 h-4 ${config.color}`} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {event.title}
                  </p>

                  {event.body && (
                    <p className="text-xs text-gray-500 dark:text-white/40 mt-0.5">
                      {truncateBody(event.body)}
                    </p>
                  )}

                  <p className="text-xs text-gray-400 dark:text-white/30 mt-1">
                    {event.actorName} &middot; {getRelativeTime(event.created_at)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      ))}

      {hasMore && (
        <button
          onClick={handleLoadMore}
          disabled={loadingMore}
          className="w-full py-2 text-sm text-indigo-electric hover:text-indigo-600 font-medium disabled:opacity-50"
        >
          {loadingMore ? 'Loading...' : 'Load more'}
        </button>
      )}
    </div>
  );
}
