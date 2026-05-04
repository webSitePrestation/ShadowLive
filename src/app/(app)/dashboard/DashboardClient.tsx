'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Radio, LogOut, Users, Clock, ChevronRight, Sparkles, Shield, Settings2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Avatar from '@/components/ui/Avatar';
import type { Profile, LiveSession } from '@/types';

interface Props {
  profile: Profile;
  sessions: LiveSession[];
}

const MIN_GIFT_OPTIONS = [5, 10, 25, 50, 100] as const;
const MAX_GIFT_OPTIONS = [100, 200, 500, 1000, 5000] as const;
const COOLDOWN_OPTIONS = [0, 5, 10, 30, 60] as const;

export default function DashboardClient({ profile, sessions: initialSessions }: Props) {
  const [sessions, setSessions] = useState(initialSessions);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [minGiftIdx, setMinGiftIdx] = useState(1);
  const [maxGiftIdx, setMaxGiftIdx] = useState(2);
  const [cooldownIdx, setCooldownIdx] = useState(0);
  const [error, setError] = useState('');
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    setSessions(initialSessions);
  }, [initialSessions]);

  const refetchSessions = useCallback(async () => {
    const { data } = await supabase
      .from('live_sessions')
      .select('*')
      .eq('domina_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(10);
    setSessions((data ?? []) as LiveSession[]);
  }, [profile.id, supabase]);

  useEffect(() => {
    const channelName = `dashboard:live_sessions:${profile.id}`;
    const ch = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'live_sessions',
          filter: `domina_id=eq.${profile.id}`,
        },
        () => {
          void refetchSessions();
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') void refetchSessions();
      });
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [supabase, profile.id, refetchSessions]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const handleCreateSession = async () => {
    if (!title.trim()) return;
    setCreating(true);
    setError('');

    let minCoins: number = MIN_GIFT_OPTIONS[minGiftIdx];
    let maxCoins: number = MAX_GIFT_OPTIONS[maxGiftIdx];
    if (maxCoins < minCoins) {
      maxCoins = MAX_GIFT_OPTIONS.find((m) => m >= minCoins) ?? minCoins;
    }

    const { data, error } = await supabase
      .from('live_sessions')
      .insert({
        domina_id: profile.id,
        title: title.trim(),
        status: 'PENDING',
        agora_channel: crypto.randomUUID(),
        min_coins_per_gift: minCoins,
        max_coins_per_gift: maxCoins,
        cooldown_seconds: COOLDOWN_OPTIONS[cooldownIdx],
      })
      .select()
      .single();

    if (error) {
      setError(error.message);
      setCreating(false);
      return;
    }

    if (data) router.push(`/live/${data.id}`);
    setCreating(false);
  };

  const canCreateLive = profile.role === 'DOMINA' || profile.role === 'ADMIN';

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
            <Badge variant={profile.role === 'ADMIN' ? 'gold' : profile.role === 'DOMINA' ? 'red' : 'ghost'}>
              {profile.role}
            </Badge>
            {profile.role === 'ADMIN' && (
              <button
                onClick={() => router.push('/admin')}
                className="text-yellow-600/60 hover:text-yellow-500 transition-colors"
              >
                <Shield size={16} />
              </button>
            )}
            <button onClick={handleSignOut} className="text-white/30 hover:text-white/70 transition-colors p-1">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-5 py-6 space-y-6">
        {/* Profile card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="surface-luxury rounded-2xl p-5"
        >
          <div className="flex items-center gap-4">
            <Avatar username={profile.username} avatarUrl={profile.avatar_url} size="lg" />
            <div className="flex-1 min-w-0">
              <p className="font-bold text-white text-lg truncate">{profile.username}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-gradient-gold text-sm font-semibold">
                  {profile.coins_balance.toLocaleString()}
                </span>
                <span className="text-white/30 text-sm">pièces</span>
              </div>
            </div>
            <div className="text-2xl">
              {profile.role === 'ADMIN' ? '👑' : profile.role === 'DOMINA' ? '⛓️' : '🖤'}
            </div>
          </div>
        </motion.div>

        {/* Créer un live */}
        {canCreateLive && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <AnimatePresence mode="wait">
              {!showForm ? (
                <motion.div key="btn" exit={{ opacity: 0, scale: 0.97 }}>
                  <Button
                    variant="red"
                    size="lg"
                    fullWidth
                    onClick={() => setShowForm(true)}
                    className="glow-red py-4 text-base"
                  >
                    <Radio size={18} />
                    Nouveau Live
                  </Button>
                </motion.div>
              ) : (
                <motion.div
                  key="form"
                  initial={{ opacity: 0, scale: 0.97, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  className="surface-luxury rounded-2xl p-5 space-y-4"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Sparkles size={14} className="text-yellow-600" />
                    <p className="text-white/40 text-xs uppercase tracking-widest">Titre du live</p>
                  </div>
                  <input
                    autoFocus
                    type="text"
                    placeholder="Session privée..."
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleCreateSession()}
                    maxLength={80}
                    className="w-full bg-black/50 border border-white/8 rounded-xl px-4 py-3 text-white placeholder-white/15 focus:outline-none focus:border-yellow-700/40 transition-colors text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAdvanced((v) => !v)}
                    className="flex w-full items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-left text-yellow-600/90 text-xs font-semibold uppercase tracking-wide hover:border-yellow-800/40"
                  >
                    <span className="flex items-center gap-2">
                      <Settings2 size={14} className="shrink-0 opacity-80" />
                      Paramètres avancés
                    </span>
                    <ChevronRight
                      size={14}
                      className={`shrink-0 text-white/35 transition-transform ${showAdvanced ? 'rotate-90' : ''}`}
                    />
                  </button>
                  {showAdvanced && (
                    <div className="space-y-4 rounded-xl border border-white/8 bg-black/50 p-4">
                      <div>
                        <label className="block text-yellow-600/90 text-xs font-medium mb-2">
                          Don minimum : {MIN_GIFT_OPTIONS[minGiftIdx]} pièces
                        </label>
                        <input
                          type="range"
                          min={0}
                          max={MIN_GIFT_OPTIONS.length - 1}
                          step={1}
                          value={minGiftIdx}
                          onChange={(e) => setMinGiftIdx(Number(e.target.value))}
                          className="w-full h-2 cursor-pointer rounded-lg bg-black accent-red-600"
                          style={{ accentColor: '#dc2626' }}
                        />
                      </div>
                      <div>
                        <label className="block text-yellow-600/90 text-xs font-medium mb-2">
                          Don maximum : {MAX_GIFT_OPTIONS[maxGiftIdx]} pièces
                        </label>
                        <input
                          type="range"
                          min={0}
                          max={MAX_GIFT_OPTIONS.length - 1}
                          step={1}
                          value={maxGiftIdx}
                          onChange={(e) => setMaxGiftIdx(Number(e.target.value))}
                          className="w-full h-2 cursor-pointer rounded-lg bg-black accent-red-600"
                          style={{ accentColor: '#dc2626' }}
                        />
                      </div>
                      <div>
                        <label className="block text-yellow-600/90 text-xs font-medium mb-2">
                          Délai entre dons : {COOLDOWN_OPTIONS[cooldownIdx]}s
                          {COOLDOWN_OPTIONS[cooldownIdx] === 0 ? ' (illimité)' : ''}
                        </label>
                        <input
                          type="range"
                          min={0}
                          max={COOLDOWN_OPTIONS.length - 1}
                          step={1}
                          value={cooldownIdx}
                          onChange={(e) => setCooldownIdx(Number(e.target.value))}
                          className="w-full h-2 cursor-pointer rounded-lg bg-black accent-red-600"
                          style={{ accentColor: '#dc2626' }}
                        />
                      </div>
                    </div>
                  )}
                  {error && <p className="text-red-400 text-xs">{error}</p>}
                  <div className="flex gap-3">
                    <Button
                      variant="ghost"
                      size="md"
                      onClick={() => {
                        setShowForm(false);
                        setTitle('');
                        setError('');
                        setShowAdvanced(false);
                        setMinGiftIdx(1);
                        setMaxGiftIdx(2);
                        setCooldownIdx(0);
                      }}
                      className="flex-1"
                    >
                      Annuler
                    </Button>
                    <Button
                      variant="red"
                      size="md"
                      onClick={handleCreateSession}
                      disabled={creating || !title.trim()}
                      className="flex-1"
                    >
                      <Radio size={15} />
                      {creating ? 'Création...' : 'Lancer'}
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* Sessions */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <p className="text-white/20 text-xs uppercase tracking-widest mb-3 px-1">Sessions récentes</p>
          {sessions.length === 0 ? (
            <div className="text-center py-16 space-y-3">
              <Radio size={36} className="mx-auto text-white/10" />
              <p className="text-white/20 text-sm">Aucun live pour le moment</p>
            </div>
          ) : (
            <div className="space-y-2">
              {sessions.map((session, i) => (
                <motion.div
                  key={session.id}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 * i }}
                  onClick={() => router.push(session.status === 'ENDED' ? `/session/${session.id}` : `/live/${session.id}`)}
                  className="surface-dark rounded-xl p-4 cursor-pointer active-scale flex items-center gap-3 hover:border-yellow-800/20 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{session.title}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="flex items-center gap-1 text-white/25 text-xs">
                        <Users size={10} />
                        {session.viewer_count}
                      </span>
                      <span className="flex items-center gap-1 text-white/25 text-xs">
                        <Clock size={10} />
                        {new Date(session.created_at).toLocaleDateString('fr-FR')}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={
                      session.status === 'LIVE' ? 'live' :
                      session.status === 'PENDING' ? 'gold' : 'ghost'
                    }>
                      {session.status === 'LIVE' ? '● EN DIRECT' : session.status === 'PENDING' ? 'EN ATTENTE' : 'TERMINÉ'}
                    </Badge>
                    <ChevronRight size={14} className="text-white/20" />
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
