// @crumb frontend-arena-leaderboard
// UI | fetch_battle_stats | compute_ranks | render_leaderboard | navigate_back
// why: Display competitive sales leaderboard ranking reps by calls, emails, deals moved, and total activity score
// in:Supabase activities table(aggregated per user),useAuth,useNavigate out:leaderboard table sorted by total_activity,current user highlighted,loading skeleton err:Supabase query failure(network/auth),no stats returned(empty org activity)
// hazard: void-700 missing from tailwind.config.js — rank colour fallback uses undefined colour class
// edge:frontend/src/hooks/useAuth.ts -> CALLS
// edge:frontend/src/lib/supabase.ts -> CALLS
// edge:frontend/src/App.tsx -> RELATES
// edge:leaderboard#1 -> STEP_IN
// prompt: Add void-700 to tailwind.config.js. Consider real-time subscription for live leaderboard. Add time-range filter. Enforce org-scoped leaderboard.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy, Zap, Mail, Phone, TrendingUp, ArrowLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

interface BattleStats {
  user_id: string;
  user_name: string;
  calls_made: number;
  emails_sent: number;
  deals_moved: number;
  total_activity: number;
  rank: number;
}

export default function Arena() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<BattleStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadLeaderboard();
    }
  }, [user]);

  const loadLeaderboard = async () => {
    try {
      const { data: activities, error } = await supabase
        .from('activities')
        .select('user_id, type, users!activities_user_id_fkey(display_name)')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const userStats = new Map<string, BattleStats>();

      activities.forEach((activity: any) => {
        const userId = activity.user_id;
        const userName = activity.users?.display_name || 'Unknown';

        if (!userStats.has(userId)) {
          userStats.set(userId, {
            user_id: userId,
            user_name: userName,
            calls_made: 0,
            emails_sent: 0,
            deals_moved: 0,
            total_activity: 0,
            rank: 0,
          });
        }

        const stats = userStats.get(userId)!;
        if (activity.type === 'call') stats.calls_made++;
        if (activity.type === 'email') stats.emails_sent++;
        if (activity.type === 'pipeline_move') stats.deals_moved++;
        stats.total_activity++;
      });

      const sortedStats = Array.from(userStats.values())
        .sort((a, b) => b.total_activity - a.total_activity)
        .map((stat, index) => ({
          ...stat,
          rank: index + 1,
        }));

      setStats(sortedStats);
    } catch (error) {
      console.error('Failed to load leaderboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const getMedalColor = (rank: number) => {
    if (rank === 1) return 'text-yellow-400';
    if (rank === 2) return 'text-gray-400';
    if (rank === 3) return 'text-orange-400';
    return 'text-void-700';
  };

  const getMedalBg = (rank: number) => {
    if (rank === 1) return 'bg-yellow-500/10 border-yellow-500/20';
    if (rank === 2) return 'bg-gray-500/10 border-gray-500/20';
    if (rank === 3) return 'bg-orange-500/10 border-orange-500/20';
    return 'bg-void-800/40 border-void-700/20';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-void-950 via-void-900 to-void-800">
      <div className="border-b border-white/5 bg-void-950/50 backdrop-blur-xl">
        <div className="mx-auto max-w-6xl px-6 py-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="rounded-lg p-2 hover:bg-white/5 transition"
            >
              <ArrowLeft className="h-5 w-5 text-white/60" />
            </button>
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <Trophy className="h-6 w-6 text-cyan-neon" />
                <h1 className="text-2xl font-bold text-white">The Arena</h1>
              </div>
              <p className="mt-1 text-sm text-white/60">Battle stats for top performers</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-6 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex items-center gap-3 text-white/60">
              <div className="w-5 h-5 border-2 border-indigo-electric border-t-transparent rounded-full animate-spin" />
              Loading leaderboard...
            </div>
          </div>
        ) : stats.length === 0 ? (
          <div className="rounded-lg border border-white/10 bg-void-900/40 p-12 text-center">
            <Zap className="mx-auto h-8 w-8 text-white/30 mb-3" />
            <p className="text-white/60">No battle stats yet. Start logging activities!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {stats.slice(0, 3).length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                {stats[1] && (
                  <div className={`rounded-lg border ${getMedalBg(2)} p-6 text-center order-1`}>
                    <div className={`text-4xl font-bold ${getMedalColor(2)} mb-2`}>🥈</div>
                    <p className="text-white font-semibold">{stats[1].user_name}</p>
                    <div className="mt-4 space-y-2 text-sm">
                      <div className="flex items-center justify-center gap-2 text-white/70">
                        <Phone className="h-4 w-4" />
                        <span>{stats[1].calls_made} calls</span>
                      </div>
                      <div className="flex items-center justify-center gap-2 text-white/70">
                        <Mail className="h-4 w-4" />
                        <span>{stats[1].emails_sent} emails</span>
                      </div>
                      <div className="flex items-center justify-center gap-2 text-cyan-neon">
                        <TrendingUp className="h-4 w-4" />
                        <span className="font-semibold">{stats[1].deals_moved} deals</span>
                      </div>
                    </div>
                  </div>
                )}

                {stats[0] && (
                  <div className={`rounded-lg border ${getMedalBg(1)} p-6 text-center order-2 md:scale-105`}>
                    <div className={`text-5xl font-bold ${getMedalColor(1)} mb-2`}>🏆</div>
                    <p className="text-white font-bold text-lg">{stats[0].user_name}</p>
                    <p className="text-yellow-400/80 text-xs font-semibold mt-1">CHAMPION</p>
                    <div className="mt-4 space-y-2 text-sm">
                      <div className="flex items-center justify-center gap-2 text-white/70">
                        <Phone className="h-4 w-4" />
                        <span>{stats[0].calls_made} calls</span>
                      </div>
                      <div className="flex items-center justify-center gap-2 text-white/70">
                        <Mail className="h-4 w-4" />
                        <span>{stats[0].emails_sent} emails</span>
                      </div>
                      <div className="flex items-center justify-center gap-2 text-cyan-neon">
                        <TrendingUp className="h-4 w-4" />
                        <span className="font-semibold">{stats[0].deals_moved} deals</span>
                      </div>
                    </div>
                  </div>
                )}

                {stats[2] && (
                  <div className={`rounded-lg border ${getMedalBg(3)} p-6 text-center order-3`}>
                    <div className={`text-4xl font-bold ${getMedalColor(3)} mb-2`}>🥉</div>
                    <p className="text-white font-semibold">{stats[2].user_name}</p>
                    <div className="mt-4 space-y-2 text-sm">
                      <div className="flex items-center justify-center gap-2 text-white/70">
                        <Phone className="h-4 w-4" />
                        <span>{stats[2].calls_made} calls</span>
                      </div>
                      <div className="flex items-center justify-center gap-2 text-white/70">
                        <Mail className="h-4 w-4" />
                        <span>{stats[2].emails_sent} emails</span>
                      </div>
                      <div className="flex items-center justify-center gap-2 text-cyan-neon">
                        <TrendingUp className="h-4 w-4" />
                        <span className="font-semibold">{stats[2].deals_moved} deals</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="rounded-lg border border-white/10 bg-void-900/40 overflow-hidden">
              <table className="w-full">
                <thead className="border-b border-white/10 bg-void-900/80">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-white/80">Rank</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-white/80">Warrior</th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-white/80">
                      <div className="flex items-center justify-end gap-2">
                        <Phone className="h-4 w-4" />
                        Calls
                      </div>
                    </th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-white/80">
                      <div className="flex items-center justify-end gap-2">
                        <Mail className="h-4 w-4" />
                        Emails
                      </div>
                    </th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-cyan-neon">
                      <div className="flex items-center justify-end gap-2">
                        <TrendingUp className="h-4 w-4" />
                        Deals
                      </div>
                    </th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-white/80">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.map((stat) => (
                    <tr
                      key={stat.user_id}
                      className="border-t border-white/5 hover:bg-white/5 transition"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center">
                          <span className="text-lg font-bold text-white/60">{stat.rank}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-medium text-white">{stat.user_name}</p>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="text-white/80">{stat.calls_made}</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="text-white/80">{stat.emails_sent}</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="text-cyan-neon font-semibold">{stat.deals_moved}</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="font-semibold text-indigo-electric">{stat.total_activity}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
