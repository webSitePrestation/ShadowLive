'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Radio, LogOut, UserCircle, Link2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Avatar from '@/components/ui/Avatar';
import Badge from '@/components/ui/Badge';
import LiveCard from '@/components/explore/LiveCard';
import { parseInviteJoinToken } from '@/lib/join-invite-parse';
import { usePushNotification } from '@/hooks/usePushNotification';
import type { Profile } from '@/types';
import type { ExploreSessionWithDomina, FollowedDomina } from '@/types/explore';

const LIVE_SELECT = '*, profiles!live_sessions_domina_id_fkey(id, username, avatar_url)';

interface Props {
  profile: Profile;
  sessions: ExploreSessionWithDomina[];
  pendingSessions: ExploreSessionWithDomina[];
  followedDominas: FollowedDomina[];
}

export default function ExploreClient({
  profile,
  sessions: initialSessions,
  pendingSessions: initialPending,
  followedDominas: initialFollowed,
}: Props) {
  const [sessions, setSessions] = useState(initialSessions);
  const [pendingSessions] = useState(initialPending);
  const [followedDominas, setFollowedDominas] = useState(initialFollowed);
  const [balance] = useState(profile.coins_balance);
  const [liveRemovedFlash, setLiveRemovedFlash] = useState<string | null>(null);
  const [joinInput, setJoinInput] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();
  const { supported: pushSupported, permission, requestPermission } = usePushNotification();

  useEffect(() => {
    try {
      const msg = sessionStorage.getItem('shadowlive_live_removed');
      if (msg) {
        sessionStorage.removeItem('shadowlive_live_removed');
        setLiveRemovedFlash(msg);
        const t = window.setTimeout(() => setLiveRemovedFlash(null), 6000);
        return () => window.clearTimeout(t);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const map = new Map(sessions.map((s) => [s.domina_id, s.id]));
    setFollowedDominas((prev) =>
      prev.map((d) => ({ ...d, liveSessionId: map.get(d.id) ?? null }))
    );
  }, [sessions]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const enrichLiveSessions = useCallback(
    async (rows: ExploreSessionWithDomina[]) => {
      const dominaIds = [...new Set(rows.map((s) => s.domina_id))];
      if (dominaIds.length === 0) {
        return rows.map((s) => ({
          ...s,
          dominaFollowersCount: 0,
          followedByViewer: false,
        }));
      }
      const { data: followRows } = await supabase
        .from('follows')
        .select('following_id, follower_id')
        .in('following_id', dominaIds);
      const countMap = new Map<string, number>();
      const followedSet = new Set<string>();
      for (const row of followRows ?? []) {
        countMap.set(row.following_id, (countMap.get(row.following_id) ?? 0) + 1);
        if (row.follower_id === profile.id) followedSet.add(row.following_id);
      }
      return rows.map((s) => ({
        ...s,
        dominaFollowersCount: countMap.get(s.domina_id) ?? 0,
        followedByViewer: followedSet.has(s.domina_id),
      }));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- client Supabase
    [profile.id]
  );

  const refetchLiveSessions = useCallback(async () => {
    const { data } = await supabase
      .from('live_sessions')
      .select(LIVE_SELECT)
      .eq('status', 'LIVE')
      .order('viewer_count', { ascending: false });
    const raw = (data ?? []) as ExploreSessionWithDomina[];
    const enriched = await enrichLiveSessions(raw);
    setSessions(enriched);
  }, [supabase, enrichLiveSessions]);

  useEffect(() => {
    const channel = supabase
      .channel('live_sessions_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'live_sessions',
        },
        () => {
          void refetchLiveSessions();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, refetchLiveSessions]);

  const handleJoinByLink = () => {
    setJoinError(null);
    const token = parseInviteJoinToken(joinInput);
    if (!token) {
      setJoinError('Colle un lien valide ou le code d’invitation.');
      return;
    }
    router.push(`/join/${encodeURIComponent(token)}`);
  };

  const goToDomina = (d: FollowedDomina) => {
    if (d.liveSessionId) {
      router.push(`/live/${d.liveSessionId}`);
    }
  };

  return (
    <div className="min-h-screen bg-[#080808] pb-10">
      <div className="sticky top-0 z-20 glass border-b border-white/5 px-4 py-3">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <div>
            <h1 className="text-lg font-black tracking-[0.18em] text-gradient-red uppercase">Shadow</h1>
            <p className="text-[9px] tracking-[0.35em] text-gradient-gold uppercase -mt-0.5">Découverte</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-yellow-900/20 border border-yellow-700/20 rounded-full px-2.5 py-1">
              <span className="text-sm">🪙</span>
              <span className="text-yellow-500 text-sm font-bold">{balance.toLocaleString()}</span>
            </div>
            <button
              type="button"
              onClick={() => router.push('/profile')}
              className="text-white/30 hover:text-white/70 transition-colors p-1"
            >
              <UserCircle size={18} />
            </button>
            <button
              type="button"
              onClick={() => void handleSignOut()}
              className="text-white/30 hover:text-white/70 transition-colors p-1"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </div>

      {pushSupported && permission === 'default' && (
        <div className="max-w-lg mx-auto px-4 pt-2">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-yellow-800/25 bg-yellow-950/20 px-3 py-2.5">
            <p className="text-[11px] text-white/75 leading-snug flex-1 min-w-0">
              🔔 Sois notifié quand une Domina démarre un live
            </p>
            <button
              type="button"
              onClick={() => void requestPermission()}
              className="shrink-0 px-3 py-1.5 rounded-lg bg-amber-600/90 text-black text-xs font-bold hover:bg-amber-500 transition-colors"
            >
              Activer
            </button>
          </div>
        </div>
      )}

      {pushSupported && permission === 'denied' && (
        <div className="max-w-lg mx-auto px-4 pt-2">
          <p className="text-[10px] text-center text-white/30">Notifications désactivées</p>
        </div>
      )}

      {liveRemovedFlash && (
        <div className="max-w-lg mx-auto px-4 pt-3">
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-amber-600/40 bg-amber-950/50 px-4 py-3 text-center text-sm text-amber-100"
          >
            {liveRemovedFlash}
          </motion.div>
        </div>
      )}

      <div className="max-w-lg mx-auto px-4 pt-4 space-y-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="surface-luxury rounded-2xl p-4 flex items-center gap-3"
        >
          <Avatar username={profile.username} avatarUrl={profile.avatar_url} size="md" />
          <div className="flex-1 min-w-0">
            <p className="font-bold text-white truncate">{profile.username}</p>
            <Badge variant="ghost" className="mt-0.5 text-[10px]">
              🖤 SOUMIS
            </Badge>
          </div>
        </motion.div>

        {/* Section 1 — En direct */}
        <section>
          <div className="flex items-center justify-between mb-3 px-0.5">
            <h2 className="text-white/90 text-sm font-bold tracking-wide">En direct maintenant</h2>
            {sessions.length > 0 && (
              <Badge variant="live" className="text-[10px]">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                {sessions.length}
              </Badge>
            )}
          </div>

          <AnimatePresence mode="popLayout">
            {sessions.length === 0 ? (
              <motion.div
                key="empty-live"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-14 space-y-3 rounded-2xl border border-white/5 bg-white/[0.02]"
              >
                <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center mx-auto">
                  <Radio size={26} className="text-white/12" />
                </div>
                <p className="text-white/25 text-sm">Aucun live pour l’instant</p>
                <p className="text-white/15 text-xs px-6">Reviens plus tard ou rejoins une Domina que tu suis</p>
              </motion.div>
            ) : (
              <div className="flex gap-3 overflow-x-auto pb-2 pt-1 -mx-1 px-1 snap-x snap-mandatory scrollbar-hide">
                {sessions.map((session, i) => (
                  <LiveCard
                    key={session.id}
                    session={session}
                    index={i}
                    variant="live"
                    onClick={() => router.push(`/live/${session.id}`)}
                  />
                ))}
              </div>
            )}
          </AnimatePresence>
        </section>

        {/* Section 2 — Dominas suivies (table follows) */}
        <section>
          <h2 className="text-white/90 text-sm font-bold tracking-wide mb-3 px-0.5">Dominas que tu suis</h2>
          {followedDominas.length === 0 ? (
            <p className="text-white/30 text-xs text-center px-2 py-6 rounded-xl border border-white/6 bg-white/[0.02]">
              Tu ne suis encore aucune Domina — rejoins un live pour commencer
            </p>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
              {followedDominas.map((d, i) => (
                <motion.button
                  key={d.id}
                  type="button"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => goToDomina(d)}
                  className="shrink-0 flex flex-col items-center gap-2 w-[76px] rounded-2xl border border-white/8 bg-white/[0.03] py-3 px-2 active-scale"
                >
                  <div className="relative">
                    <Avatar username={d.username} avatarUrl={d.avatar_url} size="md" />
                    {d.liveSessionId && (
                      <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-red-600 border-2 border-[#0a0a0a] animate-pulse" />
                    )}
                  </div>
                  <span className="text-[10px] text-white/80 font-medium truncate w-full text-center leading-tight">
                    {d.username}
                  </span>
                  {!d.liveSessionId && (
                    <Badge variant="ghost" className="text-[8px] px-1.5 py-0 border border-white/10 text-white/35">
                      Pas en live
                    </Badge>
                  )}
                </motion.button>
              ))}
            </div>
          )}
        </section>

        {/* Section 3 — Rejoindre par lien */}
        <section className="surface-luxury rounded-2xl p-4 border border-white/6">
          <div className="flex items-center gap-2 mb-3">
            <Link2 size={16} className="text-yellow-600/70" />
            <h2 className="text-white/90 text-sm font-bold tracking-wide">Rejoindre par lien</h2>
          </div>
          <p className="text-white/35 text-xs mb-3">
            Colle l’URL complète ou uniquement le code d’invitation.
          </p>
          <div className="flex gap-2">
            <input
              value={joinInput}
              onChange={(e) => {
                setJoinInput(e.target.value);
                setJoinError(null);
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleJoinByLink()}
              placeholder="https://…/join/… ou token"
              className="flex-1 min-w-0 bg-black/50 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-red-800/40"
            />
            <motion.button
              type="button"
              whileTap={{ scale: 0.96 }}
              onClick={handleJoinByLink}
              className="shrink-0 px-4 py-2.5 rounded-xl bg-red-800/80 border border-red-700/40 text-white text-sm font-bold"
            >
              Rejoindre
            </motion.button>
          </div>
          {joinError && <p className="text-red-400/90 text-xs mt-2">{joinError}</p>}
        </section>

        {/* Prochains lives (PENDING) */}
        {pendingSessions.length > 0 && (
          <section>
            <h2 className="text-white/90 text-sm font-bold tracking-wide mb-3 px-0.5">Bientôt chez tes Dominas</h2>
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x snap-mandatory scrollbar-hide">
              {pendingSessions.map((session, i) => (
                <LiveCard
                  key={session.id}
                  session={session}
                  index={i}
                  variant="pending"
                  onClick={() => router.push(`/live/${session.id}`)}
                />
              ))}
            </div>
          </section>
        )}

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="surface-luxury rounded-2xl p-5 border border-yellow-900/15"
        >
          <p className="text-white/40 text-xs uppercase tracking-widest mb-2">Ton solde</p>
          <p className="text-3xl font-black text-gradient-gold">{balance.toLocaleString()}</p>
          <p className="text-white/20 text-xs mt-2">
            Récompense les Dominas pendant les lives pour apparaître ici
          </p>
        </motion.div>
      </div>
    </div>
  );
}
