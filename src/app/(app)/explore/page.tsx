import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import ExploreClient from './ExploreClient';
import type { ExploreSessionWithDomina, FollowedDomina } from '@/types/explore';

const LIVE_SELECT = '*, profiles!live_sessions_domina_id_fkey(id, username, avatar_url)';

export default async function ExplorePage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('auth_user_id', user.id)
    .single();

  if (!profile) redirect('/login');

  if (profile.role === 'DOMINA' || profile.role === 'ADMIN') {
    redirect('/dashboard');
  }

  const { data: liveSessionsRaw } = await supabase
    .from('live_sessions')
    .select(LIVE_SELECT)
    .eq('status', 'LIVE')
    .order('viewer_count', { ascending: false });

  const liveSessionsList = liveSessionsRaw ?? [];
  const dominaIdsForLive = [...new Set(liveSessionsList.map((s) => s.domina_id))];

  const countMap = new Map<string, number>();
  const followedDominaSet = new Set<string>();
  if (dominaIdsForLive.length > 0) {
    const { data: followRows } = await supabase
      .from('follows')
      .select('following_id, follower_id')
      .in('following_id', dominaIdsForLive);
    for (const row of followRows ?? []) {
      countMap.set(row.following_id, (countMap.get(row.following_id) ?? 0) + 1);
      if (row.follower_id === profile.id) {
        followedDominaSet.add(row.following_id);
      }
    }
  }

  const liveSessions = liveSessionsList.map((s) => ({
    ...s,
    dominaFollowersCount: countMap.get(s.domina_id) ?? 0,
    followedByViewer: followedDominaSet.has(s.domina_id),
  })) as ExploreSessionWithDomina[];

  const { data: giftRows } = await supabase
    .from('coin_transactions')
    .select('receiver_id')
    .eq('sender_id', profile.id)
    .eq('type', 'GIFT');

  const rewardedDominaIds = [...new Set((giftRows ?? []).map((r) => r.receiver_id).filter(Boolean))] as string[];

  let pendingSessions: ExploreSessionWithDomina[] = [];
  if (rewardedDominaIds.length > 0) {
    const { data: pending } = await supabase
      .from('live_sessions')
      .select(LIVE_SELECT)
      .in('domina_id', rewardedDominaIds)
      .eq('status', 'PENDING')
      .order('created_at', { ascending: true })
      .limit(3);
    pendingSessions = (pending ?? []) as ExploreSessionWithDomina[];
  }

  const { data: myFollowRows } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', profile.id);

  const followingIds = [...new Set((myFollowRows ?? []).map((r) => r.following_id))];

  let followedDominas: FollowedDomina[] = [];
  if (followingIds.length > 0) {
    const { data: dominaProfiles } = await supabase
      .from('profiles')
      .select('id, username, avatar_url')
      .in('id', followingIds)
      .eq('role', 'DOMINA');

    const liveByDomina = new Map(liveSessions.map((s) => [s.domina_id, s.id]));

    followedDominas = (dominaProfiles ?? [])
      .map((p) => ({
        id: p.id,
        username: p.username,
        avatar_url: p.avatar_url,
        liveSessionId: liveByDomina.get(p.id) ?? null,
      }))
      .sort((a, b) => a.username.localeCompare(b.username, 'fr'));
  }

  return (
    <ExploreClient
      profile={profile}
      sessions={liveSessions}
      pendingSessions={pendingSessions}
      followedDominas={followedDominas}
    />
  );
}
