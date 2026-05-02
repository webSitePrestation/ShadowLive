'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Radio, LogOut, Users, Coins, Crown } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Avatar from '@/components/ui/Avatar';
import Badge from '@/components/ui/Badge';
import type { Profile, LiveSession } from '@/types';

interface SessionWithDomina extends LiveSession {
  profiles: Pick<Profile, 'id' | 'username' | 'avatar_url'> | null;
}

interface Props {
  profile: Profile;
  sessions: SessionWithDomina[];
}

export default function ExploreClient({ profile, sessions: initialSessions }: Props) {
  const [sessions, setSessions] = useState<SessionWithDomina[]>(initialSessions);
  const [balance, setBalance] = useState(profile.coins_balance);
  const router = useRouter();
  const supabase = createClient();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  // Realtime — nouveaux lives
  useEffect(() => {
    const channel = supabase
      .channel('live_sessions_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'live_sessions',
      }, async () => {
        const { data } = await supabase
          .from('live_sessions')
          .select('*, profiles!live_sessions_domina_id_fkey(id, username, avatar_url)')
          .eq('status', 'LIVE')
          .order('viewer_count', { ascending: false });
        setSessions(data ?? []);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  return (
    <div className="min-h-screen bg-[#080808]">
      {/* Header */}
      <div className="sticky top-0 z-10 glass border-b border-white/5 px-5 py-4">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <div>
            <h1 className="text-xl font-black tracking-[0.2em] text-gradient-red uppercase">Shadow</h1>
            <p className="text-[10px] tracking-[0.4em] text-gradient-gold uppercase -mt-0.5">Live</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 bg-yellow-900/20 border border-yellow-700/20 rounded-full px-3 py-1">
              <span className="text-sm">🪙</span>
              <span className="text-yellow-500 text-sm font-bold">{balance.toLocaleString()}</span>
            </div>
            <button
              onClick={handleSignOut}
              className="text-white/30 hover:text-white/70 transition-colors p-1"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-5 py-6 space-y-6">
        {/* Profil soumis */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="surface-luxury rounded-2xl p-5"
        >
          <div className="flex items-center gap-4">
            <Avatar username={profile.username} avatarUrl={profile.avatar_url} size="lg" />
            <div className="flex-1 min-w-0">
              <p className="font-bold text-white text-lg truncate">{profile.username}</p>
              <Badge variant="ghost" className="mt-1">🖤 SOUMIS</Badge>
            </div>
          </div>
        </motion.div>

        {/* Lives en cours */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="flex items-center justify-between mb-3 px-1">
            <p className="text-white/20 text-xs uppercase tracking-widest">Lives en cours</p>
            {sessions.length > 0 && (
              <Badge variant="live">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                {sessions.length} en direct
              </Badge>
            )}
          </div>

          <AnimatePresence mode="popLayout">
            {sessions.length === 0 ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-20 space-y-4"
              >
                <div className="w-16 h-16 rounded-full bg-white/3 flex items-center justify-center mx-auto">
                  <Radio size={28} className="text-white/10" />
                </div>
                <div className="space-y-1">
                  <p className="text-white/20 text-sm">Aucun live en cours</p>
                  <p className="text-white/10 text-xs">
                    Reviens plus tard ou attends une invitation
                  </p>
                </div>
              </motion.div>
            ) : (
              sessions.map((session, i) => (
                <motion.div
                  key={session.id}
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={{ delay: 0.05 * i }}
                  onClick={() => router.push(`/live/${session.id}`)}
                  className="surface-dark rounded-xl p-4 mb-2 cursor-pointer active-scale hover:border-red-900/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {/* Avatar Domina */}
                    <div className="relative shrink-0">
                      <Avatar
                        username={session.profiles?.username ?? '?'}
                        avatarUrl={session.profiles?.avatar_url}
                        size="md"
                      />
                      <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-red-500 border-2 border-[#111] animate-pulse" />
                    </div>

                    {/* Infos */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <Crown size={11} className="text-yellow-600/60 shrink-0" />
                        <p className="text-yellow-500/80 text-xs font-medium truncate">
                          {session.profiles?.username ?? 'Domina'}
                        </p>
                      </div>
                      <p className="text-white text-sm font-semibold truncate">{session.title}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="flex items-center gap-1 text-white/25 text-xs">
                          <Users size={10} />
                          {session.viewer_count} spectateurs
                        </span>
                      </div>
                    </div>

                    {/* Badge live */}
                    <Badge variant="live" className="shrink-0">● LIVE</Badge>
                  </div>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </motion.div>

        {/* Info pièces */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="surface-luxury rounded-2xl p-5"
        >
          <div className="flex items-center gap-3 mb-3">
            <span className="text-xl">🪙</span>
            <p className="text-white/40 text-xs uppercase tracking-widest">Ton solde</p>
          </div>
          <p className="text-3xl font-black text-gradient-gold">{balance.toLocaleString()}</p>
          <p className="text-white/20 text-xs mt-1">
            Utilise tes pièces pour récompenser les Dominas pendant les lives
          </p>
        </motion.div>
      </div>
    </div>
  );
}
