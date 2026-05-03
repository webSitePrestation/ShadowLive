import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import StatsClient, {
  type AdminGlobalStats,
  type DailyActivity,
  type RecentCoinRow,
  type TopSessionRow,
} from './StatsClient';
import type { CoinTransaction, Profile } from '@/types';

type SessionRowWithDomina = {
  id: string;
  title: string;
  status: string;
  started_at: string | null;
  ended_at: string | null;
  domina_id: string;
  profiles?: { username: string } | { username: string }[] | null;
};

function utcDayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function last7UtcDayKeys(): string[] {
  const keys: string[] = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i));
    keys.push(utcDayKey(d));
  }
  return keys;
}

export default async function AdminStatsPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('auth_user_id', user.id)
    .single();

  if (!profile || profile.role !== 'ADMIN') redirect('/dashboard');

  const sevenDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();

  const [
    adminCount,
    dominaCount,
    soumisCount,
    liveNow,
    allSessionsCount,
    endedSessionsCount,
    coinRows,
    dominaProfiles,
    recentTxRaw,
    txsForDaily,
    sessionCoinRows,
  ] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'ADMIN'),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'DOMINA'),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'SOUMIS'),
    supabase.from('live_sessions').select('id', { count: 'exact', head: true }).eq('status', 'LIVE'),
    supabase.from('live_sessions').select('id', { count: 'exact', head: true }),
    supabase.from('live_sessions').select('id', { count: 'exact', head: true }).eq('status', 'ENDED'),
    supabase.from('coin_transactions').select('receiver_id, amount'),
    supabase.from('profiles').select('id, username, avatar_url').eq('role', 'DOMINA'),
    supabase
      .from('coin_transactions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('coin_transactions')
      .select('amount, created_at, type')
      .gte('created_at', sevenDaysAgo),
    supabase.from('coin_transactions').select('session_id, amount').not('session_id', 'is', null),
  ]);

  const byReceiver = new Map<string, number>();
  for (const row of coinRows.data ?? []) {
    const rid = row.receiver_id as string;
    const amt = Number(row.amount) || 0;
    byReceiver.set(rid, (byReceiver.get(rid) ?? 0) + amt);
  }

  const topDominas = (dominaProfiles.data ?? [])
    .map((p) => ({
      id: p.id,
      username: p.username,
      avatar_url: p.avatar_url,
      coinsReceived: byReceiver.get(p.id) ?? 0,
    }))
    .sort((a, b) => b.coinsReceived - a.coinsReceived)
    .slice(0, 5);

  const coinsTotalTransacted = (coinRows.data ?? []).reduce(
    (s, r) => s + (Number(r.amount) || 0),
    0
  );

  const stats: AdminGlobalStats = {
    usersByRole: {
      ADMIN: adminCount.count ?? 0,
      DOMINA: dominaCount.count ?? 0,
      SOUMIS: soumisCount.count ?? 0,
    },
    liveSessionsNow: liveNow.count ?? 0,
    sessionsTotal: allSessionsCount.count ?? 0,
    sessionsEnded: endedSessionsCount.count ?? 0,
    coinsTotalTransacted,
    topDominas,
  };

  const txList = (recentTxRaw.data ?? []) as CoinTransaction[];
  const profileIds = [...new Set(txList.flatMap((t) => [t.sender_id, t.receiver_id]))];
  let profileMap = new Map<string, Pick<Profile, 'id' | 'username' | 'avatar_url'>>();
  if (profileIds.length > 0) {
    const { data: profs } = await supabase
      .from('profiles')
      .select('id, username, avatar_url')
      .in('id', profileIds);
    profileMap = new Map((profs ?? []).map((p) => [p.id, p]));
  }

  const recentTransactions: RecentCoinRow[] = txList.map((t) => ({
    ...t,
    sender: profileMap.get(t.sender_id) ?? {
      id: t.sender_id,
      username: '?',
      avatar_url: null,
    },
    receiver: profileMap.get(t.receiver_id) ?? {
      id: t.receiver_id,
      username: '?',
      avatar_url: null,
    },
  }));

  const dayKeys = last7UtcDayKeys();
  const byDay = new Map<string, { count: number; total: number }>();
  for (const k of dayKeys) {
    byDay.set(k, { count: 0, total: 0 });
  }
  for (const row of txsForDaily.data ?? []) {
    const day = (row.created_at as string).slice(0, 10);
    if (!byDay.has(day)) continue;
    const cur = byDay.get(day)!;
    cur.count += 1;
    cur.total += Number(row.amount) || 0;
  }
  const maxTotal = Math.max(1, ...[...byDay.values()].map((v) => v.total));
  const dailyActivity: DailyActivity[] = dayKeys.map((date) => {
    const v = byDay.get(date)!;
    return {
      date,
      count: v.count,
      total: v.total,
      barPct: Math.round((v.total / maxTotal) * 100),
    };
  });

  const sumBySession = new Map<string, number>();
  for (const row of sessionCoinRows.data ?? []) {
    const sid = row.session_id as string;
    sumBySession.set(sid, (sumBySession.get(sid) ?? 0) + (Number(row.amount) || 0));
  }
  const top5Ids = [...sumBySession.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id]) => id);

  let topSessions: TopSessionRow[] = [];
  if (top5Ids.length > 0) {
    const { data: sessRows } = await supabase
      .from('live_sessions')
      .select('id, title, status, started_at, ended_at, domina_id, profiles!live_sessions_domina_id_fkey(username)')
      .in('id', top5Ids);

    const order = new Map(top5Ids.map((id, i) => [id, i]));
    topSessions = (sessRows ?? [])
      .map((s) => {
        const row = s as SessionRowWithDomina;
        const rawP = row.profiles;
        const dom = Array.isArray(rawP) ? rawP[0] : rawP;
        const totalCoins = sumBySession.get(row.id) ?? 0;
        let durationLabel = '—';
        if (row.started_at && row.ended_at) {
          const ms = new Date(row.ended_at).getTime() - new Date(row.started_at).getTime();
          const h = Math.floor(ms / 3600000);
          const m = Math.floor((ms % 3600000) / 60000);
          durationLabel = h > 0 ? `${h}h ${m}m` : `${m} min`;
        } else if (row.started_at) {
          durationLabel = 'En cours / sans fin';
        }
        return {
          id: row.id,
          title: row.title,
          status: row.status,
          started_at: row.started_at,
          ended_at: row.ended_at,
          domina_username: dom?.username ?? 'Domina',
          totalCoins,
          durationLabel,
        };
      })
      .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  }

  return (
    <StatsClient
      stats={stats}
      recentTransactions={recentTransactions}
      dailyActivity={dailyActivity}
      topSessions={topSessions}
    />
  );
}
